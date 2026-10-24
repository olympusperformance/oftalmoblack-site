const {createRequire}=require('node:module');
const {chromium}=createRequire(process.env.PLAYWRIGHT_MODULE||'C:/Users/Dr Alex Sá 01/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/')('playwright');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../public'),live=process.env.BLACK_QA_LIVE==='1';
const out=process.env.BLACK_QA_OUT||path.resolve(__dirname,'../../../../../analises/revisao-home-2026-10-24/qa-perfil',live?'production':'local');
fs.mkdirSync(out,{recursive:true});const reports=[];
(async()=>{
 const {validate}=await import('../supabase/functions/perfil-clinica/core.mjs');
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  async function setup(width,{mode='ok',javaScriptEnabled=true,shortTimeout=false}={}){
   const context=await browser.newContext({viewport:{width,height:844},javaScriptEnabled});
   const errors=[],missing=[],external=[],posts=[];let responseMode=mode;
   await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.pathname.endsWith('/perfil-clinica')&&req.method()==='POST'){
     const body=JSON.parse(req.postData());posts.push(body);validate(body);const current=responseMode;
     if(current==='timeout')await new Promise(r=>setTimeout(r,250));if(current==='slow')await new Promise(r=>setTimeout(r,90));
     const answer=current==='badack'?{ok:true,id:'wrong'}:current==='missingok'?{id:body.submission_id}:{ok:true,id:body.submission_id};
     return route.fulfill({status:current==='error'?503:200,contentType:'application/json',body:JSON.stringify(answer)}).catch(()=>{});
    }
    if(url.hostname!=='oftalmoblack.com.br'){external.push(req.url());return route.fulfill({status:200,body:'',contentType:'application/javascript'});}
    if(live)return route.continue();
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname)+(url.pathname.endsWith('/')?'index.html':''));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){missing.push(url.pathname);return route.fulfill({status:404,body:'missing'});}
    return route.fulfill({path:file,contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':undefined});
   });
   await context.addInitScript(({shortTimeout})=>{document.addEventListener('click',e=>{if(e.target.closest('#home-commercial'))e.preventDefault();},true);if(shortTimeout){const native=setTimeout;window.setTimeout=(fn,delay,...args)=>native(fn,delay===18000?80:delay,...args);}},{shortTimeout});
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   return{context,page,errors,missing,external,posts,setMode:value=>{responseMode=value;}};
  }
  async function at(p,name){await p.locator('[data-step="'+name+'"]').waitFor({state:'visible'});assert.equal(await p.locator('[data-step]:visible').count(),1);assert.equal(new URL(p.url()).pathname,'/');}
  async function radio(p,name,value,next){await p.locator('[name="'+name+'"][value="'+value+'"]').click();await at(p,next);}
  async function contact(t){await t.page.locator('#nome').fill('QA Home Clínica');await t.page.locator('#email').fill('qa-home@example.invalid');await t.page.locator('#whatsapp').fill('+1 202 555 0100');await t.page.locator('#submit-button').click();await at(t.page,'lentes');assert.equal(t.posts.length,0);}
  async function finish(t,premium=false){await contact(t);await radio(t.page,'lentes_premium',premium?'sim':'nao',premium?'volume':'faturamento');if(premium)await radio(t.page,'volume_lentes','6_10','faturamento');await radio(t.page,'faturamento','50_100','desafios');await t.page.locator('[name=desafios][value=atrair_particulares]').check();}
  async function capture(t,name,fullPage=false){await t.page.screenshot({path:path.join(out,name+'.png'),fullPage});}
  for(const width of [320,390,768,1440]){
   const t=await setup(width);await t.page.goto('https://oftalmoblack.com.br/?qa=1');
   await t.page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));document.querySelectorAll('.rev').forEach(e=>{e.style.opacity='1';e.style.transform='none';});window.scrollTo({top:0,behavior:'instant'});});
   const metrics=await t.page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,copy:document.body.innerText,anchors:[...document.querySelectorAll('a[href^="#"]')].filter(a=>!document.getElementById(a.hash.slice(1))).map(a=>a.hash)}));
   assert.equal(metrics.width,metrics.scrollWidth);assert.deepEqual(metrics.anchors,[]);assert(!/[—–]/.test(metrics.copy));assert(!/Jean|48h úteis|20% de desconto|45 cirurgias|Adquira seu ingresso/.test(metrics.copy));
   assert.equal(await t.page.locator('form').count(),1);assert.equal(await t.page.locator('a[href*="/club/"]').count(),0);assert.equal(await t.page.locator('a[data-profile-link][target="_blank"]').count(),0);
   await capture(t,`hero-${width}`);if([390,1440].includes(width))await capture(t,`page-${width}`,true);
   await t.page.locator('a[href="#aplicacao"]').first().click();await at(t.page,'contatos');await t.page.evaluate(()=>document.getElementById('home-profile').scrollIntoView({block:'start',behavior:'instant'}));await capture(t,`form-${width}`);
   await t.page.locator('#submit-button').click();await at(t.page,'contatos');assert.equal(t.posts.length,0);
   await contact(t);await radio(t.page,'lentes_premium','sim','volume');await radio(t.page,'volume_lentes','6_10','faturamento');await radio(t.page,'faturamento','50_100','desafios');
   await t.page.locator('[name=desafios][value=equipe_processos]').check();await t.page.locator('[name=desafios][value=atrair_particulares]').check();await t.page.locator('#outro').check();await t.page.locator('#outro-desafio').fill('QA desafio da clínica');await capture(t,`desafios-${width}`);
   await t.page.locator('#back-button').click();await at(t.page,'faturamento');await t.page.locator('#back-button').click();await at(t.page,'volume');await t.page.locator('#back-button').click();await at(t.page,'lentes');
   await radio(t.page,'lentes_premium','nao','faturamento');assert.equal(await t.page.locator('[name=volume_lentes]:checked').count(),0);await radio(t.page,'faturamento','50_100','desafios');assert.equal(await t.page.locator('[name=desafios]:checked').count(),3);assert.equal(await t.page.locator('#outro-desafio').inputValue(),'QA desafio da clínica');
   await t.page.locator('#outro').uncheck();assert.equal(await t.page.locator('#outro-desafio').inputValue(),'');assert.equal(await t.page.locator('#home-commercial').getAttribute('href'),null);assert.equal(t.posts.length,0);
   await t.page.locator('#submit-button').click();await t.page.locator('#success').waitFor({state:'visible'});assert.equal(t.posts.length,1);assert.equal(t.posts[0].pagina,'/');assert.equal(t.posts[0].origem,'direto');assert.equal(t.posts[0].volume_lentes,null);assert.equal(t.posts[0].outro_desafio,null);assert.equal(t.posts[0].desafios.length,2);
   assert.equal(new URL(t.page.url()).pathname,'/');assert.equal(await t.page.locator('#nome,#email,#whatsapp').count(),0);assert.equal(await t.page.evaluate(()=>localStorage.length+sessionStorage.length),0);
   const wa=new URL(await t.page.locator('#home-commercial').getAttribute('href'));assert.equal(wa.pathname,'/5511993436267');assert.equal(wa.searchParams.get('text'),'Olá! Preenchi o formulário no site do Club OftalmoBlack e quero conversar com a equipe sobre minha clínica.');
   await capture(t,`success-${width}`);assert.deepEqual(t.errors,[]);assert.deepEqual(t.missing,[]);assert.deepEqual(t.external,[]);
   reports.push({scenario:`layout-flow-${width}`,sameHome:true,conditionalVolume:true,multipleChallenges:true,clearOther:true,noPartialWrite:true,contactOnlyAfterReceipt:true,qaSuppressed:true});await t.context.close();
  }
  for(const mode of ['badack','missingok','error','timeout']){
   const t=await setup(390,{mode,shortTimeout:mode==='timeout'});await t.page.goto('https://oftalmoblack.com.br/?qa=1');await finish(t,true);await t.page.locator('#submit-button').click();await t.page.locator('#form-message').waitFor({state:'visible'});
   assert.equal(await t.page.locator('#success').isVisible(),false);assert.equal(await t.page.locator('#home-commercial').getAttribute('href'),null);assert.equal(t.posts.length,1);
   t.setMode('ok');await t.page.locator('#submit-button').click();await t.page.locator('#success').waitFor({state:'visible'});assert.equal(t.posts.length,2);assert.deepEqual(t.posts[0],t.posts[1]);assert.deepEqual(t.errors,[]);
   reports.push({scenario:mode,receiptRequired:true,retryIDStable:true});await t.context.close();
  }
  const double=await setup(390,{mode:'slow'});await double.page.goto('https://oftalmoblack.com.br/?qa=1');await finish(double);await double.page.evaluate(()=>{const f=document.getElementById('perfil-form');f.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));f.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));});await double.page.locator('#success').waitFor({state:'visible'});assert.equal(double.posts.length,1);reports.push({scenario:'double-submit',oneWrite:true});await double.context.close();
  const t=await setup(390);await t.page.goto('https://oftalmoblack.com.br/?utm_source=imersao&utm_medium=qrcode&utm_campaign=club&utm_content=home-business&aid=123456789&email=private@example.test#aplicacao');
  const telemetry=()=>t.page.evaluate(()=>({meta:(window.fbq?.queue||[]).map(x=>Array.from(x)),ga:(window.dataLayer||[]).map(x=>Array.from(x))}));
  let tx=await telemetry();assert.equal(tx.meta.filter(x=>x[0]==='init'&&x[1]==='919253591198015').length,1);assert.equal(tx.meta.filter(x=>x[0]==='track'&&x[1]==='PageView').length,1);assert.equal(tx.meta.filter(x=>x[0]==='track'&&x[1]==='Lead').length,0);assert(!t.page.url().includes('private'));
  await finish(t);await t.page.locator('#submit-button').click();await t.page.locator('#success').waitFor({state:'visible'});assert.equal(t.posts[0].utm.aid,'123456789');assert.equal(t.posts[0].utm.utm_content,'home-business');assert.equal(t.posts[0].pagina,'/');
  await t.page.locator('#home-commercial').click();tx=await telemetry();for(const name of ['Lead','Contact'])assert.equal(tx.meta.filter(x=>x[0]==='track'&&x[1]===name).length,1);for(const name of ['generate_lead','whatsapp_click'])assert.equal(tx.ga.filter(x=>x[0]==='event'&&x[1]===name).length,1);
  const serialized=JSON.stringify(tx);for(const pii of ['QA Home','qa-home@','12025550100','50_100','atrair_particulares'])assert(!serialized.includes(pii));for(const name of ['Purchase','InitiateCheckout'])assert.equal(tx.meta.filter(x=>x[0]==='track'&&x[1]===name).length,0);
  assert.deepEqual(t.errors,[]);reports.push({scenario:'attribution-and-events',aidPreserved:true,leadOnlyAfterReceipt:true,contactOnlyAfterClick:true,noPIIOrAnswersInEvents:true});await t.context.close();
  const nojs=await setup(390,{javaScriptEnabled:false});await nojs.page.goto('https://oftalmoblack.com.br/?qa=1');assert.equal(await nojs.page.locator('#submit-button').isDisabled(),true);assert.equal(await nojs.page.locator('#perfil-form').getAttribute('method'),'post');assert.equal(await nojs.page.locator('#home-commercial').isVisible(),false);reports.push({scenario:'no-javascript',noAccidentalGET:true});await nojs.context.close();
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({live,checkedAt:new Date().toISOString(),reports,transport:'All form writes, analytics transports and WhatsApp navigation intercepted. No real lead created.'},null,2));console.log(JSON.stringify({passed:reports.length,out}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
