/* Contrato puro de leitura e importação. Não recebe dados de compradores. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.ClubLivroModel=factory();})(typeof window!=='undefined'?window:globalThis,function(){
 'use strict';
 var fields=['views','checkout_clicks','paid_sales','revenue_cents'];
 function permalink(v){return /^https:\/\/(www\.)?instagram\.com\/(reel|p|tv)\/[A-Za-z0-9_-]+\/$/.test(v||'')?v:null;}
 function validDate(v){return /^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;}
 function report(snapshots,publications,start,end){
  if(!validDate(start)||!validDate(end)||start>end)throw Error('Confira o período selecionado.');
  var sources={},pubs={},by={},totals={},attributed=0;
  snapshots.forEach(function(s){sources[s.source]=s;});publications.forEach(function(p){pubs[p.media_id]=p;});
  function ready(k){var s=sources[k];return !!(s&&s.last_success_at&&s.payload&&Array.isArray(s.payload.rows));}
  fields.forEach(function(f){totals[f]=ready(f==='views'||f==='checkout_clicks'?'ga4':'greenn')?0:null;});
  ['ga4','greenn'].forEach(function(source){if(!ready(source))return;
   sources[source].payload.rows.forEach(function(r){if(r.date<start||r.date>end)return;
    var target=by[r.key];if(!target){
     var p=pubs[r.media_id]||{};
     target=by[r.key]={key:r.key,media_id:r.media_id||null,story_id:r.story_id||null,title:r.story_id?'Story do Instagram · '+r.story_id:r.media_id?(p.title||'Publicação '+r.media_id):r.key==='unattributed'?'Sem publicação identificada':('Outra origem: '+[r.source,r.medium,r.content||r.campaign].filter(Boolean).join(' · ')),permalink:r.story_id?null:permalink(p.permalink)};
     fields.forEach(function(f){target[f]=totals[f]===null?null:0;});
    }
    var sourceFields=source==='ga4'?fields.slice(0,2):fields.slice(2);
    sourceFields.forEach(function(f){var n=r[f];if(!Number.isSafeInteger(n)||n<0)throw Error('A fonte devolveu valores inválidos.');target[f]+=n;totals[f]+=n;});
    if(source==='greenn'&&(r.media_id||r.story_id))attributed+=r.paid_sales;
   });
  });
  return {rows:Object.keys(by).map(function(k){return by[k];}),totals:totals,attributed:attributed,sources:sources,time_zone:(sources.ga4&&sources.ga4.payload.time_zone)||(sources.greenn&&sources.greenn.payload.time_zone)||'America/Manaus'};
 }
 function csvRows(text){
  text=String(text).replace(/^\uFEFF/,'');if(text.length>5000000)throw Error('CSV maior que 5 MB.');
  var first=text.split(/\r?\n/,1)[0],delimiter=(first.match(/;/g)||[]).length>(first.match(/,/g)||[]).length?';':',';
  var rows=[],row=[],cell='',quoted=false;
  for(var i=0;i<text.length;i++){var c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||cell==='')quoted=!quoted;else throw Error('Aspas inválidas no CSV.');}
   else if(!quoted&&(c===delimiter||c==='\n'||c==='\r')){row.push(cell);cell='';if(c!==delimiter){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(function(v){return v.trim();}))rows.push(row);row=[];}}
   else cell+=c;
   if(rows.length>10001)throw Error('O limite é de 10 mil linhas por arquivo.');
  }
  if(quoted)throw Error('Aspas não fechadas no CSV.');row.push(cell);if(row.some(function(v){return v.trim();}))rows.push(row);return rows;
 }
 function header(v){return v.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
 function parseCSV(text){
  var rows=csvRows(text),head=(rows.shift()||[]).map(header),aliases={sale_id:['saleid','idvenda','iddavenda','vend id','id'],product_id:['productid','produtoid','iddoproduto','idproduto'],utm_source:['utmsource'],utm_medium:['utmmedium'],utm_campaign:['utmcampaign'],utm_content:['utmcontent']},cols={};
  Object.keys(aliases).forEach(function(k){var matches=[];head.forEach(function(h,i){if(aliases[k].indexOf(h)!==-1)matches.push(i);});if(matches.length>1)throw Error('Colunas duplicadas para '+k+'.');cols[k]=matches.length?matches[0]:-1;});
  if(cols.sale_id<0||!['utm_source','utm_medium','utm_campaign','utm_content'].some(function(k){return cols[k]>=0;}))throw Error('Faltam colunas: ID da venda e pelo menos uma UTM.');
  var found={},blocked={},errors=[],skipped=0;
  rows.forEach(function(row,i){
   function v(k){return cols[k]<0?'':(row[cols[k]]||'').trim();}
   var id=v('sale_id'),pid=v('product_id'),rec={sale_id:Number(id),product_id:pid?Number(pid):null,origin_mode:'greenn_csv'};
   if(!/^\d+$/.test(id)||!Number.isSafeInteger(rec.sale_id)||rec.sale_id<=0||pid&&!['199173','199893'].includes(pid)){errors.push('Linha '+(i+2)+': ID da venda ou produto inválido.');return;}
   id=String(rec.sale_id);
   var invalid=false;['utm_source','utm_medium','utm_campaign','utm_content'].forEach(function(k){rec[k]=v(k);if(!/^[A-Za-z0-9_-]{0,180}$/.test(rec[k]))invalid=true;});
   if(invalid){errors.push('Linha '+(i+2)+': UTM fora do formato permitido.');return;}
   if(!rec.utm_source&&!rec.utm_medium&&!rec.utm_campaign&&!rec.utm_content){skipped++;return;}
   if(blocked[id]){skipped++;return;}
   if(found[id]){if(JSON.stringify(found[id])!==JSON.stringify(rec)){errors.push('Venda '+id+': origens conflitantes. Corrija o arquivo.');delete found[id];blocked[id]=true;}else skipped++;return;}
   found[id]=rec;
  });
  return {records:Object.values(found),errors:errors,skipped:skipped};
 }
 function exportCSV(rows){
  function cell(v){var s=v==null?'':String(v);if(/^[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
  return '\uFEFF'+[['Publicação','Instagram','Acessos (visualizações)','Cliques no checkout','Vendas pagas','Faturamento do livro (BRL)']].concat(rows.map(function(r){return [r.title,r.permalink,r.views,r.checkout_clicks,r.paid_sales,r.revenue_cents===null?'':(r.revenue_cents/100).toFixed(2)];})).map(function(r){return r.map(cell).join(';');}).join('\r\n');
 }
 return {report:report,parseCSV:parseCSV,permalink:permalink,exportCSV:exportCSV};
});
