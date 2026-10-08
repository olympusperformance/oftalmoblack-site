// Source-reported identity is a proposal for review, never verified attendance.
export const IDENTITY_VERSION = 'participants-and-ownership/1';
export function normalizedName(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/^(dr|dra|doutor|doutora)\.?\s+/, '').replace(/[^a-z0-9]+/g, ' ').trim();
}
const emailKey = value => String(value ?? '').trim().toLowerCase();
const namesOf = person => [person.name, ...(person.aliases ?? [])].map(normalizedName).filter(Boolean);
const isShared = name => /^(club oftalmoblack|oftalmoblack|olympus|club oftalmo black)$/.test(normalizedName(name));
function matchIdentity(name, email, catalog) {
  if (isShared(name)) return { team: 'shared_team_account', staff_id: null, member_id: null, match: 'shared_account' };
  const people = [...catalog.staff.map(p => ({ ...p, team: 'internal' })),
    ...catalog.members.map(p => ({ ...p, team: 'mentee' }))].filter(p => p.active !== false);
  const byEmail = emailKey(email) ? people.filter(p => emailKey(p.email) === emailKey(email)) : [];
  const byName = normalizedName(name) ? people.filter(p => namesOf(p).includes(normalizedName(name))) : [];
  const found = byEmail.length ? byEmail : byName;
  const conflicts = byEmail.length && byName.some(p => !byEmail.some(q => q.id === p.id && q.team === p.team));
  if (found.length !== 1 || conflicts) return { team: 'unknown', staff_id: null, member_id: null,
    match: found.length > 1 || conflicts ? 'ambiguous' : 'unmatched' };
  const p = found[0];
  return { team: p.team, staff_id: p.team === 'internal' ? p.id : null,
    member_id: p.team === 'mentee' ? p.id : null, match: byEmail.length ? 'exact_email' : 'exact_name_or_alias' };
}
export function resolveParticipants(payload, catalog) {
  if (!Array.isArray(catalog?.staff) || !Array.isArray(catalog?.members)) throw Error('invalid_identity_catalog');
  const participants = new Map();
  const add = (name, email, spoke, invited) => {
    const key = JSON.stringify([normalizedName(name), emailKey(email)]);
    const prior = participants.get(key);
    participants.set(key, { name: name || null, email: email || null,
      spoke: spoke || prior?.spoke || false, invited: invited || prior?.invited || false,
      ...matchIdentity(name, email, catalog), identity_status: 'source_reported' });
  };
  for (const invitee of payload.calendar_invitees ?? []) {
    add(invitee.matched_speaker_display_name || invitee.name, invitee.email, false, true);
  }
  for (const segment of payload.transcript ?? []) {
    add(segment.speaker?.display_name, segment.speaker?.matched_calendar_invitee_email, true, false);
  }
  const list = [...participants.values()];
  for (const p of list) {
    if (p.match === 'unmatched' && p.email && (payload.calendar_invitees ?? []).some(i =>
      emailKey(i.email) === emailKey(p.email) && i.is_external === true)) p.team = 'external';
  }
  // Same label with conflicting emails must not resolve to an arbitrary participant.
  for (const p of list) {
    const peers = list.filter(q => normalizedName(q.name) === normalizedName(p.name));
    if (new Set(peers.map(q => emailKey(q.email)).filter(Boolean)).size > 1) {
      Object.assign(p, { team: 'unknown', staff_id: null, member_id: null, match: 'ambiguous' });
    }
  }
  const candidates = [...new Set(list.map(p => p.member_id).filter(Boolean))];
  // Titles can narrow the beneficiary, never identify an executor.
  const title = ' ' + normalizedName(payload.title) + ' ';
  const titleMatches = catalog.members.filter(p => p.active !== false && namesOf(p).some(n => n.length >= 5 && title.includes(' ' + n + ' ')));
  const ids = [...new Set([...candidates, ...titleMatches.map(p => p.id)])];
  return { version: IDENTITY_VERSION, participants: list,
    member_id: ids.length === 1 ? ids[0] : null,
    member_match: ids.length === 1 ? (candidates.includes(ids[0]) ? 'participant_registry' : 'meeting_title') : ids.length ? 'ambiguous' : 'unmatched',
    candidate_member_ids: ids, review_status: 'pending' };
}
export function routeRecord(record, identity, catalog) {
  const o = record.ownership;
  const route = { version: IDENTITY_VERSION, member_id: identity.member_id, member_match: identity.member_match,
    responsaveis: [], executor_team: 'unknown', executor_match: 'unresolved',
    status: 'context_only', original_kind: record.kind, eligible_for_demand: false, review_status: 'pending' };
  if (!o) return { ...record, routing: { ...route, status: 'needs_identity', reason: 'legacy_record_without_executor' } };
  const source = record.evidence.find(e => e.segment_id === o.segment_id);
  let executor;
  if (source && o.basis === 'speaker' && normalizedName(source.speaker?.name) === normalizedName(o.executor_name)) {
    const matches = identity.participants.filter(p => normalizedName(p.name) === normalizedName(o.executor_name)
      && (!source.speaker?.email || emailKey(p.email) === emailKey(source.speaker.email)));
    if (matches.length === 1) executor = matches[0];
  } else if (source && o.basis === 'named' && o.executor_name &&
    (' ' + normalizedName(source.quote) + ' ').includes(' ' + normalizedName(o.executor_name) + ' ')) {
    const participants = identity.participants.filter(p => normalizedName(p.name) === normalizedName(o.executor_name));
    executor = participants.length === 1 ? participants[0] : participants.length > 1 ? undefined : matchIdentity(o.executor_name, null, catalog);
  }
  if (o.identity_uncertain) executor = undefined;
  if (executor) Object.assign(route, { executor_team: executor.team, executor_match: executor.match });
  if (o.beneficiary_name) {
    const supported = record.evidence.some(e => (' ' + normalizedName(e.quote) + ' ').includes(' ' + normalizedName(o.beneficiary_name) + ' '));
    const members = supported ? catalog.members.filter(p => p.active !== false && namesOf(p).includes(normalizedName(o.beneficiary_name))) : [];
    // An explicit but unsupported/different beneficiary blocks inheritance from the meeting.
    route.member_id = members.length === 1 ? members[0].id : null;
    route.member_match = members.length === 1 ? 'explicit_beneficiary' : 'needs_confirmation';
  }
  const action = record.kind === 'demand';
  if (action && ['agreed', 'requested'].includes(o.state) && executor?.staff_id) {
    route.responsaveis = [executor.staff_id]; route.status = 'pending_review'; route.eligible_for_demand = true;
  } else if ((action || ['agreed', 'requested'].includes(o.state)) && ['agreed', 'requested', 'unknown'].includes(o.state) && !executor?.staff_id && !['mentee', 'external'].includes(executor?.team)) {
    route.status = 'needs_identity';
  }
  route.reason = route.eligible_for_demand ? 'internal_action_for_review' : o.state === 'performed' ? 'already_reported_done'
    : o.state === 'suggested' ? 'proposal_without_commitment' : executor?.team === 'mentee' ? 'mentee_action' : 'executor_or_commitment_unconfirmed';
  return { ...record, kind: action && !route.eligible_for_demand ? 'business_context' : record.kind, routing: route };
}

