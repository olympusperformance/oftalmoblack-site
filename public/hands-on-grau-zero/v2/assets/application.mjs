import {QUESTIONS,UFS,createState,transition,reviewRows,formatWhatsAppForDisplay} from './model.mjs';

const landing=document.getElementById('landing');
const research=document.getElementById('application-screen');
const completion=document.getElementById('review-screen');
const interestForm=document.getElementById('interest-form');
const questionForm=document.getElementById('question-form');
const fields=document.getElementById('question-fields');
const title=document.getElementById('question-title');
const description=document.getElementById('question-description');
const error=document.getElementById('question-error');
let state=createState();

const element=(tag,attributes={},text='')=>{
  const item=document.createElement(tag);
  for(const [key,value]of Object.entries(attributes))item.setAttribute(key,String(value));
  if(text)item.textContent=text;
  return item;
};
function setFieldError(input,message) {
  if(message) input.setAttribute('aria-invalid','true');
  else input.removeAttribute('aria-invalid');
}
function markIdentityErrors() {
  for(const key of ['nome','whatsapp']) {
    const input=interestForm.elements[key],message=document.getElementById(`${key}-error`);
    setFieldError(input,state.errors[key]);message.textContent=state.errors[key]||'';message.hidden=!state.errors[key];
  }
}
function textField(key,label,options={}) {
  const wrapper=element('div',{class:'field'});
  const input=element('input',{id:key,name:key,type:options.type||'text',...options});
  input.value=state.answers[key]??'';
  input.addEventListener('input',()=>{
    state=transition(state,{type:'answer',key,value:input.value});
    input.removeAttribute('aria-invalid');error.hidden=true;
  });
  wrapper.append(element('label',{for:key},label),input);return wrapper;
}
function renderQuestion(focus=true) {
  const question=QUESTIONS[state.step];
  title.textContent=question.title;description.textContent=question.description;
  document.getElementById('question-step').textContent=`Pergunta ${state.step+1} de ${QUESTIONS.length}`;
  const progress=document.getElementById('application-progress');progress.value=state.step+1;
  progress.setAttribute('aria-valuetext',`${state.step+1} de ${QUESTIONS.length}`);
  fields.replaceChildren();
  if(question.type==='professional') {
    const row=element('div',{class:'professional-row'});
    row.append(textField('crm','CRM',{inputmode:'numeric',maxlength:10,autocomplete:'off'}));
    const wrapper=element('div',{class:'field'}),select=element('select',{id:'uf',name:'uf'});
    select.append(element('option',{value:''},'Selecione'));
    for(const uf of UFS)select.append(element('option',{value:uf},uf));
    select.value=state.answers.uf||'';
    select.addEventListener('change',()=>{state=transition(state,{type:'answer',key:'uf',value:select.value});select.removeAttribute('aria-invalid');error.hidden=true;});
    wrapper.append(element('label',{for:'uf'},'UF do CRM'),select);row.append(wrapper);fields.append(row);
  } else if(question.type==='choice') {
    const group=element('fieldset',{class:'options','aria-labelledby':'question-title','aria-describedby':'question-description question-error'});
    for(const [value,label] of question.options) {
      const option=element('label',{class:'option'});
      const radio=element('input',{type:'radio',name:question.key,value});radio.checked=state.answers[question.key]===value;
      radio.addEventListener('change',()=>{state=transition(state,{type:'answer',key:question.key,value});error.hidden=true;});
      option.append(radio,element('span',{},label));group.append(option);
    }
    fields.append(group);
  } else if(question.type==='number') {
    fields.append(textField(question.key,'Média mensal',{type:'number',inputmode:'numeric',min:0,max:10000,step:1,placeholder:'0'}));
    fields.append(element('p',{class:'field-help'},'Ainda não opera? Zero é uma resposta válida.'));
  } else {
    const wrapper=element('div',{class:'field'}),textarea=element('textarea',{id:'objetivo',name:'objetivo',rows:5,maxlength:2000,placeholder:'Conte o que gostaria de levar para sua prática.'});
    textarea.value=state.answers.objetivo||'';
    textarea.addEventListener('input',()=>{state=transition(state,{type:'answer',key:'objetivo',value:textarea.value});error.hidden=true;document.getElementById('objective-count').textContent=`${textarea.value.length}/2000`;});
    wrapper.append(element('label',{for:'objetivo'},'Seu objetivo (opcional)'),textarea,element('span',{id:'objective-count',class:'field-help'},`${textarea.value.length}/2000`));fields.append(wrapper);
  }
  document.getElementById('question-next').textContent=state.step===QUESTIONS.length-1?'Concluir prévia':'Continuar';
  document.getElementById('question-back').textContent=state.step===0?'Voltar aos meus dados':'Voltar';
  error.textContent=Object.values(state.errors).join(' ');error.hidden=!error.textContent;
  for(const [key,message]of Object.entries(state.errors)) {const input=fields.querySelector(`[name="${key}"]`);if(input){setFieldError(input,message);input.setAttribute('aria-describedby','question-error');}}
  if(focus) {title.focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
}
function render(focus=true) {
  landing.hidden=state.screen!=='landing';research.hidden=state.screen!=='questions';completion.hidden=state.screen!=='review';
  document.body.dataset.screen=state.screen;
  document.getElementById('topnote').textContent=state.screen==='landing'?'Exclusivo para oftalmologistas':'Sua aplicação ao Hands-on';
  if(state.screen==='questions')renderQuestion(focus);
  if(state.screen==='review') {
    const list=document.getElementById('review-list');list.replaceChildren();
    for(const [label,value]of reviewRows(state)) {const row=element('div',{class:'review-row'});row.append(element('dt',{},label),element('dd',{},value));list.append(row);}
    if(focus){document.getElementById('review-title').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
  }
  if(state.screen==='landing') {
    if(!state.identity.nome && !Object.keys(state.answers).length){fields.replaceChildren();document.getElementById('review-list').replaceChildren();}
    interestForm.elements.nome.value=state.identity.nome;interestForm.elements.whatsapp.value=formatWhatsAppForDisplay(state.identity.whatsapp);markIdentityErrors();
    if(focus){interestForm.elements.nome.focus({preventScroll:true});document.getElementById('interesse').scrollIntoView({behavior:'instant',block:'center'});}
  }
}
interestForm.addEventListener('submit',event=>{
  event.preventDefault();
  state=transition(state,{type:'begin',identity:{nome:interestForm.elements.nome.value,whatsapp:interestForm.elements.whatsapp.value}});
  markIdentityErrors();
  if(Object.keys(state.errors).length){interestForm.querySelector('[aria-invalid="true"]')?.focus();return;}
  render();
});
for(const key of ['nome','whatsapp'])interestForm.elements[key].addEventListener('input',()=>{
  const input=interestForm.elements[key];input.removeAttribute('aria-invalid');document.getElementById(`${key}-error`).hidden=true;
});
questionForm.addEventListener('submit',event=>{
  event.preventDefault();state=transition(state,{type:'next'});
  if(Object.keys(state.errors).length){renderQuestion(false);fields.querySelector('[aria-invalid="true"]')?.focus();if(!fields.querySelector('[aria-invalid="true"]'))error.focus();return;}
  render();
});
document.getElementById('question-back').addEventListener('click',()=>{state=transition(state,{type:'back'});render();});
document.getElementById('edit-identity').addEventListener('click',()=>{state=transition(state,{type:'edit-identity'});render();});
document.getElementById('review-answers').addEventListener('click',()=>{state=transition(state,{type:'review'});render();});
document.getElementById('restart-preview').addEventListener('click',()=>{state=transition(state,{type:'restart'});render();});
document.getElementById('brand-home').addEventListener('click',event=>{event.preventDefault();if(state.screen!=='landing'){state=transition(state,{type:'edit-identity'});render();}else window.scrollTo({top:0,behavior:'smooth'});});
document.getElementById('interest-next').disabled=false;
render(false);
