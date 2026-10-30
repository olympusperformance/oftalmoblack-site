// Teste de Arquétipo do Club OftalmoBlack: guarda cada resultado e manda o PDF para a equipe.
//
// A página /teste-de-arquetipo/ envia o resultado (respostas, placar e o mesmo PDF que o membro
// baixa) assim que o teste termina. Cada resultado vira uma linha em DATA_DIR/respostas.jsonl,
// o PDF fica em DATA_DIR/pdf/ e uma cópia segue pelo WhatsApp do Atendimento para quem está em
// AVISAR. Node puro, sem dependências; roda como serviço Swarm `teste-arquetipo` na VPS, e o
// Traefik manda /api/arquetipo/ para cá (ver traefik.json e implantar.sh nesta pasta).
//
// Rotas:
//   POST /api/arquetipo/respostas  público; grava e avisa (teste:true vai para testes.jsonl e avisa AVISAR_TESTE)
//   GET  /api/arquetipo/saude      sinal de vida, sem dados
//
// Ambiente (na VPS, em /opt/teste-arquetipo/.env, fora do git):
//   EVOLUTION_URL, EVOLUTION_INSTANCIA, EVOLUTION_TOKEN  envio pelo WhatsApp (token da própria instância)
//   AVISAR, AVISAR_TESTE                                 destinos separados por vírgula (JID @lid ou número)

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || '/data';
const ORIGENS = new Set(
  (process.env.ORIGENS || 'https://oftalmoblack.com.br,https://www.oftalmoblack.com.br')
    .split(',').map((s) => s.trim()).filter(Boolean)
);
const EVO = {
  url: (process.env.EVOLUTION_URL || '').replace(/\/+$/, ''),
  instancia: process.env.EVOLUTION_INSTANCIA || 'Atendimento Oftalmoblack',
  token: process.env.EVOLUTION_TOKEN || '',
};
const destinos = (v) => (v || '').split(',').map((s) => s.trim()).filter(Boolean);
const AVISAR = destinos(process.env.AVISAR);
const AVISAR_TESTE = destinos(process.env.AVISAR_TESTE);
const AVISOS_POR_DIA = Number(process.env.AVISOS_POR_DIA || 80);
// O PDF do teste tem ~175 KB (~235 KB em base64) e o proxy da frente corta em 1 MB.
const LIMITE_CORPO = 900 * 1024;
const LIMITE_PDF = 600 * 1024;
const ESPERAS = [30_000, 300_000]; // novas tentativas do WhatsApp

const ARQ = {
  respostas: path.join(DATA_DIR, 'respostas.jsonl'),
  testes: path.join(DATA_DIR, 'testes.jsonl'),
  avisos: path.join(DATA_DIR, 'avisos.jsonl'),
};
const PASTA_PDF = { respostas: path.join(DATA_DIR, 'pdf'), testes: path.join(DATA_DIR, 'pdf-testes') };

/* Mesmas chaves, nomes e variações de public/teste-de-arquetipo/dados.js. A legenda do
   WhatsApp sai daqui, então só nome e cidade chegam como texto livre. */
const ARQUETIPOS = {
  MAGO: ['Mago', ['Místico', 'Transformador da Mente', 'Alquimista']],
  SABIO: ['Sábio', ['Acadêmico', 'Mentor', 'Comunicador']],
  HEROI: ['Herói', ['Guerreiro', 'Atleta', 'Salvador']],
  EXPLORADOR: ['Explorador', ['Aventureiro', 'Desbravador', 'Cosmopolita']],
  FORA_DA_LEI: ['Fora-da-Lei', ['Ativista', 'Disruptor', 'Reformador']],
  CRIADOR: ['Criador', ['Esteta', 'Narrador', 'Empreendedor']],
  GOVERNANTE: ['Governante', ['Clássico', 'Soberano', 'Patriarca']],
  CUIDADOR: ['Cuidador', ['Protetor', 'Curador', 'Acolhedor']],
  AMANTE: ['Amante', ['Apaixonado', 'Leal', 'Sedutor']],
  INOCENTE: ['Inocente', ['Puro', 'Sonhador', 'Idealista']],
  BOBO_DA_CORTE: ['Bobo da Corte', ['Showman', 'Brincalhão', 'Provocador']],
  CARA_COMUM: ['Cara Comum', ['Coletivo', 'Igualitário', 'Acessível']],
};

