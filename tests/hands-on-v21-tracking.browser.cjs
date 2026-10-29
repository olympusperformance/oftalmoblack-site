// SITE_ROOT points to the application checkout under review. All network is intercepted.
const {createRequire}=require('node:module');
const {chromium}=createRequire(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Dr Alex Sá 01/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/')('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(process.env.SITE_ROOT,'public');
const tracking=path.resolve(__dirname,'../public/hands-on-grau-zero/assets/v21-tracking.js');
const count=(events,method,name)=>events.filter(e=>e[0]===method&&e[1]===name).length;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const context=await browser.newContext(),submissions=[],visits=[],blocked=[];
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.pathname.endsWith('/hands-on-capi')){
    const body=JSON.parse(req.postData());
    if(body.op==='visit'){visits.push(body);return route.fulfill({json:{ok:true}});}
    submissions.push(body);
    return route.fulfill({json:{ok:true,request_id:body.request_id,tracking_mode:'production',crm_status:'applied',capture_store:'crm'}});
   }
   if(url.hostname!=='oftalmoblack.com.br'){blocked.push(url.hostname);return route.abort();}
   if(url.pathname.endsWith('/assets/tracking.js'))return route.fulfill({path:tracking,contentType:'application/javascript'});
   const file=path.resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
   return route.fulfill({path:file,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':undefined});
  });
  const page=await context.newPage();
  await page.goto('https://oftalmoblack.com.br/hands-on-grau-zero/?utm_source=meta&utm_medium=cpc&utm_campaign=novembro&utm_term=grupo&utm_content=anuncio&aid=123&fbclid=realclick&gbraid=realgbraid');
  await page.locator('#nome').fill('Pessoa Técnica Fictícia');await page.locator('#whatsapp').fill('92900000000');
  await page.getByTestId('continue-step').click();await page.locator('#crm').fill('999999');await page.locator('#uf').selectOption('PE');
  await page.locator('#question-next').click();await page.locator('[name="experiencia_catarata"][value="ainda_nao_opero"]').check();
  await page.locator('#question-next').click();await page.locator('#cirurgias_mes').fill('0');await page.locator('#question-next').click();
  await page.locator('[name="experiencia_lentes"][value="ainda_nao_implanto"]').check();await page.locator('#question-next').click();
  await page.locator('[name="oferta_premium"][value="nao"]').check();await page.locator('#question-next').click();
  await page.locator('[name="clinica"][value="nao"]').check();await page.locator('#question-next').click();
  await page.getByTestId('final-submit').click();await page.waitForFunction(()=>document.body.dataset.screen==='review');
  assert.equal(submissions.length,1);
  for(const [key,value] of Object.entries({utm_source:'meta',utm_medium:'cpc',utm_campaign:'novembro',utm_term:'grupo',utm_content:'anuncio',aid:'123',fbclid:'realclick',gbraid:'realgbraid'}))assert.equal(submissions[0][key],value);
  await page.evaluate(id=>window.dispatchEvent(new CustomEvent('hands-on:receipt',{detail:{ok:true,request_id:id,tracking_mode:'production',crm_status:'applied'}})),submissions[0].request_id);
  await page.waitForTimeout(900);
  const events=await page.evaluate(()=>({ga:(window.dataLayer||[]).map(x=>Array.from(x)),meta:(window.fbq?.queue||[]).map(x=>Array.from(x))}));
  assert.equal(count(events.ga,'event','page_view'),1);assert.equal(count(events.ga,'event','generate_lead'),1);
  assert.equal(count(events.meta,'track','PageView'),1);assert.equal(count(events.meta,'track','ViewContent'),1);assert.equal(count(events.meta,'track','Lead'),1);
  assert.equal(events.meta.find(e=>e[1]==='Lead')[3].eventID,'hands-on:'+submissions[0].request_id+':Lead');
  assert.equal(visits.length,1);assert.equal(events.meta.find(e=>e[1]==='PageView')[3].eventID,'hands-on:'+visits[0].page_id+':PageView');
  console.log('PASS: form and tracking exercised with mocked CRM, CAPI and all external network blocked');
  await context.close();
 } finally {await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
