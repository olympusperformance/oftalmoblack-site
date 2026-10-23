"""Coleta read-only de GA4/Greenn; publica somente agregados no Admin."""
import json, os, re, sqlite3, subprocess, urllib.request, urllib.parse, urllib.error
from pathlib import Path
from datetime import datetime,timezone
from zoneinfo import ZoneInfo
from model import aggregate_traffic,aggregate_sales,PRODUCTS,UTMS

ROOT=Path(os.environ.get('BOOK_DASHBOARD_STATE','/var/lib/olympus-book-dashboard'))
START='2026-10-19'

def request(url,headers=None,body=None,method=None):
    data=None if body is None else json.dumps(body).encode()
    req=urllib.request.Request(url,data=data,headers=headers or {},method=method)
    with urllib.request.urlopen(req,timeout=45) as res:
        raw=res.read()
        return json.loads(raw) if raw else None

def sb(path,body=None,method=None):
    key=os.environ['SUPABASE_SERVICE_ROLE_KEY']
    return request(os.environ['SUPABASE_URL'].rstrip('/')+'/rest/v1/'+path,
      {'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json','Prefer':'return=representation' if path.startswith('rpc/') else 'resolution=merge-duplicates,return=minimal'},body,method)

def all_rows(table,select='*'):
    rows=[]
    for offset in range(0,100000,500):
        part=sb(table+'?select='+select+'&order='+('sale_id' if table=='book_sale_attributions' else 'media_id')+'&limit=500&offset='+str(offset))
        rows+=part
        if len(part)<500:return rows
    raise ValueError('row_limit')

def snapshot(source,payload=None,error=None):
    now=datetime.now(timezone.utc).isoformat()
    row={'source':source,'updated_at':now,'error':error}
    if payload is not None:row.update(payload=payload,last_success_at=now)
    # PATCH preserves the last successful payload when collection fails.
    if payload is None:
        previous=sb('book_dashboard_snapshots?source=eq.'+source+'&select=source')
        if previous:sb('book_dashboard_snapshots?source=eq.'+source,row,'PATCH');return
    sb('book_dashboard_snapshots?on_conflict=source',row,'POST')

def ga4():
    form=urllib.parse.urlencode({'client_id':os.environ['GA4_CLIENT_ID'],'client_secret':os.environ['GA4_CLIENT_SECRET'],'refresh_token':os.environ['GA4_REFRESH_TOKEN'],'grant_type':'refresh_token'}).encode()
    req=urllib.request.Request('https://oauth2.googleapis.com/token',data=form,headers={'Content-Type':'application/x-www-form-urlencoded'})
    with urllib.request.urlopen(req,timeout=30) as res:token=json.load(res)['access_token']
    filters=[{'filter':{'fieldName':'pagePath','inListFilter':{'values':['/livro/','/livro']}}},
      {'filter':{'fieldName':'eventName','inListFilter':{'values':['page_view','begin_checkout']}}}]
    body={'dateRanges':[{'startDate':START,'endDate':'today'}],
      'dimensions':[{'name':x} for x in ['date','pageLocation','eventName']],
      'metrics':[{'name':'eventCount'}],'dimensionFilter':{'andGroup':{'expressions':filters}},'limit':10000}
    rows=[];zone=None
    for offset in range(0,100000,10000):
        data=request('https://analyticsdata.googleapis.com/v1beta/properties/'+os.environ['GA4_PROPERTY_ID']+':runReport',
          {'Authorization':'Bearer '+token,'Content-Type':'application/json'},{**body,'offset':offset})
        zone=data.get('metadata',{}).get('timeZone') or zone
        for row in data.get('rows',[]):
            d=[v['value'] for v in row['dimensionValues']]
            rows.append({'date':d[0],'page_location':d[1],'event':d[2],'count':row['metricValues'][0]['value']})
        if offset+10000>=int(data.get('rowCount',0)):break
    else:raise ValueError('ga4_row_limit')
    if not zone:raise ValueError('ga4_missing_timezone')
    return {'rows':aggregate_traffic(rows),'time_zone':zone,'start_date':START,'end_date':datetime.now(ZoneInfo(zone)).date().isoformat(),'definition':'page_view and begin_checkout on /livro/'}

