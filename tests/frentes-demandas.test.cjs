const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');

function source(file) { return fs.readFileSync(path.join(root, file), 'utf8'); }
function extract(file, start, end) {
  const src = source(file);
  const a = src.indexOf(start), b = src.indexOf(end, a);
  assert(a >= 0 && b > a, 'marcador não encontrado em ' + file + ': ' + start);
  return src.slice(a, b);
}

test('COLUNAS.demands grava artifact_id e step_id, não projeto; os dois são nuláveis', () => {
  const code = extract('public/assets/club-data.js', '  var COLUNAS = {', '  /* Tabelas que só a administração');
  const ctx = vm.createContext({});
  vm.runInContext(code + '\nthis.COLUNAS = COLUNAS; this.NULAVEIS = NULAVEIS;', ctx);
  assert.ok(ctx.COLUNAS.demands.includes('artifact_id'));
  assert.ok(ctx.COLUNAS.demands.includes('step_id'));
  assert.ok(!ctx.COLUNAS.demands.includes('projeto'));
  assert.ok(!ctx.COLUNAS.demands.includes('projeto_legado'), 'legado é só leitura');
  assert.ok(ctx.NULAVEIS.includes('artifact_id'));
  assert.ok(ctx.NULAVEIS.includes('step_id'));
});

function contextoQuadro() {
  const membros = { m1:'João Vitor', m2:'Cintia' };
  const st = {
    members: [{ id:'m1', nome:'João Vitor' }, { id:'m2', nome:'Cintia' }],
    groups: [
      { id:'g4', nome:'Geração de demanda', ordem:4, interna:false },
      { id:'g2', nome:'Tecnologia e dados', ordem:2, interna:false },
      { id:'g8', nome:'Operação Olympus',   ordem:8, interna:true }
    ],
    artifacts: [
      { id:'meta',  nome:'Meta Ads',      group_id:'g4', ordem:1, tipo:'artefato', member_id:null },
      { id:'quiz',  nome:'Quiz',          group_id:'g4', ordem:4, tipo:'artefato', member_id:null },
      { id:'sb',    nome:'Sistema Black', group_id:'g2', ordem:1, tipo:'artefato', member_id:null },
      { id:'os',    nome:'Olympus OS',    group_id:'g8', ordem:1, tipo:'interna',  member_id:null },
      { id:'enc',   nome:'Encontro',      group_id:'g4', ordem:7, tipo:'artefato', member_id:'m1' }
    ],
    demands: [], recemFechadas: {}, demFrente: ''
  };
  const ctx = vm.createContext({
    st,
    membro: id => membros[id] || null,
    grupoDe: a => st.groups.filter(g => g.id === a.group_id)[0] || null,
    esc: s => String(s == null ? '' : s),
    Club: { DEM_ABERTOS: ['A fazer', 'Planejando', 'Em andamento', 'Em risco', 'Aguardando retorno', 'Em pausa'],
            diffDays: d => d ? 0 : null },
    PESO_PRIO: { Alta:0, 'Média':1, Baixa:2 }
  });
  return ctx;
}

const MARCA_INI = '  /* ── frente: o eixo de leitura do quadro';
const MARCA_FIM = '  function estaFechada(d)';

