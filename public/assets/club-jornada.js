/* Checklist único do módulo: equipe e mentorado na mesma lista de marcos.
   Regras puras, sem DOM: o que conta como feito, de quem é a vez e qual ciclo vale. */
(function(root){
  'use strict';
  var C=root.Club=root.Club||{};
  var STATUS={
    pendente:{label:'A fazer',tone:'muted'},
    aguardando:{label:'Aguardando mentorado',tone:'orange'},
    em_validacao:{label:'Em validação',tone:'blue'},
    ajuste:{label:'Ajuste pedido',tone:'orange'},
    concluida:{label:'Concluído',tone:'success'},
    nao_aplica:{label:'Não se aplica',tone:'muted'}
  };
  var OWNER={equipe:'Equipe Black',mentorado:'Mentorado'};
  // Fechado = não pede mais nada nesta lista. "Não se aplica" sai da conta.
  function fechado(status){return status==='concluida'||status==='nao_aplica';}
  function mesAtual(hoje){return String(hoje||new Date().toISOString()).slice(0,7);}
  // Referência compartilhada segue até o módulo dono dos marcos (no máximo 3 saltos).
  function origem(delivery,catalogo){
    var d=delivery,n=0;
    while(d&&d.sharedWith&&n<3){d=(catalogo||[]).find(function(x){return x.id===d.sharedWith;})||null;n++;}
    return d||delivery;
  }
  function marcos(delivery,catalogo,steps){
    var dono=origem(delivery,catalogo);
    return (steps||[]).filter(function(s){return s.delivery_id===dono.id;}).sort(function(a,b){return a.position-b.position;});
  }
  // Ciclo vigente: '' (única), 'AAAA-MM' (mensal) ou a data da edição do encontro.
  function ciclo(delivery,escolhido,encontros,hoje){
    if(!delivery||delivery.cycle==='unica'||!delivery.cycle)return '';
    if(delivery.cycle==='mensal')return /^20\d{2}-(0[1-9]|1[0-2])$/.test(escolhido||'')?escolhido:mesAtual(hoje);
    var eds=(encontros||[]).map(function(e){return String(e.edition);}).sort().reverse();
    return eds.indexOf(escolhido)>=0?escolhido:eds[0]||null;
  }
  function estado(progresso,memberId,stepId,edicao){
    return (progresso||[]).find(function(p){return p.member_id===memberId&&p.step_id===stepId&&p.edition===(edicao||'');})||{status:'pendente'};
  }
  // Andamento de um módulo para um mentorado num ciclo. Sem marcos = acompanhamento (indicador).
  function andamento(lista,progresso,memberId,edicao){
    var r={total:0,concluidos:0,naoAplica:0,aguardando:0,validacao:0,proximo:null,vez:null};
    if(edicao===null)return r;
    lista.forEach(function(s){
      var e=estado(progresso,memberId,s.id,edicao);
      if(e.status==='nao_aplica'){r.naoAplica++;return;}
      r.total++;
      if(e.status==='concluida'){r.concluidos++;return;}
      if(e.status==='em_validacao')r.validacao++;
      if(e.status==='aguardando'||e.status==='ajuste')r.aguardando++;
      if(!r.proximo){r.proximo=s;r.vez=e.status==='em_validacao'?'equipe':e.status==='aguardando'||e.status==='ajuste'?'mentorado':s.owner;}
    });
    r.pct=r.total?r.concluidos/r.total:0;
    r.completo=r.total>0&&r.concluidos===r.total;
    return r;
  }
  // O mentorado só vê como pendência o que foi pedido a ele (ou devolvido para ajuste).
  // A equipe vê o que espera validação e os pedidos em aberto.
  function pendencias(modulos,catalogo,steps,progresso,memberId,equipe,ciclos){
    var out=[];
    (modulos||[]).forEach(function(d){
      if(d.sharedWith)return;
      var ed=ciclos?ciclos(d):'';if(ed===null)return;
      marcos(d,catalogo,steps).forEach(function(s){
        var e=estado(progresso,memberId,s.id,ed);
        var mine=equipe?e.status==='em_validacao':(e.status==='aguardando'||e.status==='ajuste');
        if(!mine&&!(equipe&&(e.status==='aguardando'||e.status==='ajuste')))return;
        out.push({delivery:d,step:s,estado:e,edicao:ed,vez:e.status==='em_validacao'?'equipe':'mentorado'});
      });
    });
    return out;
  }
  // Ações que cada lado pode tomar sobre um marco, na ordem em que aparecem.
  function acoes(step,est,equipe){
    var s=est.status||'pendente';
    if(!equipe)return step.owner==='mentorado'&&(s==='pendente'||s==='aguardando'||s==='ajuste')?['enviar']:[];
    if(s==='concluida'||s==='nao_aplica')return ['reabrir'];
    if(s==='em_validacao')return ['concluir','ajuste'];
    var a=['concluir'];
    if(step.owner==='mentorado')a.push(s==='aguardando'||s==='ajuste'?'lembrar':'pedir');
    a.push('nao_aplica');
    return a;
  }
  C.jornada={STATUS:STATUS,OWNER:OWNER,fechado:fechado,mesAtual:mesAtual,origem:origem,marcos:marcos,ciclo:ciclo,estado:estado,andamento:andamento,pendencias:pendencias,acoes:acoes};
  if(typeof module!=='undefined')module.exports=C.jornada;
})(typeof window!=='undefined'?window:globalThis);
