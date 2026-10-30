/* Desafio Black: a meta de Reels que o membro combinou no encontro de quinta e
   quanto já saiu. Não é ranking: cada membro lê só a própria linha (RLS) e a tela
   não mostra ninguém além dele. Falha aqui não derruba as outras áreas. */
(function(root){
  'use strict';
  var C=root.Club=root.Club||{};

  // Regras puras, sem DOM.
  function progresso(row){
    var meta=Math.max(1,Number(row&&row.meta)||1),feitos=Math.max(0,Number(row&&row.feitos)||0);
    return {meta:meta,feitos:feitos,pct:Math.min(1,feitos/meta),faltam:Math.max(0,meta-feitos),completo:feitos>=meta};
  }
  // O desafio da vez é o mais recente pela data de início; sem linhas, nenhum.
  function atual(rows){
    return (rows||[]).filter(function(r){return r&&r.cb_desafios;}).sort(function(a,b){return Date.parse(b.cb_desafios.inicio)-Date.parse(a.cb_desafios.inicio);})[0]||null;
  }
  function encerrado(desafio,agora){return Date.parse(desafio.fim)<=(agora==null?Date.now():agora);}

  var model={progresso:progresso,atual:atual,encerrado:encerrado};
  if(typeof module!=='undefined'){module.exports=model;return;}

  var esc=C.esc,st={host:null,member:null,row:null,erro:null,carregando:true,onChange:null};
  function dia(s){return new Date(s).toLocaleDateString('pt-BR',{timeZone:'America/Manaus',day:'2-digit',month:'2-digit'});}
  function quando(s){return new Date(s).toLocaleString('pt-BR',{timeZone:'America/Manaus',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});}
  function link(u){return /^https:\/\/(www\.)?instagram\.com\//.test(u||'')?u:null;}

  function render(){
    if(!st.host)return;
    if(st.carregando){st.host.innerHTML='<div class="cb-loading" role="status">Carregando o Desafio Black…</div>';return;}
    if(st.erro){st.host.innerHTML='<div class="cb-notice" role="alert">Não foi possível carregar o Desafio Black agora. <button type="button" class="btn" data-desafio-recarregar>Tentar novamente</button></div>';return;}
    var r=st.row;
    if(!r){st.host.innerHTML='<div class="cb-empty">Nenhum desafio em andamento para você.</div>';return;}
    var d=r.cb_desafios,p=progresso(r),fim=encerrado(d);
    var reels=(r.reels||[]).map(function(x){var u=link(x.link);return u?'<a class="cb-link" href="'+esc(u)+'" target="_blank" rel="noopener">'+esc(dia(x.publicado_em))+'</a>':'';}).filter(Boolean);
    st.host.innerHTML='<div class="cb-head"><div><span class="cb-kicker">'+esc(st.member.nome)+' · Desafio Black</span><h1>'+esc(d.titulo)+'</h1><p>A meta que você combinou no encontro. Só você vê esta tela.</p></div></div>'+
      '<article class="cb-hero"><span class="cb-kicker">'+(fim?'Encerrado em ':'Sua meta até ')+esc(dia(d.fim))+'</span>'+
      '<div class="cb-score"><strong>'+p.feitos+'<small> / '+p.meta+'</small></strong><p>Reels publicados desde '+esc(dia(d.inicio))+'</p></div>'+
      '<div class="cb-bar" role="progressbar" aria-valuemin="0" aria-valuemax="'+p.meta+'" aria-valuenow="'+Math.min(p.feitos,p.meta)+'" aria-label="Progresso da meta"><span style="width:'+Math.round(p.pct*100)+'%"></span></div>'+
      '<p>'+(p.completo?'Meta batida. Oss.':fim?'Faltaram '+p.faltam+' para a meta.':'Faltam '+p.faltam+' para a meta.')+'</p>'+
      (reels.length?'<p class="cb-note">Reels contados: '+reels.join(' · ')+'</p>':'')+
      '<p class="cb-note">'+esc(d.regra)+(r.conferido_em?' Conferido pela equipe em '+esc(quando(r.conferido_em))+'.':'')+'</p></article>';
  }

  function carregar(){
    st.carregando=true;st.erro=null;render();
    return C.sb.from('cb_desafio_metas').select('desafio_id,meta,feitos,reels,conferido_em,cb_desafios(id,titulo,inicio,fim,regra)').eq('member_id',st.member.id)
      .then(function(res){if(res.error)throw res.error;st.row=atual(res.data);})
      .catch(function(){st.erro=true;st.row=null;})
      .then(function(){st.carregando=false;render();if(st.onChange)st.onChange(!!st.row);});
  }

  function mount(host,member,options){
    st.host=host;st.member=member;st.onChange=options&&options.onChange||null;
    if(!host||!member)return Promise.resolve();
    if(!host.dataset.desafioPronto){host.dataset.desafioPronto='1';host.addEventListener('click',function(e){if(e.target.closest('[data-desafio-recarregar]'))carregar();});}
    return carregar();
  }

  C.desafio={mount:mount,progresso:progresso,atual:atual,encerrado:encerrado};
})(typeof window!=='undefined'?window:globalThis);
