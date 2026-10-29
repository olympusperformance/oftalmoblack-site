import test from 'node:test';
import assert from 'node:assert/strict';

let client={};
try {client=await import('../public/hands-on-grau-zero/assets/application-submit.js');} catch {}
const firstId='a01ea3ee-942c-45ca-8ee5-22bc89ab27d1';
const secondId='b01ea3ee-942c-45ca-8ee5-22bc89ab27d2';
const candidate=()=>({identity:{nome:' Pessoa Técnica ',whatsapp:'+55 92 90000-0000'},answers:{crm:'123456',uf:'PE',experiencia_catarata:'ainda_nao_opero',cirurgias_mes:'0',experiencia_lentes:'ainda_nao_implanto',oferta_premium:'nao',clinica:'nao',objetivo:' Objetivo da candidatura ',extra:'não deve sair'}});
const attribution={href:'https://oftalmoblack.com.br/hands-on-grau-zero/?utm_source=meta&utm_medium=cpc&utm_campaign=novembro&aid=ad-real&gbraid=received-gb&wbraid=received-wb&email=private@example.test',referrer:'https://example.test/post?phone=private#fragment'};
function harness(respond=async body=>({ok:true,request_id:body.request_id,crm_status:'applied'}),options={}) {
  assert.equal(typeof client.createApplicationSubmitter,'function','o módulo de submissão precisa existir');
  const calls=[],events=[];let ids=0,tracking={fbp:'fb.1.123.456',fbc:'fb.1.123.real-click'};
  const submitter=client.createApplicationSubmitter({endpoint:'https://receiver.test/hands-on-capi',key:'public-key',randomUUID:()=>[firstId,secondId][ids++],context:()=>({...tracking}),onProgress:(action,extra)=>events.push({action,...extra}),fetcher:async(url,request)=>{
    const body=JSON.parse(request.body);calls.push({url,request,body});
    const response=await respond(body,calls.length,request);
    return {ok:true,json:async()=>response};
  },...options});
  const payload=()=>client.createApplicationPayload(candidate(),attribution);
  return {submitter,calls,events,payload,set tracking(value){tracking=value;}};
}

test('payload mantém contrato, zero e não operador; URLs excluem query privada e campos extras',()=>{
  assert.equal(typeof client.createApplicationPayload,'function');
  const input=candidate(),payload=client.createApplicationPayload(input,attribution);
  assert.equal(payload.schema_version,1);assert.equal(payload.produto,'hands_on_grau_zero');
  assert.equal(payload.nome,'Pessoa Técnica');assert.equal(payload.whatsapp,'5592900000000');
  assert.equal(payload.cirurgias_mes,0);assert.equal(payload.uf,'PE');assert.equal(payload.clinica,'nao');
  assert.equal(payload.objetivo,'Objetivo da candidatura');
  assert.equal(payload.page,'https://oftalmoblack.com.br/hands-on-grau-zero/');
  assert.equal(payload.referrer,'https://example.test/post');
  assert.equal(payload.utm_source,'meta');assert.equal(payload.aid,'ad-real');
  assert.equal(payload.gbraid,'received-gb');assert.equal(payload.wbraid,'received-wb');
  assert(!JSON.stringify(payload).includes('private'));assert(!('extra' in payload));
  assert.equal(input.identity.nome,' Pessoa Técnica ','não altera o estado da interface');
});

test('payload incompleto ou enum inválido não pode ser enviado',()=>{
  assert.equal(typeof client.createApplicationPayload,'function');
  for(const change of [{crm:''},{uf:'ZZ'},{experiencia_catarata:'outra'},{cirurgias_mes:''},{cirurgias_mes:-1}]) {
    const input=candidate();Object.assign(input.answers,change);
    assert.throws(()=>client.createApplicationPayload(input,attribution),/invalid_application/);
  }
  const input=candidate();input.answers.objetivo='';
  assert.equal(client.createApplicationPayload(input,attribution).objetivo,'');
});

test('envia uma candidatura real com chave/contexto atuais e aceita recibo aplicado ou em revisão',async()=>{
  for(const crm_status of ['applied','review']) {
    const h=harness(async body=>({ok:true,request_id:body.request_id,crm_status,lead_id:'private-crm-id'}));
    const result=await h.submitter.submit(h.payload());
    assert.deepEqual(result,{ok:true,request_id:firstId,tracking_mode:'production',crm_status});
    assert.equal(h.calls.length,1);const sent=h.calls[0];
    assert.equal(sent.request.method,'POST');assert.equal(sent.request.headers.apikey,'public-key');
    assert.equal(sent.request.headers['Content-Type'],'text/plain;charset=UTF-8');
    assert.equal(sent.request.credentials,'omit');assert.equal(sent.request.referrerPolicy,'no-referrer');
    assert.deepEqual(sent.body.tracking,{fbp:'fb.1.123.456',fbc:'fb.1.123.real-click'});assert.equal(sent.body.qa,false);
    assert.equal(sent.body.request_id,firstId);assert.equal(h.submitter.completed,true);
    assert.deepEqual(h.events,[{action:'submit'}]);
  }
});

