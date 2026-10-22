const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const origin='https://oftalmoblack.com.br';
const source=path.resolve(__dirname,'../public');
const canonical=fs.readFileSync(path.resolve(__dirname,'../scripts/perfil-tracking-inline.js'),'utf8').trim();
const routes=['/perfil-clinica/','/perfil-clinica/nivel-2/'];
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BLACK_BROWSER_CHANNEL?{channel:process.env.BLACK_BROWSER_CHANNEL}:{})});
 const checks=[];
 try {
  for(const pathname of routes){
   const context=await browser.newContext(),page=await context.newPage();let mode='badack',posts=[];const sdk=[],errors=[];
   await page.addInitScript(()=>{const set=window.setTimeout;window.setTimeout=(fn,ms,...args)=>set(fn,ms===18000?80:ms,...args);});
   page.on('pageerror',e=>errors.push(e.message));
   await context.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.origin===origin){const file=path.join(source,u.pathname,'index.html');if(fs.existsSync(file)){return route.fulfill({contentType:'text/html',body:fs.readFileSync(file,'utf8')});}return route.abort();}
    if(u.hostname==='zpyxnkuvircukjlfexrv.supabase.co'){
     const b=route.request().postDataJSON();posts.push(b);const current=mode;
     if(current==='timeout')await new Promise(r=>setTimeout(r,180));
     return route.fulfill({status:current==='http'?500:200,contentType:'application/json',body:JSON.stringify({ok:true,id:current==='badack'?'wrong':b.submission_id})}).catch(()=>{});
    }
    if(/googletagmanager|connect.facebook.net/.test(u.hostname)){sdk.push(u.hostname);return route.fulfill({contentType:'application/javascript',body:''});}
    return route.abort();
   });
   const query='?origem=stories&utm_source=ig&utm_medium=stories&utm_campaign=perfil-black-evento&utm_content=link_stories&email=secret%40invalid.test#secret';
   await page.goto(origin+pathname+query,{referer:origin+'/somewhere/?email=referrer%40invalid.test'});
   const inline=await page.locator('script[data-perfil-tracking]').textContent();assert.equal(inline.trim(),canonical);
   assert(!page.url().includes('secret'));assert(!page.url().includes('email='));
   assert.equal(await page.evaluate(()=>document.referrer),origin+'/');
   const events=()=>page.evaluate(()=>({ga:window.dataLayer.map(x=>Array.from(x)),meta:window.fbq.queue.map(x=>Array.from(x))}));
   const count=(data,name,platform='ga')=>data[platform].filter(x=>x[0]===(platform==='ga'?'event':'track')&&x[1]===name).length;
   let data=await events();assert.equal(count(data,'page_view'),1);assert.equal(count(data,'PageView','meta'),1);assert.equal(count(data,'ViewContent','meta'),1);
   assert.equal(count(data,'generate_lead'),0);
   for(const feature of ['AutomaticMatching','AutomaticMatchingForPartnerIntegrations','AutomaticMatchingRegex','AutomaticMatchingAI'])assert(data.meta.some(x=>x[0]==='optOut'&&x[2]===feature));
   await page.locator('#nome').fill('Sensitive Person');await page.locator('#email').fill('secret@example.invalid');await page.locator('#whatsapp').fill('(92) 98123-4567');
   await page.locator('#submit-button').click();await page.locator('[data-step=lentes]').waitFor({state:'visible'});
   await page.locator('[name=lentes_premium][value=nao]').click();await page.locator('[data-step=faturamento]').waitFor({state:'visible'});
   await page.locator('[name=faturamento][value="50_100"]').click();await page.locator('[data-step=desafios]').waitFor({state:'visible'});
   await page.locator('[name=desafios][value=atrair_particulares]').check();await page.locator('[name=desafios][value=equipe_processos]').check();
   data=await events();assert.equal(count(data,'perfil_black_form_start'),1);assert.equal(count(data,'perfil_black_contact_complete'),1);assert.equal(count(data,'generate_lead'),0);
   for(const failure of ['badack','http','timeout']){
    mode=failure;await page.locator('#submit-button').click();await page.locator('#form-message').waitFor({state:'visible'});
    assert.equal(count(await events(),'generate_lead'),0);assert.equal(count(await events(),'Lead','meta'),0);
   }
   mode='ok';await page.locator('#submit-button').click();await page.locator('#success').waitFor({state:'visible'});
   const id=posts.at(-1).submission_id;assert(posts.every(x=>x.submission_id===id));
   await page.evaluate(id=>window.dispatchEvent(new CustomEvent('perfil-black:receipt',{detail:{ok:true,id}})),id);
   data=await events();assert.equal(count(data,'generate_lead'),1);assert.equal(count(data,'Lead','meta'),1);
   assert.equal(count(data,'perfil_black_submit_attempt'),4);assert.equal(count(data,'perfil_black_form_error'),3);
   const lead=data.meta.find(x=>x[0]==='track'&&x[1]==='Lead');assert.equal(lead[3].eventID,'perfil-black:'+id+':Lead');
   const serialized=JSON.stringify(data);
   for(const pii of ['Sensitive Person','secret@','referrer@','98123','atrair_particulares','equipe_processos','50_100'])assert(!serialized.includes(pii));
   assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);assert.deepEqual(errors,[]);assert.equal(sdk.length,2);
   checks.push({pathname,ackOnly:true,failuresNoLead:true,retryDeduplicated:true,noFormData:true,referrerOriginOnly:true,matchingOptOut:true});await context.close();
  }
  for(const url of [origin+'/perfil-clinica/?qa=1',origin+'/perfil-clinica/?QA=1',origin+'/perfil-clinica/nivel-2/?utm_source=QA','http://127.0.0.1:8773/perfil-clinica/']){
   const context=await browser.newContext(),page=await context.newPage();const sdk=[];
   await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.pathname.includes('/perfil-clinica/'))return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(source,'perfil-clinica',u.pathname.includes('nivel-2')?'nivel-2/index.html':'index.html'),'utf8')});sdk.push(u.hostname);return route.abort();});
   await page.goto(url);assert.equal(await page.evaluate(()=>Boolean(window.perfilTrackingLoaded||window.gtag||window.fbq)),false);assert.deepEqual(sdk,[]);await context.close();
  }
  const memberFile=fs.readFileSync(path.join(source,'perfil-clinica/nivel-1/index.html'));
  assert.equal(crypto.createHash('sha256').update(memberFile).digest('hex'),'936e5fa6f3b5d2f34649a0ac1b551b9d24a897feb915ad74fb4f52e8b7215a53');
  assert(!memberFile.toString().includes('data-perfil-tracking'));
  console.log(JSON.stringify({checks,qaAndLocalSuppressed:true,memberPageUnchanged:true,externalConversionsSent:false}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
