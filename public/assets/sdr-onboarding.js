
'use strict';
import {sugestoes, usarSugestao, irParaCampo} from './sdr-sugestoes.js?v=3';
// Fatos de referência não são respostas até a clínica confirmá-los.
const sections=[
{id:'equipe',title:'Equipe e WhatsApp',description:'Quem responde e como a assistente trabalha com a equipe.',fields:[
['canal_principal','Qual número a assistente deve atender?','text','Informe número, DDD e canal usado pela equipe.',true],
['canais_adicionais','Há outros números ou canais que devem entrar?','textarea','Informe os números ou escreva “nenhum”.',true],
['equipe_papeis','Quem atende conversas novas, pacientes existentes e encaminhamentos?','textarea','Informe nomes e funções.',true],
['horario_equipe','Em quais dias e horários a equipe responde?','textarea','Inclua fins de semana e o fuso, com horários por dia.',true],
['horario_assistente','Em quais dias e horários a assistente deve atender?','textarea','Indique a janela por dia e se deve atender quando a equipe também estiver disponível.',true],
['posse_conversa','Quando uma pessoa assumir, como a assistente deve parar e quando pode retomar?','textarea','Descreva também o que acontece fora do horário humano.',true],
['mensagem_automatica','Há saudação ou mensagem de ausência automática no WhatsApp?','textarea','Copie o texto e diga quando aparece, ou informe “não há”.',true],
['pacientes_existentes','Ela atenderá apenas novos contatos ou também pacientes existentes?','textarea','Explique como separar esses casos e quem assume os já acompanhados.',true]
]},
{id:'servicos',title:'Consultas e locais',description:'O que a assistente poderá apresentar e como a equipe confirma cada consulta.',fields:[
['unidades','Quais locais e endereços a assistente pode informar?','textarea','Informe nome e endereço dos locais, sem presumir que sejam próprios.',true],
['servicos_consulta','Quais tipos de consulta a assistente pode oferecer em cada unidade?','textarea','Informe valores, duração e o que inclui por modalidade e local.',true],
['agenda_grade','Quais dias e horários reais estão disponíveis por local e tipo de consulta?','textarea','Informe frequência, intervalos, duração, exceções e antecedência mínima. Não precisamos dos dados de pacientes.',true],
['agenda_confirmacao','Quem confirma, remarca e cancela os agendamentos?','textarea','Diga se a assistente poderá confirmar sozinha ou se a equipe deverá confirmar.',true],
['teleconsulta','A assistente deve oferecer teleconsulta? Como funciona?','textarea','Se sim, indique público, valor, duração, agenda, plataforma e responsável pelo link. Se não, informe “não”.',true],
['preco_cirurgia','Que informações de preço de procedimentos podem ser ditas?','textarea','Por procedimento, valor ou faixa, por olho ou ambos, condições e quando encaminhar. Os valores informados ao Black não são autorização automática de divulgação.',true],
['outros_servicos','Quais outros serviços entram no atendimento e quais ficam com a equipe?','textarea','Inclua exames, retorno, crianças e pedidos fora da especialidade, se aplicável.',true]
]},
{id:'convenios',title:'Convênios e condições',description:'Regras para que ninguém receba uma promessa de atendimento indevida.',fields:[
['convenios','Quais planos e modalidades estão disponíveis em cada unidade?','textarea','Informe unidade, modalidade e restrições atuais.',true],
['plano_suspenso','Como tratar convênios temporariamente suspensos?','textarea','Se houver suspensão, descreva aviso, retomada e alternativa particular. Se não houver, informe “nenhum”.',true],
['plano_nao_coberto','O que fazer quando o plano não é atendido ou a cobertura é incerta?','textarea','Descreva se cabe oferecer particular, consultar a equipe e quem confirma cobertura.',true],
['pagamento_consulta','Quais pagamentos e condições podem ser informados?','textarea','Inclua formas aceitas, parcelamento, retorno e descontos ou diga que a equipe informa.',true],
['sinal','Há sinal para reservar?','textarea','Se houver, indique valor, condições, devolução, responsável e como agir se a pessoa quiser pagar na clínica. Se não houver, informe “sem sinal”. Não informe chave ou dados bancários.',true]
]},
{id:'assistente',title:'Identidade e conhecimento',description:'O jeito de falar e as informações que vocês autorizam.',fields:[
['nome_assistente','Qual nome e apresentação a assistente deve usar?','text','Informe o nome e como deve se apresentar aos pacientes.',true],
['tom','Como a assistente deve conversar?','textarea','Descreva o tom, frases desejadas e palavras ou promessas proibidas.',true],
['informacoes_aprovadas','Quais informações sobre o médico e a clínica podem ser usadas?','textarea','Inclua formação, diferenciais, números e afirmações autorizadas. Não inclua informações que precisem de confirmação clínica.',true],
['perguntas_frequentes','Quais perguntas são frequentes e quais respostas vocês aprovam?','textarea','Uma pergunta e resposta por linha, ou indique um documento que a equipe possa fornecer.',true],
['limites_humano','Quais situações exigem atendimento humano imediato?','textarea','Inclua pedido de pessoa, urgência, dúvidas clínicas, pós-operatório, reclamação e outras regras da clínica.',true]
]},
{id:'retorno',title:'Acompanhamento e testes',description:'Como acompanhar interessados e experimentar a assistente com a equipe.',fields:[
['followup_regras','Como desejam acompanhar quem ainda não agendou?','textarea','Quem acompanha, quando retoma, quais horários são adequados e quando não deve voltar a chamar.',true],
['followup_atual','Existem lembretes ou mensagens automáticas já ativos?','textarea','Informe onde funcionam, quem controla e em quais situações são enviados, ou “nenhum”.',true],
['origens','De onde chegam os contatos que a assistente deve atender?','textarea','Ex.: página de agendamento, anúncio, Instagram ou indicação. Diga se alguma origem deve ficar fora.',true],
['testadores','Quem vai testar e quem aprova a assistente?','textarea','Informe nome e função. O número de teste será combinado em canal seguro.',true],
['cenarios','Quais situações vocês querem testar antes de decidir a ativação?','textarea','Ex.: agendamento particular, convênio suspenso, preço e encaminhamento humano.',true],
['observacoes','Há alguma outra regra importante para o atendimento?','textarea','Informe algo que a assistente precisa saber ou escreva “nenhuma”.',true]
]}];
const exemplos={
posse_conversa:'Exemplo: quando a secretária assumir, a assistente pausa; só volta quando a equipe liberar.',
mensagem_automatica:'Exemplo: há uma mensagem de ausência fora do expediente. Ela será desligada antes do teste.',
pacientes_existentes:'Exemplo: atender novos contatos; pacientes em acompanhamento vão para a equipe.',
unidades:'Exemplo: unidade Centro, Rua Exemplo, 100, sala 2. Inclua endereço completo e referência.',
servicos_consulta:'Exemplo: consulta particular, R$ 300, 40 minutos, na unidade Centro. Valores fictícios.',
agenda_grade:'Exemplo: terça e quinta, das 9h às 12h, consultas de 40 minutos. Horários fictícios.',
agenda_confirmacao:'Exemplo: a assistente propõe horários; a equipe confirma, remarca e cancela.',
nome_assistente:'Exemplo: Júlia, assistente da equipe do médico.',
tom:'Exemplo: acolhedora, objetiva e sem prometer resultados.',
informacoes_aprovadas:'Exemplo: nome, CRM, especialidade e formação confirmados. Informe apenas fatos do seu médico.',
perguntas_frequentes:'Exemplo: “Como funciona a consulta?” e a resposta aprovada pela equipe.',
limites_humano:'Exemplo: pedido de pessoa, reclamação, urgência ou dúvida clínica.',
followup_regras:'Exemplo: retomar conforme combinado, durante o horário autorizado, sem insistir se a pessoa pedir para parar.',
followup_atual:'Exemplo: o sistema envia um lembrete de consulta um dia antes; a recepção acompanha. Descreva apenas o que já existe.',
origens:'Exemplo: contatos vindos do Instagram, da página de agendamento e de indicações.',
testadores:'Exemplo: Ana, secretária, testa o agendamento; o médico revisa e aprova.',
cenarios:'Exemplo: consulta particular, convênio suspenso, áudio recebido e pedido de atendimento humano.',
observacoes:'Exemplo: a equipe quer revisar a assistente antes de atender pacientes. Se não houver, escreva “nenhuma”.',
};
const $=s=>document.querySelector(s), el=(tag,txt)=>{const x=document.createElement(tag);if(txt!==undefined)x.textContent=txt;return x};let edited=false,reviewed=false;
for(const s of sections){const sec=el('section');sec.id='sec-'+s.id;sec.append(el('h2',s.title));const desc=el('p',s.description);desc.className='intro';sec.append(desc);if(s.id==='assistente'){const p=el('p','Padrão de atendimento: a assistente deve compreender áudios e responder em texto. Áudios, imagens e documentos fazem parte da preparação e serão configurados e testados antes da ativação.');p.className='notice';sec.append(p)}const grid=el('div');grid.className='group';for(const [id,title,type,hint,required] of s.fields){const wrap=el('div');wrap.className='field'+(type==='textarea'?' wide':'');const label=el('label',title+(required?' *':''));label.htmlFor=id;const note=el('span',hint);note.className=hint.startsWith('Referência')||hint.startsWith('Em 27')||hint.startsWith('O senhor')||hint.startsWith('Felipe')?'reference':'hint';note.id='hint-'+id;const input=el(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;input.name=id;input.id=id;input.required=required;input.maxLength=3000;input.setAttribute('aria-describedby',note.id);wrap.append(label,note,input);if(exemplos[id]){const example=el('span',exemplos[id]);example.className='example';wrap.append(example)}if(sugestoes[id]){const b=el('button','Usar padrão da Íris');b.type='button';b.className='preset';b.onclick=()=>{const value=usarSugestao(id,input.value);if(value===input.value){$('#status').textContent='Sua resposta foi preservada. Para usar o padrão, limpe o campo primeiro.';return}input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));$('#status').textContent='Padrão inserido. Revise e adapte antes de salvar.';input.focus()};wrap.append(b)}grid.append(wrap)}sec.append(grid);$('#sections').append(sec);const a=el('a',s.title);a.href='#sec-'+s.id;a.onclick=e=>irParaCampo(e,sec);$('#nav').append(a)}
const fields=sections.flatMap(s=>s.fields);function values(){return Object.fromEntries(fields.map(([id])=>[id,document.getElementById(id).value.trim()]))}function pending(v){return fields.filter(([id,,,,req])=>req&&(!v[id]||/^(a definir|não sei|nao sei|pendente)$/i.test(v[id])))}function showProgress(){const v=values();$('#progress').textContent=(fields.length-pending(v).length)+' de '+fields.length+' pontos respondidos';}
$('#form').addEventListener('input',event=>{edited=true;if(event.target.id==='responsavel')return;reviewed=false;$('#review').textContent='As respostas mudaram. Confira novamente antes de entregar.';showProgress()});
let pendingId=null,pendingBody=null,legacyAudio='';const token=new URLSearchParams(location.hash.slice(1)).get('t')||'';
async function api(body){const c=window.CLUB_CONFIG;const response=await fetch(c.supabaseUrl+'/functions/v1/sdr-onboarding',{method:'POST',headers:{'content-type':'application/json',apikey:c.supabaseAnonKey},body:JSON.stringify({...body,token})});const data=await response.json();if(!response.ok)throw Error(data.error||'Não foi possível salvar agora.');return data}
function currentAnswers(){const answers=values();if(legacyAudio)answers.audio_imagem=legacyAudio;answers.responsavel=$('#responsavel').value.trim();for(const k of Object.keys(answers))if(!answers[k])delete answers[k];return answers}
async function save(){const answers=currentAnswers();if(!Object.keys(answers).length){$('#status').textContent='Responda pelo menos um ponto para salvar.';return}const body=JSON.stringify(answers);if(body!==pendingBody){pendingId=crypto.randomUUID();pendingBody=body}const button=$('#save');button.disabled=true;try{await api({action:'submit',version:'sdr-onboarding-v1',submission_id:pendingId,answers});const changed=JSON.stringify(currentAnswers())!==body;edited=changed;pendingId=null;pendingBody=null;$('#status').textContent=changed?'Respostas anteriores salvas. Há alterações novas para salvar.':'Respostas salvas no Cérebro. Você pode continuar depois.'}catch(e){$('#status').textContent=e.message+' As respostas continuam na tela.'}finally{button.disabled=false}}
$('#save').onclick=save;
$('#check').onclick=()=>{const m=pending(values()),box=$('#review');box.replaceChildren();if(m.length){box.append(el('strong','Faltam '+m.length+' pontos para concluir.'));const list=el('ul');for(const [id,title] of m){const li=el('li'),a=el('a',title);a.href='#'+id;a.onclick=e=>irParaCampo(e,document.getElementById(id));li.append(a);list.append(li)}box.append(list)}else{box.append(el('strong','Todos os pontos foram respondidos.'),el('p','Informe quem revisou e clique em Salvar respostas.'))}$('#revisao').scrollIntoView({behavior:'smooth'})};
window.addEventListener('beforeunload',e=>{if(edited){e.preventDefault();e.returnValue=''}});$('#form').addEventListener('submit',e=>e.preventDefault());
try{if(!/^[a-f0-9]{64}$/.test(token))throw Error('Abra o link individual enviado pela equipe.');const d=await api({action:'load'});if(d.version!=='sdr-onboarding-v1')throw Error('Versão de formulário incompatível.');legacyAudio=typeof d.answers.audio_imagem==='string'?d.answers.audio_imagem:'';for(const [id] of fields)document.getElementById(id).value=typeof d.answers[id]==='string'?d.answers[id]:'';$('#responsavel').value=d.answers.responsavel||'';for(const [key,value] of Object.entries(d.references||{})){if(typeof value!=='string')continue;const p=el('p',value);p.className='hint';$('#reference-list').append(p)}if($('#reference-list').children.length)$('#references').hidden=false;document.querySelector('.hero p').textContent=d.nome+', conte como sua equipe atende hoje. As respostas ajudam a preparar sua assistente.';$('#form').hidden=false;$('#save').disabled=false;$('#check').disabled=false;showProgress()}catch(e){$('#status').textContent=e.message;$('#form').hidden=true;$('#save').disabled=true;$('#check').disabled=true}
