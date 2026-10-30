import {test} from 'node:test';
import assert from 'node:assert/strict';
const M=await import('../supabase/functions/_shared/member-profile-model.mjs').catch(()=>({}));
const use=n=>{assert.equal(typeof M[n],'function',n+' deve existir');return M[n];};
const member={id:'00000000-0000-4000-8000-000000000001',nome:'Pessoa A',email:'a@example.invalid',ativo:true,instagram:'@teste'};
const s1={id:'10000000-0000-4000-8000-000000000001',member_id:member.id,source_type:'cadastro',source_at:'2026-10-20T00:00:00Z',recorded_at:'2026-10-27T00:00:00Z',source_precision:'day',data:{}};
const s2={...s1,id:'10000000-0000-4000-8000-000000000002',source_at:'2026-10-25T00:00:00Z'};
const info=(valor,src=s1.id)=>({valor,situacao:'informado',natureza:'declarado',fontes_refs:[src]});
const patch=(patch,revision=1)=>({patch,revision,created_at:'2026-10-27T00:00:00Z',created_by:{tipo:'agente',id:'fixture'},mode:'registrar'});
test('todos têm os mesmos campos e14seções, mesmo sem fatos ou mensagens',()=>{
 const make=use('emptyProfile');const a=make(member),b=make({...member,id:'00000000-0000-4000-8000-000000000002'});
 assert.equal(a.catalogo.sections.length,14);assert.ok(Object.keys(a.campos).length>80);assert.deepEqual(Object.keys(a.campos),Object.keys(b.campos));
 assert.equal(a.campos['equipe.papel_sdr'].valor,null);assert.equal(a.campos['equipe.papel_sdr'].situacao,'nao_informado');assert.equal(a.campos['identidade.nome_completo'].valor,'Pessoa A');
});
test('não cria campos de uma fonte ou de um registro particular',()=>{
 const normalize=use('normalizePatch');assert.throws(()=>normalize({'equipe.nome_da_pessoa':info('x')}));
 assert.throws(()=>normalize({'equipe.pessoas_parceiros':info([{id:'p1',nome:'Teste',campo_particular:'x'}])}));
});
test('listas usam os mesmos campos internos, inclusive valores não conhecidos',()=>{
 const p=use('buildProfile')(member,[patch({'equipe.pessoas_parceiros':info([{id:'p1',nome:'Pessoa',funcao:'Atendimento'}])})],[s1]);
 const person=p.campos['equipe.pessoas_parceiros'].valor[0];assert.equal(person.campos.nome.valor,'Pessoa');assert.equal(person.campos.responsabilidades.valor,null);assert.equal(person.campos.responsabilidades.situacao,'nao_informado');assert.equal(person.campos.funcao.fontes_refs[0],s1.id);
});
test('zero, false e faixa não viram vazio; ausência confirmada difere de desconhecimento',()=>{
 const build=use('buildProfile');const p=build(member,[patch({'atuacao.centro_cirurgico_proprio':info(false),'equipe.organizacao_trafego':info('nao'),'baseline.indicadores.consultas_mensais.atual':info({tipo_valor:'numero',numero:0,unidade:'consultas/mes'}),'baseline.indicadores.faturamento_mensal.atual':info({tipo_valor:'faixa',minimo:200000,maximo:500000,unidade:'BRL/mes'})})],[s1]);
 assert.equal(p.campos['atuacao.centro_cirurgico_proprio'].valor,false);assert.equal(p.campos['equipe.organizacao_trafego'].situacao,'informado');assert.equal(p.campos['baseline.indicadores.consultas_mensais.atual'].valor.numero,0);assert.equal(p.campos['baseline.indicadores.faturamento_mensal.atual'].valor.maximo,500000);
 assert.equal(p.campos['equipe.organizacao_social_media'].situacao,'nao_informado');
});
test('fonte antiga recuperada depois não substitui informação mais recente',()=>{
 const p=use('buildProfile')(member,[patch({'equipe.papel_sdr':info('eu',s2.id)},1),patch({'equipe.papel_sdr':info('acumula',s1.id)},2)],[s1,s2]);assert.equal(p.campos['equipe.papel_sdr'].valor,'eu');
});
test('conflito simultâneo mantém alternativas e fonte, sem escolher silenciosamente',()=>{
 const other={...s1,id:'10000000-0000-4000-8000-000000000003'};
 const p=use('buildProfile')(member,[patch({'equipe.papel_sdr':info('eu')},1),patch({'equipe.papel_sdr':info('acumula',other.id)},2)],[s1,other]);
 assert.equal(p.campos['equipe.papel_sdr'].situacao,'a_confirmar');assert.equal(p.campos['equipe.papel_sdr'].alternativas.length,2);
});
test('registro canônico continua vindo do cadastro e fonte de outro membro é rejeitada',()=>{
 const build=use('buildProfile');assert.throws(()=>build(member,[patch({'identidade.nome_completo':info('Outro')})],[s1]));
 assert.throws(()=>build(member,[patch({'equipe.papel_sdr':info('eu')})],[{...s1,member_id:'outro'}]));
});
test('dez perguntas entram no catálogo, com estimativas e não sei preservados',()=>{
 const intake={...s2,source_type:'pre_diagnostico',version:'pre-diagnostico-v1',data:{consultas:'Cerca de200',cirurgias_indicadas:'Não sei',cirurgias_realizadas:'0',sdr:'acumula',closer:'eu',outras_pessoas:'Recepção e técnica de exames',agenda:'Segunda a sexta',sistemas:'Agenda e prontuário atuais',trafego:'externa',social_media:'nao'}};
 const p=use('buildProfile')(member,[],[intake]);assert.equal(p.campos['equipe.papel_sdr'].valor,'acumula');assert.equal(p.campos['solucoes.contexto_declarado'].valor,'Agenda e prontuário atuais');assert.equal(p.campos['baseline.indicadores.consultas_mensais.atual'].valor.texto_original,'Cerca de200');assert.equal(p.campos['baseline.indicadores.cirurgias_indicadas_mensais.atual'].situacao,'nao_informado');assert.equal(p.campos['baseline.indicadores.cirurgias_realizadas_mensais.atual'].valor.numero,0);
});
test('omissão no complemento não apaga fato conhecido, nem converte data da coleta em período',()=>{
 const intake={...s2,source_type:'pre_diagnostico',version:'pre-diagnostico-v1',data:{sdr:'eu'}};
 const p=use('buildProfile')(member,[patch({'atuacao.agenda_semanal':info('Agenda conhecida')})],[s1,intake]);assert.equal(p.campos['atuacao.agenda_semanal'].valor,'Agenda conhecida');assert.equal(p.campos['equipe.papel_sdr'].data_referencia.inicio,null);
});
test('consulta por seções usa os mesmos valores e rejeita seção desconhecida',()=>{
 const p=use('emptyProfile')(member),pick=use('selectProfile');const q=pick(p,['equipe']);assert.ok(Object.keys(q.campos).every(k=>k.startsWith('equipe.')));assert.deepEqual(q.campos['equipe.papel_sdr'],p.campos['equipe.papel_sdr']);assert.throws(()=>pick(p,['arbitraria']));
});
test('datas impossíveis são rejeitadas sem alterar o calendário',()=>{
 const normalize=use('normalizePatch');assert.throws(()=>normalize({'identidade.data_entrada':info('2026-02-31')}));
});
test('campos de conflito fabricados são rejeitados',()=>{
 const normalize=use('normalizePatch');
 assert.throws(()=>normalize({'equipe.papel_sdr':{...info('eu'),alternativas:[{campo_inventado:'x'}]}}));
});
test('período do indicador prevalece sobre documento recuperado depois',()=>{
 const k='baseline.indicadores.consultas_mensais.atual',periodo=inicio=>({inicio,fim:null,precisao:'mes',natureza:'fato'});
 const p=M.buildProfile(member,[patch({[k]:info({tipo_valor:'numero',numero:300,periodo:periodo('2026-09')},s1.id)},1),patch({[k]:info({tipo_valor:'numero',numero:100,periodo:periodo('2026-05')},s2.id)},2)],[s1,s2]);assert.equal(p.campos[k].valor.numero,300);
});
test('lista recuperada depois não reativa pessoa com evidência interna antiga',()=>{
 const k='equipe.pessoas_parceiros',ref={inicio:'2026-09-01',fim:null,precisao:'dia',natureza:'fato'};
 const p=M.buildProfile(member,[patch({[k]:info([{id:'p1',estado:'historico',nome:'Pessoa'}],s1.id)},1),patch({[k]:info([{id:'p1',estado:'atual',campos:{nome:{...info('Pessoa',s2.id),data_referencia:ref}}}],s2.id)},2)],[s1,s2]);assert.equal(p.campos[k].valor.length,0);assert.equal(p.campos[k].historicos[0].id,'p1');
});
test('fonte própria antiga de pessoa prevalece sobre fonte nova da lista',()=>{
 const k='equipe.pessoas_parceiros',s3={...s2,id:'10000000-0000-4000-8000-000000000003',source_at:'2026-10-27T00:00:00Z'};
 const p=M.buildProfile(member,[patch({[k]:info([{id:'p1',estado:'historico',nome:'Pessoa'}],s2.id)},1),patch({[k]:info([{id:'p1',estado:'atual',campos:{nome:info('Pessoa',s1.id)}}],s3.id)},2)],[s1,s2,s3]);assert.equal(p.campos[k].valor.length,0);
});
test('Instagram compara somente a mesma dimensão e vínculo confirmado',()=>{
 for(const alter of [{vinculo_id:'b'},{unidade:'publicacoes'},{escopo:'nao_definido'}]){
  const metric={tipo_valor:'numero',numero:100,precisao:'exata',unidade:'seguidores',escopo:'vinculo',vinculo_id:'a'};
  const first={...info(metric),data_referencia:{inicio:'2026-09-01',precisao:'dia',natureza:'fato'}},last={...info({...metric,numero:200,...alter},s2.id),data_referencia:{inicio:'2026-10-01',precisao:'dia',natureza:'fato'}};
  const p=M.buildProfile(member,[patch({'baseline.indicadores.seguidores_instagram.referencia_inicial':first,'baseline.indicadores.seguidores_instagram.atual':last})],[s1,s2]);assert.equal(p.campos['instagram.comparacao'].valor,null);
 }
});
