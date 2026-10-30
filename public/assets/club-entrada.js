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
  // Campos da mensagem que o Jean manda no grupo Fechamentos Olympus, na ordem dela.
  var FECHAMENTO=[
    {grupo:'participante',nome:'Participante',campos:[['nome','Nome'],['cpf','CPF'],['rg','RG'],['nacionalidade','Nacionalidade'],
      ['estado_civil','Estado civil'],['profissao','Profissão'],['email','E-mail'],['telefone','Telefone'],['endereco','Endereço (com CEP)']]},
    {grupo:'contratante',nome:'Contratante (pessoa jurídica)',campos:[['razao_social','Razão social'],['cnpj','CNPJ'],
      ['endereco','Endereço'],['email','E-mail'],['telefone','Telefone']]},
    {grupo:'pagamento',nome:'Pagamento',campos:[['forma','Forma de pagamento'],['condicoes','Condições']]}
  ];
  function chave(t){return String(t||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\(.*?\)/g,'').replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim();}
  var ROTULOS={'razao social':'razao_social','cnpj':'cnpj','endereco':'endereco','e mail':'email','email':'email','telefone':'telefone',
    'nome':'nome','cpf':'cpf','rg':'rg','nacionalidade':'nacionalidade','estado civil':'estado_civil','profissao':'profissao'};
  // Lê a mensagem colada do grupo. Linha sem rótulo continua o campo anterior
  // (o CEP costuma quebrar linha); depois da forma de pagamento, vira condição.
  function lerFechamento(texto){
    var out={participante:{},contratante:{},pagamento:{}},secao='participante',ultimo=null;
    String(texto||'').split(/\r?\n/).forEach(function(bruta){
      var linha=bruta.replace(/^[\s•*·\-–]+/,'').trim();if(!linha)return;
      var k=chave(linha);
      if(k==='contratante'){secao='contratante';ultimo=null;return;}
      if(k==='participante'){secao='participante';ultimo=null;return;}
      if(/^club oftalmoblack$/.test(k))return;
      var m=/^([^:]{2,40}):\s*(.*)$/.exec(linha);
      if(m&&chave(m[1])==='forma de pagamento'){out.pagamento.forma=m[2].trim();ultimo='pagamento';return;}
      if(m&&ROTULOS[chave(m[1])]){var c=ROTULOS[chave(m[1])],v=m[2].replace(/^\(com cep\)\s*/i,'').trim();if(v)out[secao][c]=v;ultimo=v?[secao,c]:null;return;}
      if(ultimo==='pagamento'){out.pagamento.condicoes=(out.pagamento.condicoes?out.pagamento.condicoes+' ':'')+linha;return;}
      if(ultimo)out[ultimo[0]][ultimo[1]]+=' '+linha;
    });
    return out;
  }
  C.entrada={FASES:FASES,AGENDAMENTO:AGENDAMENTO,FECHAMENTO:FECHAMENTO,feitos:feitos,aberta:aberta,andamento:andamento,mensagem:mensagem,primeiroNome:primeiroNome,lerFechamento:lerFechamento};
  if(typeof module!=='undefined')module.exports=C.entrada;
})(typeof window!=='undefined'?window:globalThis);
