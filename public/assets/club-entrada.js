/* Entrada do novo mentorado: do fechamento até a CS encerrar a integração.
   Regras puras, sem DOM: andamento, fase atual e mensagens prontas para copiar. */
(function(root){
  'use strict';
  var C=root.Club=root.Club||{};
  var FASES=[
    {id:'fechamento',nome:'Fechamento'},
    {id:'administrativo',nome:'Administrativo'},
    {id:'integracao',nome:'Integração'},
    {id:'encontros',nome:'Encontros'},
    {id:'pos',nome:'Depois do diagnóstico'}
  ];
  var AGENDAMENTO='https://oftalmoblack.com.br/agendamento/onboarding';
  function feitos(progresso,memberId){
    var r={};(progresso||[]).forEach(function(p){if(p.member_id===memberId)r[p.passo_id]=p;});return r;
  }
  // Administrativo corre em paralelo e não segura os encontros; a integração segura.
  function aberta(fase,pend){
    if(fase==='fechamento')return true;
    if(pend.fechamento)return false;
    if(fase==='encontros')return !pend.integracao;
    if(fase==='pos')return !pend.integracao&&!pend.encontros;
    return true;
  }
  function andamento(passos,progresso,memberId){
    var f=feitos(progresso,memberId),pend={},lista=(passos||[]).slice().sort(function(a,b){return a.position-b.position;});
    lista.forEach(function(p){if(!f[p.id])pend[p.fase]=(pend[p.fase]||0)+1;});
    var abertos=lista.filter(function(p){return !f[p.id]&&aberta(p.fase,pend);});
    var concluidos=lista.filter(function(p){return f[p.id];}).length;
    return {total:lista.length,concluidos:concluidos,completo:lista.length>0&&concluidos===lista.length,
      proximos:abertos,feitos:f,
      // Fase de quem está mais atrás no caminho principal; administrativo só aparece quando é o que resta.
      fase:['fechamento','integracao','encontros','pos','administrativo'].filter(function(f){return pend[f];})[0]||null};
  }
  function primeiroNome(nome){
    var partes=String(nome||'').trim().split(/\s+/);
    return /^(dr|dra)\.?$/i.test(partes[0])&&partes[1]?partes[0]+' '+partes[1]:partes[0]||'';
  }
  function mensagem(tipo,member){
    if(tipo==='grupo')return 'Grupo de operação · '+(member&&member.nome||'')+' · Club OftalmoBlack\n\nAgende sua Reunião de Diagnóstico: '+AGENDAMENTO;
    if(tipo==='convite')return 'Olá, '+primeiroNome(member&&member.nome)+'! Seja bem-vindo ao Club OftalmoBlack. '+
      'Quero te convidar para o onboarding em grupo com o Dr. Alex, na segunda-feira às 20h (horário de Brasília). Pode confirmar sua presença?\n\n'+
      'Aproveite e já agende sua Reunião de Diagnóstico: '+AGENDAMENTO;
    return '';
  }
  C.entrada={FASES:FASES,AGENDAMENTO:AGENDAMENTO,feitos:feitos,aberta:aberta,andamento:andamento,mensagem:mensagem,primeiroNome:primeiroNome};
  if(typeof module!=='undefined')module.exports=C.entrada;
})(typeof window!=='undefined'?window:globalThis);
