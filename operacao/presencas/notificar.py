"""Presenças 22-24/10: consulta restrita e avisos somente aos dois alvos autorizados.

SQLite reserva antes de enviar. POST de resultado incerto nunca é repetido sem
reconciliação pela API. Não modifica a presença nem qualquer instância/webhook.
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import time
import urllib.request
import urllib.error
import urllib.parse
from zoneinfo import ZoneInfo

INSTANCE='felipe-tester'
ALLOWED={'9750':{'140815603118310@lid','559285909750@s.whatsapp.net'},'felipe':{'559281381810@s.whatsapp.net','5592981381810@s.whatsapp.net'}}
ENDPOINT='https://zpyxnkuvircukjlfexrv.supabase.co/functions/v1/black-presencas-lista'

def now():return datetime.now(timezone.utc).isoformat()

def text(row):
    day=datetime.strptime(row['dia'],'%Y-%m-%d').strftime('%d/%m/%Y')
    stamp=row['registrada_em'].replace('Z','+00:00')
    pattern='%Y-%m-%dT%H:%M:%S.%f%z' if '.' in stamp else '%Y-%m-%dT%H:%M:%S%z'
    hour=datetime.strptime(stamp,pattern).astimezone(ZoneInfo('America/Sao_Paulo')).strftime('%Hh%M')
    return 'Presença registrada · Imersão Black\n\nNome informado: '+row['nome']+'\nDia: '+day+'\nHorário: '+hour+', horário de Brasília.\n\nConfirmação feita pelo participante na ficha do evento.'

def records(value):
    if isinstance(value,dict):
        if isinstance(value.get('key'),dict) and 'id' in value['key']:yield value
        for v in value.values():yield from records(v)
    elif isinstance(value,list):
        for v in value:yield from records(v)

def message_text(item):
    m=item.get('message',{})
    return m.get('conversation',m.get('extendedTextMessage',{}).get('text',''))

def matches(item,destination,content):
    k=item.get('key',{})
    return k.get('fromMe') is True and (k.get('remoteJid') in ALLOWED[destination] or k.get('remoteJidAlt') in ALLOWED[destination]) and message_text(item)==content

def call(url,headers,body=None,timeout=25):
    payload=None if body is None else json.dumps(body,ensure_ascii=False).encode()
    req=urllib.request.Request(url,data=payload,headers={**headers,'Content-Type':'application/json'},method='GET' if body is None else 'POST')
    with urllib.request.urlopen(req,timeout=timeout) as response:return json.load(response)

def connect(file):
    db=sqlite3.connect(file);db.row_factory=sqlite3.Row
    db.execute('create table if not exists notifications (presence_id text not null, destination text not null, content text not null, state text not null default "pending", message_id text, attempted_at text, verified_at text, last_checked_at text, error_type text, primary key(presence_id,destination))')
    if 'last_checked_at' not in [r[1] for r in db.execute('pragma table_info(notifications)')]:db.execute('alter table notifications add column last_checked_at text')
    db.commit();os.chmod(file,0o600);return db

def enqueue(db,rows):
    for row in rows:
        if row['dia'] not in ['2026-10-22','2026-10-23','2026-10-24']:continue
        content=text(row)
        for dest in ALLOWED:
            db.execute('insert or ignore into notifications(presence_id,destination,content) values(?,?,?)',(row['id'],dest,content))
    db.commit()

def process(db,evo,max_messages=30):
    # Excludes verified rows; an uncertain POST is reconciled, never resent.
    pending_budget=max(1,max_messages*2//3)
    rows=db.execute('select * from notifications where state="pending" order by rowid limit ?',(pending_budget,)).fetchall()
    rows+=db.execute('select * from notifications where state not in ("pending","verified") order by coalesce(last_checked_at,""),rowid limit ?',(max_messages-pending_budget,)).fetchall()
    for row in rows:
        dest=row['destination'];jid='140815603118310@lid' if dest=='9750' else '559281381810@s.whatsapp.net'
        mid=row['message_id']
        if row['state']=='pending':
            claim=db.execute('update notifications set state="attempting",attempted_at=?,error_type=null where presence_id=? and destination=? and state="pending"',(now(),row['presence_id'],dest));db.commit()
            if claim.rowcount!=1:continue
            try:
                result=evo('/message/sendText/'+INSTANCE,{'number':jid,'text':row['content']})
                key=result.get('key',{});mid=key.get('id')
                if not mid or key.get('fromMe') is not True or key.get('remoteJid') not in ALLOWED[dest]:raise ValueError('unconfirmed_ack')
                db.execute('update notifications set state="accepted",message_id=? where presence_id=? and destination=?',(mid,row['presence_id'],dest));db.commit()
            except Exception:
                # Could have reached Evolution. Reconcile by ID or exact text.
                db.execute('update notifications set error_type="send_outcome_unknown" where presence_id=? and destination=?',(row['presence_id'],dest));db.commit()
        try:
            db.execute('update notifications set last_checked_at=? where presence_id=? and destination=?',(now(),row['presence_id'],dest));db.commit()
            query={'where':{'key':{'id':mid}},'limit':5} if mid else {'where':{'key':{'remoteJid':jid,'fromMe':True}},'limit':100}
            found=[m for m in records(evo('/chat/findMessages/'+INSTANCE,query)) if matches(m,dest,row['content']) and (not mid or m['key']['id']==mid)]
            ids={m['key']['id'] for m in found}
            if len(ids)==1:
                db.execute('update notifications set state="verified",message_id=?,verified_at=?,error_type=null where presence_id=? and destination=?',(next(iter(ids)),now(),row['presence_id'],dest));db.commit()
            else:
                db.execute('update notifications set error_type="readback_pending" where presence_id=? and destination=?',(row['presence_id'],dest));db.commit()
        except Exception:
            db.execute('update notifications set error_type="readback_unavailable" where presence_id=? and destination=?',(row['presence_id'],dest));db.commit()
        time.sleep(.7)
    return dict(db.execute('select state,count(*) from notifications group by state').fetchall())

def run(config_file,db_file):
    if datetime.now(timezone.utc)>=datetime(2026,10,25,3,0,tzinfo=timezone.utc):
        print(json.dumps({'status':'event_window_ended'}));return 0
    config=json.loads(Path(config_file).read_text())
    env={}
    for line in Path('/root/.secrets/evolution.env').read_text().splitlines():
        if line.startswith('EVOLUTION_KEY='):env['key']=line.split('=',1)[1].strip().strip('\"').strip("'")
    if not env.get('key'):raise RuntimeError('evolution_not_configured')
    evo=lambda path,body=None:call('http://127.0.0.1:8080'+path,{'apikey':env['key']},body)
    if evo('/instance/connectionState/'+INSTANCE).get('instance',{}).get('state')!='open':raise RuntimeError('evolution_disconnected')
    fetched=evo('/instance/fetchInstances?instanceName='+INSTANCE)
    items=fetched if isinstance(fetched,list) else fetched.get('instances',[fetched])
    identity=[e.get('instance',e) for e in items];identity=[e for e in identity if e.get('name',e.get('instanceName'))==INSTANCE]
    if len(identity)!=1 or identity[0].get('ownerJid',identity[0].get('owner')) not in ALLOWED['felipe']:raise RuntimeError('sender_identity_unconfirmed')
    result=call(ENDPOINT,{'x-presenca-view-key':config['view_key']},{})
    if result.get('ok') is not True or not isinstance(result.get('presencas'),list):raise RuntimeError('list_unconfirmed')
    db=connect(db_file)
    try:
        enqueue(db,result['presencas']);counts=process(db,evo)
        print(json.dumps({'at':now(),'counts':counts,'registered':len(result['presencas'])}))
        return 0 if not db.execute('select 1 from notifications where state != "verified" limit 1').fetchone() else 1
    finally:db.close()

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--config',default='/etc/olympus-presencas/config.json');parser.add_argument('--db',default='/var/lib/olympus-presencas/notificacoes.sqlite');parser.add_argument('--failure-alert',action='store_true');args=parser.parse_args()
    if args.failure_alert:
        state=Path('/var/lib/olympus-presencas/ultimo-alerta')
        if not state.exists() or time.time()-state.stat().st_mtime>=3600:
            subprocess.run(['systemctl','start','norte-notify-fail@olympus-presencas.service'],check=True);state.touch()
        raise SystemExit(0)
    try:raise SystemExit(run(args.config,args.db))
    except Exception as error:print(json.dumps({'error_type':type(error).__name__}));raise SystemExit(1)
