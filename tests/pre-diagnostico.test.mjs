import { test } from "node:test";
import assert from "node:assert/strict";
import {
  validateAnswers,
  createHandler,
  hash,
  VERSION,
} from "../supabase/functions/pre-diagnostico/core.mjs";

const token = "a".repeat(64),
  id = "a64582c6-721d-47dd-a3bf-712ea9fa6894";
const answers = {
  consultas: "Cerca de 200, somando as unidades",
  sdr: "acumula",
  outras_pessoas: "",
};
test("estimativas e recortes livres são preservados, branco não vira zero", () => {
  assert.deepEqual(validateAnswers(answers), {
    consultas: answers.consultas,
    sdr: "acumula",
  });
  assert.equal(
    validateAnswers({ cirurgias_indicadas: "Não sei" }).cirurgias_indicadas,
    "Não sei",
  );
  assert.equal(validateAnswers({ consultas: "0" }).consultas, "0");
});
test("recusa vazio, campos inventados, tipos, opções inválidas e texto excessivo", () => {
  for (const a of [
    {},
    { consultas: "  " },
    { member_id: id },
    { sdr: "sim" },
    { consultas: 200 },
    { agenda: "a".repeat(3001) },
    [],
  ])
    assert.throws(() => validateAnswers(a));
});
function setup(overrides = {}) {
  const calls = [];
  const handler = createHandler({
    load: async (h) => {
      calls.push(["load", h]);
      return { nome: "Pessoa Teste", version: VERSION, answers: {} };
    },
    submit: async (x) => {
      calls.push(["submit", x]);
      return { status: "created", id, created_at: "2026-10-26T00:00:00Z" };
    },
    admin: async () => false,
    issue: async () => {},
    revoke: async () => {},
    ...overrides,
  });
  const req = (body, headers = {}) =>
    handler(
      new Request("https://fixture.invalid", {
        method: "POST",
        headers: {
          origin: "https://oftalmoblack.com.br",
          "content-type": "application/json",
          ...headers,
        },
        body: JSON.stringify(body),
      }),
    );
  return { req, calls, handler };
}
test("token é validado e somente seu hash vai para persistência", async () => {
  const s = setup();
  assert.equal((await s.req({ action: "load", token: "curto" })).status, 400);
  assert.equal((await s.req({ action: "load", token })).status, 200);
  assert.equal(s.calls[0][1], await hash(token));
  assert.notEqual(s.calls[0][1], token);
});
test("envio deriva vínculo no banco, congela versão e confirma apenas persistência", async () => {
  const s = setup();
  const res = await s.req({
    action: "submit",
    token,
    submission_id: id,
    version: VERSION,
    answers,
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).id, id);
  assert.equal(s.calls[0][1].p_token_hash, await hash(token));
  assert.equal(s.calls[0][1].p_answers.consultas, answers.consultas);
  assert.equal(
    (
      await s.req({
        action: "submit",
        token,
        member_id: id,
        submission_id: id,
        version: VERSION,
        answers,
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await s.req({
        action: "submit",
        token,
        submission_id: id,
        version: "antiga",
        answers,
      })
    ).status,
    400,
  );
  const down = setup({
    submit: async () => {
      throw Error("segredo DB");
    },
  });
  const failed = await down.req({
    action: "submit",
    token,
    submission_id: id,
    version: VERSION,
    answers,
  });
  assert.equal(failed.status, 503);
  assert.ok(!(await failed.text()).includes("segredo DB"));
});
test("link ausente, expirado ou revogado não expõe identidade", async () => {
  const s = setup({ load: async () => null });
  const r = await s.req({ action: "load", token });
  assert.equal(r.status, 410);
  assert.ok(!(await r.text()).includes("Pessoa"));
});
test("recibos repetidos são aceitos; conflitos e limite retornam códigos próprios", async () => {
  for (const [status, code] of [
    ["duplicate", 200],
    ["conflict", 409],
    ["rate_limit", 429],
    ["invalid_link", 410],
  ]) {
    const s = setup({ submit: async () => ({ status, id }) });
    assert.equal(
      (
        await s.req({
          action: "submit",
          token,
          submission_id: id,
          version: VERSION,
          answers,
        })
      ).status,
      code,
    );
  }
});
test("operações administrativas exigem autorização servidor e não recebem token cliente", async () => {
  const s = setup();
  assert.equal((await s.req({ action: "issue", member_id: id })).status, 403);
  let issued;
  const ok = setup({
    admin: async (h) => h === "Bearer fixture",
    issue: async (x) => {
      issued = x;
    },
  });
  const r = await ok.req(
    { action: "issue", member_id: id },
    { authorization: "Bearer fixture" },
  );
  const data = await r.json();
  assert.equal(r.status, 200);
  assert.equal(data.token.length, 64);
  assert.equal(issued.token_hash, await hash(data.token));
  assert.equal(issued.member_id, id);
});
test("CORS, limites de corpo e cache não deixam dados públicos", async () => {
  const s = setup();
  assert.equal(
    (await s.req({ action: "load", token }, { origin: "https://evil.invalid" }))
      .status,
    403,
  );
  assert.equal(
    (
      await s.req({
        action: "submit",
        token,
        answers: { agenda: "x".repeat(40000) },
      })
    ).status,
    413,
  );
  const r = await s.req({ action: "load", token });
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.equal(
    (await s.handler(new Request("https://fixture.invalid", { method: "GET" })))
      .status,
    405,
  );
});
