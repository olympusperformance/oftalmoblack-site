const {createRequire} = require('node:module');
const {chromium} = createRequire(process.env.PLAYWRIGHT_MODULE || 'C:/Users/Dr Alex Sá 01/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/')('playwright');
const path = require('node:path'), fs = require('node:fs'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../public');
const live = process.env.BLACK_QA_LIVE === '1';
const out = process.env.BLACK_QA_OUT || path.resolve(__dirname, '../../../../../analises/revisao-home-2026-10-24/qa', live ? 'production' : 'local');
fs.mkdirSync(out, {recursive:true});
const reports = [];
(async () => {
 const browser = await chromium.launch({headless:true, channel:'msedge'});
 try {
  async function setup(width, javaScriptEnabled=true) {
   const context = await browser.newContext({viewport:{width,height:844},javaScriptEnabled});
   const errors=[], missing=[], external=[], posts=[];
   await context.route('**/*', async route => {
    const request=route.request(), url=new URL(request.url());
    if(url.pathname.endsWith('/club-cadastro')) {
     const body=JSON.parse(request.postData());posts.push(body);
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,id:body.submission_id})});
    }
    if(url.hostname!=='oftalmoblack.com.br') {external.push(request.url());return route.fulfill({status:200,body:'',contentType:'application/javascript'});}
    if(live)return route.continue();
    const file=path.resolve(root,'.'+decodeURIComponent(url.pathname)+(url.pathname.endsWith('/')?'index.html':''));
    if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){missing.push(url.pathname);return route.fulfill({status:404,body:'missing'});}
    return route.fulfill({path:file,contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':undefined});
   });
   const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
   return {context,page,errors,missing,external,posts};
  }
  for(const width of [320,390,768,1440]) {
   const t=await setup(width);await t.page.goto('https://oftalmoblack.com.br/?qa=1#aplicacao');
   await t.page.locator('.home-hero-title').waitFor({state:'visible'});
   await t.page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));document.querySelectorAll('.rev').forEach(e=>{e.style.opacity='1';e.style.transform='none';});window.scrollTo({top:0,behavior:'instant'});});
   const metrics=await t.page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,copy:document.body.innerText,brokenAnchors:[...document.querySelectorAll('a[href^="#"]')].map(a=>a.hash).filter(h=>!document.getElementById(h.slice(1)))}));
   assert.equal(metrics.scrollWidth,width,'horizontal overflow');assert.deepEqual(metrics.brokenAnchors,[]);
   for(const text of ['Cérebro Black','mais de 30 mil cirurgias','mais de 15 anos','apoio na execução'])assert(metrics.copy.toLowerCase().includes(text.toLowerCase()),text);
   for(const text of ['Eu não faço tráfego','48h úteis','20% de desconto','45 cirurgias','Turmas todo mês','Adquira seu ingresso','Vivência prévia conosco'])assert(!metrics.copy.includes(text),text);
   assert(!/[—–]/.test(metrics.copy));
   assert.equal(await t.page.locator('form').count(),0);
   assert.equal(await t.page.locator('a[href="/hands-on-grau-zero/"]').count(),1);
   assert.equal(await t.page.locator('a[href="/entrar/"]').count(),1);
   assert.equal(await t.page.locator('a[href*="catarataclass.com.br"],a[href*="5592914418889"]').count(),0);
   await t.page.screenshot({path:path.join(out,`home-${width}.png`)});
   if(width===390||width===1440)await t.page.screenshot({path:path.join(out,`home-full-${width}.png`),fullPage:true});
   assert.deepEqual(t.errors,[]);assert.deepEqual(t.missing,[]);assert.deepEqual(t.external,[]);assert.equal(t.posts.length,0);
   reports.push({scenario:`home-${width}`,noOverflow:true,qaSuppressed:true,anchorsValid:true});await t.context.close();
  }
  const t=await setup(390);
  await t.page.goto('https://oftalmoblack.com.br/?utm_source=imersao&utm_medium=qrcode&utm_campaign=club&utm_content=site-principal&aid=123&fbclid=abc123&email=private@example.test#aplicacao');
  const telemetry=await t.page.evaluate(()=>({meta:(window.fbq?.queue||[]).map(x=>Array.from(x)),ga:(window.dataLayer||[]).map(x=>Array.from(x)),url:location.href,targets:[...document.querySelectorAll('[data-club-link]')].map(a=>a.href)}));
  assert(!telemetry.url.includes('private'));assert(telemetry.url.endsWith('#aplicacao'));
  assert.equal(telemetry.meta.filter(x=>x[0]==='init'&&x[1]==='919253591198015').length,1);
  assert(!JSON.stringify(telemetry).includes('2561269564312861'));
  for(const event of ['PageView','ViewContent'])assert.equal(telemetry.meta.filter(x=>x[0]==='track'&&x[1]===event).length,1);
  for(const event of ['Lead','Contact','Purchase','InitiateCheckout'])assert.equal(telemetry.meta.filter(x=>x[0]==='track'&&x[1]===event).length,0);
  assert.equal(telemetry.ga.filter(x=>x[0]==='event'&&x[1]==='page_view').length,1);
  assert(telemetry.targets.length>2);
  for(const target of telemetry.targets){const u=new URL(target);assert.equal(u.pathname,'/club/');assert.equal(u.hash,'#cadastro');assert.equal(u.searchParams.get('utm_source'),'imersao');assert.equal(u.searchParams.get('aid'),'123');assert.equal(u.searchParams.get('fbclid'),'abc123');assert(!u.searchParams.has('email'));}
  await t.page.locator('#aplicacao [data-club-link]').click();await t.page.waitForURL('**/club/**');
  await t.page.locator('#club-submit').waitFor({state:'visible'});assert.equal(await t.page.locator('form input').count(),2);
  await t.page.locator('#club-submit').click();assert.equal(t.posts.length,0);
  await t.page.locator('[name=full_name]').fill('Pessoa Verificação');await t.page.locator('[name=phone]').fill('+1 202 555 0100');
  await t.page.locator('#club-submit').click();await t.page.locator('#club-success').waitFor({state:'visible'});
  assert.equal(t.posts.length,1);assert.equal(t.posts[0].utm.utm_content,'site-principal');assert.equal(t.posts[0].utm.aid,'123');
  const wa=new URL(await t.page.locator('#jean-whatsapp').getAttribute('href'));assert.equal(wa.pathname,'/5511993436267');
  assert.equal(wa.searchParams.get('text'),'Olá, Jean! Fiz meu cadastro na página do Club OftalmoBlack e quero saber mais sobre a mentoria.');
  assert.deepEqual(t.errors,[]);assert.deepEqual(t.missing,[]);
  await t.page.screenshot({path:path.join(out,'club-confirmed-390.png')});
  reports.push({scenario:'home-to-existing-registration',attributionPreserved:true,b2bPixel:true,piiExcluded:true,receiptRequired:true,submissionIntercepted:true});await t.context.close();
  const nojs=await setup(390,false);await nojs.page.goto('https://oftalmoblack.com.br/?qa=1');
  assert.equal(await nojs.page.locator('#aplicacao [data-club-link]').getAttribute('href'),'/club/#cadastro');
  assert.equal(await nojs.page.locator('#recebe').isVisible(),true);
  reports.push({scenario:'no-javascript',contentVisible:true,cadastroLinkWorks:true});await nojs.context.close();
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({live,checkedAt:new Date().toISOString(),reports,transport:'All writes, external analytics and WhatsApp navigation intercepted. No real lead created.'},null,2));
  console.log(JSON.stringify({passed:reports.length,out}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
