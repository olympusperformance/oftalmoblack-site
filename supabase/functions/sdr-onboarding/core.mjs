export const VERSION = "sdr-onboarding-v1";
export const FIELDS = {
  canal_principal: null,
  canais_adicionais: null,
  equipe_papeis: null,
  horario_equipe: null,
  horario_assistente: null,
  posse_conversa: null,
  mensagem_automatica: null,
  pacientes_existentes: null,
  unidades: null,
  servicos_consulta: null,
  agenda_grade: null,
  agenda_confirmacao: null,
  teleconsulta: null,
  preco_cirurgia: null,
  outros_servicos: null,
  convenios: null,
  plano_suspenso: null,
  plano_nao_coberto: null,
  pagamento_consulta: null,
  sinal: null,
  nome_assistente: null,
  tom: null,
  informacoes_aprovadas: null,
  perguntas_frequentes: null,
  audio_imagem: null,
  limites_humano: null,
  followup_regras: null,
  followup_atual: null,
  origens: null,
  testadores: null,
  cenarios: null,
  observacoes: null,
  responsavel: null,
};
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const origins = new Set([
  "https://oftalmoblack.com.br",
  "https://www.oftalmoblack.com.br",
]);
export async function hash(value) {
  return [
    ...new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export function validateAnswers(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw Error("answers");
  const out = {};
  for (const key of Object.keys(input))
    if (!Object.hasOwn(FIELDS, key)) throw Error("field");
  for (const [key, choices] of Object.entries(FIELDS)) {
    const value = input[key];
    if (value == null || value === "") continue;
    if (typeof value !== "string" || value.length > 3000) throw Error("answer");
    const clean = value.trim();
    if (!clean) continue;
    if (choices && !choices.includes(clean)) throw Error("choice");
    out[key] = clean;
  }
  if (!Object.keys(out).length) throw Error("empty");
  return out;
}
export function createHandler({ load, submit, admin, issue, revoke }) {
  return async (req) => {
    const origin = req.headers.get("origin");
    const headers = {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      vary: "Origin",
      "access-control-allow-headers": "authorization, apikey, content-type",
      "access-control-allow-methods": "POST, OPTIONS",
    };
    if (origin && origins.has(origin))
      headers["access-control-allow-origin"] = origin;
    const reply = (status, body) =>
      new Response(JSON.stringify(body), { status, headers });
    if (origin && !origins.has(origin))
      return reply(403, { error: "Origem não permitida." });
    if (req.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (req.method !== "POST")
      return reply(405, { error: "Método não permitido." });
    // Read at most 32 KiB, including requests without Content-Length.
    const chunks = [];
    let size = 0;
    const reader = req.body?.getReader();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 32768) {
          await reader.cancel();
          return reply(413, { error: "Resposta muito longa." });
        }
        chunks.push(value);
      }
    }
    let body;
    try {
      const bytes = new Uint8Array(size);
      let pos = 0;
      for (const c of chunks) {
        bytes.set(c, pos);
        pos += c.length;
      }
      body = JSON.parse(new TextDecoder().decode(bytes));
      if (!body || Array.isArray(body) || typeof body !== "object")
        throw Error();
    } catch {
      return reply(400, { error: "Dados inválidos." });
    }
    const allowed = {
      load: ["action", "token"],
      submit: ["action", "token", "submission_id", "version", "answers"],
      issue: ["action", "member_id"],
      revoke: ["action", "link_id"],
    }[body.action];
    if (!allowed || Object.keys(body).some((k) => !allowed.includes(k)))
      return reply(400, { error: "Dados inválidos." });
    try {
      if (body.action === "issue" || body.action === "revoke") {
        const actor = await admin(req.headers.get("authorization") || "");
        if (!actor) return reply(403, { error: "Acesso restrito à equipe." });
        if (body.action === "revoke") {
          if (!uuid.test(body.link_id || ""))
            return reply(400, { error: "Link inválido." });
          await revoke(body.link_id);
          return reply(200, { ok: true });
        }
        if (!uuid.test(body.member_id || ""))
          return reply(400, { error: "Mentorado inválido." });
        const token = [...crypto.getRandomValues(new Uint8Array(32))]
          .map((x) => x.toString(16).padStart(2, "0"))
          .join("");
        const expires_at = new Date(Date.now() + 30 * 86400000).toISOString();
        await issue({
          member_id: body.member_id,
          token_hash: await hash(token),
          version: VERSION,
          expires_at,
          issued_by: typeof actor === "string" ? actor : null,
        });
        return reply(200, { ok: true, token, expires_at });
      }
      if (!/^[a-f0-9]{64}$/.test(body.token || ""))
        return reply(400, { error: "Link inválido." });
      const tokenHash = await hash(body.token);
      if (body.action === "load") {
        const data = await load(tokenHash);
        return data
          ? reply(200, data)
          : reply(410, {
              error:
                "Este link expirou ou foi encerrado. Peça um novo link à equipe.",
            });
      }
      let answers;
      try {
        if (body.version !== VERSION || !uuid.test(body.submission_id || ""))
          throw Error();
        answers = validateAnswers(body.answers);
      } catch {
        return reply(400, {
          error: "Confira as respostas. Preencha ao menos uma pergunta.",
        });
      }
      const result = await submit({
        p_token_hash: tokenHash,
        p_submission_id: body.submission_id,
        p_version: VERSION,
        p_answers: answers,
        p_content_hash: await hash(JSON.stringify(answers)),
      });
      const status = {
        created: 200,
        duplicate: 200,
        conflict: 409,
        rate_limit: 429,
        invalid_link: 410,
      }[result?.status];
      if (!status) throw Error("storage");
      if (status !== 200)
        return reply(status, {
          error:
            status === 409
              ? "Este envio já foi registrado com outro conteúdo. Recarregue para complementar."
              : status === 429
                ? "Muitos envios em sequência. Aguarde um pouco."
                : "Este link expirou ou foi encerrado.",
        });
      return reply(200, {
        ok: true,
        id: result.id,
        created_at: result.created_at,
      });
    } catch {
      return reply(503, {
        error:
          "Não foi possível salvar agora. Suas respostas continuam na tela. Tente novamente.",
      });
    }
  };
}
