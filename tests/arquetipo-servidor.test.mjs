import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import http from 'node:http';
import net from 'node:net';

// Serviço do Teste de Arquétipo com dados sintéticos e uma Evolution falsa: nada sai para o WhatsApp.
let dir, child, base, evo;
const chamadas = [];
const ORDEM = ['CRIADOR', 'GOVERNANTE', 'CARA_COMUM', 'SABIO', 'HEROI', 'FORA_DA_LEI', 'CUIDADOR', 'AMANTE', 'INOCENTE', 'MAGO', 'EXPLORADOR', 'BOBO_DA_CORTE'];
const TOTAIS = [12, 12, 12, 8, 8, 8, 8, 8, 8, 4, 4, 4];
const PDF = Buffer.concat([Buffer.from('%PDF-1.3\n'), Buffer.alloc(300, 32), Buffer.from('\n%%EOF\n')]);

async function portaLivre() {
  const s = net.createServer();
  await new Promise((ok) => s.listen(0, '127.0.0.1', ok));
  const p = s.address().port;
  await new Promise((ok) => s.close(ok));
  return p;
}

before(async () => {
  evo = http.createServer((req, res) => {
    let b = '';
    req.on('data', (c) => { b += c; });
    req.on('end', () => {
      chamadas.push({ url: req.url, apikey: req.headers.apikey, corpo: JSON.parse(b) });
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ key: { id: 'FALSO' + chamadas.length }, status: 'PENDING' }));
    });
  });
  await new Promise((ok) => evo.listen(0, '127.0.0.1', ok));
  dir = await mkdtemp(join(tmpdir(), 'arquetipo-test-'));
  await writeFile(join(dir, 'respostas.jsonl'), JSON.stringify({ resposta_id: 'antigo-0001', usuario: { nome: 'x' } }) + '\n');
  const port = await portaLivre();
  base = 'http://127.0.0.1:' + port;
  child = spawn(process.execPath, ['operacao/teste-arquetipo/server.mjs'], {
    env: {
      ...process.env, PORT: String(port), DATA_DIR: dir,
      EVOLUTION_URL: 'http://127.0.0.1:' + evo.address().port, EVOLUTION_TOKEN: 'token-sintetico',
      AVISAR: 'equipe@lid', AVISAR_TESTE: 'conferencia@lid',
    },
    stdio: 'ignore',
  });
  for (let i = 0; i < 80; i++) {
    try { if ((await fetch(base + '/api/arquetipo/saude')).ok) return; } catch {}
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('local test server did not start');
});
after(async () => {
  if (child && child.exitCode === null) { child.kill(); await new Promise((ok) => child.once('exit', ok)); }
  await new Promise((ok) => evo.close(ok));
  await rm(dir, { recursive: true, force: true });
});

