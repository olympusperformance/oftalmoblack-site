/* Visual/regressão local. Todas as fontes externas são substituídas por fixtures. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const root=path.resolve(__dirname,'../public');
const out=process.env.BLACK_QA_DIR||fs.mkdtempSync(path.join(os.tmpdir(),'black-qa-'));
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{
  let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);if(name.endsWith('/'))name+='index.html';
  let file=path.join(root,name);if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.woff':'font/woff'})[path.extname(file)]||'application/octet-stream');res.end(data);});
});
function stub(isAdmin){return `
window.Club.cfg={supabaseUrl:'http://local.test',supabaseAnonKey:'test'};
const member={id:'10000000-0000-4000-8000-000000000001',nome:'Dra. Clínica de Teste',email:'test@example.test',iniciais:'CT',ativo:true,turma:'Black',fase:'Implantação',criado_em:'2026-04-01'};
const period=new Date().getFullYear()+'-T'+(Math.floor(new Date().getMonth()/3)+1);
const fixtures={members:[member],cb_quarters:[{member_id:member.id,period,attended:8,eligible:10,video_credits:8,weeks:10,followers_growth:2500,orphan_leads:0,sla_recorded:true,outcomes_percent:96,call_conversion:62,evidence:'Apuração de teste'}],cb_missions:[{id:'mission1',member_id:member.id,period,method_step:'D04',title:'Concluir a trilha Cultura Premium',weight:1,status:'requested',requested_on:'2026-09-01',due_on:'2026-09-10'}],cb_steps:[],cb_extras:[],cb_encontros:[],cb_grades:[],cb_cases:[],cb_case_files:[],cb_rewards:[],cb_redemptions:[],member_graduations:[]};
window.__writes=[];window.__fixtures=fixtures;window.__failTable=null;
window.Club.sb={supabaseUrl:'http://local.test',auth:{getSession:async()=>({data:{session:{access_token:'test',user:{id:'user1',email:'test@example.test'}}}}),signOut:async()=>({})},
rpc:async(name,args)=>({data:name==='me'?{is_admin:${isAdmin},email:member.email,member:${isAdmin?'null':'member'}}:name==='cb_ranking'?[{position:1,alias:member.nome,member_id:member.id,total:28.5,grade:1,movement:null}]:[]}),
functions:{invoke:async()=>({data:{status:'unlinked'}})},
from(table){let one=false,filters=[],write=null;let q={};
for(const key of ['select','order','gte','lte','gt','lt','or','in','is','not','limit','range'])q[key]=()=>q;
q.eq=(key,value)=>{filters.push([key,value]);return q;};q.maybeSingle=q.single=()=>{one=true;return q;};
q.insert=q.upsert=q.update=(row)=>{write=row;window.__writes.push({table,row});return q;};
q.then=(resolve,reject)=>{if(window.__failTable===table)return Promise.resolve({data:null,error:{message:'Fonte indisponível'}}).then(resolve,reject);let data=fixtures[table]||[];if(write){const old=data.find(r=>write.id&&r.id===write.id);const merged={...old,...write,id:write.id||'new-id'};fixtures[table]=old?data.map(r=>r===old?merged:r):[...data,merged];data=[merged];}else for(const [k,v] of filters)data=data.filter(r=>r[k]===v);return Promise.resolve({data:one?(data[0]||null):data}).then(resolve,reject);};return q;}};
const rpc=window.Club.sb.rpc;window.__failRanking=false;
window.Club.sb.rpc=async(name,args)=>{if(name==='cb_ranking'){if(window.__failRanking)return {data:null,error:{message:'Ranking indisponível'}};return {data:[{position:1,alias:member.nome,member_id:member.id,total:63.9,grade:2,source:'graduacao',is_demo:true,source_date:'2026-09-20',complete:false,movement:null}]};}return rpc(name,args);};
`;}
(function testDirectStorageHost(){const source=fs.readFileSync(path.join(root,'assets/club-black.js'),'utf8');assert.match(source,/\.storage\.supabase\.co/,'Upload grande deve usar o host direto recomendado pelo Storage');})();
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true});const errors=[];
 try{
  for(const isAdmin of [false,true]){
   const context=await browser.newContext({viewport:{width:1440,height:1080}});const page=await context.newPage();
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/assets/club-supabase.js',route=>route.fulfill({contentType:'text/javascript',body:stub(isAdmin)}));
   await page.route('https://**',route=>route.abort());
   await page.goto(url+(isAdmin?'/admin/':'/membros/'));
   await page.locator('#rail [data-nav="farol"][aria-selected=true]').waitFor();
   const mentoria=['Visão Geral','Subida: Rumo ao Olympus','Pendências','Protocolo Grau Zero','Graduação','Ranking Black','Vitrine Black','Instagram','Processos Black','Materiais','Agenda'];
   const menu=await page.locator('#rail .nav>span:not(.cb-badge)').allTextContents();
   assert.deepEqual(menu.slice(0,12),[...mentoria,'Fábrica · Íris Black']);
   assert.deepEqual(await page.locator('#rail .rail-grupo').allTextContents(),isAdmin?['Mentoria','Módulos à parte','Administração','Operação da equipe']:['Mentoria','Módulos à parte']);
   if(isAdmin)assert.deepEqual(menu.slice(12,14),['A Rede','Progressão']);
   else assert.equal(await page.locator('[data-view=rede]').count(),0);
   for(const key of ['home','encontro','iris','cerebro','profile'])assert.equal(await page.locator('#rail [data-nav="'+key+'"]').count(),0);
   assert.deepEqual(await page.locator('#navm [data-nav]').evaluateAll(nodes=>nodes.map(n=>n.dataset.nav)),await page.locator('#rail [data-nav]').evaluateAll(nodes=>nodes.map(n=>n.dataset.nav)));
   await page.locator('#rail [data-nav="subida"]').click();await page.locator('#black-subida .cb-card[data-cb-step]').last().waitFor();
   for(const selector of ['#black-subida h1','#black-subida h2','#black-subida .cb-number']){
    assert.match(await page.locator(selector).first().evaluate(el=>getComputedStyle(el).fontFamily),/InterOB/,'Áreas novas devem manter a Inter do painel atual');
   }
   assert.equal(await page.locator('#black-subida [data-cb-step]').count(),13); // 12 cartões + CTA da pendência
   await page.screenshot({path:path.join(out,isAdmin?'admin-desktop.png':'member-desktop.png'),fullPage:true});
   await page.locator('#rail').evaluate(el=>{el.style.height='auto';el.style.position='static';});
   await page.locator('header').evaluate(el=>el.style.visibility='hidden');
   await page.locator('#rail').screenshot({path:path.join(out,isAdmin?'admin-navigation.png':'member-navigation.png')});
   await page.locator('header').evaluate(el=>el.style.visibility='');
   await page.locator('#rail').evaluate(el=>{el.style.height='';el.style.position='';});
   await page.locator('#black-subida .cb-card[data-cb-step="D04"]').click();await page.locator('[data-cb-tab="audit"]').click();
   assert.match(await page.locator('.cb-drawer').innerText(),/Social Seller/);
   await page.keyboard.press('Escape');assert.equal(await page.locator('.cb-drawer').count(),0);
   await page.locator('#rail [data-nav="pendencias"]').click();await page.locator('#black-pendencias [data-cb-mission]').click();
   if(!isAdmin){assert.equal(await page.locator('.cb-drawer [name=status]').count(),0);await page.locator('.cb-drawer textarea[name=evidence]').fill('Entrega para conferência');await page.locator('.cb-drawer [type=submit]').click();await page.waitForFunction(()=>window.__writes.length>0);assert.equal((await page.evaluate(()=>window.__writes))[0].row.status,'submitted');}
   else {assert.equal(await page.locator('.cb-drawer [name=status]').count(),1);await page.keyboard.press('Escape');await page.locator('#rail [data-nav="subida"]').click();await page.locator('#black-subida .cb-card[data-cb-step="D04"]').click();await page.locator('[data-cb-step-edit]').click();await page.locator('[name=status]').selectOption('audited');await page.locator('[name=evidence]').fill('Critérios ainda incompletos');await page.locator('.cb-drawer [type=submit]').click();assert.match(await page.locator('.cb-form-error').innerText(),/todos os critérios/);await page.keyboard.press('Escape');}
   for(const key of ['ranking','vitrine','modulos','casos','graduacao','farol','artifacts','agenda',...(isAdmin?['rede','members']:[]),'subida']){await page.locator('#rail [data-nav="'+key+'"]').click();assert.equal(await page.locator('.view:not([hidden])').count(),1);}
   await page.locator('#rail [data-nav="agenda"]').click();await page.locator('[data-view=agenda] [data-nav=encontro]').click();assert.equal(await page.locator('[data-view=encontro]').isVisible(),true);
   await page.locator('#rail [data-nav=ranking]').click();await page.locator('#black-ranking .cb-table').waitFor();
   assert.match(await page.locator('#black-ranking .cb-own').innerText(),/63,9/);
   assert.match(await page.locator('#black-ranking .cb-own').innerText(),/Prévia da graduação/);
   assert.match(await page.locator('#black-ranking .cb-notice').innerText(),/dados de prévia/);
   await page.evaluate(()=>window.__failRanking=true);await page.locator('#black-ranking [data-cb-reload]').first().click();await page.locator('#black-ranking [role=alert]').waitFor();
   assert.match(await page.locator('#black-ranking [role=alert]').innerText(),/Não foi possível carregar/);
   assert.equal(await page.locator('#black-ranking .cb-table').count(),0);
   await page.evaluate(()=>window.__failRanking=false);await page.locator('#black-ranking [role=alert] [data-cb-reload]').click();await page.locator('#black-ranking .cb-table').waitFor();
   // A apuração importada aparece no placar principal, sem virar pontos da régua v2.2.
   await page.evaluate(()=>{
    window.__savedGraduationFixtures=JSON.parse(JSON.stringify(window.__fixtures));
    const f=window.__fixtures,id=f.members[0].id,period=f.cb_quarters[0].period;
    f.cb_quarters=[];f.cb_missions=[];
    f.member_graduations=[{member_id:id,source_date:'2026-09-30',is_demo:false,snapshot:{grade:2,sourceDate:'2026-09-30',periods:[{id:period,label:'Trimestre de teste',state:'closed',points:108.5,scores:{attendance:16.5,followers:20,videos:12},referrals:2,referralUnitPoints:25,bonus:10,followers:{growth:5100,estimated:true},cutoffDate:'2026-09-24'}]}}];
   });
   await page.locator('#rail [data-nav=graduacao]').click();
   await page.locator('#black-graduacao [data-cb-reload]').click();
   await page.locator('#black-graduacao .gr-big-points').waitFor();
   assert.match(await page.locator('#black-graduacao').innerText(),/108,5/);
   assert.match(await page.locator('#black-graduacao').innerText(),/30\/09\/2026/);
   assert.match(await page.locator('#black-graduacao').innerText(),/vale 25 pontos/);
   assert.doesNotMatch(await page.locator('#black-graduacao').innerText(),/Prévia da graduação|Placar v2.2/i);
   for(const width of [390,1440]){await page.setViewportSize({width,height:1080});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));await page.screenshot({path:path.join(out,(isAdmin?'admin':'member')+'-graduacao-'+width+'.png'),fullPage:true});}
   await page.evaluate(()=>{const f=window.__fixtures;f.cb_quarters=[{member_id:f.members[0].id,period:f.member_graduations[0].snapshot.periods[0].id,attended:0,eligible:10}];});
   await page.locator('#black-graduacao [data-cb-reload]').click();
   await page.locator('#black-graduacao .cb-score').waitFor();
   assert.match(await page.locator('#black-graduacao').innerText(),/Placar v2.2/i);
   assert.doesNotMatch(await page.locator('#black-graduacao').innerText(),/108,5/);
   await page.evaluate(()=>{for(const key of Object.keys(window.__fixtures))delete window.__fixtures[key];Object.assign(window.__fixtures,window.__savedGraduationFixtures);});
   await page.locator('#black-graduacao [data-cb-reload]').click();await page.locator('#black-graduacao .cb-score').waitFor();
   await page.locator('#rail [data-nav="modulos"]').click();assert.equal(await page.locator('#black-modulos .cb-module').count(),2);await page.locator('#black-modulos [data-nav=iris]').click();assert.equal(await page.locator('[data-view=iris]').isVisible(),true);
   if(!isAdmin){for(const key of ['cerebro','profile']){await page.locator('header [data-nav='+key+']').click();assert.equal(await page.locator('[data-view='+key+']').isVisible(),true);}}
   await page.locator('#rail [data-nav="subida"]').click();await page.locator('#black-subida .cb-card[data-cb-step=D08]').click();await page.locator('.cb-drawer [data-nav=encontro]').click();assert.equal(await page.locator('[data-view=encontro]').isVisible(),true);assert.equal(await page.locator('.cb-drawer').count(),0);
   await page.locator('#rail [data-nav="subida"]').click();
   for(const key of ['encontro','iris',...(!isAdmin?['home','cerebro','profile']:[])]){await page.evaluate(key=>location.hash=key,key);await page.locator('[data-view='+key+']').waitFor({state:'visible'});}
   await page.locator('#rail [data-nav="subida"]').click();
   for(const width of [320,430,560]){await page.setViewportSize({width,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));if(!isAdmin)assert.equal(await page.locator('header [data-nav=profile]').isVisible(),true);}
   await page.setViewportSize({width:390,height:844});
   if(!isAdmin){for(const key of ['cerebro','profile']){await page.locator('header [data-nav='+key+']').click();assert.equal(await page.locator('[data-view='+key+']').isVisible(),true);}await page.locator('#navm [data-nav=subida]').click();}
   await page.screenshot({path:path.join(out,isAdmin?'admin-mobile.png':'member-mobile.png'),fullPage:true});
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Overflow horizontal no mobile');
   await page.evaluate(()=>document.documentElement.dataset.theme='light');await page.screenshot({path:path.join(out,isAdmin?'admin-light.png':'member-light.png'),fullPage:true,animations:'disabled'});
   if(!isAdmin){
    await page.setViewportSize({width:1440,height:1080});
    let offset=0,patches=0,retried=false,heads=0;
    const uploadHeaders={'Access-Control-Allow-Origin':'*','Access-Control-Expose-Headers':'Location,Upload-Offset','Access-Control-Allow-Headers':'authorization,tus-resumable,upload-length,upload-metadata,upload-offset,content-type','Access-Control-Allow-Methods':'POST,PATCH,HEAD,OPTIONS','Tus-Resumable':'1.0.0'};
    await page.route('http://local.test/storage/v1/upload/resumable**',async route=>{
      const req=route.request();if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:uploadHeaders});
      if(req.method()==='POST')return route.fulfill({status:201,headers:{...uploadHeaders,Location:'http://local.test/storage/v1/upload/resumable/qa'}});
      if(req.method()==='HEAD'){heads++;return route.fulfill({status:200,headers:{...uploadHeaders,'Upload-Offset':String(offset)}});}
      assert.equal(Number(req.headers()['upload-offset']),offset);
      if(offset>0&&!retried){retried=true;return route.fulfill({status:500,headers:uploadHeaders});}
      offset+=req.postDataBuffer().length;patches++;return route.fulfill({status:204,headers:{...uploadHeaders,'Upload-Offset':String(offset)}});
    });
    await page.locator('#rail [data-nav="casos"]').click();await page.locator('#black-casos [data-cb-case-new]').click();
    await page.locator('.cb-form').evaluate(f=>{for(const i of f.querySelectorAll('input[type=text],textarea'))i.value='Dado de teste';f.elements.code.value='MGZ-QA';f.elements.initials.value='QA';f.elements.age.value='55';f.elements.consent.checked=true;});
    const pdfSize=90*1024*1024;
    await page.locator('.cb-form [name=files]').evaluate((input,size)=>{const data=new DataTransfer();data.items.add(new File(['%PDF-1.7\n',new Uint8Array(size-9)],'exame-desidentificado.pdf',{type:'application/pdf'}));input.files=data.files;input.dispatchEvent(new Event('change',{bubbles:true}));},pdfSize);
    await page.locator('.cb-form [type=submit]').click();await page.waitForFunction(()=>window.__writes.some(w=>w.table==='cb_case_files'),{},{timeout:60000});
    assert.equal(offset,pdfSize);assert.equal(patches,15);assert.equal(heads,1);
    const uploaded=await page.evaluate(()=>window.__writes.find(w=>w.table==='cb_case_files').row);assert.equal(uploaded.size_bytes,pdfSize);assert.ok(uploaded.path.endsWith('.pdf'));assert.ok(!uploaded.path.includes('exame-desidentificado'));
    await page.locator('.cb-drawer').waitFor({state:'detached'});await page.locator('#rail [data-nav="subida"]').click();
   }
   await page.evaluate(()=>window.__failTable='cb_missions');await page.locator('#black-subida [data-cb-reload]').click();await page.locator('#black-subida [role=alert]').waitFor();
   assert.equal(await page.locator('#black-subida .cb-card').count(),0,'Fonte indisponível não deve parecer um painel zerado');
   await context.close();
  }
  assert.deepEqual(errors,[]);console.log('Browser: navegação, drawer, permissão, evidência, auditoria incompleta, erro de fonte, mobile e PDF de 90 MB com retomada OK.');console.log('Capturas: '+out);
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
