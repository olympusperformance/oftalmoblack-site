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
  // Vídeo enviado no grupo é lançado à mão pela equipe: inteiro de 0 a 60, senão null.
  function lancamento(valor){var s=String(valor==null?'':valor).trim();if(!/^\d{1,2}$/.test(s))return null;var n=Number(s);return n<=60?n:null;}

  var model={progresso:progresso,atual:atual,encerrado:encerrado,lancamento:lancamento};
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
      '<div class="cb-score"><strong>'+p.feitos+'<small> / '+p.meta+'</small></strong><p>Vídeos contados desde '+esc(dia(d.inicio))+'</p></div>'+
      '<div class="cb-bar" role="progressbar" aria-valuemin="0" aria-valuemax="'+p.meta+'" aria-valuenow="'+Math.min(p.feitos,p.meta)+'" aria-label="Progresso da meta"><span style="width:'+Math.round(p.pct*100)+'%"></span></div>'+
      '<p>'+(p.completo?'Meta batida. Oss.':fim?'Faltaram '+p.faltam+' para a meta.':'Faltam '+p.faltam+' para a meta.')+'</p>'+
      (reels.length?'<p class="cb-note">Reels no seu Instagram: '+reels.join(' · ')+'</p>':'')+
      (Number(r.videos_grupo)>0?'<p class="cb-note">Vídeos enviados no seu grupo: '+Number(r.videos_grupo)+'</p>':'')+
      '<p class="cb-note">'+esc(d.regra)+(r.conferido_em?' Conferido pela equipe em '+esc(quando(r.conferido_em))+'.':'')+'</p></article>';
  }

  function carregar(){
    st.carregando=true;st.erro=null;render();
    return C.sb.from('cb_desafio_metas').select('desafio_id,meta,feitos,videos_grupo,reels,conferido_em,cb_desafios(id,titulo,inicio,fim,regra)').eq('member_id',st.member.id)
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

  /* Acompanhamento da equipe (só no /admin/): Reels contam sozinhos na checagem
     diária; vídeo enviado no grupo é lançado aqui. Ordem alfabética, sem ranking. */
  var adm={host:null,members:[],rows:null,erro:null,msg:null};
  function nomeDe(id){var m=adm.members.find(function(x){return x.id===id;});return m?m.nome:'Membro';}
  function renderAdmin(){
    if(!adm.host)return;
    var h=adm.host;
    if(adm.rows===null&&!adm.erro){h.innerHTML='<div class="cb-loading" role="status">Carregando o Desafio Black…</div>';return;}
    var topo='<div class="cb-head"><div><span class="cb-kicker">Operação da equipe</span><h1>Desafio Black</h1><p>Reels no Instagram entram sozinhos na checagem diária. Vídeo enviado no grupo individual é lançado aqui. Vale o maior dos dois, nunca a soma. Os membros não veem esta lista.</p></div></div>';
    if(adm.erro){h.innerHTML=topo+'<div class="cb-notice" role="alert">Não foi possível carregar o Desafio Black. <button type="button" class="btn" data-desafio-admin-recarregar>Tentar novamente</button></div>';return;}
    var r0=atual(adm.rows);
    if(!r0){h.innerHTML=topo+'<div class="cb-empty">Nenhum desafio cadastrado.</div>';return;}
    var d=r0.cb_desafios,lista=adm.rows.filter(function(r){return r.desafio_id===r0.desafio_id;}).sort(function(a,b){return nomeDe(a.member_id).localeCompare(nomeDe(b.member_id),'pt-BR');});
    h.innerHTML=topo+'<p class="cb-note">'+esc(d.titulo)+' · de '+esc(dia(d.inicio))+' a '+esc(dia(d.fim))+(encerrado(d)?' · encerrado':'')+'</p>'+
      (adm.msg?'<div class="cb-notice" role="status">'+esc(adm.msg)+'</div>':'')+
      '<div class="cb-table-wrap"><table class="cb-table"><thead><tr><th>Membro</th><th>Meta</th><th>Reels no IG</th><th>Vídeos no grupo</th><th>Contados</th><th>Atualizado em</th></tr></thead><tbody>'+
      lista.map(function(r){var p=progresso(r);return '<tr><td>'+esc(nomeDe(r.member_id))+'</td><td>'+p.meta+'</td><td>'+Number(r.reels_ig||0)+'</td>'+
        '<td><form class="cb-tools" data-desafio-lancar="'+esc(r.member_id)+'" data-desafio-id="'+esc(r.desafio_id)+'"><input class="inp" type="number" min="0" max="60" step="1" inputmode="numeric" name="videos" value="'+Number(r.videos_grupo||0)+'" aria-label="Vídeos no grupo de '+esc(nomeDe(r.member_id))+'" style="width:72px"><button type="submit" class="btn">Salvar</button></form></td>'+
        '<td>'+p.feitos+' / '+p.meta+(p.completo?' ✓':'')+'</td><td>'+(r.updated_at?esc(quando(r.updated_at)):'—')+'</td></tr>';}).join('')+
      '</tbody></table></div>';
  }
  function carregarAdmin(){
    adm.rows=null;adm.erro=null;renderAdmin();
    return C.sb.from('cb_desafio_metas').select('desafio_id,member_id,meta,reels_ig,videos_grupo,feitos,updated_at,cb_desafios(id,titulo,inicio,fim)')
      .then(function(res){if(res.error)throw res.error;adm.rows=res.data||[];})
      .catch(function(){adm.erro=true;adm.rows=[];})
      .then(renderAdmin);
  }
  function lancar(form){
    var n=lancamento(form.videos.value),id=form.dataset.desafioLancar;
    if(n===null){adm.msg='Informe um número inteiro de 0 a 60.';renderAdmin();return;}
    form.querySelector('button').disabled=true;
    C.sb.from('cb_desafio_metas').update({videos_grupo:n}).eq('desafio_id',form.dataset.desafioId).eq('member_id',id).select('member_id')
      .then(function(res){if(res.error||!res.data||res.data.length!==1)throw res.error||new Error('sem linha');adm.msg=nomeDe(id)+': '+n+' vídeo(s) no grupo salvo(s).';})
      .catch(function(){adm.msg='Não foi possível salvar o lançamento de '+nomeDe(id)+'. Tente de novo.';})
      .then(carregarAdmin);
  }
  function enterAdmin(host,members){
    adm.host=host;adm.members=members||[];adm.msg=null;
    if(!host)return Promise.resolve();
    if(!host.dataset.desafioPronto){host.dataset.desafioPronto='1';
      host.addEventListener('click',function(e){if(e.target.closest('[data-desafio-admin-recarregar]'))carregarAdmin();});
      host.addEventListener('submit',function(e){var f=e.target.closest('[data-desafio-lancar]');if(f){e.preventDefault();lancar(f);}});}
    return carregarAdmin();
  }

  C.desafio={mount:mount,enterAdmin:enterAdmin,progresso:progresso,atual:atual,encerrado:encerrado,lancamento:lancamento};
})(typeof window!=='undefined'?window:globalThis);
