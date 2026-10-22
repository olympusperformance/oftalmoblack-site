const {chromium}=require('C:/Users/Dr Alex Sá 01/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
const {pathToFileURL}=require('url');
(async()=>{
 const out=process.env.BOOK_FRETE_QA||path.resolve('../..','livro-presbiopia-cirurgica/_qa/liberacao-frete-manual-2026-10-22');fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({channel:'msedge',headless:true});const results=[];
 for(const width of [320,390,768,1280]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const base=process.env.BOOK_BASE;
  await context.route(/^https?:/,route=>base&&new URL(route.request().url()).origin===new URL(base).origin?route.continue():route.abort()); // Nenhum evento, WhatsApp ou compra real.
  const mainUrl=base?new URL('livro/',base).href:pathToFileURL(path.resolve('public/livro/index.html')).href;
  await page.goto(mainUrl+'?utm_source=credencial&utm_medium=qrcode&utm_campaign=imersao_grau_zero_out26&utm_content=livro');
  await page.locator('#oferta').scrollIntoViewIfNeeded();
  assert.match(await page.locator('.card__log').innerText(),/calcula o frete manualmente/);
  assert.match(await page.locator('.card__safe').innerText(),/não está incluído neste pagamento/);
  for(const a of await page.locator('a.js-checkout').all()){const u=new URL(await a.getAttribute('href'));assert.equal(u.pathname,'/199173');assert.equal(u.searchParams.get('ch_id'),'144678');}
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.screenshot({path:path.join(out,`${width}-oferta.png`)});
  const [checkoutRequest]=await Promise.all([context.waitForEvent('request',{predicate:r=>r.url().startsWith('https://payfast.greenn.com.br/199173?')}),page.locator('a.js-checkout').first().click()]);
  const checkoutUrl=new URL(checkoutRequest.url());assert.equal(checkoutUrl.searchParams.get('ch_id'),'144678');assert.equal(checkoutUrl.searchParams.get('utm_source'),'credencial');assert.equal(checkoutUrl.searchParams.get('src'),'lp-livro');
  await page.goto((base?new URL('livro/obrigado/',base).href:pathToFileURL(path.resolve('public/livro/obrigado/index.html')).href)+'?email=nao-repassar%40example.com&phone=000');
  const contact=page.getByRole('link',{name:'Calcular frete no WhatsApp'});assert.ok(await contact.isVisible());
  const u=new URL(await contact.getAttribute('href'));assert.equal(u.pathname,'/559284654390');
  assert.match(u.searchParams.get('text'),/confirmar a entrega e calcular o frete/);assert.ok(!u.toString().includes('example'));
  assert.equal(await page.locator('.frete li').count(),3);
  const conversions=await page.evaluate(()=>({meta:window.fbq?.queue?.filter(x=>x[1]==='CompraLivro')||[],ga:(window.dataLayer||[]).filter(x=>x[1]==='compra_livro')}));
  assert.equal(conversions.meta.length+conversions.ga.length,0);
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.deepEqual(errors,[]);
  await page.screenshot({path:path.join(out,`${width}-pos-compra.png`),fullPage:true});results.push({width,passed:true});await context.close();
 }
 await browser.close();fs.writeFileSync(path.join(out,'resultado.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
})().catch(e=>{console.error(e);process.exit(1)});
