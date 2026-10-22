(function(){
 'use strict';
 var Club=window.Club=window.Club||{},M=window.ClubLivroModel,host,loaded=false,loading=false,snapshots=[],publications=[],current,pending,sort='revenue_cents';
 var nf=new Intl.NumberFormat('pt-BR'),money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
 function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
 function el(id){return host.querySelector('[data-book="'+id+'"]');}
 function num(v){return v===null?'Indisponível':nf.format(v);}
 function value(f,v){return f==='revenue_cents'?(v===null?'Indisponível':money.format(v/100)):num(v);}
 function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Manaus',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
 function status(text,error){el('status').textContent=text;el('status').classList.toggle('book-error',!!error);}
 function mount(){
  host=document.getElementById('livroPanel');if(!host||host.dataset.mounted)return;host.dataset.mounted='1';
  host.innerHTML='<div class="book-heading"><div><p class="book-eyebrow">OFTALMOBLACK · RESULTADOS</p><h1>Livro</h1><p>Da publicação à compra de Presbiopia Cirúrgica.</p></div><button class="btn" data-book="refresh">Atualizar leitura</button></div>'+
   '<form class="book-filters" data-book="filters"><label>De<input class="inp" type="date" data-book="start" min="2026-10-19" required></label><label>Até<input class="inp" type="date" data-book="end" min="2026-10-19" required></label><button class="btn btn-primary" type="submit">Aplicar</button><button class="btn" type="button" data-book="all">Desde o início</button><span class="book-period" data-book="period"></span></form>'+
   '<p class="book-status" role="status" aria-live="polite" data-book="status">Preparando a leitura...</p>'+
   '<div class="book-kpis" data-book="kpis"></div><div class="book-sources" data-book="sources"></div>'+
   '<section class="book-ranking"><div class="book-section-title"><div><h2>Resultado por publicação</h2><p data-book="coverage"></p></div><div class="book-actions"><label>Ordenar por <select class="inp" data-book="sort"><option value="revenue_cents">Faturamento</option><option value="paid_sales">Vendas pagas</option><option value="views">Acessos</option><option value="checkout_clicks">Cliques no checkout</option></select></label><button class="btn btn-sm" data-book="export" disabled>Exportar ranking</button></div></div><div class="book-table-wrap" data-book="table"></div></section>'+
   '<details class="book-import"><summary>Importar origens da Greenn</summary><p>Exporte as vendas na Greenn com as colunas de UTM. O arquivo é lido neste navegador. Somente ID da venda, ID do produto e UTMs são enviados. Nome, e-mail e telefone são descartados.</p><p>A API atualiza pagamentos e valores a cada 15 minutos. A origem por publicação depende desta importação ou de uma origem já conferida. A integração por webhook ainda não está ativa.</p><label class="book-file">Arquivo CSV<input type="file" accept=".csv,text/csv" data-book="file"></label><div data-book="preview" aria-live="polite"></div><button class="btn btn-primary" data-book="import" hidden>Importar origens válidas</button><p class="book-status" data-book="importStatus" role="status"></p></details>'+
   '<p class="book-footnote">Acessos são visualizações da página, não pessoas únicas. Cliques são eventos de abertura do checkout, não compras. Vendas são pagamentos confirmados na Greenn, sem recusas, reembolsos ou chargebacks. Faturamento é o valor do livro após desconto, sem frete e antes das taxas. O GA4 pode levar de 24 a 48 horas para processar eventos. Todas as datas usam o fuso America/Manaus.</p>';
  el('start').value='2026-10-19';el('end').value=today();el('end').max=today();el('start').max=today();
  el('filters').addEventListener('submit',function(e){e.preventDefault();render();});
  el('all').onclick=function(){el('start').value='2026-10-19';el('end').value=today();render();};
  el('refresh').onclick=load;el('sort').onchange=function(){sort=this.value;render();};
  el('export').onclick=function(){if(!current)return;var blob=new Blob([M.exportCSV(ordered(current.rows))],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='livro-publicacoes-'+el('start').value+'-'+el('end').value+'.csv';a.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);};
  el('file').onchange=preview;el('import').onclick=importOrigins;
 }
 function ordered(rows){return rows.slice().sort(function(a,b){return (b[sort]||0)-(a[sort]||0)||a.title.localeCompare(b.title,'pt-BR');});}
 function sourceNote(key,title){
  var s=current.sources[key],good=s&&s.last_success_at,age=good?(Date.now()-Date.parse(s.last_success_at))/60000:Infinity,late=!!(s&&s.error)||age>45;
  var text=good?'Último sucesso: '+new Intl.DateTimeFormat('pt-BR',{timeZone:current.time_zone,dateStyle:'short',timeStyle:'short'}).format(new Date(s.last_success_at)):'Ainda sem coleta confirmada';
  return '<div class="book-source '+(late?'book-source-pending':'')+'"><strong>'+title+'</strong><span>'+esc(text)+'</span>'+(late?'<span class="book-source-warning">'+(good?'Atualização pendente. Exibindo a última coleta.':'Dados indisponíveis nesta leitura.')+'</span>':'<span>Coleta a cada 15 minutos</span>')+'</div>';
 }
 function render(){
  try{current=M.report(snapshots,publications,el('start').value,el('end').value);}catch(e){status(e.message,true);return;}
  var cards=[['views','Acessos','Visualizações na página'],['checkout_clicks','Cliques no checkout','Aberturas do checkout'],['paid_sales','Vendas pagas','Pagamentos confirmados'],['revenue_cents','Faturamento do livro','Sem frete, antes das taxas']];
  el('kpis').innerHTML=cards.map(function(c){return '<article class="book-kpi"><h2>'+c[1]+'</h2><strong>'+value(c[0],current.totals[c[0]])+'</strong><p>'+c[2]+'</p></article>';}).join('');
  el('sources').innerHTML=sourceNote('ga4','Tráfego · GA4')+sourceNote('greenn','Pagamentos · Greenn');
  el('coverage').textContent=current.totals.paid_sales===null?'Origem das vendas indisponível nesta leitura.':num(current.attributed)+' de '+num(current.totals.paid_sales)+' vendas têm publicação comprovada. As demais ficam em outras origens ou sem publicação identificada.';
  el('period').textContent='Dados desde 19/10/2026';
  var rows=ordered(current.rows);
  el('table').innerHTML=rows.length?'<table class="book-table"><caption class="book-sr">Resultados do livro por publicação no período selecionado</caption><thead><tr><th scope="col">Publicação ou origem</th><th scope="col">Acessos</th><th scope="col">Cliques no checkout</th><th scope="col">Vendas pagas</th><th scope="col">Faturamento</th></tr></thead><tbody>'+rows.map(function(r){return '<tr class="'+(r.media_id?'':'book-other-origin')+'"><th scope="row">'+(r.permalink?'<a href="'+esc(r.permalink)+'" target="_blank" rel="noopener noreferrer">'+esc(r.title)+' <span aria-hidden="true">↗</span></a>':esc(r.title))+(r.media_id?'<small>Instagram · '+esc(r.media_id)+'</small>':'<small>'+ (r.key==='unattributed'?'Sem origem comprovada para uma publicação':'UTM identificada sem vínculo com publicação')+'</small>')+'</th>'+['views','checkout_clicks','paid_sales','revenue_cents'].map(function(f){return '<td>'+value(f,r[f])+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table>':'<div class="book-empty">'+(current.totals.views===null&&current.totals.paid_sales===null?'Aguardando a primeira coleta. Use Atualizar leitura para tentar novamente.':'Nenhum resultado registrado neste período. Eventos recentes podem estar em processamento no GA4.')+'</div>';
  el('export').disabled=!rows.length;status('Leitura carregada. O botão atualiza os dados já coletados.');
 }
 async function readAll(table,columns){var all=[];for(var i=0;i<100000;i+=500){var r=await Club.sb.from(table).select(columns).order(table==='book_publications'?'media_id':'source').range(i,i+499);if(r.error)throw r.error;all=all.concat(r.data||[]);if((r.data||[]).length<500)return all;}throw Error('Limite de leitura excedido.');}
 async function load(){
  if(loading)return;loading=true;el('refresh').disabled=true;host.setAttribute('aria-busy','true');status('Carregando as fontes...');
  var results=await Promise.allSettled([readAll('book_dashboard_snapshots','source,payload,last_success_at,updated_at,error'),readAll('book_publications','media_id,title,permalink,published_at')]);
  if(results[0].status==='fulfilled'){snapshots=results[0].value;loaded=true;}
  if(results[1].status==='fulfilled')publications=results[1].value;
  render();if(results[0].status==='rejected')status('Não foi possível ler os dados. Confira sua conexão e tente novamente.'+(loaded?' A última leitura permanece na tela.':''),true);else if(results[1].status==='rejected')status('Resultados carregados. Os títulos das publicações estão temporariamente indisponíveis.',true);
  el('refresh').disabled=false;host.removeAttribute('aria-busy');loading=false;
 }
 async function preview(){
  pending=null;el('import').hidden=true;el('preview').textContent='';el('importStatus').textContent='';var file=el('file').files[0];if(!file)return;
  try{if(file.size>5000000)throw Error('O limite é de 5 MB por arquivo.');var r=M.parseCSV(await file.text());pending=r.records;
   el('preview').innerHTML='<p><strong>'+r.records.length+' origens válidas</strong> · '+r.skipped+' linhas ignoradas · '+r.errors.length+' problemas.</p>'+ (r.errors.length?'<ul>'+r.errors.slice(0,20).map(function(e){return '<li>'+esc(e)+'</li>';}).join('')+'</ul>':'')+'<p>As origens existentes com o mesmo ID de venda serão substituídas. Pagamentos e valores não são alterados.</p><div class="book-preview">'+r.records.slice(0,20).map(function(rec){return '<div>Venda '+rec.sale_id+' · '+esc([rec.utm_source,rec.utm_medium,rec.utm_content||rec.utm_campaign].filter(Boolean).join(' / '))+'</div>';}).join('')+'</div>';
   el('import').hidden=!r.records.length;
  }catch(e){el('importStatus').textContent=e.message;}
 }
 async function importOrigins(){
  if(!pending||!pending.length)return;el('import').disabled=true;el('file').disabled=true;var done=0;
  try{for(var i=0;i<pending.length;i+=100){var r=await Club.sb.from('book_sale_attributions').upsert(pending.slice(i,i+100),{onConflict:'sale_id'});if(r.error)throw r.error;done+=Math.min(100,pending.length-i);}el('importStatus').textContent=done+' origens salvas. O ranking será atualizado na próxima coleta, em até 15 minutos.';pending=null;el('import').hidden=true;}
  catch(e){el('importStatus').textContent='A importação parou após '+done+' origens. Reenvie o arquivo para concluir com segurança. Confira as colunas e sua permissão de administrador.';}
  finally{el('import').disabled=false;el('file').disabled=false;}
 }
 Club.livro={enter:function(){mount();if(host&&!loaded)load();}};
})();
