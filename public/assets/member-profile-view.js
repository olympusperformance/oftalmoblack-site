const states = {informado:'Informado', nao_informado:'Não informado', nao_aplicavel:'Não se aplica', a_confirmar:'A confirmar'};
const nature = {declarado:'Declarado', pesquisado:'Pesquisado', medido:'Medido'};
const units = {'BRL/mes':'R$/mês', 'consultas/mes':'consultas/mês', 'cirurgias/mes':'cirurgias/mês', 'lentes/mes':'lentes/mês'};
const number = n => new Intl.NumberFormat('pt-BR', {maximumFractionDigits:2}).format(n);
const day = v => /^\d{4}-\d{2}(-\d{2})?$/.test(v || '') ? v.split('-').reverse().join('/') : v;
export function formatSourceDate(source) {
  if (!source?.source_at || !Number.isFinite(Date.parse(source.source_at))) return 'Data não informada';
  return new Date(source.source_at).toLocaleDateString('pt-BR', {timeZone:source.source_precision === 'day' ? 'UTC' : 'America/Sao_Paulo'});
}
export function formatFieldValue(field, definition = {}) {
  if (field?.situacao === 'nao_aplicavel') return 'Não se aplica';
  const v = field?.valor;
  if (v === null || v === undefined) return states[field?.situacao] || 'Não informado';
  if (definition.kind === 'boolean') return v ? 'Sim' : 'Não';
  if (definition.kind === 'enum') return definition.choices?.[v] || String(v);
  if (definition.kind === 'date') return day(v);
  if (definition.kind === 'metric') {
    let out = v.tipo_valor === 'numero' ? number(v.numero) : v.tipo_valor === 'faixa' ? `${number(v.minimo)} a ${number(v.maximo)}` : v.texto_original;
    if (v.precisao === 'aproximada') out = 'Aproximadamente ' + out;
    if (v.unidade) out += ' ' + (units[v.unidade] || v.unidade);
    return out;
  }
  if (Array.isArray(v)) return v.length ? v.join(' · ') : 'Nenhum registrado';
  return String(v);
}
export function renderMemberProfile(target, profile, options = {}) {
  const doc = options.document || target.ownerDocument, catalog = profile.catalogo;
  const sourceMap = new Map(profile.fontes.map(s => [s.id, s]));
  const el = (tag, text, cls) => {const n=doc.createElement(tag); if(text != null)n.textContent=text;if(cls)n.className=cls;return n;};
  const reference = r => r?.inicio ? day(r.inicio) + (r.fim && r.fim !== r.inicio ? ' a ' + day(r.fim) : '') : 'Período não informado';
  function metadata(field) {
    const d=el('details', null, 'profile-evidence');d.append(el('summary','Fonte e referência'));
    const parts=[nature[field.natureza], field.data_referencia?.inicio && 'Referência: '+reference(field.data_referencia), field.updated_at && 'Atualizado em '+new Date(field.updated_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})+' (Brasília)'].filter(Boolean);
    if(parts.length)d.append(el('p',parts.join(' · '),'meta'));
    if(field.justificativa)d.append(el('p',field.justificativa));
    if(!field.fontes_refs?.length)d.append(el('p','Nenhuma fonte vinculada.','meta'));
    for(const id of field.fontes_refs || []) {
      const s=sourceMap.get(id);const p=el('p',s ? `${s.source_ref || s.source_type} · ${formatSourceDate(s)}` : 'Fonte não disponível: '+id,'meta');
      if(s && options.onSource && /^[\da-f-]{36}$/i.test(id)){const b=el('button','Ver registro original','profile-source-button');b.type='button';b.addEventListener('click',()=>options.onSource(s,p));p.append(b);}
      d.append(p);
    }
    return d;
  }
  function record(record, type) {
    const n=el('div',null,'profile-record');
    if(record.estado === 'a_confirmar')n.append(el('p','Vínculo a confirmar','profile-state'));
    for(const [key,def] of Object.entries(catalog.records[type].fields))n.append(field(record.campos[key],def));
    return n;
  }
  function field(value, def, path) {
    const n=el('div',null,'profile-field'); if(path)n.dataset.fieldPath=path;
    n.append(el('h3',def.label));
    if(value.situacao === 'a_confirmar')n.append(el('span','A confirmar','profile-state'));
    if(value.valor !== null && (def.kind === 'record' || def.kind === 'list')) {
      const records = def.kind === 'record' ? [value.valor] : value.valor;
      const current=records.filter(r=>!['historico','removido'].includes(r.estado)), historical=[...records.filter(r=>['historico','removido'].includes(r.estado)),...(value.historicos || []).filter(r=>r.campos)];
      if(!current.length)n.append(el('p',records.length ? 'Nenhum registro atual' : 'Nenhum registrado','profile-value'));
      current.forEach(r=>n.append(record(r,def.item_type)));
      if(historical.length){const h=el('details',null,'profile-history');h.append(el('summary','Histórico de vínculos ('+historical.length+')'));historical.forEach(r=>h.append(record(r,def.item_type)));n.append(h);}
    } else n.append(el('p',formatFieldValue(value,def),'profile-value'+(value.valor===null?' is-empty':'')));
    if(def.kind==='metric' && value.valor) {
      const v=value.valor;n.append(el('p',reference(v.periodo)+' · '+({geral_negocio:'Negócio em geral',vinculo:'Vínculo: '+v.vinculo_id,nao_definido:'Escopo não informado'}[v.escopo]||'Escopo não informado'),'meta'));
      if(v.texto_original)n.append(el('p','Relato original: '+v.texto_original,'meta'));
    }
    if(value.justificativa)n.append(el('p',value.justificativa,'profile-note'));
    if(value.fontes_refs?.length || value.updated_at)n.append(metadata(value));
    for(const [key,label] of [['alternativas','Informações divergentes'],['historicos','Valores anteriores']])if(value[key]?.some(x=>!x.campos)){const h=el('details',null,'profile-value-history');h.append(el('summary',label));for(const old of value[key].filter(x=>!x.campos)){h.append(el('p',formatFieldValue({...old,situacao:old.situacao || 'informado'},def)));if(old.fontes_refs)h.append(metadata(old));}n.append(h);}
    return n;
  }
  const nav=el('nav',null,'profile-sections-nav');nav.setAttribute('aria-label','Áreas do perfil');
  const fragment=[];
  for(const section of catalog.sections) {
    const entries=Object.entries(catalog.fields).filter(([,d])=>d.section===section.id);
    const filled=entries.filter(([key])=>profile.campos[key].situacao==='informado').length;
    const a=el('a',section.label);a.href='#perfil-'+section.id;nav.append(a);
    const s=el('details',null,'profile-section');s.id='perfil-'+section.id;s.dataset.profileSection=section.id;s.open=['identidade','resumo','equipe'].includes(section.id);
    const summary=el('summary');summary.append(el('span',section.label),el('small',filled+'/'+entries.length+' informados'));s.append(summary);
    const content=el('div',null,'profile-fields');for(const [key,def] of entries)content.append(field(profile.campos[key],def,key));s.append(content);fragment.push(s);
  }
  target.replaceChildren(nav,...fragment);
}
