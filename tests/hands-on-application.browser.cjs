const {createRequire}=require('node:module');
const {chromium}=createRequire(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Dr Alex Sá 01/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/')('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../public'),base='https://oftalmoblack.com.br/hands-on-grau-zero/';
const out=process.env.HOGZ_QA_OUT || path.resolve(__dirname,'../.qa-hands-on-application');
fs.mkdirSync(out,{recursive:true});
const rows=[];
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  async function setup({width=390,query='?qa=1',responses=[],js=true,version=''}={}){
   const context=await browser.newContext({viewport:{width,height:844},javaScriptEnabled:js,reducedMotion:'reduce'});
   const submissions=[],visits=[],errors=[],navigations=[];
   await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.pathname.endsWith('/hands-on-capi')){
     const body=JSON.parse(req.postData());
     if(body.op==='visit'){visits.push(body);return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});}
     submissions.push(body);
     const response=responses[submissions.length-1] || 'success';
     if(response==='http')return route.fulfill({status:503,body:'unavailable'});
     if(response==='network')return route.abort();
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,request_id:response==='mismatch'?'00000000-0000-4000-8000-000000000000':body.request_id,tracking_mode:body.qa?'qa':'production'})});
    }
    if(url.hostname!=='oftalmoblack.com.br'){if(req.isNavigationRequest())navigations.push(req.url());return route.abort();}
    const file=path.resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
    return route.fulfill({path:file,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':undefined});
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>document.addEventListener('click',e=>{if(e.target.closest('a[data-whatsapp]'))e.preventDefault();}));
   await page.goto(base+version+query);
   return {context,page,submissions,visits,errors,navigations};
  }
  async function fill(page){
   await page.locator('#nome').fill('Pessoa Técnica Fictícia');
   await page.locator('#whatsapp').fill('+55 92 90000-0000');
   await page.locator('#crm').fill('999999');await page.locator('#uf').selectOption('AM');
   await page.getByTestId('continue-step').click();
   await page.locator('#experiencia_catarata').selectOption('ainda_nao_opero');
   await page.locator('#cirurgias_mes').fill('0');
   await page.locator('#experiencia_lentes').selectOption('ainda_nao_implanto');
   await page.locator('#oferta_premium').selectOption('nao');await page.locator('#clinica').selectOption('nao');
   await page.locator('#objetivo').fill('Objetivo técnico fictício, sem dados de pacientes.');
  }
  const analytics=page=>page.evaluate(()=>({ga:(window.dataLayer||[]).map(x=>Array.from(x)),meta:(window.fbq?.queue||[]).map(x=>Array.from(x))}));
  const count=(l,op,event)=>l.filter(x=>x[0]===op&&x[1]===event).length;
  for(const width of [320,360,390,768,1440]){
   const t=await setup({width});
   assert.equal(await t.page.locator('form#candidatura-form').count(),1,'principal deve oferecer aplicação');
   assert.equal(await t.page.locator('a[href*="greenn"],a[data-checkout]').count(),0,'candidatura não pode abrir checkout');
   const ctas=t.page.locator('a[href="#candidatura"]');assert.equal(await ctas.count(),2);
   await ctas.first().click();assert.equal(new URL(t.page.url()).hash,'#candidatura');
   assert(await t.page.getByTestId('continue-step').isVisible());
   assert.equal(await t.page.locator('#hero-title').innerText(),'A cirurgia premium começa antes da lente.');
   assert((await t.page.locator('.application-note').innerText()).includes('não confirma sua vaga'));
   assert.equal(await t.page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert(!/[—–]/.test(await t.page.locator('body').innerText()));
   await t.page.locator('.mentor-card img').scrollIntoViewIfNeeded();
   await t.page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth));
   await t.page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
   await t.page.screenshot({path:path.join(out,'hero-'+width+'.png')});
   if([390,1440].includes(width))await t.page.screenshot({path:path.join(out,'page-'+width+'.png'),fullPage:true});
   assert.deepEqual(await analytics(t.page),{ga:[],meta:[]});assert.deepEqual(t.submissions,[]);assert.deepEqual(t.errors,[]);
   rows.push({scenario:'layout',width,application:true,checkout:false,overflow:false});await t.context.close();
  }
  {
   const t=await setup();
   await t.page.getByTestId('continue-step').click();
   assert(await t.page.locator('[data-step-panel="1"]').isVisible());assert.deepEqual(t.submissions,[]);
   await fill(t.page);await t.page.getByTestId('back-step').click();
   assert.equal(await t.page.locator('#nome').inputValue(),'Pessoa Técnica Fictícia');
   await t.page.getByTestId('continue-step').click();
   await t.page.getByTestId('final-submit').click();
   await t.page.waitForFunction(()=>document.querySelector('#form-status').dataset.state==='success');
   assert.equal(t.submissions.length,1);const sent=t.submissions[0];
   assert.equal(sent.experiencia_catarata,'ainda_nao_opero');assert.equal(sent.cirurgias_mes,0);assert.equal(sent.clinica,'nao');
   assert.equal(sent.produto,'hands_on_grau_zero');assert.equal(sent.page,base);assert.equal(sent.qa,true);
   assert(await t.page.getByTestId('final-submit').isDisabled());assert.deepEqual(t.navigations,[]);assert.deepEqual(t.errors,[]);
   await t.page.screenshot({path:path.join(out,'application-success.png'),fullPage:true});
   rows.push({scenario:'non-operator-zero-no-clinic',receiptRequired:true,redirect:false});await t.context.close();
  }
  for(const failure of ['http','network','mismatch']){
   const t=await setup({responses:[failure,'success']});await fill(t.page);await t.page.getByTestId('final-submit').click();
   await t.page.waitForFunction(()=>document.querySelector('#form-status').dataset.state==='error');
   assert.equal(await t.page.locator('#cirurgias_mes').inputValue(),'0');
   assert(await t.page.getByTestId('final-submit').isEnabled());
   await t.page.getByTestId('final-submit').click();
   await t.page.waitForFunction(()=>document.querySelector('#form-status').dataset.state==='success');
   assert.equal(t.submissions.length,2);assert.equal(t.submissions[0].request_id,t.submissions[1].request_id);
   assert.deepEqual(t.navigations,[]);assert.deepEqual(t.errors,[]);
   rows.push({scenario:'retry-'+failure,identityStable:true,valuesPreserved:true});await t.context.close();
  }
  {
   const t=await setup({query:'?utm_source=meta&utm_medium=cpc&utm_campaign=hands-on-novembro&utm_content=post&utm_term=oftalmo&aid=test-ad&fbclid=click-test&email=private@example.test'});
   await fill(t.page);const before=await analytics(t.page);
   assert.equal(count(before.meta,'track','Lead'),0);assert.equal(count(before.ga,'event','generate_lead'),0);
   await t.page.evaluate(()=>{const b=document.querySelector('[data-testid="final-submit"]');b.click();b.click();});
   await t.page.waitForFunction(()=>document.querySelector('#form-status').dataset.state==='success');
   assert.equal(t.submissions.length,1);const sent=t.submissions[0];
   assert.equal(sent.utm_source,'meta');assert.equal(sent.utm_medium,'cpc');assert.equal(sent.aid,'test-ad');
   await t.page.evaluate(id=>window.dispatchEvent(new CustomEvent('hands-on:receipt',{detail:{ok:true,request_id:id,tracking_mode:'production'}})),sent.request_id);
   await t.page.locator('[data-whatsapp]').click();
   await t.page.waitForTimeout(900);const after=await analytics(t.page);
   assert.equal(count(after.ga,'event','generate_lead'),1);assert.equal(count(after.meta,'track','Lead'),1);
   assert.equal(count(after.ga,'event','begin_checkout'),0);assert.equal(count(after.meta,'track','InitiateCheckout'),0);assert.equal(count(after.meta,'track','Purchase'),0);
   assert.equal(count(after.ga,'event','hands_on_whatsapp_click'),1);assert.equal(count(after.meta,'track','Contact'),1);
   assert.equal(after.meta.find(x=>x[1]==='Lead')[3].eventID,'hands-on:'+sent.request_id+':Lead');
   assert.equal(t.visits.length,1);const pv=after.meta.find(x=>x[1]==='PageView');assert.equal(pv[3].eventID,'hands-on:'+t.visits[0].page_id+':PageView');
   assert(!JSON.stringify(after).includes('Pessoa Técnica'));assert(!JSON.stringify(after).includes('private@example.test'));
   const wa=new URL(await t.page.locator('[data-whatsapp]').getAttribute('href'));assert.equal(wa.pathname,'/5511993436267');assert.deepEqual([...wa.searchParams.keys()],['text']);
   assert.deepEqual(t.navigations,[]);assert.deepEqual(t.errors,[]);
   rows.push({scenario:'acquisition-and-measurement',leadAfterReceipt:true,deduplicated:true,checkoutOrPurchase:false,piiExcluded:true});await t.context.close();
  }
  const nojs=await setup({js:false});assert.equal(await nojs.page.locator('form').count(),1);assert.equal(await nojs.page.locator('a[href*="greenn"]').count(),0);assert(await nojs.page.getByTestId('continue-step').isDisabled());await nojs.context.close();
  const old=await setup({version:'v0/'});assert.equal(await old.page.locator('form').count(),1);assert.equal(await old.page.locator('link[rel="canonical"]').getAttribute('href'),base+'v0/');assert.equal(await old.page.locator('meta[name="robots"]').getAttribute('content'),'noindex, follow');await old.context.close();
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({rows,noJavaScriptSafe:true,v0Preserved:true,externalWrites:'all intercepted',passed:rows.length+2},null,2));
  console.log(JSON.stringify({passed:rows.length+2,out}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
