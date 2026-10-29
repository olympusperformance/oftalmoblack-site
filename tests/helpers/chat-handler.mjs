import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';

export const MEMBER = '11111111-1111-4111-8111-111111111111';
export const OTHER = '22222222-2222-4222-8222-222222222222';
export const farolFixture = () => ({
  status:'ready', member_id:MEMBER, clinic:{id:'clinic',name:'Clínica exemplo',timezone:'America/Manaus'},
  period:{preset:'last30days',date_start:'2026-09-29',date_end:'2026-10-28',days:30,
    start:'2026-09-29T04:00:00.000Z',end:'2026-10-29T03:59:59.999Z'},
  updated_at:'2026-10-28T18:00:00Z',
  funnel:{status:'ready',data:{periodo:{novos:100,agendadas:20,realizadas:14,indicacoes:6,cirurgias:2,perdidos:3},
    anterior:{novos:80,agendadas:22,realizadas:10,indicacoes:4,cirurgias:1,perdidos:0},
    trilha_desde:'2026-01-01',dados_desde:'2026-01-01'}},
  commercial:{data:{total:99999}}, finance:{patient_name:'DO NOT PASS TO MODEL'},
});

// Only network/database boundaries are doubled; execute the real HTTP handler.
export async function setupChat({model,farol=farolFixture(),farolStatus=200}={}) {
  const file = new URL('../../supabase/functions/cerebro-chat/index.ts',import.meta.url);
  let raw = await readFile(file,'utf8'), handler;
  const calls=[], logs=[];
  const db={auth:{getUser:async()=>({data:{user:{id:'actor'}}})},
    from(table){const filters={};const q={select(){return q;},eq(k,v){filters[k]=v;return q;},
      maybeSingle:async()=>({data:table==='app_admins'?{user_id:'actor'}:{id:filters.id||MEMBER,nome:'Pessoa exemplo'}})};return q;},
    rpc(name,args){return {abortSignal:async()=>({data:name==='cerebro_clinica_do_membro'
      ?[{clinic_id:'clinic',clinica:'Clínica exemplo'}]:[]})};}};
  const context={Request,Response,Headers,URL,AbortController,AbortSignal,TextEncoder,TextDecoder,
    ReadableStream,crypto:globalThis.crypto,setTimeout,clearTimeout,setInterval,clearInterval,
    console:{error:(...args)=>logs.push(args),warn:(...args)=>logs.push(args),info:(...args)=>logs.push(args)},
    Deno:{env:{get:key=>({SUPABASE_URL:'https://site.test',CRM_URL:'https://crm.test'}[key]||'fixture-secret')},serve:fn=>handler=fn},
    createClient:()=>db,
    fetch:async(url,options)=>{
      const body=JSON.parse(options.body); calls.push({url,body,headers:options.headers});
      if(url==='https://api.anthropic.com/v1/messages') return model(body,calls);
      if(url==='https://api.openai.com/v1/embeddings') return Response.json({data:[{embedding:Array(1536).fill(0)}]});
      if(url==='https://site.test/functions/v1/farol-metricas') return Response.json(farol,{status:farolStatus});
      if(url==='https://crm.test/rest/v1/rpc/cerebro_metricas') return Response.json([{leads:130,agendamentos:30,compareceram:25,faltaram:1,taxa_comparecimento:96.2}]);
      throw new Error('Unexpected network target: '+url);
    }};
  for(const match of raw.matchAll(/^import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/gm)) {
    if(!match[2].startsWith('.')) continue;
    const module=await import(new URL(match[2],file));
    for(const name of match[1].split(',').map(s=>s.trim())) context[name]=module[name];
  }
  raw=raw.replace(/^import\b[\s\S]*?;\s*/gm,'');
  vm.runInNewContext(stripTypeScriptTypes(raw,{mode:'transform'}),context);
  return {calls,logs,ask:(history=[],question='Pergunta',extra={})=>handler(new Request('https://site.test/chat',{
    method:'POST',headers:{Authorization:'Bearer user-token','Content-Type':'application/json'},
    body:JSON.stringify({pergunta:question,historico:history,member_id:MEMBER,...extra})}))};
}
export const answer=text=>Response.json({stop_reason:'end_turn',content:[{type:'text',text}]});
export const tool=(name,input={},id='tool')=>Response.json({stop_reason:'tool_use',content:[{type:'tool_use',name,input,id}]});
