import {test} from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';import {stripTypeScriptTypes} from 'node:module';
import {profileChatTools,callProfileChatTool} from '../supabase/functions/_shared/member-profile-chat.mjs';import {emptyProfile} from '../supabase/functions/_shared/member-profile-model.mjs';
import {historicoSeguro} from '../supabase/functions/cerebro-chat/historico.mjs';
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002';
const raw=await readFile(new URL('../supabase/functions/cerebro-chat/index.ts',import.meta.url),'utf8');
async function setup({admin=true,preview=true,toolArgs={secoes:['equipe']}}={}){
 let handler,round=0;const advertised=[],reads=[],models=[];
 const db={auth:{getUser:async()=>({data:{user:{id:'actor'}}})},from(table){const filters={};const q={select(){return q;},eq(k,v){filters[k]=v;return q;},maybeSingle:async()=>table==='app_admins'?{data:admin?{user_id:'actor'}:null}:{data:{id:filters.id||A,nome:'Pessoa'}}};return q;}};
 const sandbox={Request,Response,AbortController,AbortSignal,TextEncoder,TextDecoder,setTimeout,clearTimeout,setInterval,clearInterval,
 Deno:{env:{get:()=> 'fixture'},serve:f=>handler=f},createClient:()=>db,profileChatTools,historicoSeguro,
 callProfileChatTool:(database,scope,args)=>callProfileChatTool(database,scope,args,async(_db,id,sections)=>{reads.push([id,sections]);return emptyProfile({id,nome:'Pessoa',ativo:true});}),
 fetch:async(_url,options)=>{const body=JSON.parse(options.body);models.push(body);advertised.push(body.tools.map(t=>t.name));round++;return new Response(JSON.stringify(round===1?{stop_reason:'tool_use',content:[{type:'tool_use',name:'consultar_perfil',id:'tool1',input:toolArgs}]}:{stop_reason:'end_turn',content:[{type:'text',text:'Dados consultados.'}]}),{status:200,headers:{'content-type':'application/json'}});}};
 const code=stripTypeScriptTypes(raw.replace(/^import\b[\s\S]*?;\s*/gm,''),{mode:'transform'});vm.runInNewContext(code,sandbox);
 const body={pergunta:'Consulte somente o perfil padrão da equipe.',historico:[],...(preview?{member_id:B}:{})};
 const response=await handler(new Request('https://fixture.invalid',{method:'POST',headers:{authorization:'Bearer fixture'},body:JSON.stringify(body)}));return {response,advertised,reads,models};
}
test('handler real autoriza prévia e entrega o mesmo DTO ao modelo',async()=>{const s=await setup();assert.equal(s.response.status,200);assert.equal(s.reads[0][0],B);assert.ok(s.advertised[0].includes('consultar_perfil'));const result=JSON.parse(s.models[1].messages.at(-1).content[0].content);assert.equal(result.schema_version,'2.0');assert.equal(result.mentorado_id,B);assert.equal(result.campos['equipe.papel_sdr'].situacao,'nao_informado');});
test('handler real barra prévia sem app_admins antes de chamar o modelo',async()=>{const s=await setup({admin:false});assert.equal(s.response.status,403);assert.equal(s.models.length,0);assert.equal(s.reads.length,0);});
test('handler real não anuncia nem executa perfil interno para o mentorado',async()=>{const s=await setup({admin:false,preview:false});assert.equal(s.response.status,502);assert.ok(!s.advertised[0].includes('consultar_perfil'));assert.equal(s.reads.length,0);});
test('argumento injetado não redireciona o membro da prévia',async()=>{const s=await setup({toolArgs:{member_id:A}});assert.equal(s.response.status,502);assert.equal(s.reads.length,0);});
