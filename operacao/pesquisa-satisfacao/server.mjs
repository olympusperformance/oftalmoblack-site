// Pesquisa de satisfação da Imersão Grau Zero e do Club OftalmoBlack (out/2026).
//
// Recebe as respostas da página /imersaograuzero/pesquisa/ e entrega os dados ao
// painel /imersaograuzero/pesquisa/resultados/. Node puro, sem dependências: cada
// resposta vira uma linha JSON em DATA_DIR. Roda como serviço Swarm
// `pesquisa-satisfacao` na VPS, e o Traefik manda /api/pesquisa/ para cá
// (ver traefik.json e implantar.sh nesta pasta).
//
// Rotas:
//   POST /api/pesquisa/respostas   público; grava uma resposta (teste:true vai para testes.jsonl)
//   GET  /api/pesquisa/resultados  com "Authorization: Bearer <CHAVE_PAINEL>"; ?fonte=testes lê os testes
//   GET  /api/pesquisa/saude       sinal de vida, sem dados

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || '/data';
const CHAVE = process.env.CHAVE_PAINEL || '';
const ORIGENS = new Set(
  (process.env.ORIGENS || 'https://oftalmoblack.com.br,https://www.oftalmoblack.com.br')
    .split(',').map((s) => s.trim()).filter(Boolean)
);
const LIMITE_CORPO = 32 * 1024;

const ARQ = {
  respostas: path.join(DATA_DIR, 'respostas.jsonl'),
  testes: path.join(DATA_DIR, 'testes.jsonl'),
  descartadas: path.join(DATA_DIR, 'descartadas.jsonl'),
};

const PERFIS = new Set(['mestre', 'equipe', 'participante', 'acompanhante', 'patrocinador']);
const CHAVE_RE = /^[a-z0-9_]{1,40}$/;

const horaSP = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'medium',
});

/* ---------- limpeza do que chega ---------- */

function texto(v, max) {
  return typeof v === 'string' ? v.replace(/\u0000/g, '').trim().slice(0, max) : '';
}

function inteiro(v, min, max) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function lista(v, max, re = CHAVE_RE) {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((x) => typeof x === 'string' && re.test(x)))].slice(0, max);
}

/* Notas de 1 a 5 por item. A chave do item vem da página: o servidor só exige
   o formato, para a página poder ganhar ou perder item sem reimplantar aqui. */
function notas(v) {
  const o = {};
  if (!v || typeof v !== 'object' || Array.isArray(v)) return o;
  for (const [k, x] of Object.entries(v).slice(0, 40)) {
    const n = inteiro(x, 1, 5);
    if (CHAVE_RE.test(k) && n !== null) o[k] = n;
  }
  return o;
}

function limpar(b) {
  if (!b || typeof b !== 'object' || !PERFIS.has(b.perfil)) return null;
  const utm = {};
  if (b.utm && typeof b.utm === 'object') {
    for (const k of ['source', 'medium', 'campaign', 'content', 'term']) {
      const s = texto(b.utm[k], 80);
      if (s) utm[k] = s;
    }
  }
  return {
    resposta_id: /^[A-Za-z0-9-]{8,64}$/.test(b.resposta_id || '') ? b.resposta_id : crypto.randomUUID(),
    perfil: b.perfil,
    dias: lista(b.dias, 3, /^(22|23|24)$/),
    nps_evento: inteiro(b.nps_evento, 0, 10),
    notas_evento: notas(b.notas_evento),
    notas_aulas: notas(b.notas_aulas),
    aulas_top: lista(b.aulas_top, 3), // versão de antes das estrelas por palestra (aba aberta antes de 24/10 à tarde)
    preparo_mgz: inteiro(b.preparo_mgz, 1, 5),
    ponto_alto: texto(b.ponto_alto, 2000),
    melhorar_evento: texto(b.melhorar_evento, 2000),
    patrocinaria: ['sim', 'talvez', 'nao'].includes(b.patrocinaria) ? b.patrocinaria : null,
    nps_club: inteiro(b.nps_club, 0, 10),
    notas_club: notas(b.notas_club),
    valoriza_club: texto(b.valoriza_club, 2000),
    melhorar_club: texto(b.melhorar_club, 2000),
    /* Anônima desde 24/10: nome, WhatsApp e pedido de contato não são gravados
       nem se uma aba antiga da página ainda os mandar. */
    utm,
    ref: texto(b.ref, 200),
    versao: texto(b.versao, 20),
    duracao_s: inteiro(b.duracao_s, 0, 86400),
  };
}