test('contextoDe: frente com área, mentorado sem frente, e vazio', () => {
  const ctx = contextoQuadro();
  vm.runInContext(extract('public/assets/admin.js', MARCA_INI, MARCA_FIM) +
    '\nthis.contextoDe = contextoDe; this.rotuloFrente = rotuloFrente;', ctx);
  const f = ctx.contextoDe({ id:'d1', artifact_id:'quiz', member_id:'m2' });
  assert.equal(f.tipo, 'frente'); assert.equal(f.nome, 'Quiz'); assert.equal(f.area.nome, 'Geração de demanda');
  const m = ctx.contextoDe({ id:'d2', artifact_id:null, member_id:'m1' });
  assert.equal(m.tipo, 'mentorado'); assert.equal(m.nome, 'João Vitor');
  const z = ctx.contextoDe({ id:'d3', artifact_id:null, member_id:null, projeto_legado:'Olympus / X' });
  assert.equal(z.tipo, 'vazio'); assert.equal(z.nome, 'Sem frente');
  const orfa = ctx.contextoDe({ id:'d4', artifact_id:'apagada', member_id:null });
  assert.equal(orfa.tipo, 'vazio', 'frente apagada conta como sem frente');
  assert.equal(ctx.rotuloFrente(ctx.st.artifacts[4]), 'Geração de demanda · Encontro (João Vitor)');
});

test('opcoesFrente vem por área, com a área inteira antes das frentes dela, internas por último', () => {
  const ctx = contextoQuadro();
  vm.runInContext(extract('public/assets/admin.js', MARCA_INI, MARCA_FIM) +
    '\nthis.opcoesFrente = opcoesFrente; this.casaFrente = casaFrente;', ctx);
  const ops = ctx.opcoesFrente();
  assert.deepEqual(Array.from(ops, o => o.value), ['a:g2', 'sb', 'a:g4', 'meta', 'quiz', 'enc', 'a:g8', 'os']);
  assert.ok(ops[0].label.includes('(tudo)'));
  assert.ok(ctx.casaFrente({ artifact_id:'quiz' }, 'a:g4'));
  assert.ok(!ctx.casaFrente({ artifact_id:'sb' }, 'a:g4'));
  assert.ok(ctx.casaFrente({ artifact_id:'sb' }, 'sb'));
  assert.ok(!ctx.casaFrente({ artifact_id:null }, 'sb'));
});

test('gruposPorFrente: área → frente, mentorado sem frente no topo, Sem frente por último', () => {
  const ctx = contextoQuadro();
  const code = extract('public/assets/admin.js', MARCA_INI, MARCA_FIM) +
    extract('public/assets/admin.js', '  function estaFechada(d)', '  /* O cartão "Em aberto" não é recorte') +
    extract('public/assets/admin.js', '  function porPrazo(a, b)', '  function linhaGrupo(g, nivel)');
  vm.runInContext(code + '\nthis.gruposPorFrente = gruposPorFrente;', ctx);
  ctx.st.demands = [
    { id:'a', titulo:'A', status:'A fazer', prioridade:'Média', artifact_id:'quiz', member_id:'m2' },
    { id:'b', titulo:'B', status:'A fazer', prioridade:'Média', artifact_id:'meta', member_id:null },
    { id:'c', titulo:'C', status:'A fazer', prioridade:'Média', artifact_id:null,   member_id:'m1' },
    { id:'d', titulo:'D', status:'A fazer', prioridade:'Média', artifact_id:null,   member_id:null },
    { id:'e', titulo:'E', status:'A fazer', prioridade:'Média', artifact_id:'os',   member_id:null }
  ];
  const topo = Array.from(ctx.gruposPorFrente(ctx.st.demands));
  const nomes = topo.map(g => g.nome);
  assert.equal(nomes[nomes.length - 1], 'Sem frente');
  const g4 = topo.find(g => g.nome === 'Geração de demanda');
  assert.equal(g4.tipo, 'pai');
  assert.deepEqual(Array.from(g4.filhos, f => f.nome), ['Meta Ads', 'Quiz']);
  assert.deepEqual(Array.from(g4.filhos[1].itens, d => d.id), ['a']);
  assert.ok(topo.some(g => g.tipo === 'mentorado' && g.nome === 'João Vitor'));
  const g8 = topo.find(g => g.nome === 'Operação Olympus');
  assert.equal(g8.filhos[0].nome, 'Olympus OS');
});