def sync_origins(sales,attrs,db_path=None,configured=None):
    """Read-only do receptor existente. Nunca cria cache ou importa venda de teste."""
    connected=configured if configured is not None else os.environ.get('BOOK_ORIGIN_CONNECTED')=='1'
    health={'webhook_active':False,'origin_conflicts':0,'origin_invalid':0}
    if not connected:return health
    path=Path(db_path or os.environ.get('BOOK_ORIGIN_DB_FILE','/var/lib/olympus-livro-notify/origins.sqlite3'))
    eligible={int(s['id']):int(s['product_id']) for s in sales if int(s['product_id']) in PRODUCTS}
    pending=[];latest=None
    db=sqlite3.connect(path.resolve().as_uri()+'?mode=ro',uri=True,timeout=5)
    try:
        for sid,pid,raw,received in db.execute('SELECT sale_id,product_id,metas,received_at FROM origins ORDER BY sale_id'):
            if sid not in eligible:continue
            if pid!=eligible[sid]:health['origin_invalid']+=1;continue
            try:
                meta=json.loads(raw)
                if not isinstance(meta,dict):raise ValueError('invalid_origin')
                clean={k:meta.get(k,'') for k in UTMS}
                if any(not isinstance(v,str) or not re.fullmatch(r'[A-Za-z0-9_-]{0,180}',v) for v in clean.values()):raise ValueError('invalid_origin')
            except (ValueError,TypeError):health['origin_invalid']+=1;continue
            if not any(clean.values()):continue
            old=attrs.get(sid) or {}
            if old.get('product_id') and int(old['product_id'])!=pid or any(old.get(k) and clean[k] and old[k]!=clean[k] for k in UTMS):
                health['origin_conflicts']+=1;continue
            latest=max(latest or '',received or '') or None
            # Complementar campos ausentes sem apagar origem já conferida.
            merged={k:clean[k] or old.get(k,'') for k in UTMS}
            if old and all(old.get(k,'')==merged[k] for k in UTMS):continue
            pending.append({'sale_id':sid,'product_id':pid,'origin_mode':'greenn_webhook',**merged})
    finally:db.close()
    for i in range(0,len(pending),100):
        batch=pending[i:i+100];stored=sb('rpc/book_merge_webhook_origins',{'p_rows':batch},'POST')
        if not isinstance(stored,list) or {int(r['sale_id']) for r in stored}!={r['sale_id'] for r in batch}:raise ValueError('invalid_origin_receipt')
        for row in stored:
            health['origin_conflicts']+=int(row.get('outcome')=='conflict')
            attrs[int(row['sale_id'])]={k:v for k,v in row.items() if k!='outcome'}
    health.update(webhook_active=True,origin_received_at=latest)
    return health

def greenn(zone):
    pat=Path(os.environ['GREENN_PAT_FILE']).read_text().strip()
    sales=[]
    for pid in PRODUCTS:
        for page in range(1,1001):
            params=urllib.parse.urlencode({'filter[product_id]':pid,'filter[paid_after]':START,'per_page':100,'page':page})
            data=request('https://apiadm.greenn.com.br/api/v1/sales?'+params,{'Authorization':'Bearer '+pat,'Accept':'application/json'})
            part=data.get('data')
            if not isinstance(part,list) or any(int(r['product_id'])!=pid for r in part):raise ValueError('greenn_invalid_product_filter')
            sales+=part
            last=data.get('meta',{}).get('last_page')
            if last is None:raise ValueError('greenn_missing_pagination')
            if page>=int(last):break
        else:raise ValueError('greenn_page_limit')
    attrs={int(a['sale_id']):a for a in all_rows('book_sale_attributions')}
    try:origin_health=sync_origins(sales,attrs)
    except Exception as e:origin_health={'webhook_active':False,'origin_error':'origins_'+type(e).__name__}
    return {'rows':aggregate_sales(sales,attrs,zone),'time_zone':zone,'start_date':START,
      'end_date':datetime.now(ZoneInfo(zone)).date().isoformat(),'definition':'paid, no refund, amount excluding shipping','attribution_mode':'greenn_webhook_with_verified_fallback',**origin_health}

def metadata(media_ids):
    existing={p['media_id'] for p in all_rows('book_publications')}
    pending=set(media_ids)-existing
    if not pending:return
    container=subprocess.check_output(['docker','ps','-q','--filter','name=sistema_black_n8n-db'],text=True).strip()
    sql="SELECT json_build_object('nodes',nodes,'staticData',\"staticData\") FROM workflow_entity WHERE id='rSJ8L2HC0Z7maNZd';"
    raw=subprocess.check_output(['docker','exec','-i',container,'sh','-c','psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -At'],input=sql,text=True)
    w=json.loads(raw)
    cfg={a['name']:a['value'] for n in w['nodes'] if n['name']=='Config' for a in n['parameters']['assignments']['assignments']}
    static=w.get('staticData') or {};static=json.loads(static) if isinstance(static,str) else static
    token=static.get('global',{}).get('igToken') or cfg['igToken']
    for mid in sorted(pending)[:50]:
        d=request(cfg['apiBase']+'/'+mid+'?fields=id,caption,permalink,timestamp',{'Authorization':'Bearer '+token})
        title=(d.get('caption') or 'Publicação '+mid).split('\n')[0][:180]
        sb('book_publications?on_conflict=media_id',{'media_id':mid,'title':title,'permalink':d.get('permalink'),'published_at':d.get('timestamp')},'POST')

def run():
    result={};payloads=[]
    previous=sb('book_dashboard_snapshots?source=eq.ga4&select=payload')
    zone=(previous[0]['payload'].get('time_zone') if previous else None) or 'America/Manaus'
    for name,fn in [('ga4',ga4),('greenn',lambda:greenn(zone))]:
        try:
            payload=fn()
            if name=='ga4':zone=payload['time_zone']
            snapshot(name,payload);payloads.append(payload);result[name]='ok'
        except Exception as e:
            error=name+'_http_'+str(e.code) if isinstance(e,urllib.error.HTTPError) else name+'_'+type(e).__name__
            snapshot(name,error=error);result[name]=error
    try:metadata({r['media_id'] for p in payloads for r in p['rows'] if r.get('media_id')})
    except Exception:result['publications']='metadata_pending'
    ROOT.mkdir(mode=0o700,parents=True,exist_ok=True)
    (ROOT/'health.json').write_text(json.dumps({'checked_at':datetime.now(timezone.utc).isoformat(),**result}))
    print(json.dumps(result))
    return 0 if all(result.get(k)=='ok' for k in ['ga4','greenn']) else 1

if __name__=='__main__':
    import fcntl
    ROOT.mkdir(mode=0o700,parents=True,exist_ok=True)
    with (ROOT/'collect.lock').open('a') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:raise SystemExit(0)
        raise SystemExit(run())
