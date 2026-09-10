const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const plain = x => JSON.parse(JSON.stringify(x));
const settle = () => new Promise(resolve => setImmediate(resolve));
function extract(file, start, end) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert(a >= 0 && b > a);
  return source.slice(a, b);
}
const helpers = extract('public/assets/admin.js', '  function celulaNota(', '  function marcarEtapa(');
const dataCode = extract('public/assets/club-data.js', '  var AVISO_NOTAS =', '  /* ── arquivo');
function controller() {
  const calls = [], pending = [];
  const ctx = vm.createContext({
    st: { notasEdit: {}, progressNotes: [], progress: [{ member_id:'m1', step_id:'s1', feito:true, feito_em:'2026-09-10' }] },
    porNota: {}, renderMembers() {}, document: { body:{}, activeElement:null },
    $: () => ({ querySelector: () => null }),
    esc: s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])),
    ico: () => '<svg></svg>',
    Club: { toast() {}, data: { progressNotes: { save(...args) {
      calls.push(args);
      return new Promise((resolve, reject) => pending.push({ resolve, reject }));
    } } } }
  });
  vm.runInContext(helpers, ctx);
  return { ctx, calls, pending };
}
function dataHarness(pages = []) {
  const calls = [];
  const C = { data:{} };
  const client = { from(table) {
    assert.equal(table, 'progress_notes');
    return {
      select() { return this; }, order() { return this; },
      range(from, to) { calls.push({ from,to }); return Promise.resolve(pages.shift()); },
      upsert(row, options) {
        calls.push({ row:plain(row), options:plain(options) });
        return { select() { return this; }, single: async () => ({ data:row, error:null }) };
      }
    };
  } };
  vm.runInNewContext(dataCode, { C, sb: () => client, PAGINA:2, ok(res) { if (res.error) throw res.error; return res.data; } });
  return { C, calls };
}
test('salva só a nota da linha e preserva progresso e outro mentorado', async () => {
  const { ctx, calls, pending } = controller();
  const outra = { member_id:'m2', alvo:'etapa:s1', observacao:'Outra pessoa' };
  ctx.st.progressNotes = [outra]; ctx.porNota['m2|etapa:s1'] = outra;
  const progresso = plain(ctx.st.progress);
  ctx.abrirNota('m1|etapa:s1'); ctx.st.notasEdit['m1|etapa:s1'].texto = '  Contexto\nNovo passo  ';
  ctx.fecharNota('m1|etapa:s1', true); ctx.fecharNota('m1|etapa:s1', true);
  assert.deepEqual(calls, [['m1','etapa:s1','Contexto\nNovo passo']]);
  assert.equal(ctx.porNota['m1|etapa:s1'], undefined);
  pending[0].resolve({ member_id:'m1', alvo:'etapa:s1', observacao:'Contexto\nNovo passo' }); await settle();
  assert.equal(ctx.porNota['m2|etapa:s1'].observacao, 'Outra pessoa');
  assert.deepEqual(plain(ctx.st.progress), progresso);
  assert.equal(ctx.st.notasEdit['m1|etapa:s1'], undefined);
});
test('cancelar e texto inalterado não gravam; texto vazio limpa uma nota existente', async () => {
  const { ctx, calls, pending } = controller();
  const k = 'm1|mentorado';
  ctx.porNota[k] = { member_id:'m1', alvo:'mentorado', observacao:'Original' };
  ctx.abrirNota(k); ctx.st.notasEdit[k].texto = 'Descartar'; ctx.fecharNota(k,false);
  ctx.abrirNota(k); ctx.fecharNota(k,true); assert.equal(calls.length,0);
  ctx.abrirNota(k); ctx.st.notasEdit[k].texto = ' '; ctx.fecharNota(k,true);
  assert.deepEqual(calls[0], ['m1','mentorado','']);
  pending[0].resolve({ member_id:'m1', alvo:'mentorado', observacao:'' }); await settle();
  assert.equal(ctx.porNota[k].observacao,'');
});
test('falha mantém texto e permite nova tentativa; limite e indisponibilidade bloqueiam escrita', async () => {
  const { ctx, calls, pending } = controller(); const k = 'm1|artefato:a1';
  ctx.abrirNota(k); ctx.st.notasEdit[k].texto = 'Rascunho'; ctx.fecharNota(k,true);
  pending[0].reject(new Error('Falha')); await settle();
  assert.equal(ctx.st.notasEdit[k].texto,'Rascunho'); assert.equal(ctx.st.notasEdit[k].salvando,false);
  assert.equal(ctx.st.notasEdit[k].erro,'Falha');
  ctx.fecharNota(k,true); pending[1].resolve({ member_id:'m1', alvo:'artefato:a1', observacao:'Rascunho' }); await settle();
  ctx.abrirNota(k); ctx.st.notasEdit[k].texto = 'x'.repeat(2001); ctx.fecharNota(k,true);
  assert.match(ctx.st.notasEdit[k].erro,/2.000/); assert.equal(calls.length,2);
  ctx.Club.erroObservacoes = 'Sem banco'; ctx.st.notasEdit[k].texto = 'Novo'; ctx.fecharNota(k,true);
  assert.equal(calls.length,2); assert.equal(ctx.st.notasEdit[k].erro,'Sem banco');
});
test('escapa HTML tanto na célula quanto no editor, sem riscar o texto da nota', () => {
  const { ctx } = controller(); const m = { id:'m1', nome:'Mentorado' }, k = 'm1|etapa:s1';
  const malicious = '</textarea><img src=x onerror=alert(1)>';
  ctx.porNota[k] = { observacao:malicious };
  assert(!ctx.celulaNota(m,'etapa:s1','Etapa').includes('<img'));
  ctx.abrirNota(k);
  const html = ctx.linhaNota(m,'etapa:s1','Etapa');
  assert(html.includes('&lt;/textarea&gt;')); assert(!html.includes('<img'));
  assert(!ctx.celulaNota(m,'etapa:s1','Etapa').includes('tx-t'));
});
test('camada de dados pagina, usa chave estável e limita o payload aos campos da nota', async () => {
  const { C, calls } = dataHarness([{ data:[{ alvo:'a' },{ alvo:'b' }] },{ data:[{ alvo:'c' }] }]);
  assert.equal((await C.data.progressNotes.list()).length,3);
  assert.deepEqual(calls.slice(0,2),[{ from:0,to:1 },{ from:2,to:3 }]);
  for (const alvo of ['mentorado','artefato:a1','etapa:s1']) await C.data.progressNotes.save('m1',alvo,' Nota ');
  assert.deepEqual(calls.slice(2).map(c => c.row), [
    { member_id:'m1',artifact_id:null,step_id:null,observacao:'Nota' },
    { member_id:'m1',artifact_id:'a1',step_id:null,observacao:'Nota' },
    { member_id:'m1',artifact_id:null,step_id:'s1',observacao:'Nota' }
  ]);
  assert.equal(calls[2].options.onConflict,'member_id,alvo');
  await assert.rejects(C.data.progressNotes.save('m1','invalido','Nota'),/inválida/);
  await assert.rejects(C.data.progressNotes.save('m1','mentorado','x'.repeat(2001)),/2.000/);
});
test('migração ausente e erro em página posterior descartam dados parciais e impedem sobrescrita', async () => {
  const first = dataHarness([{ error:{ code:'PGRST205',message:'schema cache' } }]);
  assert.deepEqual(plain(await first.C.data.progressNotes.list()),[]);
  assert.match(first.C.erroObservacoes,/observacoes-progressao.sql/);
  await assert.rejects(first.C.data.progressNotes.save('m1','mentorado','Nota'),/ativadas/);
  const second = dataHarness([{ data:[{},{}] },{ error:{ code:'X',message:'Rede indisponível' } }]);
  assert.deepEqual(plain(await second.C.data.progressNotes.list()),[]);
  assert.equal(second.C.erroObservacoes,'Rede indisponível');
});
