export const UFS = 'AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' ');

export const QUESTIONS = [
  {key:'professional',type:'professional',title:'Qual é o seu CRM?',description:'Informe seu registro e o estado em que foi emitido.'},
  {key:'experiencia_catarata',type:'choice',title:'Como é sua experiência com cirurgia de catarata?',description:'Escolha a opção que melhor representa seu momento.',options:[['ainda_nao_opero','Ainda não opero'],['iniciando_supervisao','Estou começando e preciso de supervisão frequente'],['opero_autonomia','Já opero com autonomia']]},
  {key:'cirurgias_mes',type:'number',title:'Quantas cirurgias de catarata você faz por mês?',description:'Uma média é suficiente. Se ainda não opera, pode responder zero.'},
  {key:'experiencia_lentes',type:'choice',title:'Qual é sua experiência com lentes de alta tecnologia?',description:'Considere sua experiência até hoje.',options:[['ainda_nao_implanto','Ainda não implanto'],['poucos_casos','Já implantei em poucos casos'],['regularmente','Implanto regularmente']]},
  {key:'oferta_premium',type:'choice',title:'Você já oferece lentes de alta tecnologia aos pacientes?',description:'Queremos conhecer o contexto da sua prática.',options:[['nao','Não'],['alguns_casos','Em alguns casos'],['rotina','Faz parte da minha rotina']]},
  {key:'clinica',type:'choice',title:'Você tem clínica ou consultório próprio?',description:'Não é necessário ter clínica própria para participar.',options:[['proprietario','Sim, sou proprietário'],['socio','Sim, sou sócio'],['nao','Não']]},
  {key:'objetivo',type:'text',title:'O que você deseja aprender no Hands-on?',description:'Esta resposta é opcional. Conte seu objetivo sem incluir dados de pacientes.'},
];

const clean = value => typeof value === 'string' ? value.trim() : '';
export function formatWhatsAppForDisplay(value = '') {
  const literal=clean(value),digits=literal.replace(/\D/g,'');
  if (!/^\+?[\d\s().-]+$/.test(literal) || (literal.startsWith('+') && !digits.startsWith('55'))) return literal;
  const country=digits.startsWith('55') && [12,13].includes(digits.length);
  const national=country?digits.slice(2):digits;
  const match=national.match(/^((?:1[1-9]|2[12478]|3[1234578]|4[1-9]|5[1345]|6[1-9]|7[134579]|8[1-9]|9[1-9]))([2-5]\d{3}|9\d{4})(\d{4})$/);
  return match?`${country?'+55 ':''}(${match[1]}) ${match[2]}-${match[3]}`:literal;
}
export function validateIdentity(identity = {}) {
  const errors = {};
  const name = clean(identity.nome), phone = clean(identity.whatsapp);
  if (name.length < 2 || name.length > 140) errors.nome = 'Informe seu nome completo.';
  if (!/^\+?[\d\s().-]+$/.test(phone) || !/^\d{10,15}$/.test(phone.replace(/\D/g,''))) errors.whatsapp = 'Informe um WhatsApp válido, com DDD.';
  return errors;
}
export function validateAnswer(step, answers = {}) {
  const question = QUESTIONS[step], errors = {};
  if (!question) return errors;
  if (question.type === 'professional') {
    if (!/^\d{1,10}$/.test(clean(answers.crm))) errors.crm = 'Informe o número do seu CRM, sem letras.';
    if (!UFS.includes(answers.uf)) errors.uf = 'Selecione a UF do seu CRM.';
  } else if (question.type === 'choice') {
    if (!question.options.some(([key]) => key === answers[question.key])) errors[question.key] = 'Selecione uma opção para continuar.';
  } else if (question.type === 'number') {
    const value = String(answers[question.key] ?? '').trim();
    if (!/^\d+$/.test(value) || Number(value) > 10000) errors[question.key] = 'Informe um número inteiro entre 0 e 10000.';
  } else if (clean(answers[question.key]).length > 2000) {
    errors[question.key] = 'Use até 2000 caracteres para contar seu objetivo.';
  }
  return errors;
}
export function createState() {
  return {screen:'landing',identity:{nome:'',whatsapp:''},answers:{},step:0,errors:{}};
}
export function transition(previous, event) {
  const state = {...previous, identity:{...previous.identity}, answers:{...previous.answers}, errors:{}};
  switch (event.type) {
    case 'begin': {
      const identity = {nome:clean(event.identity?.nome),whatsapp:clean(event.identity?.whatsapp)};
      state.identity = identity;
      state.errors = validateIdentity(identity);
      if (!Object.keys(state.errors).length) {
        state.identity.whatsapp = identity.whatsapp.replace(/\D/g,'');
        state.screen='questions';state.step=0;
      }
      break;
    }
    case 'answer':
      if (['crm','uf',...QUESTIONS.map(question=>question.key)].includes(event.key)) state.answers[event.key]=event.value;
      break;
    case 'next':
      if (state.screen !== 'questions') break;
      state.errors=validateAnswer(state.step,state.answers);
      if (!Object.keys(state.errors).length) {
        if (state.step === QUESTIONS.length-1) state.screen='review';
        else state.step++;
      }
      break;
    case 'back':
      if (state.step > 0) {state.step--;state.screen='questions';}
      else state.screen='landing';
      break;
    case 'edit-identity': state.screen='landing';break;
    case 'review': state.screen='questions';state.step=0;break;
    case 'edit-question':
      if (Number.isInteger(event.step) && event.step>=0 && event.step<QUESTIONS.length) {state.step=event.step;state.screen='questions';}
      break;
    case 'restart': return createState();
  }
  return state;
}
export function reviewRows(state) {
  const rows=[['Nome completo',state.identity.nome],['WhatsApp',formatWhatsAppForDisplay(state.identity.whatsapp)]];
  for (const question of QUESTIONS) {
    let value=state.answers[question.key];
    if (question.type==='professional') value=`${state.answers.crm || ''} · ${state.answers.uf || ''}`;
    else if (question.type==='choice') value=question.options.find(([key])=>key===value)?.[1] || '';
    else if (question.type==='text') value=clean(value)||'Não informado';
    rows.push([question.title,String(value ?? '')]);
  }
  return rows;
}