test('FOCOS.semfrente pega aberta sem frente, e só ela', () => {
  const ctx = contextoQuadro();
  vm.runInContext(extract('public/assets/admin.js', MARCA_INI, MARCA_FIM) +
    extract('public/assets/admin.js', '  function estaFechada(d)', '  /* O cartão "Em aberto" não é recorte') +
    '\nthis.FOCOS = FOCOS;', ctx);
  assert.ok(ctx.FOCOS.semfrente.testa({ status:'A fazer', artifact_id:null }));
  assert.ok(!ctx.FOCOS.semfrente.testa({ status:'A fazer', artifact_id:'quiz' }));
  assert.ok(!ctx.FOCOS.semfrente.testa({ status:'Concluída', artifact_id:null }));
});

test('registroDemanda grava frente e etapa, nunca projeto; etapa sem frente é descartada', () => {
  const code = extract('public/assets/admin.js', '  function registroDemanda(', '  function modalDemanda(');
  const ctx = vm.createContext({});
  vm.runInContext(code + '\nthis.registroDemanda = registroDemanda;', ctx);
  const base = { titulo:'X', descricao:'', status:'A fazer', prioridade:'Média', responsaveis:[], origem:'', vence_em:'' };
  const r = ctx.registroDemanda(base, 'm1', 'quiz', 's9');
  assert.equal(r.member_id, 'm1'); assert.equal(r.artifact_id, 'quiz'); assert.equal(r.step_id, 's9');
  assert.ok(!('projeto' in r) && !('projeto_legado' in r));
  const semFrente = ctx.registroDemanda(base, null, '', 's9');
  assert.equal(semFrente.artifact_id, null); assert.equal(semFrente.step_id, null);
});

test('etapaParaMarcar: só com etapa, mentorado e etapa ainda não marcada', () => {
  const marcadas = { 'm1|s1': true };
  const ctx = vm.createContext({ marcada: (m, s) => !!marcadas[m + '|' + s] });
  vm.runInContext(extract('public/assets/admin.js', '  function etapaParaMarcar(', '  function mudarStatus(') +
    '\nthis.etapaParaMarcar = etapaParaMarcar;', ctx);
  const alvo = ctx.etapaParaMarcar({ member_id:'m1', step_id:'s2' });
  assert.equal(alvo.memberId, 'm1'); assert.equal(alvo.stepId, 's2');
  assert.equal(ctx.etapaParaMarcar({ member_id:'m1', step_id:'s1' }), null, 'já marcada');
  assert.equal(ctx.etapaParaMarcar({ member_id:null, step_id:'s2' }), null, 'sem mentorado não há progresso');
  assert.equal(ctx.etapaParaMarcar({ member_id:'m1', step_id:null }), null);
});

test('prefillDaEtapa: título da etapa, frente, etapa, mentorado; trava vai para a CS, senão dono do artefato', () => {
  const ctx = vm.createContext({
    st: { staff: [{ id:'kk', apelido:'KK', nome:'Kellen', ativo:true }, { id:'ta', apelido:'TA', nome:'Thomas', ativo:true }],
          groups: [{ id:'g4', nome:'Geração de demanda', responsaveis:['ta'] }] },
    grupoDe: a => ({ id:'g4', nome:'Geração de demanda', responsaveis:['ta'] }),
    Club: { tipoEtapa: e => e.tipo || 'entrega', fmtDataCurta: () => '21/09' }
  });
  vm.runInContext(extract('public/assets/admin.js', '  function prefillDaEtapa(', '  function demandasAbertasDaEtapa(') +
    '\nthis.prefillDaEtapa = prefillDaEtapa;', ctx);
  const m = { id:'m1', nome:'João Vitor' };
  const meta = { id:'meta', nome:'Meta Ads', responsaveis:['ta'] };
  const trava = ctx.prefillDaEtapa(m, { id:'s1', titulo:'Acesso à BM', tipo:'trava' }, meta);
  assert.equal(trava.titulo, 'Acesso à BM'); assert.equal(trava.member_id, 'm1');
  assert.equal(trava.artifact_id, 'meta'); assert.equal(trava.step_id, 's1');
  assert.deepEqual(Array.from(trava.responsaveis), ['kk']);
  assert.ok(trava.origem.startsWith('Progressão · Meta Ads'));
  const entrega = ctx.prefillDaEtapa(m, { id:'s2', titulo:'Plano de subida', tipo:'entrega' }, meta);
  assert.deepEqual(Array.from(entrega.responsaveis), ['ta']);
  const semDono = ctx.prefillDaEtapa(m, { id:'s3', titulo:'X', tipo:'entrega' }, { id:'q', nome:'Quiz', responsaveis:[] });
  assert.deepEqual(Array.from(semDono.responsaveis), ['ta'], 'cai no dono da área');
});

