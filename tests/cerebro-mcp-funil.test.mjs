import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {pedidoDePeriodo,funilDaClinica,textoDoFunil,textoDeTodas} from '../supabase/functions/cerebro-mcp/funil.mjs';

const raw=await readFile(new URL('../supabase/functions/farol-metricas/periodo.ts',import.meta.url),'utf8');
const periodo=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(raw,{mode:'transform'})).toString('base64'));
const AGORA=new Date('2026-10-28T19:18:00Z');
const CLINICA={id:'clinic',name:'Clínica exemplo',timezone:'America/Manaus'};
const BRUTO={periodo:{novos:100,agendadas:20,realizadas:14,indicacoes:6,cirurgias:2,perdidos:3},
  anterior:{novos:80,agendadas:22,realizadas:10,indicacoes:4,cirurgias:1,perdidos:0},trilha_desde:'2026-01-01',dados_desde:'2026-01-01'};

test('pedido de período segue o contrato do chat: dias vira days, datas viram custom',()=>{
  assert.deepEqual(pedidoDePeriodo({dias:7}),{days:7});
  assert.deepEqual(pedidoDePeriodo({}),{days:30});
  assert.deepEqual(pedidoDePeriodo({inicio:'2026-10-01',fim:'2026-10-20'}),{preset:'custom',from:'2026-10-01',to:'2026-10-20'});
});

test('funil da clínica usa get_funil_metrics com o mesmo recorte zonado do Farol',async()=>{
  const chamadas=[];
  const r=await funilDaClinica({clinica:CLINICA,args:{dias:30},agora:AGORA,resolverPeriodo:periodo.resolveRequestedPeriod,
    rpcDoCrm:async(nome,corpo)=>{chamadas.push({nome,corpo});return BRUTO;}});
  assert.equal(chamadas[0].nome,'get_funil_metrics');
  assert.deepEqual(chamadas[0].corpo,{p_clinic_id:'clinic',p_period_start:'2026-09-29T04:00:00.000Z',p_period_end:'2026-10-29T03:59:59.999Z'});
  assert.equal(r.status,'pronto');
  assert.equal(r.fonte,'Visão Geral / get_funil_metrics');
  assert.deepEqual(r.metricas,BRUTO.periodo);
  assert.deepEqual(r.anterior,BRUTO.anterior);
  assert.equal(r.periodo.date_start,'2026-09-29');assert.equal(r.periodo.date_end,'2026-10-28');assert.equal(r.periodo.days,30);
  assert.equal(r.fuso,'America/Manaus');
  assert.equal(r.atualizado_em_texto,'28/10/2026 às 15:18 (America/Manaus, UTC-04:00)');
  assert.equal(r.coorte,false);assert.equal(r.taxas_de_conversao,null);assert.equal(r.taxa_comparecimento,null);
  assert.equal(r.definicoes.cirurgias.rotulo,'Fechamentos');
  assert.equal(r.cobertura.trilha_desde,'2026-01-01');
});

test('período inválido não cai em 30 dias e não consulta o CRM',async()=>{
  let consultou=false;
  const r=await funilDaClinica({clinica:CLINICA,args:{inicio:'2026-10-01',fim:'2027-01-01'},agora:AGORA,resolverPeriodo:periodo.resolveRequestedPeriod,
    rpcDoCrm:async()=>{consultou=true;return BRUTO;}});
  assert.equal(consultou,false);assert.equal(r.status,'periodo_invalido');assert.equal(r.metricas,null);
  assert.match(r.motivo,/Período inválido/);
});

test('fonte indisponível ou resposta malformada não vira zero',async()=>{
  const falha=await funilDaClinica({clinica:CLINICA,args:{dias:30},agora:AGORA,resolverPeriodo:periodo.resolveRequestedPeriod,rpcDoCrm:async()=>{throw new Error('CRM respondeu 503');}});
  assert.equal(falha.status,'indisponivel');assert.equal(falha.metricas,null);assert.match(falha.motivo,/Não reutilize/);
  const torto=await funilDaClinica({clinica:CLINICA,args:{dias:30},agora:AGORA,resolverPeriodo:periodo.resolveRequestedPeriod,rpcDoCrm:async()=>({periodo:{novos:1}})});
  assert.equal(torto.status,'indisponivel');assert.equal(torto.metricas,null);
  assert.doesNotMatch(textoDoFunil(torto),/: 0\b/);
});

test('texto do funil traz unidades, fonte, horário e limites de leitura, sem taxas',async()=>{
  const r=await funilDaClinica({clinica:CLINICA,args:{dias:30},agora:AGORA,resolverPeriodo:periodo.resolveRequestedPeriod,rpcDoCrm:async()=>BRUTO});
  const t=textoDoFunil(r);
  assert.match(t,/Clínica exemplo/);assert.match(t,/29\/09\/2026 a 28\/10\/2026/);
  assert.match(t,/Novos leads \(pessoas\): 100/);assert.match(t,/Fechamentos \(registros por procedimento\): 2/);
  assert.match(t,/chave legada "cirurgias"/);assert.match(t,/Visão Geral \/ get_funil_metrics/);
  assert.match(t,/28\/10\/2026 às 15:18/);assert.match(t,/Período anterior/);assert.match(t,/não acompanham a mesma coorte/i);
  assert.doesNotMatch(t,/taxa de comparecimento: \d/);assert.doesNotMatch(t,/%/);
});