function payload(id, extra = {}) {
  return {
    resposta_id: id, versao: '2026-10-30',
    usuario: { nome: 'Dra. Sintética Teste', cidade: 'Cidade Fictícia', data: '2026-10-30' },
    respostas: Array(60).fill(0),
    resultado: {
      principal: { chave: 'CRIADOR', variacao: 'Empreendedor' },
      apoio: { chave: 'GOVERNANTE', variacao: 'Soberano' },
      placar: ORDEM.map((k, i) => [k, TOTAIS[i]]),
    },
    pdf: PDF.toString('base64'),
    ...extra,
  };
}
const post = (data) => fetch(base + '/api/arquetipo/respostas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
async function linhas(arq) {
  try { return (await readFile(join(dir, arq), 'utf8')).split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; }
}
async function esperarChamadas(n) {
  for (let i = 0; i < 80 && chamadas.length < n; i++) await new Promise((r) => setTimeout(r, 25));
  assert.equal(chamadas.length, n);
}

test('result is stored with its PDF and the PDF goes to the team with the tie spelled out', async () => {
  const r = await post(payload('sintetico-0001'));
  assert.equal(r.status, 201);
  const reg = (await linhas('respostas.jsonl')).find((x) => x.resposta_id === 'sintetico-0001');
  assert.equal(reg.usuario.nome, 'Dra. Sintética Teste');
  assert.deepEqual(reg.resultado.principal, { chave: 'CRIADOR', variacao: 'Empreendedor' });
  assert.equal(reg.respostas.length, 60);
  assert.match(reg.pdf, /^pdf\/\d{4}-\d{2}-\d{2}_\d{6}_dra-sintetica-teste_sintetic\.pdf$/);
  assert.deepEqual(await readFile(join(dir, reg.pdf)), PDF);
  await esperarChamadas(1);
  const c = chamadas[0];
  assert.equal(c.url, '/message/sendMedia/Atendimento%20Oftalmoblack');
  assert.equal(c.apikey, 'token-sintetico');
  assert.equal(c.corpo.number, 'equipe@lid');
  assert.equal(c.corpo.mediatype, 'document');
  assert.equal(c.corpo.fileName, 'Teste de Arquétipo - Dra. Sintética Teste.pdf');
  assert.deepEqual(Buffer.from(c.corpo.media, 'base64'), PDF);
  assert.match(c.corpo.caption, /Principal: Criador · Empreendedor \(12\)\nApoio: Governante · Soberano \(12\)/);
  assert.match(c.corpo.caption, /Empate em 12: Criador, Governante e Cara Comum\./);
  for (let i = 0; i < 40 && !(await linhas('avisos.jsonl')).length; i++) await new Promise((r) => setTimeout(r, 25));
  assert.equal((await linhas('avisos.jsonl'))[0].key_id, 'FALSO1');
});

test('the same response id is stored and announced only once, also across restarts', async () => {
  const r = await post(payload('sintetico-0001'));
  assert.equal(r.status, 200);
  assert.equal((await r.json()).repetido, true);
  assert.equal((await post(payload('antigo-0001'))).status, 200);
  await new Promise((r2) => setTimeout(r2, 200));
  assert.equal((await linhas('respostas.jsonl')).filter((x) => x.resposta_id === 'sintetico-0001').length, 1);
  assert.equal(chamadas.length, 1);
});

test('test mode stays apart from real answers and only reaches the test recipient', async () => {
  assert.equal((await post(payload('sintetico-0002', { teste: true }))).status, 201);
  assert.equal((await linhas('respostas.jsonl')).some((x) => x.resposta_id === 'sintetico-0002'), false);
  const reg = (await linhas('testes.jsonl')).find((x) => x.resposta_id === 'sintetico-0002');
  assert.match(reg.pdf, /^pdf-testes\//);
  await esperarChamadas(2);
  assert.equal(chamadas[1].corpo.number, 'conferencia@lid');
  assert.match(chamadas[1].corpo.caption, /^\[TESTE\]\n/);
});

test('without a valid PDF the result is still stored and goes as text; support ties are flagged', async () => {
  const placar = [['CARA_COMUM', 20], ['AMANTE', 12], ['CUIDADOR', 12], ...ORDEM.filter((k) => !['CARA_COMUM', 'AMANTE', 'CUIDADOR'].includes(k)).map((k) => [k, 6])];
  const r = await post(payload('sintetico-0003', {
    pdf: Buffer.from('não é pdf').toString('base64'),
    resultado: { principal: { chave: 'CARA_COMUM', variacao: 'Inventada' }, apoio: { chave: 'AMANTE', variacao: 'Leal' }, placar },
  }));
  assert.equal(r.status, 201);
  const reg = (await linhas('respostas.jsonl')).find((x) => x.resposta_id === 'sintetico-0003');
  assert.equal(reg.pdf, null);
  assert.equal(reg.resultado.principal.variacao, null);
  await esperarChamadas(3);
  assert.equal(chamadas[2].url, '/message/sendText/Atendimento%20Oftalmoblack');
  assert.match(chamadas[2].corpo.text, /Principal: Cara Comum \(20\)\nApoio: Amante · Leal \(12\)\nApoio empatado em 12: Amante e Cuidador\.\n\(sem PDF\)$/);
});

test('broken payloads and foreign origins are refused without writing anything', async () => {
  const antes = (await linhas('respostas.jsonl')).length;
  const dup = payload('sintetico-0004');
  dup.resultado.placar[1] = ['CRIADOR', 12];
  assert.equal((await post(dup)).status, 422);
  assert.equal((await post(payload('sintetico-0005', { usuario: { nome: '  ' } }))).status, 422);
  assert.equal((await post(payload('curto', {}))).status, 422);
  assert.equal((await post(payload('sintetico-0006', { respostas: Array(60).fill(4) }))).status, 422);
  const origem = await new Promise((ok, falha) => {
    const req = http.request(base + '/api/arquetipo/respostas', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://outro.example' } }, (res) => { res.resume(); ok(res.statusCode); });
    req.on('error', falha);
    req.end(JSON.stringify(payload('sintetico-0007')));
  });
  assert.equal(origem, 403);
  assert.equal((await linhas('respostas.jsonl')).length, antes);
  assert.equal(chamadas.length, 3);
});