const horaSP = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium',
});
const diaSP = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }); // AAAA-MM-DD
const carimboSP = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium',
}); // AAAA-MM-DD HH:MM:SS, para o nome do PDF

/* ---------- limpeza do que chega ---------- */

function texto(v, max) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function arquetipo(v) {
  if (!v || typeof v !== 'object' || !Object.hasOwn(ARQUETIPOS, v.chave)) return null;
  const variacao = ARQUETIPOS[v.chave][1].includes(v.variacao) ? v.variacao : null;
  return { chave: v.chave, variacao };
}

/* Placar como [[chave, total], ...] na ordem da tela (maior primeiro, empate na ordem do teste). */
function placar(v) {
  if (!Array.isArray(v) || v.length !== 12) return null;
  const vistos = new Set();
  for (const item of v) {
    if (!Array.isArray(item) || item.length !== 2) return null;
    const [k, t] = item;
    if (!Object.hasOwn(ARQUETIPOS, k) || vistos.has(k) || !Number.isInteger(t) || t < 0 || t > 1000) return null;
    vistos.add(k);
  }
  return v.map(([k, t]) => [k, t]);
}

function pdf(v) {
  if (typeof v !== 'string' || !v) return null;
  const buf = Buffer.from(v, 'base64');
  if (buf.length < 100 || buf.length > LIMITE_PDF || buf.subarray(0, 5).toString('latin1') !== '%PDF-') return null;
  return buf;
}

function limpar(b) {
  if (!b || typeof b !== 'object') return null;
  if (!/^[A-Za-z0-9-]{8,64}$/.test(b.resposta_id || '')) return null;
  const u = b.usuario && typeof b.usuario === 'object' ? b.usuario : {};
  const nome = texto(u.nome, 120);
  if (!nome) return null;
  const respostas = b.respostas;
  if (!Array.isArray(respostas) || respostas.length < 12 || respostas.length > 120 ||
      !respostas.every((x) => Number.isInteger(x) && x >= 0 && x <= 3)) return null;
  const r = b.resultado && typeof b.resultado === 'object' ? b.resultado : {};
  const principal = arquetipo(r.principal), apoio = arquetipo(r.apoio), pl = placar(r.placar);
  if (!principal || !apoio || !pl || principal.chave === apoio.chave) return null;
  return {
    resposta_id: b.resposta_id,
    versao: texto(b.versao, 20),
    usuario: {
      nome,
      cidade: texto(u.cidade, 120),
      data: /^\d{4}-\d{2}-\d{2}$/.test(u.data || '') ? u.data : '',
    },
    respostas,
    resultado: { principal, apoio, placar: pl },
  };
}

/* ---------- arquivo ---------- */

