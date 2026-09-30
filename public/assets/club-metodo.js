/* Método Faixa Preta, versão de 29/09/2026. Catálogo e regras sem dados de demonstração. */
(function (root) {
  'use strict';
  var C = root.Club = root.Club || {};
  var movements = ['Preparar', 'Criar', 'Capturar', 'Converter', 'Perpetuar'];
  // key, rótulo, unidade. As fontes automáticas são sobrepostas pela integração.
  var steps = [
    ['D01','Diagnóstico Black',0,'A fotografia inicial das três frentes e as prioridades do Dia Zero.','Gate de entrada',
      ['Foto das três frentes registrada no Sistema','Lentes prioritárias anotadas no tatame'],
      [['dia_zero','Data do Dia Zero',''],['leads_iniciais','Leads/mês no Dia Zero',''],['capacidade','Capacidade mensal de consultas','']]],
    ['D02','Posicionamento Black',0,'Mecanismo Grau Zero, arquétipo, branding e linha editorial.','Colaboração · peso ½',
      ['MGZ aprovado pelo Club','Arquétipo e branding revisados','Linha editorial e scripts em uso'],
      [['mgz','Mecanismo Grau Zero',''],['arquetipo','Arquétipo',''],['scripts','Scripts entregues','']]],
    ['D03','Sistema Black',0,'CRM, prontuário e agenda no mesmo fluxo: registrar para decidir.','Rotina · até 5 pts',
      ['CRM, prontuário e agenda no mesmo fluxo','Rastreamento implantado','Leitura semanal do placar'],
      [['novos','Leads novos',''],['sla','SLA de primeiro contato','min'],['orfaos','Leads órfãos',''],['desfechos','Desfechos registrados','%'],['comparecimento','Comparecimento','%']]],
    ['D04','Time Premium',0,'Montar as quatro funções e formar a equipe no padrão premium.','Missões de execução',
      ['Social Seller com dono','SDR: Íris Black ou humana com dono','Closer / Orientadora Cirúrgica com dona','Equipe clínica com responsáveis','Trilha Cultura Premium & Atendimento Premium concluída','Padrões implantados no balcão'],
      [['funcoes','Funções com dono','/ 4'],['trilha','Equipe formada na trilha','%'],['padroes','Padrões implantados','/ 9']]],
    ['D05','Referência Black',1,'Conteúdo e presença que fazem do médico uma referência.','Rotina · até 15 pts',
      ['Canais de conteúdo ativos','GBP com artigo semanal','Site institucional AEO publicado'],
      [['videos','Vídeos publicados na semana',''],['seguidores','Seguidores',''],['crescimento','Crescimento no trimestre',''],['artigos','Artigos GBP na semana','']]],
    ['D06','Máquina de Tráfego',1,'Meta, Google e Funil Expresso: do clique ao WhatsApp qualificado.','Missões + Resultado',
      ['Rastreamento clique → cirurgia','Funil Expresso: página, VSL e pedágios','Máquina auditada após implantação','Leitura mensal e verba acordada'],
      [['cpv','CPV-Cirurgia','R$'],['cpv_percent','CPV / ticket','%'],['verba','Verba investida','R$'],['criativos','Criativos ativos',''],['pedagios','Pedágios implementados','/ 5']]],
    ['D07','Captação Ativa',2,'Prospecção, indicação ativa e desfechos dos Leads Bônus.','Missões de execução',
      ['Social Seller com rotina diária','Roteiro de indicação ativa padronizado','Desfecho registrado de todos os Leads Bônus'],
      [['dms','DMs por dia',''],['respostas','Taxa de resposta','%'],['agendamentos','Agendamentos na semana',''],['bonus_recebidos','Leads Bônus recebidos',''],['bonus_desfechos','Leads Bônus com desfecho','']]],
    ['D08','Encontro Grau Zero',2,'O webinar mensal da rede, com participação do Mestre e leads para sua clínica.','Rotina · até 10 pts',
      ['Divulgação no perfil marcando @dralexsa','Vídeos enviados para grupo e tráfego','Presença ao vivo no pitch'],
      [['inscritos','Inscritos da edição',''],['leads','Leads direcionados à clínica',''],['conversao','Lead → consulta','%']]],
    ['D09','Chamada Consultiva',3,'Funil de High Ticket: a Closer destrava o qualificado e resgata leads parados em chamadas de 15–25 minutos.','Missões + Resultado',
      ['Closer treinada no Método In The Bag','Agenda com dupla de horários','Ciclo mensal de resgate em operação'],
      [['chamadas','Chamadas na semana',''],['funil_b','Qualificados travados → chamada',''],['resgatados','Leads resgatados e reagendados',''],['chamada_consulta','Chamada → consulta','%'],['no_show','No-show fora da praça','']]],
    ['D10','Método In The Bag',3,'Venda consultiva: sequência de oito etapas, temperamentos e fechamento pós-consulta.','Missões de execução',
      ['SDR com dono: Íris Black ou humana','Sequência In The Bag treinada com roleplay','Agenda do médico protegida','Cadência D+1 · D+5 · D+9 · D+16 · D+21'],
      [['sla_sdr','SLA do SDR','min'],['consulta_cirurgia','Consulta → cirurgia','%'],['cirurgias','Cirurgias fechadas',''],['cadencia','Cadência pós-consulta','']]],
    ['D11','Protocolo de Encantamento',4,'Atendimento Premium que gera experiência, prova e indicação.','Missões de execução',
      ['Três rituais padronizados com gatilho','Provas com consentimento registrado','NPS na rotina pós-operatória'],
      [['nps','NPS',''],['rituais','Rituais padronizados','/ 7'],['provas','Provas registradas no mês','']]],
    ['D12','Recorrência Black',4,'Seguro Premium, Cuidado Premium e retorno após a cirurgia.','Missões de execução',
      ['Seguro Premium estruturado e precificado','Oferta padronizada na alta','Pacotes Cuidado Premium implantados'],
      [['seguros','Seguro Premium: assinaturas ativas',''],['ofertas','Altas com oferta','%'],['pacotes','Pacotes Cuidado Premium',''],['retornos','Retornos de seis meses reativados','']]]
  ].map(function (s) { return { id:s[0], name:s[1], movement:movements[s[2]], definition:s[3], points:s[4], checklist:s[5], metrics:s[6] }; });
  function quarter(date) {
    var d = date || new Date();
    return d.getFullYear() + '-T' + (Math.floor(d.getMonth() / 3) + 1);
  }
  function bounds(period) {
    if (!/^\d{4}-T[1-4]$/.test(period)) throw new Error('Trimestre inválido');
    var y = +period.slice(0,4), m = (+period.slice(-1) - 1) * 3;
    function iso(d) { return d.toISOString().slice(0,10); }
    return { start:iso(new Date(Date.UTC(y,m,1))), end:iso(new Date(Date.UTC(y,m+3,0))) };
  }
  function number(v) { return v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v); }
  function ratio(a,b,max) { a=number(a); b=number(b); return a === null || b === null || b <= 0 ? null : Math.max(0,Math.min(max,a/b*max)); }
  function round(n) { return Math.round((n + Number.EPSILON)*100)/100; }
  function score(q,missions,extras,editions) {
    q=q||{}; missions=missions||[]; extras=extras||[]; editions=editions||[];
    var eligible = missions.filter(function(m){return m.weight>0&&m.status!=='cancelled';});
    var asked=eligible.reduce(function(s,m){return s+Number(m.weight);},0);
    var done=eligible.reduce(function(s,m){return s+(m.status==='verified'?Number(m.weight):0);},0);
    var possible=editions.length*3;
    var delivered=editions.reduce(function(s,e){return s+(e.publicized?1:0)+(e.video_group&&e.video_ads?1:0)+(e.attended?1:0);},0);
    var parts={
      attendance:ratio(q.attended,q.eligible,10), videos:ratio(q.video_credits,q.weeks,10),
      encontro:ratio(delivered,possible,10), followers:q.followers_growth==null?null:Math.min(5,Math.max(0,q.followers_growth/1000)),
      system:q.orphan_leads==null||q.sla_recorded==null||q.outcomes_percent==null?null:(q.orphan_leads===0&&q.sla_recorded&&q.outcomes_percent>=95?5:0),
      missions:asked?done/asked*15:0,
      result:(q.cpv_percent!=null&&q.cpv_percent<15)||(q.call_conversion!=null&&q.call_conversion>=60)?5:(q.cpv_percent==null&&q.call_conversion==null?null:0)
    };
    var bonus=extras.some(function(e){return e.kind==='bonus';})?10:0;
    var referrals=extras.filter(function(e){return e.kind==='referral';}).length;
    var modules=new Set(extras.filter(function(e){return e.kind==='module';}).map(function(e){return e.reference;})).size;
    var routine=['attendance','videos','encontro','followers','system'].reduce(function(s,k){return s+(parts[k]||0);},0);
    var total=routine+parts.missions+(parts.result||0)+bonus+referrals*25+modules*5;
    return { parts:parts,routine:round(routine),missions:round(parts.missions),result:parts.result,extra:bonus+referrals*25+modules*5,total:round(total),referrals:referrals,vouchers:referrals,asked:asked,done:done,complete:Object.keys(parts).every(function(k){return parts[k]!==null;}) };
  }
  function artifactSteps(a) {
    if (Array.isArray(a.method_steps)) return a.method_steps;
    var name=String(a.nome||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if (/fabrica|iris/.test(name)) return [];
    var map=[[/onboarding|diagnostico/,['D01']],[/posicionamento|linha editorial/,['D02']],[/tracker|trackeamento/,['D03','D06']],[/sistema black/,['D03']],[/time premium/,['D04']],[/site institucional|gbp|aeo|google meu negocio/,['D05']],[/meta ads|google ads|trafego|funil expresso/,['D06']],[/captacao ativa/,['D07']],[/encontro grau zero/,['D08']],[/chamada consultiva/,['D09']],[/in the bag|closer/,['D10']],[/encantamento/,['D11']],[/recorrencia|seguro premium/,['D12']]];
    var found=map.find(function(x){return x[0].test(name);}); return found?found[1]:[];
  }
  function pending(missions,artifacts,steps,progress,today) {
    today=today||new Date().toISOString().slice(0,10);
    var items=(missions||[]).filter(function(m){return m.status!=='verified'&&m.status!=='cancelled';}).map(function(m){return { id:m.id,title:m.title,step:m.method_step,due:m.due_on,requested:m.requested_on,weight:m.weight,status:m.status,source:'Missão solicitada',evidence:m.evidence };});
    // Uma trava de catálogo não prova que houve pedido. Só marcações explícitas entram.
    (progress||[]).filter(function(p){return !p.feito&&p.requested_at;}).forEach(function(p){
      var s=(steps||[]).find(function(s){return s.id===p.step_id;});
      var a=s&&(artifacts||[]).find(function(a){return a.id===s.artifact_id;});
      if (!a||items.some(function(m){return m.id===p.mission_id;})) return;
      items.push({id:p.step_id,title:s.titulo,step:artifactSteps(a)[0],due:p.due_on,requested:p.requested_at,weight:null,source:a.nome,status:'requested'});
    });
    return items.map(function(m){ m.late=m.due?Math.max(0,Math.round((Date.parse(today)-Date.parse(m.due))/86400000)):0;return m;})
      .sort(function(a,b){return (a.due||'9999').localeCompare(b.due||'9999')||String(a.title).localeCompare(String(b.title));});
  }
  function canonical(hash) {
    var s=String(hash||'').replace(/^#/,'');
    // p01–p12 são os links do protótipo de 12 degraus, não do método antigo.
    return s.replace(/^subida\/p(\d{2})$/,'subida/D$1');
  }
  // Classifica apenas os intervalos explícitos do quadro fornecido pelo Club.
  // Não indica lente nem preenche lacunas do material com inferência clínica.
  function referenceSignal(key,value) {
    var n=number(value);if(n===null||n<0)return 'off';
    if(key==='endotelio')return n>=2000?'ok':n>=1500?'warn':'crit';
    if(key==='hoa')return n<.3?'ok':n<.5?'warn':'crit';
    if(key==='coma'||key==='trefoil')return n<.2?'ok':n<.3?'warn':'crit';
    if(key==='ae')return n<=.4?'ok':n<=.5?'warn':n>.6?'crit':'off';
    if(key==='macula'||key==='no')return n===0?'ok':n===1?'warn':n===2||n===3?'crit':'off';
    return 'off';
  }
  C.metodo={steps:steps,movements:movements,quarter:quarter,bounds:bounds,number:number,score:score,artifactSteps:artifactSteps,pending:pending,canonical:canonical,referenceSignal:referenceSignal};
  if (typeof module!=='undefined') module.exports=C.metodo;
})(typeof window!=='undefined'?window:globalThis);
