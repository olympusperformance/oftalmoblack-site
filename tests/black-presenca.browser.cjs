const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto'),path=require('path');
const siteRoot=path.resolve(__dirname,'..');
const testURL=new URL(process.env.PRESENCA_TEST_URL || 'http://127.0.0.1:8773/perfil-clinica/nivel-1/');
const out=path.resolve(process.env.PERFIL_QA_DIR || path.join(siteRoot,'../_qa/nivel-1-diario'));fs.mkdirSync(out,{recursive:true});
const digest=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').toUpperCase();
const preservedFiles=['public/perfil-clinica/index.html','public/perfil-clinica/nivel-2/index.html'];
const beforeHashes=preservedFiles.map(file=>digest(path.join(siteRoot,file)));
(async()=>{
 const browser=await chromium.launch({channel:process.env.BLACK_BROWSER_CHANNEL || 'msedge',headless:true});
 const errors=[],requests=[],authRequests=[],unexpected=[];let mode='badack',ackDay='2026-10-23';
 async function makePage(width=390){
  const page=await browser.newPage({viewport:{width,height:900}});page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   // The shared device may already hold an operator session. Do not read it.
   const key='sb-existing-operator-auth-token';localStorage.setItem(key,'{"user":{"name":"Operador TV"},"access_token":"qa-unused-token"}');
   window.qaStorageReads=0;const get=Storage.prototype.getItem;Storage.prototype.getItem=function(k){window.qaStorageReads++;return get.call(this,k);};
   const RealDate=Date;window.Date=class extends RealDate{constructor(...args){super(...(args.length?args:['2026-10-22T12:00:00Z']));}static now(){return new RealDate('2026-10-22T12:00:00Z').getTime();}};
   const timeout=setTimeout;window.setTimeout=(fn,ms,...args)=>timeout(fn,ms===18000?100:ms,...args);
  });
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname==='/functions/v1/black-presenca'){
    const body=route.request().postDataJSON(),headers=route.request().headers(),current=mode,day=ackDay;requests.push({body,headers});
    if(current==='timeout')await new Promise(r=>setTimeout(r,230));if(current==='slow')await new Promise(r=>setTimeout(r,60));
    const ack={ok:true,id:current==='badack'?'wrong':body.submission_id,...(current==='missingday'?{}:{day})};
    await route.fulfill({status:current==='httpfail'?503:200,contentType:'application/json',body:JSON.stringify(ack)}).catch(()=>{});return;
   }
   if(/\/auth\/|\/rest\/|supabase\.js|club-supabase|club-auth|\/config\.js/.test(u.href)){authRequests.push(u.pathname);await route.abort();return;}
   if(u.origin===testURL.origin){await route.continue();return;}
   unexpected.push(u.hostname+u.pathname);await route.abort();
  });return page;
 }
 const widths=[];
 for(const width of [360,390,768,1280]){
  const page=await makePage(width);await page.goto(testURL.href);await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.locator('#member-gate').isVisible(),true);assert.equal(requests.length,0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:out+'/'+width+'-gate.png',fullPage:true});
  await page.locator('#member-yes').click();await page.locator('#presence-form').waitFor();assert.equal(await page.locator('label[for=nome]').innerText(),'Nome completo');assert.equal(await page.locator('#nome').getAttribute('type'),'text');assert.equal(await page.locator('#email').count(),0);assert.equal(requests.length,0);
  await page.screenshot({path:out+'/'+width+'-name.png',fullPage:true});await page.locator('#confirm-button').click();assert.equal(requests.length,0);await page.locator('#nome').fill('A');await page.locator('#confirm-button').click();assert.equal(requests.length,0);
  await page.locator('#nome').evaluate(el=>{el.value='x'.repeat(161);el.dispatchEvent(new Event('input',{bubbles:true}));});await page.locator('#confirm-button').click();assert.equal(await page.locator('#nome').evaluate(el=>el.validity.customError),true);assert.equal(requests.length,0);
  await page.locator('#nome').fill('Alex Sá');assert.equal(await page.locator('#nome').evaluate(el=>el.validity.customError),false);await page.locator('#back-button').click();await page.locator('#member-yes').click();assert.equal(await page.locator('#nome').inputValue(),'Alex Sá');assert.equal(await page.evaluate(()=>window.qaStorageReads),0);await page.close();widths.push({width,gate:true,nameLabel:true,nameBounds:true,backPreserves:true,noOverflow:true,noPreactionPost:true});
 }
 const redirect=await makePage();await redirect.goto(new URL('?origem=invalida&utm_source=instagram&utm_campaign=evento&email=private@example.invalid&nome=private&utm_content=private@example.invalid#private',testURL).href);await redirect.locator('#member-no').click();await redirect.waitForURL('**/perfil-clinica/?**');const redirected=new URL(redirect.url());assert.equal(redirected.searchParams.get('origem'),'presencial');assert.equal(redirected.searchParams.get('utm_source'),'instagram');assert.equal(redirected.searchParams.has('email'),false);assert.equal(redirected.searchParams.has('nome'),false);assert.equal(redirected.searchParams.has('utm_content'),false);assert.equal(redirected.hash,'');await redirect.close();
 const page=await makePage();const sameURL=new URL('?origem=presencial&utm_source=qa&utm_campaign=evento',testURL).href;await page.goto(sameURL);await page.locator('#member-yes').click();await page.locator('#nome').fill('  Ａｌｅｘ   Sá  ');assert.equal(requests.length,0);
 await page.locator('#confirm-button').click();await page.locator('#presence-message').waitFor({state:'visible'});assert.equal(requests.length,1);assert.equal(requests[0].body.nome,'Alex Sá');assert.deepEqual(Object.keys(requests[0].body).sort(),['submission_id','nome','origem','utm','pagina'].sort());assert.equal(requests[0].headers['x-member-token'],undefined);assert.equal(await page.locator('#success').isVisible(),false);
 mode='missingday';await page.locator('#confirm-button').click();await page.locator('#presence-message').waitFor({state:'visible'});assert.equal(await page.locator('#success').isVisible(),false);
 const invalidDays=['2026-02-29','2026-04-31','2026-13-01','2026-00-10','2026-01-00','2026-10-32','2026-10-23T00:00:00Z','2026-2-03','0000-01-01',null];
 for(const day of invalidDays){mode='ack';ackDay=day;await page.locator('#confirm-button').click();await page.locator('#presence-message').waitFor({state:'visible'});assert.equal(await page.locator('#success').isVisible(),false);assert.equal(await page.locator('#nome').inputValue(),'  Ａｌｅｘ   Sá  ');}
 mode='timeout';await page.locator('#confirm-button').click();await page.locator('#presence-message').waitFor({state:'visible'});const failedCount=requests.length;assert.equal(new Set(requests.map(r=>r.body.submission_id)).size,1);assert.equal(await page.locator('#nome').isEnabled(),true);
 await page.locator('#nome').fill('Outra Pessoa');mode='slow';ackDay='2026-10-23';await page.evaluate(()=>{const form=document.querySelector('form');form.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));form.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));});await page.locator('#success').waitFor();assert.equal(requests.length,failedCount+1);assert.notEqual(requests.at(-1).body.submission_id,requests[0].body.submission_id);assert.equal(requests.at(-1).body.nome,'Outra Pessoa');
 assert.equal(await page.evaluate(()=>new Date().toISOString().slice(0,10)),'2026-10-22');assert.equal(await page.locator('#success-day').innerText(),'Sua presença foi registrada em 23/10/2026.');assert.equal(await page.locator('#nome,#email').count(),0);assert.equal((await page.locator('body').innerText()).includes('Outra Pessoa'),false);assert.equal((await page.locator('body').innerText()).includes('Operador TV'),false);assert.equal(await page.evaluate(()=>window.qaStorageReads),0);assert.equal(await page.evaluate(()=>localStorage.length),1);assert.equal(await page.evaluate(()=>sessionStorage.length),0);
 await page.screenshot({path:out+'/success-server-day.png',fullPage:true});await page.waitForTimeout(200);assert.equal(await page.locator('#success').isVisible(),true);assert.equal(requests.length,failedCount+1);
 await Promise.all([page.waitForEvent('domcontentloaded'),page.locator('#new-presence').click()]);assert.equal(page.url(),sameURL);await page.locator('#member-gate').waitFor();assert.equal(requests.length,failedCount+1);await page.locator('#member-yes').click();assert.equal(await page.locator('#nome').inputValue(),'');await page.screenshot({path:out+'/new-presence-empty.png',fullPage:true});await page.close();
 assert.deepEqual(authRequests,[]);assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);const afterHashes=preservedFiles.map(file=>digest(path.join(siteRoot,file)));assert.deepEqual(afterHashes,beforeHashes);
 const report={widths,nameNFKC:true,exactPayload:true,redirectWhitelist:true,noAuthRequests:true,noStorageReads:true,noPIIStorage:true,noPreactionPost:true,invalidAckRejected:true,missingDayRejected:true,invalidCalendarDaysRejected:true,timeout:true,retrySameUUID:true,changedNameNewUUID:true,doubleSubmitBlocked:true,serverDayOverridesClientClock:true,successHasNoPII:true,noAutoReset:true,newPresenceSameURL:true,newPresenceEmpty:true,levels0And2ByteIdentical:true,hashes:afterHashes,errors,realPosts:0};fs.writeFileSync(out+'/qa-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));await browser.close();
})().catch(error=>{console.error(error);process.exit(1)});