test('falhas HTTP, rede, JSON e recibo divergente não confirmam e retry mantém UUID/corpo',async()=>{
  for(const mode of ['http','network','json','mismatch','not-ok']) {
    let attempt=0;
    const h=harness(undefined,{fetcher:async(url,request)=>{
      const body=JSON.parse(request.body);h.calls.push({url,request,body});attempt++;
      if(attempt===1) {
        if(mode==='network')throw new Error('private network error');
        if(mode==='http')return {ok:false};
        if(mode==='json')return {ok:true,json:async()=>{throw new Error('bad json');}};
        return {ok:true,json:async()=>({ok:mode!=='not-ok',request_id:mode==='mismatch'?secondId:body.request_id})};
      }
      return {ok:true,json:async()=>({ok:true,request_id:body.request_id,crm_status:'applied'})};
    }});
    const result=await h.submitter.submit(h.payload());
    assert.equal(result.ok,false);assert.equal(h.submitter.completed,false);assert.equal(h.submitter.pending,false);
    assert.equal(result.error_type,mode==='http'?'http':mode==='network'?'network':'unconfirmed');
    h.tracking={fbp:'fb.1.999.888'};
    assert.equal((await h.submitter.submit(h.payload())).ok,true);
    assert.equal(h.calls[0].body.request_id,h.calls[1].body.request_id);
    assert.equal(h.calls[0].request.body,h.calls[1].request.body,'retry conserva o payload original mesmo se cookie mudar');
    assert.deepEqual(h.events.map(event=>event.action),['submit','error','submit']);
  }
});

test('editar candidatura após falha cria UUID novo',async()=>{
  const h=harness(undefined,{fetcher:async(url,request)=>{h.calls.push({url,request,body:JSON.parse(request.body)});throw new Error('offline');}});
  await h.submitter.submit(h.payload());
  await h.submitter.submit({...h.payload(),objetivo:'Objetivo alterado'});
  assert.equal(h.calls[0].body.request_id,firstId);assert.equal(h.calls[1].body.request_id,secondId);
});
test('recibo sem confirmação do CRM ou ainda pendente não fecha a candidatura',async()=>{
  for(const crm_status of [undefined,'pending','error']) {
    const h=harness(async body=>({ok:true,request_id:body.request_id,crm_status}));
    assert.equal((await h.submitter.submit(h.payload())).ok,false);
    assert.equal(h.submitter.completed,false);
  }
});

test('duplo clique compartilha o envio em andamento e sucesso impede envio novo',async()=>{
  let release;const gate=new Promise(resolve=>release=resolve);
  const h=harness(async body=>{await gate;return {ok:true,request_id:body.request_id,crm_status:'applied'};});
  const first=h.submitter.submit(h.payload()),second=h.submitter.submit({...h.payload(),objetivo:'não enviar paralelo'});
  assert.equal(first,second);assert.equal(h.submitter.pending,true);assert.equal(h.calls.length,1);
  release();const receipt=await first;
  assert.equal(receipt.ok,true);assert.equal(h.submitter.pending,false);
  assert.deepEqual(await h.submitter.submit(h.payload()),receipt);assert.equal(h.calls.length,1);
});

test('QA permanece fora de marketing mesmo se o receptor omitir ou indicar produção',async()=>{
  for(const options of [{qa:true},{qa:false}]) {
    const h=harness(async body=>({ok:true,request_id:body.request_id,tracking_mode:'production',crm_status:'applied'}),options);
    const payload=options.qa?h.payload():{...h.payload(),utm_source:'QA'};
    assert.equal((await h.submitter.submit(payload)).tracking_mode,'qa');
    assert.equal(h.calls[0].body.qa,true);
  }
});

test('timeout aborta requisição e libera a tentativa sem confirmar',async()=>{
  let expire,cleared=false;
  const h=harness(undefined,{setTimer:callback=>{expire=callback;return 1;},clearTimer:()=>cleared=true,fetcher:async(url,request)=>{
    h.calls.push({url,request,body:JSON.parse(request.body)});
    return new Promise((resolve,reject)=>request.signal.addEventListener('abort',()=>reject(new Error('timeout'))));
  }});
  const promise=h.submitter.submit(h.payload());expire();
  assert.deepEqual(await promise,{ok:false,error_type:'timeout'});
  assert.equal(h.submitter.pending,false);assert.equal(h.submitter.completed,false);assert(cleared);
});