/* ---------- arquivo ---------- */

/* Uma linha por resposta, com fsync: perder resposta de evento não tem volta. */
function gravar(arquivo, registro) {
  const fd = fs.openSync(arquivo, 'a', 0o600);
  try {
    fs.writeSync(fd, JSON.stringify(registro) + '\n');
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function ler(arquivo) {
  let bruto = '';
  try { bruto = fs.readFileSync(arquivo, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const out = [];
  for (const linha of bruto.split('\n')) {
    if (!linha.trim()) continue;
    try { out.push(JSON.parse(linha)); } catch { /* linha cortada: ignora */ }
  }
  return out;
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

function autorizado(req) {
  if (!CHAVE) return false;
  const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
  if (!m) return false;
  const a = crypto.createHash('sha256').update(m[1].trim()).digest();
  const b = crypto.createHash('sha256').update(CHAVE).digest();
  return crypto.timingSafeEqual(a, b);
}

/* Freio contra enxurrada. No evento todo mundo divide o mesmo Wi-Fi e o mesmo
   proxy na frente, então o limite é por minuto e folgado, não por pessoa. */
const janela = { inicio: Date.now(), n: 0 };
function dentroDoLimite() {
  const agora = Date.now();
  if (agora - janela.inicio > 60_000) { janela.inicio = agora; janela.n = 0; }
  janela.n += 1;
  return janela.n <= 600;
}

async function rotear(req, res) {
  const url = new URL(req.url, 'http://local');
  const p = url.pathname.replace(/\/+$/, '');

  if (p === '/api/pesquisa/saude' && (req.method === 'GET' || req.method === 'HEAD')) {
    return json(res, 200, { ok: true });
  }

  if (p === '/api/pesquisa/respostas' && req.method === 'POST') {
    const origem = req.headers.origin;
    if (origem && !ORIGENS.has(origem)) return json(res, 403, { ok: false, erro: 'origem' });
    if (!dentroDoLimite()) return json(res, 429, { ok: false, erro: 'limite' });

    let b;
    try { b = JSON.parse(await corpo(req)); } catch (e) {
      return json(res, e.status || 400, { ok: false, erro: e.status === 413 ? 'grande' : 'json' });
    }

    const agora = new Date();
    const extra = {
      recebido_em: agora.toISOString(),
      recebido_sp: horaSP.format(agora),
    };

    /* Campo-isca invisível: gente não preenche, robô preenche. */
    if (texto(b && b.site, 200)) {
      gravar(ARQ.descartadas, { ...extra, motivo: 'isca' });
      return json(res, 201, { ok: true });
    }

    const r = limpar(b);
    if (!r) return json(res, 422, { ok: false, erro: 'perfil' });

    const teste = b.teste === true;
    gravar(teste ? ARQ.testes : ARQ.respostas, { ...r, ...extra });
    console.log(agora.toISOString(), teste ? 'teste' : 'resposta', r.perfil, r.resposta_id);
    return json(res, 201, { ok: true, id: r.resposta_id, recebido_em: extra.recebido_em });
  }

  if (p === '/api/pesquisa/resultados' && req.method === 'GET') {
    if (!autorizado(req)) return json(res, 401, { ok: false, erro: 'chave' });
    const fonte = url.searchParams.get('fonte') === 'testes' ? 'testes' : 'respostas';
    const respostas = ler(ARQ[fonte]);
    return json(res, 200, { ok: true, fonte, total: respostas.length, gerado_em: new Date().toISOString(), respostas });
  }

  return json(res, 404, { ok: false, erro: 'rota' });
}

fs.mkdirSync(DATA_DIR, { recursive: true });

const server = http.createServer((req, res) => {
  rotear(req, res).catch((e) => {
    console.error(new Date().toISOString(), 'erro', (e && e.stack) || e);
    if (!res.headersSent) json(res, 500, { ok: false, erro: 'interno' });
    else res.end();
  });
});
server.requestTimeout = 15_000;
server.listen(PORT, () => console.log(`pesquisa-satisfacao ouvindo na porta ${PORT}; dados em ${DATA_DIR}`));

for (const sinal of ['SIGTERM', 'SIGINT']) {
  process.on(sinal, () => server.close(() => process.exit(0)));
}
