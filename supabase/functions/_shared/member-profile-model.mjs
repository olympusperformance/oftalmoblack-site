import catalog from './member-profile-catalog.json' with {type:'json'};
export const CATALOG=catalog;
const statuses=['informado','nao_informado','nao_aplicavel','a_confirmar'];
const states=['atual','historico','removido','a_confirmar'];
const infoKeys=['valor','situacao','natureza','fontes_refs','data_referencia','justificativa','updated_at','updated_by','alternativas','historicos'];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const copy=v=>structuredClone(v);
export const blankField=()=>({valor:null,situacao:'nao_informado',natureza:null,fontes_refs:[],data_referencia:{inicio:null,fim:null,precisao:'desconhecida',natureza:null},justificativa:null,updated_at:null,updated_by:null,alternativas:[],historicos:[]});
function knownKeys(value,allowed){if(!object(value)||Object.keys(value).some(k=>!allowed.includes(k)))throw Error('Campo fora do catálogo');}
function text(value){if(typeof value!=='string'||value.length>12000)throw Error('Texto inválido');return value;}
function dateRef(input){
 const out={...blankField().data_referencia,...input};
 knownKeys(out,['inicio','fim','precisao','natureza']);
 if(!['dia','mes','intervalo','desconhecida'].includes(out.precisao))throw Error('Precisão inválida');
 for(const k of ['inicio','fim'])if(out[k]!==null&&(!/^\d{4}-\d{2}(-\d{2})?$/.test(out[k])||Number(out[k].slice(5,7))<1||Number(out[k].slice(5,7))>12||!Number.isFinite(Date.parse(out[k]))))throw Error('Referência inválida');
 for(const k of ['inicio','fim'])if(out[k]?.length===10&&new Date(out[k]+'T00:00:00Z').toISOString().slice(0,10)!==out[k])throw Error('Data fora do calendário');
 if(out.inicio&&out.fim&&out.fim<out.inicio)throw Error('Intervalo inválido');
 if(out.natureza!==null&&!['fato','documento'].includes(out.natureza))throw Error('Natureza temporal inválida');
 return out;
}
function metric(value,def){
 const keys=['tipo_valor','numero','minimo','maximo','texto_original','unidade','precisao','periodo','escopo','vinculo_id'];knownKeys(value,keys);
 const out={tipo_valor:'texto',numero:null,minimo:null,maximo:null,texto_original:null,unidade:def.unit||null,precisao:'nao_definida',periodo:null,escopo:'nao_definido',vinculo_id:null,...value};
 if(!['numero','faixa','texto'].includes(out.tipo_valor)||!['exata','aproximada','faixa','nao_definida'].includes(out.precisao)||!['geral_negocio','vinculo','nao_definido'].includes(out.escopo))throw Error('Indicador inválido');
 for(const k of ['numero','minimo','maximo'])if(out[k]!==null&&(typeof out[k]!=='number'||!Number.isFinite(out[k])))throw Error('Número inválido');
 if(out.tipo_valor==='numero'&&out.numero===null)throw Error('Número ausente');
 if(out.tipo_valor==='faixa'&&(out.minimo===null||out.maximo===null||out.minimo>out.maximo))throw Error('Faixa inválida');
 for(const k of ['texto_original','unidade','vinculo_id'])if(out[k]!==null)text(out[k]);
 if(out.tipo_valor==='texto'&&!out.texto_original)throw Error('Relato ausente');
 if(out.periodo!==null)out.periodo=dateRef(out.periodo);
 if(out.escopo==='vinculo'&&!out.vinculo_id)throw Error('Vínculo ausente');
 return out;
}
function record(value,type,parent){
 const def=CATALOG.records[type];if(!def)throw Error('Tipo de registro inválido');
 knownKeys(value,['id','estado','campos',...Object.keys(def.fields)]);
 if(typeof value.id!=='string'||!/^[\w-]{1,120}$/.test(value.id))throw Error('Registro precisa de ID estável');
 if(value.campos&&Object.keys(value).some(k=>Object.hasOwn(def.fields,k)))throw Error('Registro ambíguo');
 const fields=value.campos||Object.fromEntries(Object.entries(value).filter(([k])=>Object.hasOwn(def.fields,k)));
 knownKeys(fields,Object.keys(def.fields));
 const result={id:value.id,estado:value.estado||'atual',campos:{}};if(!states.includes(result.estado))throw Error('Estado inválido');
 for(const [key,fieldDef] of Object.entries(def.fields)){
  const raw=fields[key];result.campos[key]=raw===undefined||raw===null?blankField():normalizeField(fieldDef,object(raw)&&Object.hasOwn(raw,'valor')?raw:{...parent,valor:raw,situacao:'informado'});
 }
 return result;
}
function normalizeField(def,input){
 knownKeys(input,infoKeys);
 const out={...blankField(),...copy(input)};
 if(!Array.isArray(out.alternativas)||!Array.isArray(out.historicos)||out.alternativas.length||out.historicos.length)throw Error('Histórico e alternativas são derivados');
 if(!statuses.includes(out.situacao)||![null,'declarado','pesquisado','medido'].includes(out.natureza))throw Error('Situação inválida');
 if(!Array.isArray(out.fontes_refs)||out.fontes_refs.some(x=>typeof x!=='string')||out.fontes_refs.length>50)throw Error('Fontes inválidas');
 out.fontes_refs=[...new Set(out.fontes_refs)];out.data_referencia=dateRef(out.data_referencia);
 if(out.justificativa!==null)text(out.justificativa);
 if(out.situacao==='nao_aplicavel'&&!out.justificativa)throw Error('Não aplicável exige justificativa');
 if(out.situacao==='nao_informado'||out.situacao==='nao_aplicavel'){if(out.valor!==null)throw Error('Valor incompatível com situação');return out;}
 if(out.valor===null){if(out.situacao!=='a_confirmar')throw Error('Valor informado ausente');return out;}
 if(def.kind==='text')out.valor=text(out.valor);
 else if(def.kind==='date'){text(out.valor);dateRef({inicio:out.valor,precisao:out.valor.length===7?'mes':'dia'});}
 else if(def.kind==='boolean'){if(typeof out.valor!=='boolean')throw Error('Booleano inválido');}
 else if(def.kind==='enum'){if(!Object.hasOwn(def.choices,out.valor))throw Error('Opção inválida');}
 else if(def.kind==='text_list'){if(!Array.isArray(out.valor)||out.valor.length>200)throw Error('Lista inválida');out.valor=out.valor.map(text);}
 else if(def.kind==='metric')out.valor=metric(out.valor,def);
 else if(def.kind==='record')out.valor=record(out.valor,def.item_type,out);
 else if(def.kind==='list'){
  if(!Array.isArray(out.valor)||out.valor.length>200)throw Error('Lista inválida');
  out.valor=out.valor.map(v=>record(v,def.item_type,out));if(new Set(out.valor.map(x=>x.id)).size!==out.valor.length)throw Error('ID de registro duplicado');
 }else throw Error('Tipo desconhecido');
 return out;
}
export function normalizePatch(patch){
 knownKeys(patch,Object.keys(CATALOG.fields));if(Object.keys(patch).length>150)throw Error('Patch muito grande');
 const out={};for(const [key,value] of Object.entries(patch)){const def=CATALOG.fields[key];if(def.readonly||def.canonical)throw Error('Campo derivado ou canônico: use o cadastro');out[key]=normalizeField(def,value);}return out;
}
function fromRegistry(value){return value===null||value===undefined||value===''?blankField():{...blankField(),valor:value,situacao:'informado',natureza:'declarado',fontes_refs:['cadastro']};}
export function emptyProfile(member){
 if(!member?.id)throw Error('Mentorado inválido');
 const campos={};for(const [key,def] of Object.entries(CATALOG.fields)){campos[key]=blankField();if(def.canonical){let v=member[def.canonical];if(def.canonical==='ativo')v=v===true?'ativo':v===false?'inativo':null;campos[key]=fromRegistry(v);}}
 return {schema_version:CATALOG.schema_version,mentorado_id:member.id,nome:member.nome,revision:'0:0',revision_dados:0,catalogo:copy(CATALOG),campos,fontes:[{id:'cadastro',source_type:'cadastro_sistema',source_ref:'Cadastro do Cérebro',source_at:null,source_precision:'day',recorded_at:member.criado_em||null,version:'members'}],updated_at:null,perfil_completo:true};
}
const unsure=value=>typeof value==='string'&&/^(n[aã]o sei( informar| ainda)?|n[aã]o informado|n[aã]o tenho essa informa[cç][aã]o)$/iu.test(value.trim());
export function intakeToPatch(source){
 if(source.source_type!=='pre_diagnostico'||source.version!=='pre-diagnostico-v1')return {};
 const out={},a=source.data||{};
 const info=value=>({...blankField(),valor:value,situacao:'informado',natureza:'declarado',fontes_refs:[source.id]});
 const map={sdr:'equipe.papel_sdr',closer:'equipe.papel_closer',agenda:'atuacao.agenda_semanal',sistemas:'solucoes.contexto_declarado',trafego:'equipe.organizacao_trafego',social_media:'equipe.organizacao_social_media'};
 for(const [input,path] of Object.entries(map))if(typeof a[input]==='string'&&a[input].trim())out[path]=a[input]==='nao_sei'||unsure(a[input])?{...info(null),situacao:'nao_informado',justificativa:'O mentorado informou não saber.'}:info(a[input]);
 const metrics={consultas:'consultas_mensais',cirurgias_indicadas:'cirurgias_indicadas_mensais',cirurgias_realizadas:'cirurgias_realizadas_mensais'};
 for(const [input,code] of Object.entries(metrics))if(typeof a[input]==='string'&&a[input].trim()){
  const path='baseline.indicadores.'+code+'.atual',value=a[input].trim();
  out[path]=unsure(value)?{...info(null),situacao:'nao_informado',justificativa:'Resposta original: '+value}:info({tipo_valor:/^\d{1,8}$/.test(value)?'numero':'texto',numero:/^\d{1,8}$/.test(value)?Number(value):null,texto_original:value,unidade:CATALOG.fields[path].unit,escopo:'geral_negocio'});
 }
 if(typeof a.outras_pessoas==='string'&&a.outras_pessoas.trim()){
  const value=a.outras_pessoas.trim();out['equipe.outras_pessoas_jornada']=unsure(value)?{...info(null),situacao:'nao_informado',justificativa:'Resposta original: '+value}:info(/^(n[aã]o|nenhuma?)$/iu.test(value)?[]:[{id:'jornada-'+source.id,contexto:value}]);
 }
 return normalizePatch(out);
}
function walk(field,fn){fn(field);const v=field.valor;if(Array.isArray(v))for(const r of v)if(r?.campos)for(const f of Object.values(r.campos))walk(f,fn);if(object(v)&&v.campos)for(const f of Object.values(v.campos))walk(f,fn);}
function evidenceTime(field,sources){
 const ref=field.data_referencia;if(ref.inicio&&ref.natureza!=='documento')return Date.parse(ref.inicio)||0;
 return Math.max(0,...field.fontes_refs.map(id=>Date.parse(sources.get(id)?.source_at||'')||0));
}
function mergeCandidate(previous,next,sources,mode){
 if(mode==='corrigir'||previous.situacao==='nao_informado'&&!previous.fontes_refs.length)return next;
 const a=evidenceTime(previous,sources),b=evidenceTime(next,sources);if(b<a)return previous;if(b>a)return next;
 if(JSON.stringify(previous.valor)===JSON.stringify(next.valor)&&previous.situacao===next.situacao)return {...next,fontes_refs:[...new Set([...previous.fontes_refs,...next.fontes_refs])]};
 const alternatives=previous.alternativas.length?previous.alternativas:[{valor:previous.valor,fontes_refs:previous.fontes_refs,data_referencia:previous.data_referencia}];
 return {...next,valor:null,situacao:'a_confirmar',justificativa:'Fontes de mesma referência apresentam informações diferentes.',fontes_refs:[...new Set([...previous.fontes_refs,...next.fontes_refs])],alternativas:[...alternatives,{valor:next.valor,fontes_refs:next.fontes_refs,data_referencia:next.data_referencia}]};
}
export function buildProfile(member,patches=[],sources=[],connections=null){
 const out=emptyProfile(member),sourceMap=new Map();
 for(const s of sources){if(s.member_id&&s.member_id!==member.id)throw Error('Fonte de outro mentorado');sourceMap.set(s.id,s);out.fontes.push(Object.fromEntries(Object.entries(s).filter(([k])=>k!=='data'&&k!=='content_hash'&&k!=='intake_link_id')));}
 const forms=sources.filter(s=>s.source_type==='pre_diagnostico'&&s.version==='pre-diagnostico-v1').sort((a,b)=>a.recorded_at.localeCompare(b.recorded_at)||a.id.localeCompare(b.id));
 const events=[...patches.map(p=>({...p,patch:normalizePatch(p.patch)})),...forms.map(s=>({patch:intakeToPatch(s),revision:0,mode:'registrar',created_at:s.recorded_at,created_by:{tipo:'mentorado',id:member.id}}))].sort((a,b)=>a.created_at.localeCompare(b.created_at)||(a.revision||0)-(b.revision||0));
 for(const event of events){
  if(event.member_id&&event.member_id!==member.id)throw Error('Atualização de outro mentorado');
  for(const [path,raw] of Object.entries(event.patch)){
   const field=copy(raw);walk(field,f=>{
    if(f.situacao==='informado'&&!f.fontes_refs.length)throw Error('Informação precisa de fonte');
    for(const id of f.fontes_refs)if(!sourceMap.has(id))throw Error('Fonte ausente ou de outro mentorado');
    if(f.situacao!=='nao_informado'||f.fontes_refs.length){f.updated_at=event.created_at;f.updated_by=event.created_by;}
   });
   out.campos[path]=mergeCandidate(out.campos[path],field,sourceMap,event.mode);
  }
  if(!out.updated_at||event.created_at>out.updated_at)out.updated_at=event.created_at;
 }
 out.revision_dados=Math.max(0,...patches.map(p=>Number(p.revision)||0));out.revision=out.revision_dados+':'+(forms.at(-1)?.id||'0');
 const insta=String(member.instagram||'').replace(/^@/,'');
 if(insta){
  const raw={id:'cadastro-instagram',tipo:'instagram',nome:'Instagram principal',endereco:/^[a-z0-9._]{1,30}$/i.test(insta)?'https://www.instagram.com/'+insta+'/':String(member.instagram)};
  const base=out.campos['presenca.canais'];const recordValue=record(raw,'canal',fromRegistry(''));
  for(const f of Object.values(recordValue.campos))if(f.valor!==null){f.situacao='informado';f.natureza='declarado';f.fontes_refs=['cadastro'];}
  base.valor=[recordValue,...(base.valor||[]).filter(r=>r.id!=='cadastro-instagram')];base.situacao='informado';base.fontes_refs=[...new Set([...base.fontes_refs,'cadastro'])];
 }
 for(const [path,def] of Object.entries(CATALOG.fields))if(def.reference)out.campos[path]=copy(out.campos[def.reference]);
 if(connections&&typeof connections.instagram_contas==='number'){
  out.fontes.push({id:'integracoes',source_type:'configuracao',source_ref:'Vínculos de coleta no Cérebro',source_at:null,recorded_at:connections.checked_at||null,version:'connections'});
  out.campos['instagram.situacao_coleta']={...blankField(),valor:connections.instagram_contas>0?'vinculada_sem_dados':'nao_vinculada',situacao:'informado',natureza:'medido',fontes_refs:['integracoes']};
  if(connections.instagram_metricas>0)out.campos['instagram.situacao_coleta'].valor='com_dados';
 }else out.campos['instagram.situacao_coleta']={...blankField(),situacao:'a_confirmar',justificativa:'Vínculo de coleta ainda não verificado nesta leitura.'};
 const first=out.campos['instagram.primeira_leitura'],last=out.campos['instagram.ultima_leitura'];
 if(first.valor?.tipo_valor==='numero'&&last.valor?.tipo_valor==='numero'&&first.valor.precisao==='exata'&&last.valor.precisao==='exata'&&first.data_referencia.inicio&&last.data_referencia.inicio&&first.data_referencia.inicio<last.data_referencia.inicio&&first.valor.escopo===last.valor.escopo){
  out.campos['instagram.comparacao']={...copy(last),valor:String(last.valor.numero-first.valor.numero)+' seguidores no período',fontes_refs:[...new Set([...first.fontes_refs,...last.fontes_refs])]};
 }
 const confirmations=out.campos['confirmacoes.pontos'].valor||[];
 for(const point of confirmations){const key=point.campos.campo_ref.valor,state=point.campos.situacao.valor;if(key&&out.campos[key]&&!['resolvido','concluido'].includes(state)){out.campos[key].situacao='a_confirmar';out.campos[key].justificativa=point.campos.duvida.valor;}}
 for(const field of Object.values(out.campos))if(Array.isArray(field.valor)&&field.valor.some(r=>r?.campos)){
  field.historicos=field.valor.filter(r=>r.estado==='historico');field.valor=field.valor.filter(r=>r.estado!=='historico'&&r.estado!=='removido');
 }
 return out;
}
export function selectProfile(profile,sections){
 if(sections===undefined||sections===null)return profile;
 if(!Array.isArray(sections)||!sections.length||sections.length>14||sections.some(s=>!CATALOG.sections.some(x=>x.id===s)))throw Error('Seção inválida');
 const out=copy(profile);out.campos=Object.fromEntries(Object.entries(out.campos).filter(([key])=>sections.includes(CATALOG.fields[key].section)));out.catalogo.fields=Object.fromEntries(Object.entries(out.catalogo.fields).filter(([,v])=>sections.includes(v.section)));out.catalogo.sections=out.catalogo.sections.filter(s=>sections.includes(s.id));out.perfil_completo=sections.length===14;out.secoes_selecionadas=[...new Set(sections)];return out;
}
