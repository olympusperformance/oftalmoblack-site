// Funil do MCP pela mesma fonte da Visão Geral: get_funil_metrics no CRM, com o
// recorte de período e fuso do Farol (periodo.ts). Substitui a RPC legada
// cerebro_metricas, que usava outra janela e outra deduplicação e divergia do painel.
// Só agregados do funil chegam ao modelo; nada de registro individual nem valor.

export const FONTE = 'Visão Geral / get_funil_metrics';
export const CAMPOS = ['novos','agendadas','realizadas','indicacoes','cirurgias','perdidos'];
export const DEFINICOES = {
  novos:{rotulo:'Novos leads',unidade:'pessoas'},
  agendadas:{rotulo:'Agendadas',unidade:'pessoas'},
  realizadas:{rotulo:'Realizadas',unidade:'pessoas'},
  indicacoes:{rotulo:'Indicações',unidade:'registros por procedimento'},
  cirurgias:{rotulo:'Fechamentos',unidade:'registros por procedimento',
    aviso:'Nome legado da chave; inclui fechamentos de exames e cirurgias. Não significa cirurgias realizadas.'},
  perdidos:{rotulo:'Perdidos',aviso:'Registros classificados como perdidos na fonte.'},
};
export const INTERPRETACAO = [
  'Fluxo da janela: leads e consultas contam pessoas; indicações e fechamentos contam um registro por procedimento. Uma pessoa com cirurgia e exame pode contar mais de uma vez. As etapas não acompanham a mesma coorte de leads.',
  'Não subtraia etapas nem divida totais para afirmar perda, abandono ou conversão. Agendamentos podem vir de leads anteriores e avançar depois do período.',
  'Realizadas/agendadas não é taxa de comparecimento: faltam vínculo entre os atendimentos e situação final dos agendamentos.',
  'Perdidos são registros classificados como perdidos, não a diferença entre etapas.',
  'Zero significa nenhum registro contado nesta fonte; não prova ausência de atividade nem defeito de registro. Dado indisponível não é zero.',
];

// Mesmo contrato do chat (cerebro-chat/metricas.mjs): datas explícitas viram
// intervalo personalizado; senão, dias corridos até hoje no fuso da clínica.
export function pedidoDePeriodo(args = {}) {
  if (args.inicio !== undefined || args.fim !== undefined) return {preset:'custom',from:args.inicio,to:args.fim};
  return {days:args.dias ?? 30};
}

export function horarioDaFonte(value, zone) {
  if (typeof value !== 'string' || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) || typeof zone !== 'string') return null;
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat('pt-BR',{
      timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',
      hourCycle:'h23',timeZoneName:'longOffset',
    }).formatToParts(new Date(value)).map(p=>[p.type,p.value]));
    const offset = parts.timeZoneName === 'GMT' ? 'UTC+00:00' : parts.timeZoneName.replace('GMT','UTC');
    return `${parts.day}/${parts.month}/${parts.year} às ${parts.hour}:${parts.minute} (${zone}, ${offset})`;
  } catch (_) { return null; }
}

// As três funções de data são cópia do farol-metricas/index.ts, para o recorte bater byte a byte.
function dateInZone(value, zone) {
  return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(value);
}
function addDays(day, offset) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0,10);
}
function zonedMidnight(day, zone) {
  const [year, month, date] = day.split('-').map(Number);
  const wanted = Date.UTC(year, month - 1, date);
  const formatter = new Intl.DateTimeFormat('en-US',{
    timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23',
  });
  let guess = wanted;
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(formatter.formatToParts(new Date(guess)).map(part=>[part.type,Number(part.value)]));
    const seen = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess += wanted - seen;
  }
  return new Date(guess);
}
function fusoValido(zone) {
  const z = zone || 'America/Sao_Paulo';
  try { new Intl.DateTimeFormat('en-US',{timeZone:z}); return z; } catch (_) { return 'America/Sao_Paulo'; }
}
function contagens(part) {
  return CAMPOS.every(key=>Number.isInteger(part?.[key]) && part[key] >= 0) ? Object.fromEntries(CAMPOS.map(key=>[key,part[key]])) : null;
}
function dataBr(day) {
  return typeof day === 'string' && /^\d{4}-\d{2}-\d{2}/.test(day) ? `${day.slice(8,10)}/${day.slice(5,7)}/${day.slice(0,4)}` : String(day ?? '?');
}