/* Uma linha por resultado, com fsync: resposta perdida não volta. */
function gravar(arquivo, registro) {
  const fd = fs.openSync(arquivo, 'a', 0o600);
  try {
    fs.writeSync(fd, JSON.stringify(registro) + '\n');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function gravarPdf(pasta, nome, buf) {
  fs.mkdirSync(pasta, { recursive: true, mode: 0o700 });
  const final = path.join(pasta, nome);
  const tmp = final + '.tmp';
  fs.writeFileSync(tmp, buf, { mode: 0o600 });
  fs.renameSync(tmp, final);
}

function lerIds(arquivo) {
  let bruto = '';
  try { bruto = fs.readFileSync(arquivo, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const ids = [];
  for (const linha of bruto.split('\n')) {
    if (!linha.trim()) continue;
    try { ids.push(JSON.parse(linha).resposta_id); } catch { /* linha cortada: ignora */ }
  }
  return ids;
}

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'sem-nome';
}

/* ---------- aviso no WhatsApp ---------- */

function juntar(xs) {
  return xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' e ' + xs[xs.length - 1];
}

function legenda(reg, teste) {
  const { principal: P, apoio: A, placar: pl } = reg.resultado;
  const total = Object.fromEntries(pl);
  const nome = (k) => ARQUETIPOS[k][0];
  const linha = (rotulo, x) => rotulo + ': ' + nome(x.chave) + (x.variacao ? ' · ' + x.variacao : '') + ' (' + total[x.chave] + ')';
  const out = [];
  if (teste) out.push('[TESTE]');
  out.push('*Teste de Arquétipo respondido*');
  out.push([reg.usuario.nome, reg.usuario.cidade].filter(Boolean).join(' · '));
  out.push(linha('Principal', P));
  out.push(linha('Apoio', A));
  const topo = pl.filter(([, t]) => t === total[P.chave]).map(([k]) => nome(k));
  if (topo.length > 1) {
    out.push('Empate em ' + total[P.chave] + ': ' + juntar(topo) + '. O PDF põe o primeiro na frente só pela ordem do teste.');
  } else {
    const segundo = pl.filter(([k, t]) => k !== P.chave && t === total[A.chave]).map(([k]) => nome(k));
    if (segundo.length > 1) out.push('Apoio empatado em ' + total[A.chave] + ': ' + juntar(segundo) + '.');
  }
  return out.join('\n');
}

const cota = { dia: '', n: 0 };
function dentroDaCota() {
  const hoje = diaSP.format(new Date());
  if (cota.dia !== hoje) { cota.dia = hoje; cota.n = 0; }
  cota.n += 1;
  return cota.n <= AVISOS_POR_DIA;
}

async function evolution(rota, corpo) {
  const r = await fetch(EVO.url + rota + '/' + encodeURIComponent(EVO.instancia), {
    method: 'POST',
    headers: { apikey: EVO.token, 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(60_000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error('HTTP ' + r.status + ' ' + JSON.stringify(j).slice(0, 200)), { http: r.status });
  return (j && j.key && j.key.id) || '';
}

function enviar(para, reg, teste, pdfBuf) {
  const texto = legenda(reg, teste);
  if (!pdfBuf) return evolution('/message/sendText', { number: para, text: texto + '\n(sem PDF)' });
  const arquivo = 'Teste de Arquétipo - ' + reg.usuario.nome.replace(/[\\/:*?"<>|]+/g, '').trim() + '.pdf';
  return evolution('/message/sendMedia', {
    number: para, mediatype: 'document', mimetype: 'application/pdf',
    fileName: arquivo, caption: texto, media: pdfBuf.toString('base64'),
  });
}

/* Roda depois da resposta HTTP: o membro não espera o WhatsApp. Cada tentativa vira uma
   linha em avisos.jsonl, que é onde se confere se o aviso saiu. */
function avisar(reg, teste, pdfBuf) {
  const lista = teste ? AVISAR_TESTE : AVISAR;
  const base = { resposta_id: reg.resposta_id, teste };
  if (!lista.length) return;
  if (!EVO.url || !EVO.token) { gravar(ARQ.avisos, { ...base, em: new Date().toISOString(), erro: 'sem-config' }); return; }
  if (!dentroDaCota()) { gravar(ARQ.avisos, { ...base, em: new Date().toISOString(), erro: 'cota-do-dia' }); return; }
  for (const para of lista) {
    const tentar = (n) => enviar(para, reg, teste, pdfBuf).then((id) => {
      gravar(ARQ.avisos, { ...base, para, tentativa: n + 1, em: new Date().toISOString(), key_id: id });
      console.log(new Date().toISOString(), 'aviso ok', reg.resposta_id, id);
    }).catch((e) => {
      gravar(ARQ.avisos, { ...base, para, tentativa: n + 1, em: new Date().toISOString(), erro: String(e.message || e).slice(0, 300) });
      console.error(new Date().toISOString(), 'aviso falhou', reg.resposta_id, n + 1, e.message);
      const definitivo = e.http && e.http >= 400 && e.http < 500 && e.http !== 429;
      if (!definitivo && n < ESPERAS.length) setTimeout(() => tentar(n + 1), ESPERAS[n]).unref();
    });
    tentar(0);
  }
}

/* ---------- HTTP ---------- */

function json(res, status, corpo) {
  const s = JSON.stringify(corpo);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(s),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow',
  });
  res.end(s);
}

function corpo(req) {
  return new Promise((ok, falha) => {
    let tam = 0;
    const partes = [];
    req.on('data', (c) => {
      tam += c.length;
      if (tam > LIMITE_CORPO) { falha(Object.assign(new Error('grande'), { status: 413 })); req.destroy(); return; }
      partes.push(c);
    });
    req.on('end', () => ok(Buffer.concat(partes).toString('utf8')));
    req.on('error', falha);
  });
}

/* Freio contra enxurrada: um membro manda um resultado a cada 15 minutos de teste. */
const janela = { inicio: Date.now(), n: 0 };
function dentroDoLimite() {
  const agora = Date.now();
  if (agora - janela.inicio > 60_000) { janela.inicio = agora; janela.n = 0; }
  janela.n += 1;
  return janela.n <= 30;
}

const vistos = new Set();

async function rotear(req, res) {
  const url = new URL(req.url, 'http://local');
  const p = url.pathname.replace(/\/+$/, '');

  if (p === '/api/arquetipo/saude' && (req.method === 'GET' || req.method === 'HEAD')) {
    return json(res, 200, { ok: true });
  }

  if (p === '/api/arquetipo/respostas' && req.method === 'POST') {
    const origem = req.headers.origin;
    if (origem && !ORIGENS.has(origem)) return json(res, 403, { ok: false, erro: 'origem' });
    if (!dentroDoLimite()) return json(res, 429, { ok: false, erro: 'limite' });

    let b;
    try { b = JSON.parse(await corpo(req)); } catch (e) {
      return json(res, e.status || 400, { ok: false, erro: e.status === 413 ? 'grande' : 'json' });
    }

    const r = limpar(b);
    if (!r) return json(res, 422, { ok: false, erro: 'dados' });
    // a página reenvia quando não viu a confirmação; o mesmo id não grava nem avisa de novo
    if (vistos.has(r.resposta_id)) return json(res, 200, { ok: true, id: r.resposta_id, repetido: true });
    vistos.add(r.resposta_id);

    const teste = b.teste === true;
    const agora = new Date();
    const pdfBuf = pdf(b.pdf);
    const pasta = teste ? PASTA_PDF.testes : PASTA_PDF.respostas;
    let arquivo = null, reg;
    try {
      if (pdfBuf) {
        const quando = carimboSP.format(agora).replace(' ', '_').replace(/:/g, '');
        arquivo = quando + '_' + slug(r.usuario.nome) + '_' + r.resposta_id.slice(0, 8) + '.pdf';
        gravarPdf(pasta, arquivo, pdfBuf);
      }
      reg = {
        ...r,
        pdf: arquivo ? path.basename(pasta) + '/' + arquivo : null,
        pdf_sha256: pdfBuf ? crypto.createHash('sha256').update(pdfBuf).digest('hex') : null,
        recebido_em: agora.toISOString(),
        recebido_sp: horaSP.format(agora),
      };
      gravar(teste ? ARQ.testes : ARQ.respostas, reg);
    } catch (e) {
      vistos.delete(r.resposta_id); // não gravou: a página pode tentar de novo
      throw e;
    }
    console.log(agora.toISOString(), teste ? 'teste' : 'resposta', r.resposta_id, pdfBuf ? 'com pdf' : 'sem pdf');
    json(res, 201, { ok: true, id: r.resposta_id, recebido_em: reg.recebido_em });
    avisar(reg, teste, pdfBuf);
    return;
  }

  return json(res, 404, { ok: false, erro: 'rota' });
}

fs.mkdirSync(DATA_DIR, { recursive: true });
for (const id of [...lerIds(ARQ.respostas), ...lerIds(ARQ.testes)]) vistos.add(id);

const server = http.createServer((req, res) => {
  rotear(req, res).catch((e) => {
    console.error(new Date().toISOString(), 'erro', (e && e.stack) || e);
    if (!res.headersSent) json(res, 500, { ok: false, erro: 'interno' });
    else res.end();
  });
});
server.requestTimeout = 30_000;
server.listen(PORT, () => console.log(`teste-arquetipo ouvindo na porta ${PORT}; dados em ${DATA_DIR}; avisos para ${AVISAR.length} destino(s)`));

for (const sinal of ['SIGTERM', 'SIGINT']) {
  process.on(sinal, () => server.close(() => process.exit(0)));
}
