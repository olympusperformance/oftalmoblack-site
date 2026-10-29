// Regression: a preserved v0 submit must reach the real CAPI validator.
// Only external storage/Meta are simulated; no live writes are permitted.
const {createRequire}=require('node:module');
const {chromium}=createRequire('C:/Users/Dr Alex Sá 01/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/')('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
(async()=>{
 const {createHandler}=await import('../supabase/functions/hands-on-capi/core.mjs');
 const root=path.resolve(__dirname,'../public'),rows=new Map(),external=[];
 const html=fs.readFileSync(path.join(root,'hands-on-grau-zero/v0/index.html'),'utf8');
 const key=html.match(/data-capi-key="([^"]+)"/)[1];
 let sheetWrites=0,metaWrites=0;
 const handler=createHandler({env:{anonKey:key,productionEnabled:true,sheetEndpoint:'https://sheet.test/'},
  db:{rate:async()=>true,get:async id=>rows.get(id),insert:async row=>{rows.set(row.event_id,row);return row;}},
  fetcher:async(url,options)=>{
   if(url!=='https://sheet.test/'){metaWrites++;throw Error('External Meta write prohibited');}
   sheetWrites++;return Response.json({ok:true,request_id:JSON.parse(options.body).request_id});
  }});
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}});
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(url.pathname.endsWith('/hands-on-capi')){
    const response=await handler(new Request(request.url(),{method:request.method(),headers:{...request.headers(),origin:'https://oftalmoblack.com.br'},body:request.postData()}));
    return route.fulfill({status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
   }
   if(url.hostname!=='oftalmoblack.com.br'){external.push(url.hostname);return route.abort();}
   const file=path.resolve(root,'.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''));
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.abort();
   return route.fulfill({path:file,contentType:file.endsWith('.html')?'text/html':file.endsWith('.js')?'application/javascript':undefined});
  });
  const page=await context.newPage();
  await page.goto('https://oftalmoblack.com.br/hands-on-grau-zero/v0/?qa=1');
  await page.locator('#nome').fill('QA Olympus');await page.locator('#whatsapp').fill('11999990000');
  await page.locator('#crm').fill('12345');await page.locator('#uf').selectOption('AM');
  await page.locator('[data-testid="continue-step"]').click();
  await page.locator('#experiencia_catarata').selectOption('ainda_nao_opero');
  await page.locator('#cirurgias_mes').fill('0');
  await page.locator('#experiencia_lentes').selectOption('ainda_nao_implanto');
  await page.locator('#oferta_premium').selectOption('nao');await page.locator('#clinica').selectOption('nao');
  await page.locator('[data-testid="final-submit"]').click();
  await page.getByRole('button',{name:'Candidatura recebida',exact:true}).waitFor();
  assert.equal(sheetWrites,1);assert.equal(metaWrites,0);assert.deepEqual(external,[]);
  assert.equal(rows.size,1);const receipt=[...rows.values()][0];
  assert.equal(receipt.mode,'qa');assert.equal(receipt.sheet_confirmed,true);assert.equal(receipt.status,'qa');
  assert.equal(receipt.event_name,'Lead');assert(receipt.event_id.endsWith(':Lead'));
  console.log(JSON.stringify({passed:true,v0ReceiptConfirmed:true,simulatedSheetWrites:sheetWrites,liveExternalWrites:0,analyticsRequests:0}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