test('proximaOcorrencia: prazo empurrado pela cadência a partir do maior entre prazo e hoje; copia o essencial', () => {
  const ctx = vm.createContext({});
  vm.runInContext(extract('public/assets/admin.js', '  function proximaOcorrencia(', '  /* Concluir a demanda que nasceu de uma etapa') +
    '\nthis.proximaOcorrencia = proximaOcorrencia;', ctx);
  const d = { id:'d1', titulo:'Leitura semanal', descricao:'x', prioridade:'Alta', responsaveis:['ta'],
              member_id:'m1', artifact_id:'meta', step_id:'s1', status:'Concluída', vence_em:'2026-09-15' };
  const atrasada = ctx.proximaOcorrencia(d, { titulo:'Auditoria de segunda', cadencia_dias:7 }, '2026-09-21');
  assert.equal(atrasada.vence_em, '2026-09-28', 'prazo passado: hoje + 7');
  const futura = ctx.proximaOcorrencia(Object.assign({}, d, { vence_em:'2026-09-25' }), { titulo:'X', cadencia_dias:14 }, '2026-09-21');
  assert.equal(futura.vence_em, '2026-10-09', 'prazo futuro: prazo + 14');
  const semCad = ctx.proximaOcorrencia(Object.assign({}, d, { vence_em:null }), { titulo:'X' }, '2026-09-21');
  assert.equal(semCad.vence_em, '2026-09-28', 'sem cadência vale 7');
  assert.equal(atrasada.status, 'A fazer'); assert.equal(atrasada.titulo, 'Leitura semanal');
  assert.equal(atrasada.artifact_id, 'meta'); assert.equal(atrasada.step_id, 's1'); assert.equal(atrasada.member_id, 'm1');
  assert.deepEqual(Array.from(atrasada.responsaveis), ['ta']);
  assert.ok(atrasada.origem.startsWith('Rotina · Auditoria'));
  assert.ok(!('id' in atrasada) && !('concluida_em' in atrasada));
});

test('itensMenuFrente esconde artefato exclusivo de outro mentorado e mostra o do próprio', () => {
  const ctx = contextoQuadro();
  Object.assign(ctx, { tdCel: s => s, celula: (t, id, c) => c, etapasDe: () => [] });
  vm.runInContext(extract('public/assets/admin.js', MARCA_INI, MARCA_FIM) +
    extract('public/assets/admin.js', '  /* A frente é menu:', '  /* Célula que abre menu no clique.') +
    '\nthis.itensMenuFrente = itensMenuFrente;', ctx);
  const deM2 = Array.from(ctx.itensMenuFrente('', 'm2'), i => i.value);
  assert.ok(!deM2.includes('enc'), 'Encontro é só do m1');
  assert.ok(deM2.includes('quiz') && deM2.includes('os'));
  const deM1 = Array.from(ctx.itensMenuFrente('enc', 'm1'), i => i.value);
  assert.ok(deM1.includes('enc'));
  const interna = Array.from(ctx.itensMenuFrente('', null), i => i.value);
  assert.ok(!interna.includes('enc') && interna[0] === '');
});
