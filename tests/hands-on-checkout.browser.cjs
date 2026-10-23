const {createRequire}=require('node:module');
const {chromium}=createRequire('C:/Users/Dr Alex Sá 01/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/')('playwright');
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../public'), base='https://oftalmoblack.com.br/hands-on-grau-zero/';
const out=process.env.HOGZ_QA_OUT||path.resolve(__dirname,'../.qa-hands-on-checkout');
fs.mkdirSync(out,{recursive:true});
const rows=[];
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  async function setup(width,js=true){
   const context=await browser.newContext({viewport:{width,height:844},javaScriptEnabled:js});
   const calls=[], external=[], errors=[];
   await context.route('**/*',route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.pathname.endsWith('/hands-on-capi')){
     calls.push(JSON.parse(req.postData()));
     return route.fulfill({status:200,contentType:'application/json',body:'{"ok":true}'});
    }
    if(url.hostname!=='oftalmoblack.com.br'){external.push(req.url());return route.abort();}
    const file=path.resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
    return route.fulfill({path:file,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':undefined});
   });
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.addInitScript(()=>{
    window.checkedLinks=[];
    document.addEventListener('click',event=>{
     const a=event.target.closest('a[data-checkout],a[data-whatsapp]');
     if(a){event.preventDefault();window.checkedLinks.push(a.href);}
    });
   });
   return {context,page,calls,external,errors};
  }
  for(const width of [320,360,390,768,1440]){
   const t=await setup(width);const {page}=t;
   await page.goto(base+'?qa=1');
   await page.locator('.mentor-card img').scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth));
   await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
   assert.equal(await page.locator('form,input,textarea,select').count(),0);
   assert.equal(await page.locator('[data-checkout]').count(),3);
   const state=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,text:document.body.innerText,broken:[...document.images].filter(i=>!i.complete||!i.naturalWidth).length,float:(()=>{const r=document.querySelector('[data-whatsapp]').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})()}));
   assert.equal(state.overflow,false);assert.equal(state.broken,0);assert(!/candidat|[—–]/i.test(state.text));
   assert(state.float.x>=0&&state.float.x+state.float.width<=width&&state.float.y>=0&&state.float.y+state.float.height<=844);
   await page.screenshot({path:path.join(out,'hero-'+width+'.png')});
   if([390,1440].includes(width))await page.screenshot({path:path.join(out,'page-'+width+'.png'),fullPage:true});
   for(const button of await page.locator('[data-checkout]').all()){
    const u=new URL(await button.getAttribute('href'));assert.equal(u.origin+u.pathname,'https://payfast.greenn.com.br/200090/offer/PVDlbA');assert.equal(u.searchParams.get('cupom'),'HANDSONIMERSAO');
    await button.click();
   }
   const wa=new URL(await page.locator('[data-whatsapp]').getAttribute('href'));
   assert.equal(wa.pathname,'/5511993436267');assert.equal(wa.searchParams.get('text'),'Olá! Vim pela página do Hands-on Grau Zero e quero tirar uma dúvida com o Jean.');
   await page.locator('[data-whatsapp]').click();
   const faq=page.locator('details').last();await faq.locator('summary').click();assert(await faq.getAttribute('open')!==null);
   assert.deepEqual(t.calls,[]);assert.deepEqual(t.external,[]);assert.deepEqual(t.errors,[]);
   rows.push({width,overflow:false,formAbsent:true,checkoutLinks:3,floatAccessible:true,qaSuppressed:true,errors:[]});await t.context.close();
  }
  for(const [scenario,query,qa]of [['bio','?utm_source=ig&utm_medium=social&utm_content=link_in_bio',false],['stories','?utm_source=ig&utm_medium=stories&utm_content=link_stories',false],['paid','?utm_source=meta&utm_medium=cpc&utm_campaign=campanha&utm_content=anuncio&utm_term=conjunto&aid=ad-test&fbclid=click-test&gclid=google-test&gbraid=braid-test&wbraid=wbraid-test&email=private@example.test&cupom=EVIL&redirect=https://evil.test',false],['qa-uppercase','?utm_source=QA',true]]){
   const t=await setup(390);await t.page.goto(base+query);
   if(!qa)await t.page.waitForFunction(()=>window.handsOnCapi&&window.fbq?.queue?.some(x=>x[1]==='ViewContent'));
   for(const a of await t.page.locator('[data-checkout]').all())await a.click();
   await t.page.locator('[data-whatsapp]').click();
   // Legacy receipt events cannot produce Lead/Purchase in the checkout variant.
   await t.page.evaluate(()=>window.dispatchEvent(new CustomEvent('hands-on:receipt',{detail:{ok:true,request_id:'67cf8f63-e97b-4e11-94a5-a053b75dcd28'}})));
   if(!qa)await t.page.waitForTimeout(900);
   const sent=await t.page.evaluate(()=>({ga:(window.dataLayer||[]).map(x=>Array.from(x)),meta:(window.fbq?.queue||[]).map(x=>Array.from(x)),links:window.checkedLinks}));
   const count=(l,op,event)=>l.filter(x=>x[0]===op&&x[1]===event).length;
   if(qa){assert.deepEqual(sent.ga,[]);assert.deepEqual(sent.meta,[]);assert.equal(t.calls.length,0);}
   else{
    assert.equal(count(sent.ga,'event','page_view'),1);assert.equal(count(sent.ga,'event','begin_checkout'),1);assert.equal(count(sent.ga,'event','hands_on_cta_click'),3);assert.equal(count(sent.ga,'event','hands_on_whatsapp_click'),1);
    assert.equal(count(sent.meta,'track','InitiateCheckout'),1);assert.equal(count(sent.meta,'track','Contact'),1);
    assert.equal(t.calls.length,1);assert.equal(t.calls[0].op,'visit');
    const pv=sent.meta.find(x=>x[0]==='track'&&x[1]==='PageView');assert.equal(pv[3].eventID,`hands-on:${t.calls[0].page_id}:PageView`);
   }
   assert.equal(count(sent.meta,'track','Lead'),0);assert.equal(count(sent.meta,'track','Purchase'),0);assert.equal(count(sent.ga,'event','generate_lead'),0);
   for(const l of sent.links.slice(0,3)){
    const u=new URL(l);assert.equal(u.searchParams.get('cupom'),'HANDSONIMERSAO');assert(!u.searchParams.has('email'));assert(!u.searchParams.has('redirect'));
    const q=new URLSearchParams(query);for(const key of ['utm_source','utm_medium','utm_content','aid','fbclid','gclid','gbraid','wbraid'])assert.equal(u.searchParams.get(key),q.get(key));
   }
   assert(!JSON.stringify({ga:sent.ga,meta:sent.meta,capi:t.calls}).includes('private@example.test'));assert.deepEqual(t.errors,[]);
   rows.push({scenario,checkoutOnce:true,leadOrPurchase:false,utmPreserved:true,couponPinned:true,queryPIIExcluded:true,qaSuppressed:qa});await t.context.close();
  }
  const nojs=await setup(390,false);await nojs.page.goto(base);assert.equal(await nojs.page.locator('[data-checkout][href*="PVDlbA"]').count(),3);assert.equal(await nojs.page.locator('form').count(),0);await nojs.context.close();
  const old=await setup(390);await old.page.goto(base+'v0/?qa=1');assert.equal(await old.page.locator('form#candidatura-form').count(),1);assert.equal(await old.page.locator('meta[name=robots]').getAttribute('content'),'noindex, follow');assert.equal(await old.page.locator('link[rel=canonical]').getAttribute('href'),base+'v0/');await old.page.screenshot({path:path.join(out,'v0-390.png'),fullPage:true});assert.deepEqual(old.errors,[]);await old.context.close();
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({rows,noJavaScriptCheckout:true,v0FormPreserved:true,transport:'all external writes/navigation intercepted'},null,2));console.log(JSON.stringify({passed:rows.length+2,out}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
