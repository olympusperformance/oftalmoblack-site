import {QUESTIONS,validateIdentity,validateAnswer} from './application-model.js';

const acquisitionKeys=['utm_source','utm_medium','utm_campaign','utm_content','utm_term','aid','fbclid','gclid','gbraid','wbraid'];
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const clean=value=>typeof value==='string'?value.trim():'';
const safePage=value=>{
  try {const url=new URL(value);return ['https:','http:'].includes(url.protocol)?(url.origin+url.pathname).slice(0,2000):'';} catch {return '';}
};

export function createApplicationPayload(state,{href='',referrer=''}={}) {
  const identity=state.identity||{},answers=state.answers||{};
  const errors={...validateIdentity(identity)};
  for(let step=0;step<QUESTIONS.length;step++)Object.assign(errors,validateAnswer(step,answers));
  if(Object.keys(errors).length)throw new Error('invalid_application');
  let params;
  try {params=new URL(href).searchParams;} catch {params=new URLSearchParams();}
  return {
    schema_version:1,produto:'hands_on_grau_zero',
    nome:clean(identity.nome),whatsapp:clean(identity.whatsapp).replace(/\D/g,''),
    crm:clean(answers.crm),uf:answers.uf,
    experiencia_catarata:answers.experiencia_catarata,cirurgias_mes:Number(answers.cirurgias_mes),
    experiencia_lentes:answers.experiencia_lentes,oferta_premium:answers.oferta_premium,
    clinica:answers.clinica,objetivo:clean(answers.objetivo),
    ...Object.fromEntries(acquisitionKeys.map(key=>[key,(params.get(key)||'').slice(0,500)])),
    page:safePage(href),referrer:safePage(referrer)
  };
}

export function createApplicationSubmitter({endpoint,key,context=()=>({}),qa=false,
  fetcher=globalThis.fetch,randomUUID=()=>globalThis.crypto.randomUUID(),
  setTimer=globalThis.setTimeout,clearTimer=globalThis.clearTimeout,onProgress=()=>{}}={}) {
  let active=null,receipt=null,retry=null;
  const progress=(action,extra={})=>{try {onProgress(action,extra);} catch { /* Analytics cannot interrupt the application. */ }};
  async function send(payload) {
    let controller,timer,errorType='unconfirmed';
    try {
      const url=new URL(endpoint);
      const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
      if(!key || (url.protocol!=='https:' && !(url.protocol==='http:' && loopback)))throw new Error('invalid_receiver');
      const isQA=qa===true || clean(payload.utm_source).toLowerCase()==='qa';
      const signature=JSON.stringify({...payload,qa:isQA});
      if(!retry || retry.signature!==signature) {
        const id=randomUUID();
        if(!uuid.test(id))throw new Error('invalid_request_id');
        // Freeze the wire body for retries, including the original browser context.
        retry={signature,id,qa:isQA,body:JSON.stringify({...payload,request_id:id,tracking:context(),qa:isQA})};
      }
      controller=new AbortController();timer=setTimer(()=>controller.abort(),30000);
      progress('submit');errorType='network';
      const response=await fetcher(url.href,{
        method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8',apikey:key},
        body:retry.body,signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',redirect:'follow'
      });
      if(!response.ok){errorType='http';throw new Error('http_error');}
      errorType='unconfirmed';
      const result=await response.json();
      if(result?.ok!==true || result.request_id!==retry.id || !['applied','review'].includes(result.crm_status))throw new Error('unconfirmed');
      receipt={ok:true,request_id:retry.id,tracking_mode:retry.qa?'qa':(['qa','test'].includes(result.tracking_mode)?result.tracking_mode:'production')};
      if(['applied','review'].includes(result.crm_status))receipt.crm_status=result.crm_status;
      return receipt;
    } catch {
      const error_type=controller?.signal.aborted?'timeout':errorType;
      progress('error',{error_type});return {ok:false,error_type};
    } finally {if(timer!==undefined)clearTimer(timer);}
  }
  return {
    get pending(){return active!==null;},get completed(){return receipt!==null;},
    submit(payload) {
      if(active)return active;
      if(receipt)return Promise.resolve(receipt);
      active=send(payload).finally(()=>{active=null;});
      return active;
    }
  };
}
