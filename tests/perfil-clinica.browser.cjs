const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),assert=require('assert/strict');
const path=require('node:path'),os=require('node:os');
const base=process.env.PERFIL_TEST_URL||'http://127.0.0.1:8773/perfil-clinica/';
const sourceOrigin=new URL(base).origin;
(async()=>{
 const out=process.env.PERFIL_QA_DIR||path.join(os.tmpdir(),'perfil-clinica-multistep-qa');fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,...(process.env.BLACK_BROWSER_CHANNEL?{channel:process.env.BLACK_BROWSER_CHANNEL}:{})});const page=await browser.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const original=setTimeout;window.setTimeout=(fn,ms,...args)=>original(fn,ms===18000?120:ms,...args)});
 let mode='badack',posts=[];
 await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin===sourceOrigin){await route.continue();return;}if(u.hostname==='zpyxnkuvircukjlfexrv.supabase.co'){const b=route.request().postDataJSON();posts.push(b);const current=mode;if(current==='timeout')await new Promise(r=>setTimeout(r,250));if(current==='slow')await new Promise(r=>setTimeout(r,70));await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(current==='badack'?{ok:true,id:'wrong'}:{ok:true,id:b.submission_id})}).catch(()=>{});return;}await route.abort();});
 const panel=key=>page.locator('[data-step="'+key+'"]');
 async function at(key){await panel(key).waitFor({state:'visible'});assert.equal(await page.locator('[data-step]:visible').count(),1);}
 async function clickRadio(name,value,next){await page.locator('[name="'+name+'"][value="'+value+'"]').click();await at(next);}
 async function pause(){await page.waitForTimeout(300);}
 const checks=[];
 for(const width of [360,390,768,1280]){
  await page.setViewportSize({width,height:900});await page.goto(base+'?origem=presencial&utm_source=qa&utm_medium=qa');await page.evaluate(()=>document.fonts.ready);await at('contatos');
  await page.screenshot({path:out+'/'+width+'-contacts.png',fullPage:true});assert.equal(await page.locator('#question-meta').isVisible(),false);
  await page.locator('#submit-button').click();await at('contatos');assert.equal(posts.length,0);
  await page.locator('#nome').fill('QA Frontend');await page.locator('#email').fill('usuario@clinica');await page.locator('#whatsapp').fill('(55) 99999-9999');await page.locator('#whatsapp').press('Enter');await at('contatos');assert.equal(await page.locator('#email').evaluate(el=>el.validity.customError),true);assert.equal(posts.length,0);await page.locator('#email').fill('qa@example.invalid');assert.equal(await page.locator('#email').evaluate(el=>el.validity.customError),false);await page.locator('#whatsapp').press('Enter');await at('lentes');assert.match(await page.locator('#question-step').innerText(),/1 de 3/);assert.equal(posts.length,0);
  await page.locator('#submit-button').click();await at('lentes');
  await page.locator('[name=lentes_premium][value=sim]').click();await page.locator('#back-button').click();await at('contatos');await pause();await at('contatos');assert.equal(await page.locator('#nome').inputValue(),'QA Frontend');
  await page.locator('#submit-button').click();await at('lentes');await clickRadio('lentes_premium','sim','volume');assert.match(await page.locator('#question-step').innerText(),/2 de 4/);
  await clickRadio('volume_lentes','6_10','faturamento');await clickRadio('faturamento','50_100','desafios');assert.match(await page.locator('#question-step').innerText(),/4 de 4/);
  await page.locator('[name=desafios][value=atrair_particulares]').check();await page.locator('[name=desafios][value=equipe_processos]').check();await page.locator('#outro').check();await page.locator('#outro-desafio').fill('QA desafio');await pause();await at('desafios');assert.equal(posts.length,0);
  await page.screenshot({path:out+'/'+width+'-challenges.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.locator('#back-button').click();await at('faturamento');assert.equal(await page.locator('[name=faturamento][value="50_100"]').isChecked(),true);
  await page.locator('#back-button').click();await at('volume');assert.equal(await page.locator('[name=volume_lentes][value="6_10"]').isChecked(),true);
  await page.locator('#back-button').click();await at('lentes');await clickRadio('lentes_premium','nao','faturamento');assert.equal(await page.locator('[name=volume_lentes]:checked').count(),0);assert.match(await page.locator('#question-step').innerText(),/2 de 3/);
  await clickRadio('faturamento','50_100','desafios');assert.equal(await page.locator('[name=desafios]:checked').count(),3);assert.equal(await page.locator('#outro-desafio').inputValue(),'QA desafio');
  await page.locator('#outro').uncheck();assert.equal(await page.locator('#outro-desafio').inputValue(),'');await page.locator('#outro').check();await page.locator('#submit-button').click();await at('desafios');assert.equal(posts.length,0);
  await page.locator('#outro').uncheck();checks.push({width,emailDomainValidatedAtContact:true,emailValidityClearsOnEdit:true,backPreserves:true,branches:true,multiple:true,otherRequired:true,noPartialPost:true});
 }
 mode='badack';await page.locator('#submit-button').click();await page.locator('#form-message').waitFor({state:'visible'});assert.equal(posts.length,1);assert.equal(await page.locator('#success').isVisible(),false);assert.equal(posts[0].volume_lentes,null);assert.equal(posts[0].outro_desafio,null);assert.equal(posts[0].desafios.length,2);assert.equal(posts[0].whatsapp,'+5555999999999');
 mode='timeout';await page.locator('#submit-button').click();await page.locator('#form-message').waitFor({state:'visible'});assert.equal(posts.length,2);assert.equal(posts[0].submission_id,posts[1].submission_id);
 await page.locator('[name=desafios][value=dependencia]').check();mode='slow';await page.evaluate(()=>{const f=document.querySelector('form');f.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));f.dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));});await page.locator('#success').waitFor();assert.equal(posts.length,3);assert.notEqual(posts[2].submission_id,posts[1].submission_id);assert.equal(await page.locator('#nome,#email,#whatsapp').count(),0);assert.equal(await page.evaluate(()=>localStorage.length+sessionStorage.length),0);assert.deepEqual(errors,[]);
 await page.screenshot({path:out+'/success.png',fullPage:true});console.log(JSON.stringify({checks,invalidAckRejected:true,timeout:true,retryStableId:true,editedPayloadNewId:true,duplicateBlocked:true,contactsRemoved:true,noStorage:true,errors,screenshots:out}));await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
