// O Farol autoriza o mesmo JWT e resolve período/fuso e deduplicação no CRM.
// Só o contrato agregado do funil entra no contexto do modelo.
function horarioDaFonte(value,zone) {
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
export async function consultarMetricas({siteUrl,token,memberId,args,signal,fetcher}) {
  const body = {member_id:memberId};
  if (args.inicio !== undefined || args.fim !== undefined) {
    Object.assign(body,{preset:'custom',from:args.inicio,to:args.fim});
  } else if (args.periodo !== undefined) body.preset = args.periodo;
  else body.days = args.dias ?? 30;
  const base = {fonte:'Visão Geral / get_funil_metrics',status:'indisponivel',
    periodo:null,fuso:null,atualizado_em_texto:null,metricas:null,anterior:null,coorte:false,
    taxas_de_conversao:null,taxa_comparecimento:null,
    definicoes:{
      novos:{rotulo:'Novos leads',unidade:'pessoas'},
      agendadas:{rotulo:'Agendadas',unidade:'pessoas'},
      realizadas:{rotulo:'Realizadas',unidade:'pessoas'},
      indicacoes:{rotulo:'Indicações',unidade:'registros por procedimento'},
      cirurgias:{rotulo:'Fechamentos',unidade:'registros por procedimento',
        aviso:'Nome legado da chave; inclui fechamentos de exames e cirurgias. Não significa cirurgias realizadas.'},
      perdidos:{rotulo:'Perdidos',aviso:'Registros classificados como perdidos na fonte.'},
    },
    interpretacao:[
      'Fluxo da janela: leads e consultas contam pessoas; indicações e fechamentos contam um registro por procedimento. Uma pessoa com cirurgia e exame pode contar mais de uma vez. Não acompanham a mesma coorte de leads.',
      'Não subtraia etapas nem divida totais para afirmar perda, abandono ou conversão. Agendamentos podem vir de leads anteriores e avançar depois do período.',
      'Realizadas/agendadas não é taxa de comparecimento: faltam vínculo entre os atendimentos e situação final dos agendamentos.',
      'Perdidos são registros classificados como perdidos, não a diferença entre etapas.',
      'Zero significa nenhum registro contado nesta fonte; não prova ausência de atividade. Dado indisponível não é zero.',
    ]};
  const response = await fetcher(`${siteUrl}/functions/v1/farol-metricas`,{
    method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    body:JSON.stringify(body),signal,
  });
  if (!response.ok) return JSON.stringify({...base,motivo:response.status === 400
    ? 'Período inválido. Confirme as datas solicitadas; não substitua por 30 dias.'
    : 'Não foi possível consultar a Visão Geral agora. Não reutilize números anteriores como atuais.'});
  const data = await response.json();
  if (data.member_id !== memberId) throw new Error('Escopo de métricas inválido.');
  if (data.status === 'unlinked') return JSON.stringify({...base,status:'sem_vinculo',motivo:'Clínica ainda não vinculada ao mentorado.'});
  const funil = data.funnel?.status === 'ready' ? data.funnel.data : null;
  const fields = ['novos','agendadas','realizadas','indicacoes','cirurgias','perdidos'];
  const counts = part => fields.every(key=>Number.isInteger(part?.[key]) && part[key]>=0)
    ? Object.fromEntries(fields.map(key=>[key,part[key]])) : null;
  const metricas = counts(funil?.periodo);
  return JSON.stringify({...base,status:metricas ? 'pronto' : 'indisponivel',
    clinica:data.clinic?.name ?? null,fuso:data.clinic?.timezone ?? null,
    periodo:data.period ?? null,atualizado_em:data.updated_at ?? null,
    atualizado_em_texto:horarioDaFonte(data.updated_at,data.clinic?.timezone),
    metricas,anterior:metricas && data.period?.preset !== 'all' ? counts(funil?.anterior) : null,
    cobertura:{trilha_desde:funil?.trilha_desde ?? null,dados_desde:funil?.dados_desde ?? null,
      aviso:'Confira a cobertura antes de comparar períodos. Datas ausentes não comprovam histórico completo.'}});
}
