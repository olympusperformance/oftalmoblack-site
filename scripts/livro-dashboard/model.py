"""Agregados do livro, sem dados de visitantes ou compradores."""
import re
from collections import defaultdict
from datetime import datetime
from decimal import Decimal, InvalidOperation
from urllib.parse import urlparse, parse_qs
from zoneinfo import ZoneInfo

PRODUCTS=(199173,199893)
UTMS=('utm_source','utm_medium','utm_campaign','utm_content')

def origin(raw):
    clean={k:str(raw.get(k) or '') for k in UTMS}
    clean={k:v if re.fullmatch(r'[a-zA-Z0-9_-]{0,180}',v) else '' for k,v in clean.items()}
    match=re.fullmatch(r'direct-post-(\d{5,25})',clean['utm_content'])
    media=match.group(1) if match and clean['utm_source']=='ig' else None
    key='post:'+media if media else 'origin:'+'|'.join(clean.values()) if any(clean.values()) else 'unattributed'
    return {'key':key,'media_id':media,**{k.removeprefix('utm_'):v for k,v in clean.items()}}

def aggregate_traffic(rows):
    grouped={}
    for r in rows:
        u=urlparse(r['page_location'])
        if u.hostname not in ('oftalmoblack.com.br','www.oftalmoblack.com.br') or u.path not in ('/livro','/livro/'):continue
        if r['event'] not in ('page_view','begin_checkout'):continue
        day=datetime.strptime(r['date'],'%Y%m%d').date().isoformat()
        attribution=origin({k:v[0] for k,v in parse_qs(u.query).items() if k in UTMS})
        key=(day,attribution['key'])
        row=grouped.setdefault(key,{'date':day,**attribution,'views':0,'checkout_clicks':0})
        count=int(r['count'])
        if count<0:raise ValueError('negative_event_count')
        row['views' if r['event']=='page_view' else 'checkout_clicks']+=count
    return sorted(grouped.values(),key=lambda r:(r['date'],r['key']))

def aggregate_sales(sales,attributions,time_zone):
    grouped={};seen={}
    for s in sales:
        if int(s['product_id']) not in PRODUCTS:continue
        sid=int(s['id'])
        signature=tuple(str(s.get(k)) for k in ['status','paid_at','refunded_at','amount','currency','product_id'])
        if sid in seen:
            if seen[sid]!=signature:raise ValueError('conflicting_sale')
            continue
        seen[sid]=signature
        if s.get('status')!='paid' or not s.get('paid_at') or s.get('refunded_at'):continue
        if s.get('currency')!='BRL':raise ValueError('invalid_currency')
        try:
            amount=Decimal(str(s.get('amount')))
            if not amount.is_finite() or amount<=0 or amount*100!=(amount*100).to_integral_value():raise ValueError('invalid_amount')
            paid=datetime.fromisoformat(s['paid_at'].replace('Z','+00:00'))
            if paid.tzinfo is None:raise ValueError('missing_payment_timezone')
            day=paid.astimezone(ZoneInfo(time_zone)).date().isoformat()
        except (InvalidOperation,TypeError) as exc:raise ValueError('invalid_sale') from exc
        attr=attributions.get(sid) or {}
        if attr.get('product_id') and int(attr['product_id'])!=int(s['product_id']):attr={}
        attribution=origin(attr)
        key=(day,attribution['key'])
        row=grouped.setdefault(key,{'date':day,**attribution,'paid_sales':0,'revenue_cents':0,'attributed_sales':0})
        row['paid_sales']+=1
        row['revenue_cents']+=int(amount*100)
        row['attributed_sales']+=int(bool(attribution['media_id']))
    return sorted(grouped.values(),key=lambda r:(r['date'],r['key']))