// clinica: {id,name,timezone} do CRM. rpcDoCrm(nome, corpo) devolve o JSON da RPC.
// resolverPeriodo é o resolveRequestedPeriod do farol-metricas/periodo.ts.
export async function funilDaClinica({clinica, args = {}, rpcDoCrm, resolverPeriodo, agora = new Date()}) {
  const fuso = fusoValido(clinica?.timezone);
  const base = {fonte:FONTE,status:'indisponivel',clinica:clinica?.name ?? null,fuso,periodo:null,
    atualizado_em:null,atualizado_em_texto:null,metricas:null,anterior:null,coorte:false,
    taxas_de_conversao:null,taxa_comparecimento:null,cobertura:null,definicoes:DEFINICOES,interpretacao:INTERPRETACAO};
  const hoje = dateInZone(agora, fuso);
  const periodo = resolverPeriodo(pedidoDePeriodo(args), hoje);
  if (!periodo) return {...base,status:'periodo_invalido',motivo:'Período inválido. Confirme as datas solicitadas; não substitua por 30 dias.'};
  if (periodo.not_started) return {...base,status:'nao_iniciado',periodo,motivo:'Período ainda não começou no fuso da clínica.'};
  const start = zonedMidnight(periodo.date_start, fuso).toISOString();
  const end = new Date(zonedMidnight(addDays(periodo.date_end, 1), fuso).getTime() - 1).toISOString();
  let bruto;
  try {
    bruto = await rpcDoCrm('get_funil_metrics',{p_clinic_id:clinica.id,p_period_start:start,p_period_end:end});
  } catch (_) {
    return {...base,periodo:{...periodo,start,end},motivo:'Não foi possível consultar a Visão Geral agora. Não reutilize números anteriores como atuais.'};
  }
  const metricas = contagens(bruto?.periodo);
  const atualizadoEm = agora.toISOString();
  if (!metricas) return {...base,periodo:{...periodo,start,end},atualizado_em:atualizadoEm,
    atualizado_em_texto:horarioDaFonte(atualizadoEm,fuso),motivo:'A Visão Geral respondeu sem o funil completo. Não reutilize números anteriores como atuais.'};
  return {...base,status:'pronto',periodo:{...periodo,start,end},atualizado_em:atualizadoEm,
    atualizado_em_texto:horarioDaFonte(atualizadoEm,fuso),metricas,
    anterior:periodo.preset !== 'all' ? contagens(bruto?.anterior) : null,
    cobertura:{trilha_desde:bruto?.trilha_desde ?? null,dados_desde:bruto?.dados_desde ?? null,
      aviso:'Confira a cobertura antes de comparar períodos. Datas ausentes não comprovam histórico completo.'}};
}

function linhaMetrica(chave, valor) {
  const d = DEFINICOES[chave];
  const unidade = d.unidade ? ` (${d.unidade})` : '';
  const aviso = chave === 'cirurgias' ? ' [chave legada "cirurgias"; inclui exames; não é cirurgia realizada]' : '';
  return `  ${d.rotulo}${unidade}: ${valor}${aviso}`;
}

export function textoDoFunil(r) {
  const cab = [`Clínica: ${r.clinica ?? '?'}`, `Fonte: ${r.fonte}`];
  if (r.periodo) cab.push(`Período: ${dataBr(r.periodo.date_start)} a ${dataBr(r.periodo.date_end)} (${r.periodo.days} dias, fuso ${r.fuso})`);
  if (r.atualizado_em_texto) cab.push(`Consulta feita em: ${r.atualizado_em_texto} (copie este horário; não é a hora de cada registro)`);
  if (r.status !== 'pronto') return [...cab, `Status: ${r.status}`, r.motivo ?? ''].join('\n').trim();
  const linhas = [...cab, '', 'Funil do período (mesmos totais da Visão Geral):', ...CAMPOS.map(c=>linhaMetrica(c, r.metricas[c]))];
  if (r.anterior) linhas.push('', 'Período anterior, mesma duração:', ...CAMPOS.map(c=>linhaMetrica(c, r.anterior[c])));
  if (r.cobertura) linhas.push('', `Cobertura: trilha desde ${r.cobertura.trilha_desde ?? 'desconhecida'}, dados desde ${r.cobertura.dados_desde ?? 'desconhecida'}. ${r.cobertura.aviso}`);
  linhas.push('', 'Como ler:', ...r.interpretacao.map(t=>`- ${t}`));
  return linhas.join('\n');
}

// resultados: lista de retornos de funilDaClinica (com .clinica). Uma linha por clínica, total só das prontas.
export function textoDeTodas(resultados, pedido = {}) {
  const colunas = ['novos','agendadas','realizadas','indicacoes','cirurgias','perdidos'];
  const cab = 'clínica'.padEnd(34) + ['novos','agend','realiz','indic','fecham','perdid'].map(c=>c.padStart(8)).join('');
  const prontas = resultados.filter(r=>r.status === 'pronto' && r.metricas);
  const corpo = resultados.map(r=>{
    const nome = String(r.clinica ?? '?').trim().slice(0,33).padEnd(34);
    return r.status === 'pronto' && r.metricas
      ? nome + colunas.map(c=>String(r.metricas[c]).padStart(8)).join('')
      : nome + `sem dado (${r.status})`;
  });
  const total = 'TOTAL'.padEnd(34) + colunas.map(c=>String(prontas.reduce((t,r)=>t + r.metricas[c], 0)).padStart(8)).join('');
  const periodoTexto = pedido.preset === 'custom' ? `${dataBr(pedido.from)} a ${dataBr(pedido.to)}` : `últimos ${pedido.days ?? 30} dias`;
  const exemplo = prontas[0];
  return [
    `Funil das clínicas, ${periodoTexto}, pela ${FONTE}`,
    exemplo?.atualizado_em_texto ? `Consulta feita em: ${exemplo.atualizado_em_texto}` : '',
    '',
    cab, ...corpo, total,
    '',
    'Colunas: novos leads, agendadas e realizadas contam pessoas; indicações e fechamentos (chave legada "cirurgias", inclui exames) contam registros por procedimento; perdidos são registros classificados como perdidos.',
    'Clínicas sem dado não entram no total. O período é calculado no fuso de cada clínica, como na Visão Geral de cada uma.',
    ...INTERPRETACAO.map(t=>`- ${t}`),
  ].filter(l=>l !== null).join('\n');
}
