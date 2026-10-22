// SDKs reais; todos os eventos são interceptados e abortados, sem conversão de QA nas plataformas.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.BLACK_BROWSER_CHANNEL||'msedge'});
 const out=process.env.PERFIL_QA_DIR||path.join(require('node:os').tmpdir(),'perfil-transport');fs.mkdirSync(out,{recursive:true});
 const collected=[],sdk=[],errors=[];
 try{
  const context=await browser.newContext({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0'}),page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(/connect.facebook.net|googletagmanager.com/.test(new URL(r.url()).hostname))sdk.push({url:r.url(),status:r.status()});});
  await context.route('**/*',async route=>{
   const r=route.request(),u=new URL(r.url());
   if(u.origin==='https://oftalmoblack.com.br')return route.fulfill({contentType:'text/html',body:fs.readFileSync(path.resolve(__dirname,'../public/perfil-clinica/nivel-2/index.html'),'utf8')});
   if(u.hostname==='zpyxnkuvircukjlfexrv.supabase.co'){const b=r.postDataJSON();return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,id:b.submission_id})});}
   if(/google-analytics.com$/.test(u.hostname)||(/facebook.com$/.test(u.hostname)&&u.pathname.startsWith('/tr'))){collected.push({url:r.url(),body:r.postData()||''});return route.abort();}
   return route.continue();
  });
  await page.goto('https://oftalmoblack.com.br/perfil-clinica/nivel-2/?origem=stories&utm_source=ig&utm_medium=stories&utm_campaign=perfil-black-evento&email=referrer%40example.invalid#hidden',{referer:'https://oftalmoblack.com.br/prior/?email=referrer%40example.invalid'});
  await page.waitForFunction(()=>window.fbq?.instance?.optIns && window.google_tag_manager,{timeout:30000});await page.waitForTimeout(5000);
  await page.locator('#nome').fill('Canary Private');await page.locator('#email').fill('canary-private@example.invalid');await page.locator('#whatsapp').fill('(92) 98123-4567');await page.locator('#submit-button').click();
  await page.locator('[data-step=lentes]').waitFor({state:'visible'});await page.locator('[name=lentes_premium][value=nao]').click();await page.locator('[data-step=faturamento]').waitFor({state:'visible'});await page.locator('[name=faturamento][value="50_100"]').click();await page.locator('[data-step=desafios]').waitFor({state:'visible'});await page.locator('[name=desafios][value=atrair_particulares]').check();await page.locator('#submit-button').click();await page.locator('#success').waitFor({state:'visible'});await page.waitForTimeout(5000);
  const state=await page.evaluate(()=>({matching:['AutomaticMatching','AutomaticMatchingForPartnerIntegrations','AutomaticMatchingRegex','AutomaticMatchingAI'].map(feature=>({feature,out:window.fbq.instance.optIns.isOptedOut('919253591198015',feature)})),pixels:window.fbq.getState().pixels,referrer:document.referrer}));
  assert(state.matching.every(x=>x.out));assert.equal(state.referrer,'https://oftalmoblack.com.br/');
  const raw=JSON.stringify(collected),decoded=decodeURIComponent(raw.replace(/\+/g,' '));
  for(const v of ['Canary Private','canary-private@example.invalid','92981234567','5592981234567','referrer@example.invalid','atrair_particulares','50_100']){
   assert(!decoded.includes(v),'Raw field leaked: '+v);assert(!raw.includes(crypto.createHash('sha256').update(v.toLowerCase()).digest('hex')),'Hash leaked: '+v);
  }
  const events=collected.map(r=>{const u=new URL(r.url),p=new URLSearchParams(u.search);for(const[k,v]of new URLSearchParams(r.body))p.set(k,v);return {event:p.get('ev')||p.get('en'),pixel:p.get('id')||p.get('tid'),referrer:p.get('rl')||p.get('dr'),url:p.get('dl'),userData:Array.from(p.keys()).filter(k=>/^ud\[/.test(k))};});
  assert(events.some(e=>e.event==='Lead'&&e.pixel==='919253591198015'));assert(events.some(e=>e.event==='generate_lead'&&e.pixel==='G-5NMXL3LD47'));assert(events.every(e=>e.userData.length===0));assert(events.filter(e=>e.pixel==='919253591198015').every(e=>!e.referrer||e.referrer==='https://oftalmoblack.com.br/'));assert.deepEqual(errors,[]);
  const report={at:new Date().toISOString(),sdk,state,events,errors,piiAbsent:true,allAnalyticsTransportAborted:true};fs.writeFileSync(path.join(out,'sdk-transport.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));await context.close();
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