test('texto de todas as clínicas: uma linha por clínica, total e avisos; clínica sem dado fica marcada',()=>{
  const t=textoDeTodas([
    {clinica:'Clínica A',status:'pronto',metricas:{novos:10,agendadas:2,realizadas:1,indicacoes:1,cirurgias:0,perdidos:0},periodo:{date_start:'2026-09-29',date_end:'2026-10-28',days:30},fuso:'America/Manaus'},
    {clinica:'Clínica B',status:'indisponivel',metricas:null,periodo:null,fuso:'America/Sao_Paulo'},
  ],{days:30});
  assert.match(t,/Clínica A\s+10\s+2\s+1\s+1\s+0\s+0/);
  assert.match(t,/Clínica B\s+sem dado/);
  assert.match(t,/TOTAL\s+10\s+2\s+1\s+1\s+0\s+0/);
  assert.match(t,/Clínicas sem dado não entram no total/);
  assert.match(t,/fuso de cada clínica/);
});

// ---- a função no ar: tools/call passa pelo get_funil_metrics, nunca pela RPC legada ----

async function setupMcp({members=[{id:'m1',nome:'Arthur'},{id:'m2',nome:'Bia'}]}={}) {
  const file=new URL('../supabase/functions/cerebro-mcp/index.ts',import.meta.url);
  let raw=await readFile(file,'utf8'),handler;
  const calls=[];
  const db={rpc:async(name,args)=>{
      if(name==='cerebro_clinica_por_mentorado') return {data:[{clinic_id:'clinic',clinica:'Clínica exemplo'}]};
      if(name==='cerebro_clinica_do_membro') return {data:[{clinic_id:'clinic'}]};
      return {data:[]};},
    from(){const q={select(){return q;},eq(){return q;},order(){return q;},then:(ok)=>ok({data:members,error:null})};return q;}};
  const context={Request,Response,Headers,URL,AbortController,AbortSignal,TextEncoder,TextDecoder,crypto:globalThis.crypto,setTimeout,clearTimeout,
    console,Date,Intl,JSON,Math,Number,String,Object,Array,Promise,Error,
    Deno:{env:{get:key=>({SUPABASE_URL:'https://site.test',CRM_URL:'https://crm.test'}[key]||'fixture-secret')},serve:fn=>handler=fn},
    createClient:()=>db,
    fetch:async(url,options={})=>{
      const body=options.body?JSON.parse(options.body):null;calls.push({url,body});
      if(url.startsWith('https://crm.test/rest/v1/rpc/get_funil_metrics')) return Response.json(BRUTO);
      if(url.startsWith('https://crm.test/rest/v1/clinics')) return Response.json([CLINICA]);
      throw new Error('Unexpected network target: '+url);
    }};
  for(const match of raw.matchAll(/^import\s*\{([^}]+)\}\s*from\s*["']([^"']+)["'];?/gm)) {
    if(!match[2].startsWith('.')) continue;
    const target=new URL(match[2],file);
    const module=match[2].endsWith('.ts')
      ?await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(await readFile(target,'utf8'),{mode:'transform'})).toString('base64'))
      :await import(target);
    for(const name of match[1].split(',').map(s=>s.trim())) context[name]=module[name];
  }
  raw=raw.replace(/^import\b[\s\S]*?;\s*/gm,'');
  vm.runInNewContext(stripTypeScriptTypes(raw,{mode:'transform'}),context);
  return {calls,call:async(name,args)=>{
    const res=await handler(new Request('https://site.test/functions/v1/cerebro-mcp',{method:'POST',
      headers:{'x-api-key':'fixture-secret','Content-Type':'application/json'},
      body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name,arguments:args}})}));
    return await res.json();}};
}

test('metricas_da_clinica no ar consulta get_funil_metrics com recorte zonado e devolve o texto do funil',async()=>{
  const app=await setupMcp();
  const out=await app.call('metricas_da_clinica',{mentorado:'Arthur',dias:30});
  assert.equal(out.error,undefined,JSON.stringify(out));
  const rpc=app.calls.find(c=>c.url.endsWith('/rpc/get_funil_metrics'));
  assert.ok(rpc,'precisa usar a fonte do painel');
  assert.equal(rpc.body.p_clinic_id,'clinic');assert.match(rpc.body.p_period_start,/T0[34]:00:00\.000Z$/);
  assert.ok(!app.calls.some(c=>c.url.includes('cerebro_metricas')),'a RPC legada não pode ser chamada');
  assert.match(out.result.content[0].text,/Novos leads \(pessoas\): 100/);
});

test('metricas_de_todas_as_clinicas no ar usa só clínicas vinculadas a membros ativos, sem repetir',async()=>{
  const app=await setupMcp();
  const out=await app.call('metricas_de_todas_as_clinicas',{dias:30});
  assert.equal(out.error,undefined,JSON.stringify(out));
  assert.equal(app.calls.filter(c=>c.url.endsWith('/rpc/get_funil_metrics')).length,1,'duas pessoas na mesma clínica: uma consulta');
  assert.ok(!app.calls.some(c=>c.url.includes('cerebro_metricas_todas')));
  assert.match(out.result.content[0].text,/Clínica exemplo\s+100\s+20\s+14\s+6\s+2\s+3/);
});
