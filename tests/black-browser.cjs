/* Visual/regressão local. Todas as fontes externas são substituídas por fixtures. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'@playwright/test');
const methodCatalog=require('./fixtures/method-catalog.json');
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
fixtures.artifacts=[{id:'site-qa',nome:'Site Institucional',tipo:'artefato',method_steps:['D05'],status:'Em andamento',url:'https://example.test/entrega'},{id:'private-qa',nome:'Tracker privado',tipo:'artefato',somente_equipe:true,method_steps:['D05']},{id:'other-qa',nome:'Entrega de outro membro',tipo:'artefato',member_id:'10000000-0000-4000-8000-000000000002',method_steps:['D05']}];
fixtures.artifacts.push({id:'archived-stage',nome:'Agrupador legado arquivado',tipo:'artefato',method_steps:['D04'],archived_at:'2026-10-01'},{id:'shared-training',nome:'Treinamento comercial',tipo:'artefato',method_steps:['D04','D09','D10','TREINO'],status:'Disponível'},{id:'quiz',nome:'Quiz',tipo:'artefato',method_steps:[],status:'Disponível'},{id:'iris',nome:'Íris Black',tipo:'artefato',method_steps:[],status:'Disponível'});
fixtures.members.push({...member,id:'10000000-0000-4000-8000-000000000002',nome:'Outro mentorado'});
fixtures.artifacts.push({id:'onboarding-qa',nome:'Onboarding',tipo:'artefato',method_steps:['D01'],status:'Em produção'});
fixtures.artifact_steps=[{id:'onboarding-accept',artifact_id:'onboarding-qa',titulo:'Aceite',ordem:0,tipo:'aceite'},{id:'step-qa',artifact_id:'site-qa',titulo:'Site publicado',ordem:1,tipo:'entrega'}];
fixtures.step_progress=[{member_id:member.id,step_id:'step-qa',feito:true,feito_em:'2026-09-01'}];
fixtures.artifacts.push({id:'editorial-qa',nome:'Linha Editorial',subtitulo:'Feed e stories na voz do Mestre',meta:'Entrega em 2 dias',tipo:'artefato',method_steps:['D02'],status:'Disponível',url:'/materiais/'});
fixtures.artifact_steps.push(...Array.from({length:18},(_,i)=>({id:'editorial-step-'+i,artifact_id:'editorial-qa',titulo:'Etapa de implantação '+(i+1),ordem:i,tipo:'entrega'})));
fixtures.step_progress.push({member_id:member.id,step_id:'editorial-step-0',feito:true,feito_em:'2026-09-01'});
const methodCatalog=${JSON.stringify(methodCatalog)};
fixtures.cb_method_stages=methodCatalog.stages;fixtures.cb_deliveries=methodCatalog.deliveries;fixtures.cb_checklist_catalog=methodCatalog.items;
fixtures.cb_delivery_artifacts=methodCatalog.bindings.flatMap(b=>fixtures.artifacts.filter(a=>a.nome===b.artifact_name&&a.method_steps.includes(b.stage_id)).map(a=>({...b,artifact_id:a.id})));
if(${isAdmin})fixtures.cb_checklist_requests=[{id:'pedido-1',member_id:member.id,item_id:'D07-02',edition:'',requested_at:'2026-10-01T12:00:00Z',resolved_at:null}];
fixtures.cb_vouchers=[{id:'voucher-1',member_id:member.id,origin:'indicação convertida (Dra. M., Mentoria Grau Zero)',note:'Nota interna',status:'em_maos',granted_on:'2026-06-10'}];
window.__writes=[];window.__fixtures=fixtures;window.__failTable=null;
window.Club.sb={supabaseUrl:'http://local.test',auth:{getSession:async()=>({data:{session:{access_token:'test',user:{id:'user1',email:'test@example.test'}}}}),signOut:async()=>({})},
rpc:async(name,args)=>name==='marcar_etapa'?(window.__writes.push({table:'marcar_etapa',row:args}),{data:{member_id:args.p_member_id,step_id:args.p_step_id,feito:args.p_feito,feito_em:args.p_feito?new Date().toISOString():null}}):({data:name==='me'?{is_admin:${isAdmin},email:member.email,member:${isAdmin?'null':'member'}}:name==='cb_ranking'?[{position:1,alias:member.nome,member_id:member.id,total:28.5,grade:1,movement:null}]:[]}),
functions:{invoke:async()=>({data:{status:'unlinked'}})},
from(table){let one=false,filters=[],write=null,conflict=null;let q={};
for(const key of ['select','order','gte','lte','gt','lt','or','in','is','not','limit','range'])q[key]=()=>q;
q.eq=(key,value)=>{filters.push([key,value]);return q;};q.maybeSingle=q.single=()=>{one=true;return q;};
q.insert=q.upsert=q.update=(row,options)=>{write=row;conflict=options&&options.onConflict;window.__writes.push({table,row});return q;};
q.then=(resolve,reject)=>{if(window.__failTable===table)return Promise.resolve({data:null,error:{message:'Fonte indisponível'}}).then(resolve,reject);let data=fixtures[table]||[];if(write){const old=data.find(r=>write.id&&r.id===write.id||conflict&&conflict.split(',').every(k=>r[k]===write[k]));const merged={...old,...write,id:write.id||'new-id'};fixtures[table]=old?data.map(r=>r===old?merged:r):[...data,merged];data=[merged];}else for(const [k,v] of filters)data=data.filter(r=>r[k]===v);return Promise.resolve({data:one?(data[0]||null):data}).then(resolve,reject);};return q;}};
const rpc=window.Club.sb.rpc;window.__failRanking=false;
window.__rankingRequests=[];
window.__ranking=[{position:1,alias:member.nome,member_id:member.id,total:63.9,grade:2,source:'graduacao',is_demo:true,source_date:'2026-09-20',complete:false,movement:null},...['Clínica Aurora','Clínica Horizonte','Clínica Novo Olhar','Consultório Central','Clínica Vista'].map((alias,i)=>({position:[2,2,3,4,5][i],alias:${isAdmin} ? alias:'Mestre '+['A12B34','B23C45','C34D56','D45E67','E56F78'][i],member_id:${isAdmin}?'synthetic-'+i:null,total:[58,58,49.6,27,0][i],grade:[2,1,0,1,0][i],source:'graduacao',is_demo:false,source_date:'2026-09-30',movement:[2,-1,0,null,null][i]}))];
window.Club.sb.rpc=async(name,args)=>{if(name==='cb_ranking'){window.__rankingRequests.push(args.p_period);if(window.__failRanking)return {data:null,error:{message:'Ranking indisponível'}};return {data:window.__ranking};}return rpc(name,args);};
`;}
(function testDirectStorageHost(){const source=fs.readFileSync(path.join(root,'assets/club-black.js'),'utf8');assert.match(source,/\.storage\.supabase\.co/,'Upload grande deve usar o host direto recomendado pelo Storage');})();
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({headless:true,...(process.env.BLACK_BROWSER_EXECUTABLE?{executablePath:process.env.BLACK_BROWSER_EXECUTABLE}:{})});const errors=[];let memberCatalogNames;
 try{
  for(const isAdmin of [false,true]){
   const context=await browser.newContext({viewport:{width:1440,height:1080}});const page=await context.newPage();
   page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/assets/club-supabase.js',route=>route.fulfill({contentType:'text/javascript',body:stub(isAdmin)}));
   await page.route('https://**',route=>route.abort());
   await page.goto(url+(isAdmin?'/admin/':'/membros/'));
   await page.locator('#rail [data-nav="farol"][aria-selected=true]').waitFor();
   assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(7, 6, 10)','Preservar o preto original, sem clarear o painel inteiro');
   assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--panel').trim()),'#0B0910');
   assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue('--gold').trim()),'#E8C07A');
   await page.screenshot({path:path.join(out,(isAdmin?'admin':'member')+'-farol-black-gold.png'),fullPage:true});
   const mentoria=['Visão Geral','Subida: Rumo ao Olympus','Pendências','Protocolo Grau Zero','Graduação','Ranking Black','Vitrine Black','Instagram','Processos Black','Materiais','Agenda'];
   const menu=await page.locator('#rail .nav>span:not(.cb-badge)').allTextContents();
   assert.deepEqual(menu.slice(0,12),[...mentoria,'Fábrica · Íris Black']);
   assert.deepEqual(await page.locator('#rail .rail-grupo').allTextContents(),isAdmin?['Mentoria','Módulos à parte','Administração','Operação da equipe']:['Mentoria','Módulos à parte']);
   if(isAdmin)assert.deepEqual(menu.slice(12,14),['A Rede','Progressão']);
   else assert.equal(await page.locator('[data-view=rede]').count(),0);
   for(const key of ['home','encontro','iris','cerebro','profile'])assert.equal(await page.locator('#rail [data-nav="'+key+'"]').count(),0);
   assert.deepEqual(await page.locator('#navm [data-nav]').evaluateAll(nodes=>nodes.map(n=>n.dataset.nav)),await page.locator('#rail [data-nav]').evaluateAll(nodes=>nodes.map(n=>n.dataset.nav)));
   await page.locator('#rail [data-nav="subida"]').click();await page.locator('#black-subida .cb-card[data-cb-step]').last().waitFor().catch(async e=>{console.error(await page.locator('body').innerText());console.error(await page.evaluate(()=>({hash:location.hash,stages:Club.methodStages,items:Club.stepChecklist?.length,selected:Club.black.selected()})));throw e;});
   for(const selector of ['#black-subida h1','#black-subida h2','#black-subida .cb-number']){
    assert.match(await page.locator(selector).first().evaluate(el=>getComputedStyle(el).fontFamily),/InterOB/,'Áreas novas devem manter a Inter do painel atual');
   }
   assert.equal(await page.locator('#black-subida [data-cb-step]').count(),isAdmin?15:14); // 12 cartões + CTA da pendência + Treino (+ pedido de conferência no admin)
   for(const selector of ['.cb-card','.cb-score-card','.cb-stats','.cb-pending']){
    assert.equal(await page.locator('#black-subida '+selector).first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(21, 18, 25)','Cards sutilmente mais claros que o fundo preto');
   }
   assert.equal(await page.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgb(7, 6, 10)','O fundo geral continua preto');
   await page.evaluate(()=>document.documentElement.dataset.theme='light');
   assert.notEqual(await page.locator('#black-subida .cb-card').first().evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(21, 18, 25)','O ajuste escuro não invade o tema claro');
   await page.evaluate(()=>document.documentElement.removeAttribute('data-theme'));
   await page.screenshot({path:path.join(out,isAdmin?'admin-desktop.png':'member-desktop.png'),fullPage:true});
   await page.locator('#rail').evaluate(el=>{el.style.height='auto';el.style.position='static';});
   await page.locator('header').evaluate(el=>el.style.visibility='hidden');
   await page.locator('#rail').screenshot({path:path.join(out,isAdmin?'admin-navigation.png':'member-navigation.png')});
   await page.locator('header').evaluate(el=>el.style.visibility='');
   await page.locator('#rail').evaluate(el=>{el.style.height='';el.style.position='';});
   await page.locator('#black-subida .cb-card[data-cb-step="D04"]').click();await page.locator('[data-cb-tab="audit"]').click();
   await page.locator('.cb-drawer [data-cb-delivery="D04/funcoes"]').click();
   assert.match(await page.locator('.cb-drawer').innerText(),/Social Seller/);
   await page.keyboard.press('Escape');assert.equal(await page.locator('.cb-drawer').count(),0);
   await page.locator('#black-subida .cb-card[data-cb-step=D05]').click();
   assert.equal(await page.locator('.cb-check-item').count(),0,'Degrau abre somente entregas, nunca checklist direto');
   assert.equal(await page.locator('.cb-drawer [data-cb-artifact=other-qa]').count(),0);
   assert.equal(await page.locator('.cb-drawer [data-cb-artifact=private-qa]').count(),0,'Processos internos ficam na gestão, fora da jornada do mentorado');
   assert.match(await page.locator('.cb-drawer [data-cb-artifact=site-qa]').innerText(),/Implantação: 1\/1 etapas/);
   await page.locator('.cb-drawer [data-cb-artifact=site-qa]').click();
   assert.equal(await page.locator('.cb-popup').count(),1,'Entrega abre em pop-up centralizado');
   assert.match(await page.locator('.cb-drawer').innerText(),/Site publicado/);
   assert.equal(await page.locator('.cb-drawer a').getAttribute('href'),'https://example.test/entrega');
   if(isAdmin){
    const step=page.locator('.cb-popup [data-cb-toggle-step]').first();
    assert.ok(await step.isChecked(),'Etapa feita aparece marcada');
    await step.uncheck();
    await page.waitForFunction(()=>window.__writes.some(w=>w.table==='marcar_etapa'&&w.row.p_feito===false));
    assert.equal(await page.locator('.cb-popup').count(),1,'Pop-up continua aberto ao marcar etapa');
    assert.equal(await page.locator('.cb-popup [data-cb-toggle-step]').first().isChecked(),false);
    await page.locator('.cb-popup [data-cb-toggle-step]').first().check();
    await page.waitForFunction(()=>window.__writes.some(w=>w.table==='marcar_etapa'&&w.row.p_feito===true));
    await page.locator('.cb-popup [data-cb-toggle-step]:checked').first().waitFor();
   }else{
    assert.equal(await page.locator('.cb-popup .cb-check-toggle').count(),0,'Mentorado não marca etapas nem itens');
   }
   await page.locator('.cb-drawer [data-cb-step=D05]').click();
   for(const width of [320,390,1440]){
    await page.setViewportSize({width,height:1080});
    assert.ok(await page.locator('.cb-drawer').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'Drawer deve caber no celular');
    if(width!==320)await page.screenshot({path:path.join(out,(isAdmin?'admin':'member')+'-entregas-'+width+'.png'),fullPage:true});
   }
   await page.keyboard.press('Escape');

   await page.locator('#rail [data-nav="pendencias"]').click();await page.locator('#black-pendencias [data-cb-mission]').click();
   if(!isAdmin){assert.equal(await page.locator('.cb-drawer [name=status]').count(),0);await page.locator('.cb-drawer textarea[name=evidence]').fill('Entrega para conferência');await page.locator('.cb-drawer [type=submit]').click();await page.waitForFunction(()=>window.__writes.length>0);assert.equal((await page.evaluate(()=>window.__writes))[0].row.status,'submitted');}
   else {
    assert.equal(await page.locator('.cb-drawer [name=status]').count(),1);await page.keyboard.press('Escape');
    await page.locator('#rail [data-nav="subida"]').click();await page.locator('#black-subida .cb-card[data-cb-step="D04"]').click();
    assert.equal(await page.locator('[data-cb-tab=audit]').getAttribute('aria-selected'),'true');
    await page.locator('.cb-drawer [data-cb-delivery="D04/funcoes"]').click();
    assert.equal(await page.locator('.cb-check-item').count(),4);
    await page.locator('[data-cb-toggle-item="D04-01"]').check();
    await page.waitForFunction(()=>window.__writes.some(w=>w.table==='cb_checklist_progress'&&w.row.item_id==='D04-01'&&w.row.done===true));
    await page.locator('[data-cb-toggle-item="D04-01"]:checked').waitFor();
    assert.equal(await page.locator('[data-cb-form=checklist]').count(),0,'Conferir marca direto no checklist, sem formulário lateral');
    assert.match(await page.locator('#black-subida .cb-card[data-cb-step=D04]').innerText(),/1 de 7 itens/);
    assert.match(await page.locator('#black-subida .cb-card[data-cb-step=D04]').innerText(),/Rodando/i);
    await page.locator('.cb-drawer [data-cb-step=D04]').click();await page.locator('[data-cb-tab=metrics]').click();await page.locator('[data-cb-step-edit]').click();
    assert.equal(await page.locator('.cb-drawer [name=status]').count(),0);
    await page.keyboard.press('Escape');
   }
   // Meses independentes; marcação usa o registro auditado da edição já existente.
   await page.evaluate(()=>{
    const f=window.__fixtures,m=f.members[0],period=f.cb_quarters[0].period;
    f.cb_encontros=[{id:'oct',member_id:m.id,period,edition:'2026-10-01',publicized:true,video_group:false,video_ads:false,attended:false,evidence:'Conferência anterior',updated_at:'2026-10-01',updated_by:'team'},{id:'nov',member_id:m.id,period,edition:'2026-11-01',publicized:false,video_group:false,video_ads:false,attended:false}];
   });
   await page.locator('#rail [data-nav=subida]').click();await page.locator('#black-subida [data-cb-reload]').click();
   await page.locator('#black-subida .cb-card[data-cb-step=D08]').click();
   await page.locator('.cb-drawer [data-cb-delivery="D08/divulgacao"]').click();
   assert.match(await page.locator('.cb-section').filter({hasText:'Conferência da entrega'}).innerText(),/0 de 3/);
   await page.locator('[data-cb-edition]').selectOption('2026-10-01');
   assert.match(await page.locator('.cb-section').filter({hasText:'Conferência da entrega'}).innerText(),/1 de 3/);
   if(isAdmin){
    await page.locator('[data-cb-toggle-item="D08-01"]').click();
    await page.waitForFunction(()=>window.__writes.some(w=>w.table==='cb_checklist_progress'&&w.row.item_id==='D08-01'));
    assert.equal(await page.evaluate(()=>window.__writes.find(w=>w.table==='cb_checklist_progress'&&w.row.item_id==='D08-01').row.edition),'2026-10-01','Item mensal grava na edição escolhida');
   }
   await page.keyboard.press('Escape');
   await page.evaluate(()=>window.__fixtures.cb_encontros=[]);
   await page.locator('#black-subida [data-cb-reload]').click();await page.locator('#black-subida .cb-card[data-cb-step=D08]').waitFor();
   for(const key of ['ranking','vitrine','modulos','casos','graduacao','farol','artifacts','agenda',...(isAdmin?['rede','members']:[]),'subida']){await page.locator('#rail [data-nav="'+key+'"]').click();assert.equal(await page.locator('.view:not([hidden])').count(),1);}
   await page.locator('#rail [data-nav=subida]').click();
   for(const step of ['D07','D08','D09','D10','D11','D12']){
    await page.locator('#black-subida .cb-card[data-cb-step='+step+']').click();
    assert.equal(await page.locator('.cb-drawer .cb-check-item').count(),0);
    assert.ok(await page.locator('.cb-drawer .art-compact').count()>=3,'Cada degrau tem entregas específicas');
    assert.doesNotMatch(await page.locator('.cb-drawer').innerText(),/Não há uma entrega|checklist deste agrupador/);
    await page.keyboard.press('Escape');
   }
   await page.locator('#rail [data-nav=artifacts]').click();
   const catalog=page.locator(isAdmin?'#cardsArtefatos':'#artListFull');
   if(!isAdmin)memberCatalogNames=await catalog.locator('.art-n').allTextContents();
   assert.doesNotMatch(await catalog.innerText(),/Agrupador legado arquivado/);
   if(isAdmin){
    assert.deepEqual(await catalog.locator('.art-n').allTextContents(),memberCatalogNames,'Admin e mentorado têm exatamente os mesmos cards e nomes');
    assert.doesNotMatch(await catalog.innerText(),/Tracker privado|Entrega de outro membro|Onboarding/);
    assert.equal(await page.locator('#gestaoCatalogo').getAttribute('open'),null);
    assert.equal(await page.locator('[data-view=artifacts] #gestaoCatalogo').count(),0,'Catálogo saiu de Processos');
    assert.equal(await page.locator('[data-view=members] #gestaoCatalogo').count(),1,'Catálogo fica na Progressão');
    const management=page.locator('#listaArtefatos');
    assert.match(await management.textContent(),/Onboarding/,'Processo indisponível segue acessível à gestão');
    assert.equal(await catalog.locator('[data-catalog-stage^=D]').count(),12);
    assert.equal(await catalog.locator('[data-edit=artifact][data-id=shared-training]').count(),4);
    await catalog.locator('[data-edit=artifact][data-id=site-qa]').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(out,'admin-edit-pencil.png'),fullPage:false});
    await catalog.locator('[data-edit=artifact][data-id=site-qa]').click();
    await page.locator('#modalForm [name=nome]').waitFor();
    assert.equal(await page.locator('#modalForm [name=nome]').inputValue(),'Site Institucional');
    await page.keyboard.press('Escape');
    await catalog.locator('[data-cb-delivery="D07/prospeccao"]').click();
    assert.equal(await page.locator('.cb-popup [data-cb-toggle-item]').count(),2,'Admin mantém conferência dos itens manuais');
    assert.match(await page.locator('.cb-popup').innerText(),/O mentorado pediu conferência em/);
    await page.keyboard.press('Escape');
    assert.match(await catalog.locator('[data-cb-delivery="D07/prospeccao"]').innerText(),/1 item para conferir/,'Pedido aparece no card de fora');
    await catalog.locator('[data-cb-delivery="D07/prospeccao"]').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(out,'admin-card-pedido.png'),fullPage:false});
    await catalog.locator('[data-cb-delivery="D07/prospeccao"]').click();
    await page.keyboard.press('Escape');
    await catalog.locator('[data-cb-delivery="D03/rastreio"]').click();
    await page.locator('.cb-popup [data-cb-toggle-item="D03-04"]').check();
    await page.waitForFunction(()=>window.__writes.some(w=>w.table==='cb_checklist_progress'&&w.row.item_id==='D03-04'&&w.row.done===true));
    await page.locator('.cb-popup [data-cb-toggle-item="D03-04"]:checked').waitFor();
    assert.equal(await page.locator('.cb-popup .cb-check-icon').count(),0,'Para a equipe todo item tem a mesma caixinha, inclusive AUTO');
    await page.screenshot({path:path.join(out,'admin-checklist-auto-1440.png'),fullPage:false});
    await page.keyboard.press('Escape');
    await page.locator('#filtroArtGrupo').selectOption('D05');
    assert.equal(await catalog.locator('[data-catalog-stage]').count(),1);
    assert.equal(await catalog.locator('[data-edit=artifact][data-id=site-qa]').count(),1);
    await page.locator('#filtroArtGrupo').selectOption('');
    await page.locator('#rail [data-nav=members]').click();
    await page.locator('#gestaoCatalogo summary').click();
    await page.locator('#filtroCatalogo').selectOption('AREAS');
    await page.locator('#gestaoCatalogo').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(out,'admin-catalogo-progressao.png'),fullPage:false});
    await page.locator('#filtroCatalogo').selectOption('');
    await page.locator('#gestaoCatalogo summary').click();
    await page.locator('#rail [data-nav=artifacts]').click();
    await page.locator('#processosMembro').selectOption('10000000-0000-4000-8000-000000000002');
    await catalog.locator('[data-cb-artifact=other-qa]').waitFor();
    assert.match(page.url(),/membro=10000000-0000-4000-8000-000000000002/);
    const previewHref=await page.locator('#verComoMembro').evaluate(el=>{el.addEventListener('click',e=>e.preventDefault(),{once:true});el.click();return el.href;});
    assert.match(previewHref,/membro=10000000-0000-4000-8000-000000000002#artifacts$/);
    const preview=await context.newPage();
    preview.on('pageerror',e=>errors.push(e.message));
    await preview.route('**/assets/club-supabase.js',route=>route.fulfill({contentType:'text/javascript',body:stub(true)}));
    await preview.route('https://**',route=>route.abort());
    await preview.goto(previewHref);
    await preview.locator('#voltarPainel').waitFor();
    assert.equal(await preview.locator('#artListFull [data-edit]').count(),0,'Pré-visualização não recebe ações administrativas');
    assert.match(await preview.locator('#voltarPainel').getAttribute('href'),/membro=10000000-0000-4000-8000-000000000002#artifacts$/);
    await preview.locator('#voltarPainel').click();
    await preview.locator('#cardsArtefatos [data-cb-artifact=other-qa]').waitFor();
    assert.equal(await preview.locator('#processosMembro').inputValue(),'10000000-0000-4000-8000-000000000002');
    assert.equal(await preview.locator('[data-view=artifacts]').isVisible(),true,'Voltar ao painel mantém mentorado e aba');
    await preview.close();
    await page.locator('#processosMembro').selectOption('10000000-0000-4000-8000-000000000001');
    await page.waitForFunction(()=>document.querySelector('#cardsArtefatos').textContent.includes('1/18 etapas'));
    assert.equal(await catalog.locator('[data-cb-artifact=other-qa]').count(),0);
    await catalog.locator('[data-cb-delivery="D07/prospeccao"]').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(out,'admin-deliveries-catalog.png'),fullPage:false});
    await page.locator('#rail [data-nav=members]').click();
    await page.locator('#filtroArvMembro').selectOption('10000000-0000-4000-8000-000000000002');
    await page.locator('#btnExpandir').click();
    const progression=page.locator('#listaMembros');
    const headings=await progression.locator('.grp-n').allTextContents();
    assert.deepEqual(headings.slice(0,13),methodCatalog.stages.map(s=>s.id+' · '+s.name));
    assert.doesNotMatch(headings.join(' '),/Tecnologia e dados|Presença e conteúdo|Geração de demanda/);
    assert.equal(await progression.locator('[data-progress-delivery="D07/prospeccao"]').count(),1);
    assert.equal(await progression.locator('[data-progress-delivery^="D04/"]').count(),3);
    await progression.locator('[data-progress-delivery="D07/prospeccao"]').click();
    await page.locator('.cb-popup [data-cb-toggle-item="D07-01"]').waitFor();
    assert.equal(await page.evaluate(()=>Club.black.selected()),'10000000-0000-4000-8000-000000000002');
    await page.locator('.cb-popup [data-cb-toggle-item="D07-01"]').check();
    await page.waitForFunction(()=>window.__writes.some(w=>w.table==='cb_checklist_progress'&&w.row.item_id==='D07-01'));
    const write=await page.evaluate(()=>window.__writes.find(w=>w.table==='cb_checklist_progress'&&w.row.item_id==='D07-01').row);
    assert.equal(write.member_id,'10000000-0000-4000-8000-000000000002');
    await page.locator('.cb-popup [data-cb-toggle-item="D07-01"]:checked').waitFor();
    await page.screenshot({path:path.join(out,'admin-checklist-toggle-1440.png'),fullPage:false});
    await page.keyboard.press('Escape');
    await progression.locator('[data-progress-delivery="D05/site"]').click();
    await page.locator('.cb-popup').waitFor();
    assert.match(await page.locator('.cb-popup').innerText(),/Site publicado/);
    await page.keyboard.press('Escape');
    await page.screenshot({path:path.join(out,'admin-progressao-catalogo.png'),fullPage:false});
    await page.locator('#rail [data-nav=artifacts]').click();
    await page.locator('#processosMembro').selectOption('10000000-0000-4000-8000-000000000001');

   }else{
    assert.doesNotMatch(await catalog.innerText(),/Tracker privado|Entrega de outro membro/);
    assert.match(await catalog.innerText(),/Vínculo com degrau a confirmar/);
    assert.equal(await catalog.locator('.art-st-list').count(),0,'Checklist não alonga mais os cards');
    for(const width of [1440,390,320]){
     await page.setViewportSize({width,height:844});
     const card=catalog.locator('[data-cb-delivery="D07/prospeccao"]');
     await card.click();
     assert.equal(await page.locator('.cb-popup .cb-check-item').count(),2);
     assert.equal(await page.locator('.cb-popup [data-cb-toggle-item]').count(),0,'Membro não ganha controles de conferência');
     assert.match(await page.locator('.cb-popup').innerText(),/30 DMs/);
     if(width===1440){
      assert.equal(await page.locator('.cb-popup [data-cb-request-check]').count(),2,'Mentorado pode pedir conferência dos itens não feitos');
      await page.locator('.cb-popup [data-cb-request-check="D07-01"]').click();
      await page.waitForFunction(()=>window.__writes.some(w=>w.table==='cb_checklist_requests'&&w.row.item_id==='D07-01'));
      await page.locator('.cb-popup .cb-request').waitFor();
      assert.match(await page.locator('.cb-popup .cb-request').innerText(),/Conferência pedida/);
      assert.equal(await page.locator('.cb-popup [data-cb-request-check="D07-01"]').count(),0,'Pedido não se repete');
      await page.screenshot({path:path.join(out,'member-pedido-conferencia.png'),fullPage:false});
     }
     const box=await page.locator('.cb-popup').boundingBox();
     assert.ok(box.x>=0&&box.x+box.width<=width+1);
     if(width!==320)await page.screenshot({path:path.join(out,'delivery-social-seller-'+width+'.png'),fullPage:false});
     await page.keyboard.press('Escape');
     assert.equal(await card.evaluate(el=>el===document.activeElement),true);
    }
    await page.setViewportSize({width:1440,height:1080});
    assert.match(await catalog.locator('[data-cb-delivery="D07/prospeccao"]').innerText(),/1 conferência pedida/,'Mentorado vê o pedido no card de fora');
    await catalog.locator('[data-cb-delivery="D07/prospeccao"]').scrollIntoViewIfNeeded();
    await page.screenshot({path:path.join(out,'member-deliveries-catalog.png'),fullPage:false});

    const editorial=catalog.locator('button[data-cb-artifact=editorial-qa]');
    assert.ok((await editorial.boundingBox()).height<340,'Card compacto mesmo com 18 etapas');
    assert.match(await editorial.innerText(),/1\/18/,'Resumo mantém o progresso existente');
    const before=await page.evaluate(()=>window.__writes.length);
    for(const width of [1440,390,320]){
     await page.setViewportSize({width,height:844});
     await editorial.focus();await page.keyboard.press('Enter');
     const popup=page.locator('.cb-popup');await popup.waitFor();
     assert.equal(await popup.getAttribute('role'),'dialog');
     assert.equal(await popup.getAttribute('aria-modal'),'true');
     assert.equal(await popup.locator('.cb-check-item').count(),21,'18 etapas existentes + 3 conferências da entrega preservadas');
     assert.equal(await popup.locator('.cb-check-item.is-done').count(),1);
     assert.match(await popup.innerText(),/Feed e stories na voz do Mestre/);
     assert.equal(await popup.locator('a').getAttribute('href'),url+'/materiais/','Link relativo preservado dentro do pop-up');
     const box=await popup.boundingBox();
     assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=844,'Pop-up contido na tela');
     assert.ok(Math.abs(box.x+box.width/2-width/2)<2,'Pop-up centralizado');
     assert.ok(await popup.locator('.cb-popup-content').evaluate(el=>el.scrollHeight>el.clientHeight),'Checklist longo rola dentro do pop-up');
     await page.keyboard.press('Shift+Tab');
     assert.equal(await popup.evaluate(el=>{const f=[...el.querySelectorAll('button,input,select,textarea,a[href]')].filter(n=>!n.disabled&&n.offsetParent!==null);return f[f.length-1]===document.activeElement;}),true,'Foco não escapa do modal: Shift+Tab no primeiro volta ao último');
     await page.keyboard.press('Tab');
     assert.equal(await popup.locator('.cb-close').evaluate(el=>el===document.activeElement),true);
     if(width!==320)await page.screenshot({path:path.join(out,'member-process-popup-'+width+'.png'),fullPage:true});
     await page.keyboard.press('Escape');
     assert.equal(await popup.count(),0);
     assert.equal(await editorial.evaluate(el=>el===document.activeElement),true,'Fechar devolve o foco ao card');
    }
    await editorial.click();await page.locator('.cb-overlay').click({position:{x:2,y:2}});
    assert.equal(await page.locator('.cb-popup').count(),0,'Clique fora fecha');
    await editorial.click();await page.locator('.cb-popup .cb-close').click();
    assert.equal(await page.locator('.cb-popup').count(),0,'Botão fechar funciona');
    assert.equal(await page.evaluate(()=>window.__writes.length),before,'Abrir e fechar detalhes não grava dados');
    await page.setViewportSize({width:1440,height:1080});
   }
   await page.screenshot({path:path.join(out,(isAdmin?'admin':'member')+'-hierarquia.png'),fullPage:true});
   for(const width of [320,390]){
    await page.setViewportSize({width,height:844});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Catálogo por degraus deve caber no celular');
    if(width===390)await page.screenshot({path:path.join(out,(isAdmin?'admin':'member')+'-hierarquia-mobile.png'),fullPage:true});
   }
   await page.setViewportSize({width:1440,height:1080});
   await catalog.locator(isAdmin?'[data-cb-step=D05]':'a[href="#subida/D05"]').click();
   await page.locator('.cb-drawer').waitFor();assert.match(await page.locator('.cb-drawer').innerText(),/Site institucional e AEO/);
   await page.keyboard.press('Escape');
   await page.locator('#rail [data-nav=artifacts]').click();
   await catalog.locator(isAdmin?'[data-cb-step=TREINO]':'a[href="#subida/TREINO"]').click();
   await page.locator('.cb-drawer').waitFor();assert.match(await page.locator('.cb-drawer').innerText(),/Treinamento de vendas/);
   await page.keyboard.press('Escape');
   await page.locator('#rail [data-nav="agenda"]').click();await page.locator('[data-view=agenda] [data-nav=encontro]').click();assert.equal(await page.locator('[data-view=encontro]').isVisible(),true);
   await page.locator('#rail [data-nav=ranking]').click();await page.locator('#black-ranking .cb-ranking-list').waitFor();
   const rankingQuarter=await page.evaluate(()=>Club.metodo.quarter());
   assert.equal(await page.locator('#black-ranking [data-cb-ranking-period]').inputValue(),rankingQuarter);
   assert.equal(await page.locator('#black-ranking .cb-ranking-list').getAttribute('aria-label'),'Ranking do trimestre '+rankingQuarter);
   assert.ok(await page.evaluate(p=>window.__rankingRequests.includes(p),rankingQuarter));
   await page.locator('#black-ranking [data-cb-ranking-period]').selectOption('2026-T2');
   await page.waitForFunction(()=>window.__rankingRequests.includes('2026-T2'));
   await page.locator('#black-ranking .cb-ranking-list').waitFor();
   assert.equal(await page.locator('#black-subida [data-cb-period]').inputValue(),await page.evaluate(()=>Club.metodo.quarter()),'Mudar ranking não altera apuração das outras telas');
   await page.locator('#black-ranking [data-cb-ranking-period]').selectOption('2026-T3');
   await page.locator('#black-ranking .cb-ranking-list').waitFor();
   assert.match(await page.locator('#black-ranking .cb-own').innerText(),/63,9/);
   assert.match(await page.locator('#black-ranking .cb-own').innerText(),/Prévia da graduação/);
   assert.match(await page.locator('#black-ranking .cb-notice').innerText(),/dados de prévia/);
   await page.evaluate(()=>window.__failRanking=true);await page.locator('#black-ranking [data-cb-reload]').first().click();await page.locator('#black-ranking [role=alert]').waitFor();
   assert.match(await page.locator('#black-ranking [role=alert]').innerText(),/Não foi possível carregar/);
   assert.equal(await page.locator('#black-ranking .cb-ranking-list').count(),0);
   await page.evaluate(()=>window.__failRanking=false);await page.locator('#black-ranking [role=alert] [data-cb-reload]').click();await page.locator('#black-ranking .cb-ranking-list').waitFor();
   assert.equal(await page.locator('#black-ranking .cb-ranking-card').count(),6);
   assert.deepEqual(await page.locator('#black-ranking .cb-ranking-card').evaluateAll(rows=>rows.map(r=>r.value)),[1,2,2,3,4,5]);
   assert.equal(await page.locator('#black-ranking .cb-rank-move.up').count(),1);
   assert.equal(await page.locator('#black-ranking .cb-rank-move.down').count(),1);
   assert.equal(await page.locator('#black-ranking .cb-rank-grade.no-grade').count(),2);
   if(!isAdmin)assert.doesNotMatch(await page.locator('#black-ranking').innerText(),/Clínica Aurora|Clínica Horizonte/);
   await page.evaluate(()=>window.__ranking.forEach(r=>r.is_demo=false));
   await page.locator('#black-ranking [data-cb-reload]').first().click();await page.locator('#black-ranking .cb-ranking-list').waitFor();
   for(const theme of ['dark','light']){
    await page.evaluate(theme=>{if(theme==='light')document.documentElement.dataset.theme='light';else document.documentElement.removeAttribute('data-theme');},theme);
    const contrast=await page.evaluate(()=>{
     const styles=getComputedStyle(document.documentElement),rgb=value=>value.match(/[0-9a-f]{2}/gi).map(v=>parseInt(v,16)/255);
     const lum=value=>rgb(value).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
     const bg=lum(styles.getPropertyValue('--panel').trim());
     return ['--text','--muted','--gold'].map(key=>{const fg=lum(styles.getPropertyValue(key).trim());return (Math.max(bg,fg)+.05)/(Math.min(bg,fg)+.05);});
    });
    assert.ok(contrast.every(value=>value>=4.5),'Texto, apoio e dourado precisam de contraste legível nos cartões');
    for(const width of [320,390,768,1440]){
     await page.setViewportSize({width,height:1080});
     for(const view of ['ranking','vitrine']){
      await page.evaluate(view=>location.hash=view,view);await page.locator('#black-'+view).waitFor({state:'visible'});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),view+' deve caber na tela de '+width+'px');
      if(view==='ranking'){
       assert.equal(await page.locator('#black-ranking .cb-own').count(),1);
       assert.match(await page.locator('#black-ranking .cb-rank').first().evaluate(el=>getComputedStyle(el).fontFamily),/InterOB/);
      }else{
       const vit=page.locator('#black-vitrine');
       assert.equal(await vit.locator('.cb-vit-card').count(),3,'Catálogo fixo: catarata, Grau Zero e viagem');
       const texto=await vit.innerText();
       assert.match(texto,/6 vagas \/ tri/i);assert.match(texto,/5 vagas \/ edição/i);
       assert.doesNotMatch(texto,/hospedagem/i,'Viagem só com passagem, sem hotel (Dr. Alex, 01/10)');
       assert.match(await vit.locator('.cb-vit-elig').innerText(),/1 Voucher em mãos/i);
       assert.match(texto,/Voucher Black — indicação convertida/);
       assert.equal(await vit.locator('[data-cb-redeem]').count(),0,'Mentorado ainda não resgata pelo sistema');
       assert.equal(await vit.locator('[data-cb-voucher-new]').count(),isAdmin?1:0,'Só a equipe concede voucher');
       if(!isAdmin)assert.doesNotMatch(texto,/Nota interna/,'Observação da equipe não aparece para o mentorado');
      }
      if([390,1440].includes(width))await page.screenshot({path:path.join(out,(isAdmin?'admin':'member')+'-'+view+'-'+theme+'-'+width+'.png'),fullPage:true});
     }
    }
   }
   await page.evaluate(()=>document.documentElement.removeAttribute('data-theme'));await page.setViewportSize({width:1440,height:1080});
   // A apuração importada aparece no placar principal, sem virar pontos da régua v2.2.
   await page.evaluate(()=>{
    window.__savedGraduationFixtures=JSON.parse(JSON.stringify(window.__fixtures));
    const f=window.__fixtures,id=f.members[0].id,period=f.cb_quarters[0].period;
    f.cb_quarters=[];f.cb_missions=[];
    f.member_graduations=[{member_id:id,source_date:'2026-09-30',is_demo:false,snapshot:{grade:2,sourceDate:'2026-09-30',periods:[{id:period,label:'Trimestre de teste',state:'closed',points:108.5,scores:{attendance:16.5,followers:20,videos:12},referrals:2,referralUnitPoints:25,bonus:10,followers:{growth:5100,estimated:true},cutoffDate:'2026-09-24'}]}}];
   });
   await page.locator('#rail [data-nav=graduacao]').click();
   if(isAdmin){
    await page.locator('#graduacaoAdmin .gr-radar').waitFor();
    assert.equal(await page.locator('#black-graduacao').isVisible(),false,'Admin abre primeiro o painel geral');
    assert.equal(await page.locator('#graduacaoAdmin [data-gr-period]').inputValue(),await page.evaluate(()=>Club.metodo.quarter()));
    assert.match(await page.locator('#graduacaoAdmin').innerText(),/Placar v2.2/);
    await page.locator('#graduacaoAdmin [data-gr-period]').selectOption('2026-T3');
    await page.locator('#graduacaoAdmin [data-gr-search]').fill('Outro');
    assert.equal(await page.locator('#graduacaoAdmin tbody tr').count(),1);
    const adminPath=new URL(page.url()).pathname;
    await page.locator('#graduacaoAdmin [data-gr-member]').click();
    await page.locator('#black-graduacao [data-cb-period]').waitFor();
    assert.equal(new URL(page.url()).pathname,adminPath,'Selecionar médico mantém a área de admin');
    assert.equal(await page.locator('#graduacaoOverview').isVisible(),false);
    assert.equal(await page.locator('#black-graduacao [data-cb-period]').inputValue(),'2026-T3');
    assert.equal(await page.locator('#black-graduacao [data-cb-member]').inputValue(),'10000000-0000-4000-8000-000000000002');
    assert.match(await page.locator('#black-graduacao .cb-kicker').first().innerText(),/Outro mentorado/i);
    await page.locator('[data-cb-graduacao-back]').click();
    await page.locator('#graduacaoAdmin .gr-radar').waitFor();
    assert.equal(await page.locator('#graduacaoAdmin [data-gr-search]').inputValue(),'Outro','Voltar preserva a busca');
    assert.equal(await page.locator('#black-graduacao').isVisible(),false);
    await page.locator('#graduacaoAdmin [data-gr-search]').fill('');
    await page.screenshot({path:path.join(out,'admin-graduacao-painel-geral.png'),fullPage:true});
    await page.locator('#graduacaoAdmin [data-gr-period]').selectOption(await page.evaluate(()=>Club.metodo.quarter()));
    await page.locator('#graduacaoAdmin [data-gr-member="10000000-0000-4000-8000-000000000001"]').click();
    await page.locator('#black-graduacao [data-cb-period]').waitFor();
   }
   await page.locator('#black-graduacao [data-cb-reload]').click();
   await page.locator('#black-graduacao .gr-big-points').waitFor();
   assert.equal(await page.locator('[data-view=graduacao] h1:visible').count(),1,'Graduação tem só um título visível');
   assert.equal(await page.locator('[data-view=graduacao] .gr-journey').count(),1,'Faixa e pontos não se repetem abaixo');
   assert.equal(await page.locator('#graduacaoMembro').count(),0);
   assert.match(await page.locator('#black-graduacao').innerText(),/108,5/);
   assert.match(await page.locator('#black-graduacao').innerText(),/30\/09\/2026/);
   assert.match(await page.locator('#black-graduacao').innerText(),/vale 25 pontos/);
   assert.doesNotMatch(await page.locator('#black-graduacao').innerText(),/Prévia da graduação|Placar v2.2/i);
   for(const width of [390,1440]){await page.setViewportSize({width,height:1080});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));await page.screenshot({path:path.join(out,(isAdmin?'admin':'member')+'-graduacao-'+width+'.png'),fullPage:true});}
   await page.evaluate(()=>{const f=window.__fixtures;f.cb_quarters=[{member_id:f.members[0].id,period:f.member_graduations[0].snapshot.periods[0].id,attended:0,eligible:10}];});
   await page.locator('#black-graduacao [data-cb-reload]').click();
   await page.locator('#black-graduacao .cb-score').waitFor();
   assert.match(await page.locator('#black-graduacao').innerText(),/Placar v2.2/i);
   assert.match(await page.locator('#black-graduacao').innerText(),/De onde vêm seus pontos/);
   assert.match(await page.locator('#black-graduacao').innerText(),/Leads sem resposta pelo sistema/);
   assert.match(await page.locator('#black-graduacao').innerText(),/mínimo de duas semanas/);
   assert.doesNotMatch(await page.locator('#black-graduacao').innerText(),/108,5/);
   if(isAdmin){
    await page.evaluate(()=>{const f=window.__fixtures;f.cb_quarters[0].period='2026-T4';f.cb_scoring_profiles=[{member_id:f.members[0].id,entered_on:'2026-09-01',instagram_username:'perfil_teste'}];f.cb_instagram_video_sync=[{member_id:f.members[0].id,ig_user_id:'ig-1',period:'2026-T4',covered_from:'2026-10-01',covered_until:'2026-10-07'}];f.cb_instagram_videos=[{member_id:f.members[0].id,ig_user_id:'ig-1',media_id:'v1',media_type:'VIDEO',published_at:'2026-10-03T12:00:00Z'}];f.cb_scores=[{member_id:f.members[0].id,videos_updated_at:'2026-10-08T15:00:00Z',videos_status:'ready',period:f.cb_quarters[0].period,followers_growth:2700,followers_auto_growth:2700,followers_source:'auto_base_manual',video_credits:.57,weeks:.57,auto_video_credits:.57,auto_weeks:.57,videos_source:'auto',total:2.5,complete:false}];});
    await page.locator('#black-graduacao [data-cb-period]').selectOption('2026-T4');
    await page.waitForFunction(()=>document.querySelector('#black-graduacao')?.textContent.includes('base ajustada pela equipe'));
    assert.match(await page.locator('#black-graduacao').innerText(),/Seu progresso no Instagram/);
    assert.match(await page.locator('#black-graduacao').innerText(),/54% do marco de/);
    assert.match(await page.locator('[data-cb-video-weeks]').innerText(),/01\/10\/2026 a 04\/10\/2026/);
    for(const width of [390,1440]){await page.setViewportSize({width,height:1080});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));await page.screenshot({path:path.join(out,'instagram-progresso-'+width+'.png'),fullPage:true});}
    await page.locator('#black-graduacao [data-cb-quarter]').click();
    const form=page.locator('[data-cb-form=quarter]');
    assert.equal(await form.locator('[name=followers_growth]').isDisabled(),true);
    await form.locator('[name=followers_mode]').selectOption('manual');
    await form.locator('[name=followers_growth]').fill('0');
    await form.locator('[name=followers_evidence]').fill('Conferência da planilha');
    await form.locator('[name=videos_mode]').selectOption('manual');
    await form.locator('[name=video_credits]').fill('1');await form.locator('[name=weeks]').fill('2');
    await form.locator('[name=videos_evidence]').fill('Conferência semanal');
    await form.locator('[name=evidence]').fill('Apuração de teste');
    await page.screenshot({path:path.join(out,'admin-instagram-ajuste-manual.png'),fullPage:true});
    await form.locator('button[type=submit]').click();
    await page.waitForFunction(()=>window.__writes.some(w=>w.table==='cb_quarters'&&w.row.followers_growth===0&&w.row.video_credits===1));
    await page.waitForFunction(()=>document.querySelector('#black-graduacao')?.textContent.includes('Apuração registrada: Apuração de teste'));
    await page.locator('#black-graduacao [data-cb-quarter]').click();
    await page.locator('[name=followers_mode]').selectOption('auto');await page.locator('[name=videos_mode]').selectOption('auto');
    await page.locator('[data-cb-form=quarter] button[type=submit]').click();
    await page.waitForFunction(()=>window.__writes.some(w=>w.table==='cb_quarters'&&w.row.followers_growth===null&&w.row.video_credits===null&&w.row.weeks===null));
   }
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
  assert.deepEqual(errors,[]);console.log('Browser: navegação, drawer, permissão, evidência, checklist individual, entregas relacionadas, edições mensais, erro de fonte, mobile e PDF de 90 MB com retomada OK.');console.log('Capturas: '+out);
 }finally{if(errors.length)console.error('Browser errors:',errors);await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
