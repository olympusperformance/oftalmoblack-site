import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setupChat,answer,tool} from './helpers/chat-handler.mjs';

test('resposta final com blocos internos preserva contexto sem devolver raciocínio ou ferramentas',async()=>{
  let round=0;
  const app=await setupChat({model:body=>{
    round++;
    if(round===1)return tool('numeros_da_clinica',{dias:30});
    if(round===2)return Response.json({stop_reason:'end_turn',content:[
      {type:'thinking',thinking:'INTERNAL_NOT_FOR_HISTORY',signature:'fixture'},
      {type:'text',text:'Há 100 leads; a causa não está demonstrada.'},
    ]});
    assert.deepEqual(body.messages.slice(0,2),[
      {role:'user',content:'Consulte meus indicadores.'},
      {role:'assistant',content:'Há 100 leads; a causa não está demonstrada.'},
    ]);
    return answer('A conclusão continua limitada aos registros.');
  }});
  const first=await app.ask([],'Consulte meus indicadores.');
  assert.equal(first.status,200);
  const data=await first.json();
  assert.equal(data.historico.length,2,'a resposta visível precisa acompanhar a pergunta seguinte');
  assert.doesNotMatch(JSON.stringify(data.historico),/INTERNAL_NOT_FOR_HISTORY|tool_use|tool_result/);
  assert.equal((await app.ask(data.historico,'E qual conclusão posso levar?')).status,200);
});

function hasOrphan(messages){
  return messages.some((m,i)=>Array.isArray(m.content)&&m.content.some(b=>b.type==='tool_result' &&
    !messages[i-1]?.content?.some?.(p=>p.type==='tool_use'&&p.id===b.tool_use_id)));
}
test('três perguntas com quatro consultas cada preservam histórico válido',async()=>{
  let round=0;
  const app=await setupChat({model:body=>{
    if(hasOrphan(body.messages))return Response.json({error:{type:'invalid_request_error',message:'orphan tool_result'}},{status:400});
    round++;
    return round%5===0?answer('Resposta '+round):tool('conversas_recentes',{},'tool-'+round);
  }});
  let history=[];
  for(let i=0;i<3;i++){
    const response=await app.ask(history,'Pergunta '+i);
    assert.equal(response.status,200,'a continuação não pode falhar por um corte do histórico');
    const data=await response.json();history=data.historico;
    assert.equal(hasOrphan(history),false,'histórico devolvido não pode começar em tool_result órfão');
  }
});

test('histórico antigo já cortado é recuperado sem repetir resultado órfão',async()=>{
  const old=[{role:'user',content:[{type:'tool_result',tool_use_id:'lost',content:'source'}]},
    {role:'assistant',content:[{type:'text',text:'Resposta anterior'}]},
    {role:'user',content:'Última pergunta válida'},{role:'assistant',content:'Última resposta válida'}];
  const app=await setupChat({model:body=>hasOrphan(body.messages)
    ?Response.json({error:{type:'invalid_request_error'}},{status:400}):answer('Recuperado')});
  const response=await app.ask(old);
  assert.equal(response.status,200);
  const sent=app.calls.find(c=>c.url.includes('anthropic')).body.messages;
  assert.equal(JSON.stringify(sent).includes('Última resposta válida'),true);
});

test('erro do provedor expõe código recuperável e registra somente metadados',async()=>{
  const app=await setupChat({model:()=>Response.json({error:{type:'rate_limit_error',message:'DO NOT LOG request secret or conversation'}},
    {status:429,headers:{'request-id':'request-fixture'}})});
  const response=await app.ask();const data=await response.json();
  assert.equal(response.status,502);
  assert.equal(data.codigo,'MODEL_BUSY');
  assert.equal(data.tentar_novamente,true);
  assert.ok(app.logs.length);
  assert.equal(JSON.stringify(app.logs).includes('DO NOT LOG'),false);
  assert.equal(JSON.stringify(app.logs).includes('fixture-secret'),false);
});
