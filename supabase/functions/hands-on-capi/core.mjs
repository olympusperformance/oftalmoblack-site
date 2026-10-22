export const SOURCE = 'https://oftalmoblack.com.br/hands-on-grau-zero/';
export const PIXEL = '919253591198015';
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const origins = new Set(['https://oftalmoblack.com.br','https://www.oftalmoblack.com.br']);
export const eventId = (id, name) => `hands-on:${id}:${name}`;
export async function sha(value) {
  const data = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(data)].map(b => b.toString(16).padStart(2,'0')).join('');
}
function fail(code, status=400) { throw Object.assign(new Error(code), {status}); }
function text(value, max=500, required=false) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || value.length>max || (required && !value.trim())) fail('invalid_input');
  return value.trim();
}
function one(value, choices) { if (!choices.includes(value)) fail('invalid_input'); return value; }
export function application(d) {
  if (!d || d.schema_version!==1 || d.produto!=='hands_on_grau_zero' || !UUID.test(d.request_id||'')) fail('invalid_input');
  const n={schema_version:1,produto:'hands_on_grau_zero',request_id:d.request_id};
  n.nome=text(d.nome,140,true); if(n.nome.length<2)fail('invalid_input');
  n.whatsapp=text(d.whatsapp,40,true);if(!/^\+?[\d\s().-]+$/.test(n.whatsapp))fail('invalid_input');
  n.whatsapp=n.whatsapp.replace(/\D/g,'');if(!/^\d{10,15}$/.test(n.whatsapp))fail('invalid_input');
  n.crm=text(d.crm,10,true);if(!/^\d{1,10}$/.test(n.crm))fail('invalid_input');
  n.uf=one(d.uf,'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
  n.experiencia_catarata=one(d.experiencia_catarata,['ainda_nao_opero','iniciando_supervisao','opero_autonomia']);
  if(!['string','number'].includes(typeof d.cirurgias_mes)||!/^\d+$/.test(String(d.cirurgias_mes)))fail('invalid_input');
  n.cirurgias_mes=Number(d.cirurgias_mes);if(n.cirurgias_mes>10000)fail('invalid_input');
  n.experiencia_lentes=one(d.experiencia_lentes,['ainda_nao_implanto','poucos_casos','regularmente']);
  n.oferta_premium=one(d.oferta_premium,['nao','alguns_casos','rotina']);
  n.clinica=one(d.clinica,['proprietario','socio','nao']);n.objetivo=text(d.objetivo,2000);
  for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','aid','fbclid','gclid'])n[key]=text(d[key]);
  for(const key of ['page','referrer']){
    n[key]=text(d[key],2048);
    if(n[key]&&!/^https?:\/\/[^\s/]+(?:\/[^\s]*)?$/i.test(n[key]))fail('invalid_input');
  }
  if(n.page && ![SOURCE,SOURCE+'index.html',SOURCE.replace('https://','https://www.')].includes(n.page))fail('invalid_page');
  return n;
}
export function matchingPhone(value) {
  const digits=String(value||'').replace(/\D/g,'');
  if(/^\d{12,15}$/.test(digits))return digits;
  if(/^\d{2}(?:9\d{8}|[2-8]\d{7})$/.test(digits)) {
    const ddds='11 12 13 14 15 16 17 18 19 21 22 24 27 28 31 32 33 34 35 37 38 41 42 43 44 45 46 47 48 49 51 53 54 55 61 62 63 64 65 66 67 68 69 71 73 74 75 77 79 81 82 83 84 85 86 87 88 89 91 92 93 94 95 96 97 98 99'.split(' ');
    if(ddds.includes(digits.slice(0,2)))return '55'+digits;
  }
  return '';
}
export async function metaEvent(name,id,context,req,now,phone='') {
  const user={};
  if(phone){const normalized=matchingPhone(phone);if(normalized)user.ph=[await sha(normalized)];}
  for(const key of ['fbp','fbc']) {
    const value=context?.[key];
    if(typeof value==='string'&&value.length<=500&&/^fb\.\d+\.\d+\.[A-Za-z0-9_.-]+$/.test(value))user[key]=value;
  }
  const ip=(req.headers.get('x-forwarded-for')||req.headers.get('cf-connecting-ip')||'').split(',')[0].trim();
  if(ip&&ip.length<=45&&/^[0-9a-f:.]+$/i.test(ip))user.client_ip_address=ip;
  const ua=(req.headers.get('user-agent')||'').slice(0,1000);if(ua)user.client_user_agent=ua;
  if(!Object.keys(user).length)fail('missing_matching');
  return {event_name:name,event_time:Math.floor(now/1000),event_id:eventId(id,name),action_source:'website',
    event_source_url:SOURCE,user_data:user,custom_data:{content_name:'Hands-on Grau Zero',content_category:'oftalmoblack_b2b'}};
}
export function createHandler(deps) {
  const {db,env,fetcher=fetch,clock=()=>Date.now(),background=p=>p.catch(()=>{})}=deps;
  const cors=origin=>({'Access-Control-Allow-Origin':origins.has(origin)?origin:'https://oftalmoblack.com.br',
    'Access-Control-Allow-Headers':'content-type,apikey,authorization,x-hogz-test',
    'Access-Control-Allow-Methods':'GET,POST,OPTIONS','Vary':'Origin','Cache-Control':'no-store'});
  const json=(body,status,origin)=>new Response(JSON.stringify(body),{status,headers:{...cors(origin),'Content-Type':'application/json'}});
  const secretEq=(a,b)=>{if(!a||!b||a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;};
  async function enqueue(event,hash,mode,testCode,sheetConfirmed) {
    const row={event_id:event.event_id,request_id:event.event_id.split(':')[1],event_name:event.event_name,payload_hash:hash,
      mode,sheet_confirmed:sheetConfirmed,event_payload:event,test_event_code:mode==='test'?testCode:null,status:mode==='qa'?'qa':'pending'};
    const saved=await db.insert(row);
    if(saved.payload_hash!==hash||saved.mode!==mode)fail('request_conflict',409);
    return saved;
  }
  async function dispatch() {
    const rows=await db.claim(10);const results=[];
    for(const row of rows){
      const body={data:[row.event_payload]};if(row.mode==='test')body.test_event_code=row.test_event_code;
      let status=null,receipt={},accepted=false,retry=true;
      try{
        const response=await fetcher(`https://graph.facebook.com/v25.0/${PIXEL}/events`,{method:'POST',headers:{Authorization:'Bearer '+env.metaToken,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
        status=response.status;const data=await response.json();
        accepted=response.ok&&data.events_received===1;
        receipt={events_received:data.events_received||0,messages:Array.isArray(data.messages)?data.messages:[],fbtrace_id:data.fbtrace_id||data.error?.fbtrace_id||null,error_code:data.error?.code||null,error_subcode:data.error?.error_subcode||null};
        retry=accepted||response.status>=500||response.status===429||data.error?.is_transient===true;
      }catch{receipt={error:'transport_unknown'};}
      const update={status:accepted?'accepted':retry?'pending':'blocked',last_http:status,receipt,lease_until:null,
        next_attempt_at:new Date(clock()+Math.min(21600000,60000*2**Math.min(row.attempts,8))).toISOString()};
      receipt.matching_keys=Object.keys(row.event_payload.user_data||{}).sort();
      if(accepted){update.accepted_at=new Date(clock()).toISOString();update.event_payload={...row.event_payload};delete update.event_payload.user_data;}
      await db.finish(row.event_id,row.attempts,update);
      results.push({event_id:row.event_id,status:update.status,http:status,receipt});
    }
    return results;
  }
  return async function handler(req){
    const origin=req.headers.get('origin')||'';
    if(req.method==='OPTIONS')return new Response(null,{status:origins.has(origin)?204:403,headers:cors(origin)});
    if(req.method==='GET')return json({ok:true,service:'hands-on-capi',version:1},200,origin);
    if(req.method!=='POST')return json({ok:false,error:'method'},405,origin);
    try{
      const raw=await req.text();if(raw.length>30000)fail('invalid_input',413);
      let d;try{d=JSON.parse(raw);}catch{fail('invalid_json');}
      if(!d||typeof d!=='object'||Array.isArray(d))fail('invalid_input');
      if(d.op==='dispatch'){
        if(!secretEq(req.headers.get('x-hogz-dispatch'),env.dispatchKey))fail('unauthorized',401);
        return json({ok:true,results:await dispatch()},200,origin);
      }
      if(!origins.has(origin)||!secretEq(req.headers.get('apikey'),env.anonKey))fail('unauthorized',403);
      const isTest=secretEq(req.headers.get('x-hogz-test'),env.testKey);
      if(d.test_event_code&&!isTest)fail('test_unauthorized',403);
      const testCode=isTest?text(d.test_event_code,80,true):'';
      if(isTest&&!/^TEST[A-Za-z0-9_-]+$/.test(testCode))fail('invalid_test_code');
      const mode=isTest?'test':(d.qa===true||String(d.utm_source||'').toLowerCase()==='qa'?'qa':'production');
      if(mode==='production'&&env.productionEnabled!==true)fail('unavailable',503);
      const ip=(req.headers.get('x-forwarded-for')||'unknown').split(',')[0].trim();
      const bucket=await sha(`${ip}:${Math.floor(clock()/300000)}:${d.op==='visit'?'visit':'application'}`);
      if(!await db.rate(bucket,d.op==='visit'?120:15))fail('rate_limited',429);
      if(d.op==='visit'){
        if(!UUID.test(d.page_id||''))fail('invalid_input');
        if(mode==='qa')return json({ok:true,tracking_mode:mode},200,origin);
        for(const name of ['PageView','ViewContent']){
          const event=await metaEvent(name,d.page_id,d.tracking,req,clock());
          await enqueue(event,await sha(`${d.page_id}:${name}`),mode,testCode,false);
        }
        if(!(isTest&&d.defer===true))background(dispatch());
        return json({ok:true,tracking_mode:mode},200,origin);
      }
      if(d.op&&d.op!=='application')fail('invalid_operation');
      const n=application(d),hash=await sha(JSON.stringify(n));
      const id=eventId(n.request_id,'Lead');let saved=await db.get(id);
      if(saved&&(saved.payload_hash!==hash||saved.mode!==mode))fail('request_conflict',409);
      if(!saved){
        const response=await fetcher(env.sheetEndpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8'},body:JSON.stringify(n),signal:AbortSignal.timeout(22000)});
        let ack;try{ack=await response.json();}catch{fail('sheet_unconfirmed',502);}
        if(!response.ok||ack.ok!==true||ack.request_id!==n.request_id)fail('sheet_unconfirmed',502);
        const event=await metaEvent('Lead',n.request_id,d.tracking,req,clock(),n.whatsapp);
        saved=await enqueue(event,hash,mode,testCode,true);
      }
      if(mode!=='qa'&&saved.status!=='accepted')background(dispatch());
      return json({ok:true,request_id:n.request_id,tracking_mode:mode,event_id:id},200,origin);
    }catch(error){
      const known=['invalid_input','invalid_page','invalid_json','missing_matching','request_conflict','test_unauthorized','invalid_test_code','unauthorized','invalid_operation','rate_limited','sheet_unconfirmed'];
      return json({ok:false,error:known.includes(error.message)?error.message:'unavailable'},error.status||503,origin);
    }
  };
}
