/* Navegador headless isolado, somente servidor local e dados sintéticos. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os'),vm=require('node:vm');
const assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'../public'),out=process.env.BOOK_QA_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'livro-qa-'));
fs.mkdirSync(out,{recursive:true});
const existing=fs.readFileSync(path.join(__dirname,'black-browser.cjs'),'utf8');
const stub=vm.runInNewContext(existing.slice(existing.indexOf('function stub('),existing.indexOf('(function testDirectStorageHost'))+';stub',{methodCatalog:require('./fixtures/method-catalog.json')});
const now=new Date().toISOString(),rows=[{source:'ga4',last_success_at:now,payload:{rows:[{date:'2026-10-22',key:'post:123456',media_id:'123456',views:8,checkout_clicks:3}],time_zone:'America/Manaus'}},{source:'greenn',last_success_at:now,payload:{rows:[{date:'2026-10-22',key:'post:123456',media_id:'123456',paid_sales:1,revenue_cents:105000},{date:'2026-10-22',key:'unattributed',paid_sales:2,revenue_cents:105000}],time_zone:'America/Manaus',webhook_active:true}}];
const extra=`fixtures.book_dashboard_snapshots=${JSON.stringify(rows)};fixtures.book_publications=[{media_id:'123456',title:'Como tratar a presbiopia <img src=x onerror=alert(1)>',permalink:'https://www.instagram.com/reel/Teste/'}];`;
const server=http.createServer((req,res)=>{let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name.endsWith('/'))name+='index.html';const file=path.join(root,name);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.woff2':'font/woff2','.woff':'font/woff'})[path.extname(file)]||'application/octet-stream');res.end(data);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,...(process.env.BOOK_BROWSER_EXECUTABLE?{executablePath:process.env.BOOK_BROWSER_EXECUTABLE}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/assets/club-supabase.js',r=>r.fulfill({contentType:'text/javascript',body:stub(true)+extra}));await page.route('https://**',r=>r.abort());
  await page.goto('http://127.0.0.1:'+server.address().port+'/admin/#livro');
  await page.locator('#livroPanel .book-table tbody tr').last().waitFor();
  assert.equal(await page.locator('#rail [data-nav=livro]').count(),1);
  assert.equal(await page.locator('#livroPanel .book-kpi strong').nth(2).innerText(),'3');
  assert.match(await page.locator('#livroPanel .book-kpi strong').nth(3).innerText(),/2\.100,00/);
  assert.equal(await page.locator('#livroPanel .book-table img').count(),0);
  assert.equal(await page.locator('#livroPanel .book-table a').getAttribute('href'),'https://www.instagram.com/reel/Teste/');
  await page.screenshot({path:path.join(out,'livro-desktop.png'),fullPage:true});
  await page.evaluate(()=>{window.__failTable='book_dashboard_snapshots';});await page.locator('[data-book=refresh]').click();await page.getByText('Não foi possível ler os dados.',{exact:false}).waitFor();
  assert.equal(await page.locator('#livroPanel .book-kpi strong').nth(2).innerText(),'3');
  await page.evaluate(()=>{window.__failTable=null;fixtures.book_dashboard_snapshots[0].error='test';});await page.locator('[data-book=refresh]').click();await page.getByText('Atualização pendente. Exibindo a última coleta.').waitFor();
  await page.locator('.book-import summary').click();
  await page.locator('[data-book=file]').setInputFiles({name:'origens.csv',mimeType:'text/csv',buffer:Buffer.from('sale_id,product_id,utm_source,utm_content,Email\n42,199893,ig,direct-post-123456,private@example.test')});
  await page.getByText('1 origens válidas',{exact:true}).waitFor();await page.locator('[data-book=import]').click();await page.getByText('1 origens salvas.',{exact:false}).waitFor();
  const writes=await page.evaluate(()=>window.__writes.filter(w=>w.table==='book_sale_attributions'));assert.equal(writes.length,1);assert.ok(!JSON.stringify(writes).includes('private'));assert.equal(writes[0].row[0].sale_id,42);
  await page.locator('.book-import summary').click();
  await page.evaluate(()=>document.documentElement.setAttribute('data-theme','light'));await page.screenshot({path:path.join(out,'livro-light.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'livro-mobile.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Sem transbordamento horizontal da página');
  for(const width of [320,390,430]){
   await page.setViewportSize({width,height:844});await page.evaluate(()=>window.scrollTo(0,0));
   assert.equal(await page.locator('.book-mobile-card:visible').count(),2,'Publicações em cartões no celular');
   assert.equal(await page.locator('.book-mobile-card').first().locator('dl > div').count(),4,'Quatro métricas por publicação');
   assert.match(await page.locator('.book-mobile-card').first().innerText(),/1\.050,00/);
   assert.ok(await page.locator('.book-mobile-card').first().evaluate(e=>e.scrollWidth<=e.clientWidth),'Cartão sem rolagem horizontal');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Página cabe na tela '+width);
   const touch=await page.locator('[data-book=filters] button').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().height>=44));assert.ok(touch,'Alvos de toque de pelo menos44px');
   await page.screenshot({path:path.join(out,'livro-mobile-'+width+'.png'),fullPage:true});
  }
  await page.getByText('Origem automática conectada',{exact:true}).waitFor();
  await page.evaluate(()=>{fixtures.book_dashboard_snapshots=fixtures.book_dashboard_snapshots.filter(s=>s.source!=='ga4');});await page.locator('[data-book=refresh]').click();await page.getByText('Ainda sem coleta confirmada').waitFor();assert.equal(await page.locator('#livroPanel .book-kpi strong').first().innerText(),'Indisponível');
  await page.evaluate(()=>fixtures.book_dashboard_snapshots.find(s=>s.source==='greenn').payload.rows.push({date:'2026-10-22',key:'story:123456',story_id:'123456',paid_sales:1,revenue_cents:105000}));await page.locator('[data-book=refresh]').click();
  await page.locator('.book-mobile-card').filter({hasText:'Story do Instagram · 123456'}).waitFor();
  assert.match(await page.locator('[data-book=coverage]').innerText(),/2 de 4 vendas/);
  assert.equal(await page.locator('.book-table tr').filter({hasText:'Story do Instagram · 123456'}).getByText('Resposta ao story · origem identificada',{exact:true}).count(),1);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({admin_navigation:'ok',financial_display:'ok',source_failure:'ok',csv_privacy:'ok',responsive:'ok',screenshots:out}));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
