import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../public/hands-on-grau-zero/assets/v21-tracking.js',import.meta.url),'utf8');
const pageId='ec797901-a4bb-439f-9f3b-259ea5aa7bd8';
const requestId='67cf8f63-e97b-4e11-94a5-a053b75dcd28';
const valid={ok:true,request_id:requestId,tracking_mode:'production',crm_status:'applied'};

function setup(href='https://oftalmoblack.com.br/hands-on-grau-zero/?utm_source=meta&gbraid=received&email=private%40example.test',stored=new Map()) {
  const events={},meta=[],ga=[],visits=[],scripts=[],location=new URL(href);
  const document={documentElement:{dataset:{analyticsEnabled:'true'}},referrer:'https://example.test/path?phone=private',
    createElement:()=>({}),head:{appendChild:node=>scripts.push(node.src)},
    getElementsByTagName:()=>[{parentNode:{insertBefore:node=>scripts.push(node.src)}}],querySelectorAll:()=>[]};
  const window={crypto:{randomUUID:()=>pageId},gtag:(...args)=>ga.push(args),fbq:(...args)=>meta.push(args),
    handsOnCapi:{visit:id=>visits.push(id)},setTimeout:fn=>fn(),
    sessionStorage:{getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value)},
    addEventListener:(name,fn)=>events[name]=fn};
  const context=vm.createContext({window,document,location,URL,URLSearchParams,Date,Set});
  vm.runInContext(source,context);
  return {events,meta,ga,visits,scripts,context};
}
const fire=(t,name,detail)=>t.events[name]?.({detail});

test('one GA page view and matched Pixel and CAPI visit IDs even if script loads twice',()=>{
  const t=setup();vm.runInContext(source,t.context);
  assert.equal(t.ga.filter(e=>e[0]==='event'&&e[1]==='page_view').length,1);
  assert.equal(t.ga.find(e=>e[0]==='config')[2].send_page_view,false);
  assert.deepEqual(t.visits,[pageId]);
  assert.deepEqual(t.meta.filter(e=>e[0]==='track').map(e=>[e[1],e[3].eventID]),[
    ['PageView',`hands-on:${pageId}:PageView`],['ViewContent',`hands-on:${pageId}:ViewContent`]]);
});
test('only a confirmed production CRM receipt emits Lead, once per page and tab',()=>{
  const storage=new Map(),t=setup(undefined,storage);
  for(const receipt of [{...valid,ok:false},{...valid,tracking_mode:'qa'},{...valid,crm_status:undefined},{...valid,request_id:'invalid'}]) fire(t,'hands-on:receipt',receipt);
  assert.equal(t.ga.filter(e=>e[1]==='generate_lead').length,0);
  fire(t,'hands-on:receipt',valid);fire(t,'hands-on:receipt',valid);
  const lead=t.meta.filter(e=>e[1]==='Lead');
  assert.equal(lead.length,1);assert.equal(lead[0][3].eventID,`hands-on:${requestId}:Lead`);
  assert.equal(t.ga.filter(e=>e[1]==='generate_lead').length,1);
  const reload=setup(undefined,storage);fire(reload,'hands-on:receipt',valid);
  assert.equal(reload.ga.filter(e=>e[1]==='generate_lead').length,0);
});
test('QA and localhost load no analytics and emit no external visits',()=>{
  for(const url of ['https://oftalmoblack.com.br/hands-on-grau-zero/?utm_source=QA','https://oftalmoblack.com.br/hands-on-grau-zero/?qa=1','http://localhost/hands-on-grau-zero/']) {
    const t=setup(url);assert.equal(t.ga.length+t.meta.length+t.visits.length+t.scripts.length,0);
  }
});
test('page and referrer only contain whitelisted acquisition data',()=>{
  const t=setup(),config=t.ga.find(e=>e[0]==='config')[2];
  assert(!JSON.stringify(config).includes('private'));
  assert.equal(config.page_location,'https://oftalmoblack.com.br/hands-on-grau-zero/?utm_source=meta&gbraid=received');
  assert.equal(config.page_referrer,'https://example.test/path');
});
