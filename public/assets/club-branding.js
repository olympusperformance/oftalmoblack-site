/* Campanha de Branding: mesma tabela e cálculos para equipe e mentorado. */
(function (C) {
  'use strict';
  var esc=C.esc,ico=C.icon,root,options,st,request=0;
  var $=function(id){return root.querySelector('#'+id);};
  function safePostUrl(value) {
    try { var u=new URL(value);return u.protocol==='https:'&&/(^|\.)instagram\.com$/.test(u.hostname)?esc(u.href):null; }
    catch(e){return null;}
  }
  function tabela(cols, cabecalhos, linhas, vazio) {
    return '<div class="tblw"><div class="tbl" style="--cols:' + cols + '">' +
      '<div class="tbl-h">' + cabecalhos.map(function (h) {
        var fim = h.charAt(0) === '>';
        return '<div class="td' + (fim ? ' end' : '') + '">' +
          esc(fim ? h.slice(1) : h) + '</div>';
      }).join('') + '</div>' +
      (linhas || '<div class="tbl-empty">' + esc(vazio) + '</div>') +
    '</div></div>';
  }

  function td(conteudo, classe) {
    return '<div class="td ' + (classe || '') + '"><span class="tx">' + conteudo + '</span></div>';
  }

  /* A célula que abre menu não entra no .tx: a moldura dela é mais alta e mais
     larga que a linha de texto — de propósito, para o texto ficar alinhado com
     as outras colunas — e o overflow do .tx cortava a borda fora. Ela mesma
     encolhe o que não cabe. */
  function tdCel(conteudo, classe) {
    return '<div class="td cel ' + (classe || '') + '">' + conteudo + '</div>';
  }

  function numeroCurto(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace('.0', '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k';
    return String(n);
  }

  function cardStat(k,v,d,dica) {
    return '<div class="stat'+(dica?' tem-dica':'')+'"'+(dica?' data-dica="'+esc(dica)+'"':'')+'><div class="k">'+esc(k)+'</div><div class="v">'+esc(v)+'</div><div class="d">'+esc(d)+'</div></div>';
  }
  var brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  function dinheiro(v) { return v === null || v === undefined ? '—' : brl.format(v); }

  // effective_status continua ACTIVE depois do término; a data decide.
  function situacaoImp(i) {
    if (i.termino && new Date(i.termino) < new Date()) return 'encerrado';
    return { ACTIVE: 'rodando', PAUSED: 'pausado', CAMPAIGN_PAUSED: 'pausado', ADSET_PAUSED: 'pausado',
             IN_PROCESS: 'em análise', WITH_ISSUES: 'com problema', DISAPPROVED: 'reprovado',
             ARCHIVED: 'arquivado', DELETED: 'excluído' }[i.status] || 'encerrado';
  }

  function emptyState(title,message) {
    return '<div class="placeholder">'+ico('instagram')+'<h2>'+esc(title)+'</h2><p>'+esc(message)+'</p></div>';
  }
  function render() {
    if(!root||!st)return;
    $('statsImp').innerHTML='';$('impAtualizado').textContent='';
    if(st.loading){$('listaImp').innerHTML='<div class="tbl-empty" role="status">Carregando campanha…</div>';return;}
    if(st.error){$('listaImp').innerHTML='<div class="placeholder" role="alert"><h2>Não foi possível carregar a campanha</h2><p>Tente atualizar os dados novamente.</p><button class="btn" data-branding-retry>Tentar novamente</button></div>';return;}
    var contas=st.contas||[],todos=st.rows||[];
    if(!st.impMembro){$('listaImp').innerHTML=emptyState('Nenhum mentorado disponível','Cadastre um mentorado para acompanhar a campanha.');return;}
    var daConta=contas.filter(function(c){return c.member_id===st.impMembro;});
    var coleta=daConta.map(function(c){return c.ultima_coleta;}).filter(Boolean).sort().pop();
    var erro=daConta.some(function(c){return !!c.ultimo_erro;});
    $('impAtualizado').textContent=(erro?'A atualização pela Meta está pendente. Os dados podem estar desatualizados. ':'')+(coleta?'Última atualização: '+new Date(coleta).toLocaleString('pt-BR'):'');
    if(!todos.length){
      if(erro){$('listaImp').innerHTML=emptyState('Atualização pendente','Não foi possível atualizar os dados da Meta. Fale com a equipe para conferir o acesso à conta.');return;}
      if(daConta.some(function(c){return c.ativo&&!c.ultima_coleta;})){
        $('listaImp').innerHTML=emptyState('Aguardando os primeiros dados','A conta já está vinculada. A campanha aparecerá após a primeira atualização pela Meta.');return;
      }
      $('listaImp').innerHTML=emptyState('Campanha de Branding ainda não disponível',options.admin?
        'Este mentorado ainda não está realizando a campanha de branding ou ainda não liberou acesso à conta Meta.':
        'Você ainda não está realizando a campanha de branding ou ainda não liberou acesso à sua conta Meta. Fale com a equipe para começar ou conferir o acesso.');return;
    }
    var corte = st.impPeriodo === 'todos' ? null : new Date(Date.now() - 90 * 86400000).toISOString();
    var linhas = todos.filter(function (i) { return !corte || (i.inicio && i.inicio >= corte); });

    var gasto = linhas.reduce(function (a, i) { return a + Number(i.gasto || 0); }, 0);
    var seg = linhas.reduce(function (a, i) { return a + (i.seguidores || 0); }, 0);
    var media = seg > 0 ? gasto / seg : null;
    var metade = media === null ? null : media / 2;
    var bons = media === null ? 0 : linhas.filter(function (i) {
      return i.seguidores > 0 && i.gasto / i.seguidores <= metade;
    }).length;

    $('statsImp').innerHTML =
      cardStat('INVESTIDO', dinheiro(gasto), linhas.length + ' impulsionamentos') +
      cardStat('SEGUIDORES GANHOS', numeroCurto(seg), seg ? 'atribuídos pela Meta' : 'nenhum atribuído',
               'Seguidores que a Meta atribui aos impulsionamentos do período — o mesmo ' +
               '"Seguidores no Instagram" do Gerenciador.') +
      cardStat('MÉDIA DO SEGUIDOR', dinheiro(media), 'investido ÷ seguidores',
               'Quanto custou, em média, cada seguidor trazido pelos impulsionamentos do período.') +
      cardStat('METADE DO SEGUIDOR', dinheiro(metade), bons + ' posts abaixo dela',
               'Post que traz seguidor por menos que a metade da média é post bom: ' +
               'R$ 100/dia até começar a ficar caro. Acompanhar uma vez por semana, no domingo.');

    /* Faixas fixas da planilha, nos dois custos: abaixo de R$ 1 é verde, de
       R$ 1 a R$ 2 amarelo, acima de R$ 2 vermelho. A lista vem nessa ordem pelo
       custo por seguidor (sem seguidor nenhum vai por último), e dentro de cada
       faixa do mais barato para o mais caro. */
    function faixa(v) { return v === null ? 3 : v < 1 ? 0 : v <= 2 ? 1 : 2; }
    function celCusto(v) {
      if (v === null) return '<span class="tx-s">—</span>';
      return '<span class="imp-faixa imp-f' + faixa(v) + '">' + dinheiro(v) + '</span>';
    }
    var porSeg = function (i) { return i.seguidores > 0 ? i.gasto / i.seguidores : null; };
    var ordenadas = linhas.slice().sort(function (a, b) {
      var ca = porSeg(a), cb = porSeg(b);
      return (faixa(ca) - faixa(cb)) || ((ca === null ? 0 : ca) - (cb === null ? 0 : cb)) ||
        String(b.inicio || '').localeCompare(String(a.inicio || ''));
    });

    $('listaImp').innerHTML = tabela(
      '92px 92px minmax(0,1.8fr) 104px 104px 92px 108px 112px 92px',
      ['Início', 'Término', 'Anúncio', 'Gasto', 'Total', 'Seguidores', 'Custo/visita', 'Custo/seguidor', '>Instagram'],
      ordenadas.map(function (i) {
        var cs = porSeg(i);
        var porVisita = i.visitas_perfil > 0 ? i.gasto / i.visitas_perfil : null;
        var titulo = esc(String(i.nome).replace(/^.*?(post do instagram|publica[cç][aã]o do instagram|instagram post|publicaci[oó]n de instagram)\s*:?\s*/i, '') || 'Post do Instagram');
        var link = safePostUrl(i.post_url);
        return '<div class="tr">' +
          td(i.inicio ? esc(Club.fmtDataCurta(i.inicio)) : '—') +
          td(i.termino ? esc(Club.fmtDataCurta(i.termino)) : '—') +
          td('<div class="tx"><div class="tx tx-t">' +
             (link ? '<a href="' + link + '" target="_blank" rel="noopener">' + titulo + '</a>' : titulo) +
             '</div><div class="tx tx-s">' + esc(situacaoImp(i)) +
             (i.visitas_perfil ? ' · ' + numeroCurto(i.visitas_perfil) + ' visitas ao perfil' : '') + '</div></div>') +
          td(dinheiro(Number(i.gasto))) +
          td(dinheiro(i.orcamento_total === null ? null : Number(i.orcamento_total))) +
          td(numeroCurto(i.seguidores)) +
          tdCel(celCusto(porVisita)) +
          tdCel(celCusto(cs)) +
          tdCel(link ? '<a class="btn btn-sm imp-abrir" href="' + link + '" target="_blank" rel="noopener" ' +
                'title="Abrir o post no Instagram"><svg class="ic"><use href="#i-instagram"/></svg>Abrir</a>' :
                '<span class="tx-s">sem link</span>', 'end') +
        '</div>';
      }).join(''),
      st.impPeriodo === 'todos' ? 'Nenhum impulsionamento nesta conta.' :
        'Nenhum impulsionamento nos últimos 90 dias. Veja "Todos".'
    );
  }
  function updateMemberSelect() {
    var select=$('filtroImpMembro');
    select.innerHTML=(options.members||[]).map(function(m){return '<option value="'+esc(m.id)+'"'+(m.id===st.impMembro?' selected':'')+'>'+esc(m.nome)+'</option>';}).join('');
  }
  async function load() {
    var token=++request,selected=st.impMembro;
    st.loading=true;st.error=false;render();
    try {
      var contas=await C.data.instagram.impulsionamentoContas(options.admin?null:options.member.id);
      if(token!==request)return;
      st.contas=contas;
      if(!selected)selected=contas[0]&&contas[0].member_id||(options.members[0]&&options.members[0].id)||null;
      if(!options.members.some(function(m){return m.id===selected;}))selected=options.members[0]&&options.members[0].id||null;
      st.impMembro=selected;updateMemberSelect();
      var rows=selected?await C.data.instagram.impulsionamentos(selected):[];
      if(token!==request)return;
      st.rows=rows;st.loading=false;st.loaded=true;render();
    } catch(e){if(token===request){st.loading=false;st.error=true;render();}}
  }
  function mount(el,opts) {
    if(!el)return;
    ++request;root=el;options=opts;
    options.members=opts.admin?(opts.members||[]):[opts.member];
    st={impPeriodo:'90',impMembro:opts.member&&opts.member.id||null,loading:true,loaded:false};
    root.innerHTML='<div class="hello"><h1>Campanha de Branding</h1><p>Acompanhe seus posts turbinados no Instagram e os resultados atribuídos pela Meta.</p></div>'+
      '<div class="toolbar branding-toolbar"><label'+(!opts.admin?' hidden':'')+'>Mentorado<select class="inp" id="filtroImpMembro" aria-label="Mentorado da campanha"></select></label>'+
      '<div class="seg" id="filtroImpPeriodo"><button data-imp="90" aria-pressed="true">Últimos 90 dias</button><button data-imp="todos" aria-pressed="false">Todos</button></div>'+
      '<button class="btn" data-branding-retry>Atualizar</button></div><p class="tx-s" id="impAtualizado" aria-live="polite"></p><div class="statgrid" id="statsImp"></div><div id="listaImp"></div>';
    updateMemberSelect();render();
    root.onchange=function(e){if(e.target.id==='filtroImpMembro'&&options.admin){st.impMembro=e.target.value;load();}};
    root.onclick=function(e){
      var period=e.target.closest('[data-imp]');
      if(period){st.impPeriodo=period.dataset.imp;root.querySelectorAll('[data-imp]').forEach(function(b){b.setAttribute('aria-pressed',String(b===period));});render();}
      if(e.target.closest('[data-branding-retry]'))load();
    };
  }
  C.branding={mount:mount,enter:function(){if(st&&!st.loaded)load();},selected:function(){return st&&st.impMembro;}};
})(window.Club);