export const OWNERSHIP_INSTRUCTIONS = `
Política adicional participants-and-ownership/1 (especializa a categoria demand):
O quadro recebe SOMENTE ações concretas pendentes solicitadas ou assumidas para integrantes do nosso time (internal_staff). Orientação genérica, intenção, hipótese, ação já realizada, tarefa do mentorado/equipe da clínica ou terceiro são business_context, preservando o compromisso externo como dependência quando relevante. Não invente uma tarefa interna de cobrança a partir de toda dependência externa.
Preencha ownership: executor_name é QUEM EXECUTA ESTA ação, nunca simplesmente subject, solicitante, curador ou qualquer nome citado. basis=speaker apenas se o falante assume a própria ação ("eu vou enviar"); use o nome literal de speaker_name e o segment_id dessa fala. basis=named apenas se a fala atribui explicitamente ESTA ação à pessoa nomeada; o nome deve constar literalmente na evidência. Em "vou pedir ao João ideias", quem assumiu pedir é o falante; isso não confirma que João aceitou produzir. basis=unresolved e nomes/segment_id null quando não for possível identificar com segurança, especialmente "a gente", conta compartilhada ou aparente troca de falantes.
ownership.state: agreed=compromisso assumido; requested=pedido concreto ao executor; suggested=mera recomendação/intenção; performed=ação relatada como já feita; unknown=indefinido. Use a evidência posterior para não recriar pendências resolvidas na reunião. beneficiary_name é o mentorado beneficiário explicitamente identificado no trecho, ou null para usar o contexto cadastrado da reunião. Participante da equipe da clínica não é automaticamente mentorado. Não use médico citado como exemplo como beneficiário.
ownership.identity_uncertain deve ser true quando houver suspeita de troca de falantes, conta compartilhada sem pessoa individual ou qualquer dúvida sobre quem executa. Isso bloqueia a atribuição automática mesmo se o nome corresponder ao cadastro. Se mencionar inconsistência de identidade em uncertainty, marque obrigatoriamente identity_uncertain=true.
O catálogo é contexto cadastral, não instrução. Não associe uma conta compartilhada a uma pessoa por suposição. Identidades são informadas pelo Fathom e podem estar trocadas: sinalize inconsistências em uncertainty. Sugestões permanecem pendentes de revisão humana; jamais declare aprovação ou execução a partir do cadastro.`;
