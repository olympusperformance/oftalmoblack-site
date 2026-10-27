import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readProfile,
  profileTool,
} from "../supabase/functions/cerebro-mcp/profile.mjs";
function fixture(
  members = [{ id: "fixture-id", nome: "Pessoa Teste", instagram: "@teste" }],
  entries = [],
) {
  const calls = [];
  return {
    calls,
    db: {
      from(table) {
        const call = { table };
        calls.push(call);
        const q = {
          select(fields) {
            call.fields = fields;
            return q;
          },
          eq(k, v) {
            call.eq = [k, v];
            return q;
          },
          ilike(k, v) {
            call.ilike = [k, v];
            return q;
          },
          order() {
            return q;
          },
          limit(n) {
            call.limit = n;
            return Promise.resolve({
              data: table === "members" ? members : entries,
            });
          },
        };
        return q;
      },
    },
  };
}
test("perfil do Cérebro é consulta explícita; não precisa de embeddings ou paciente", async () => {
  const f = fixture(undefined, [
    {
      source_type: "imersao",
      source_at: "2026-10-23",
      data: { volume: "1 a5" },
    },
  ]);
  const r = JSON.parse(await readProfile(f.db, { mentorado: "Pessoa Teste" }));
  assert.equal(profileTool.name, "perfil_do_mentorado");
  assert.equal(r.fontes[0].source_type, "imersao");
  assert.equal(f.calls[1].eq[1], "fixture-id");
  assert.ok(!f.calls[0].fields.includes("email"));
  assert.ok(r.nota.includes("não é zero"));
});
test("nomes ambíguos pedem escolha antes de consultar fontes", async () => {
  const f = fixture([
    { nome: "Pessoa A", id: "a" },
    { nome: "Pessoa B", id: "b" },
  ]);
  assert.match(await readProfile(f.db, { mentorado: "Pessoa" }), /ambíguo/);
  assert.equal(f.calls.length, 1);
});
test("busca inexistente não presume que cadastro local foi integrado", async () => {
  const f = fixture([]);
  assert.match(
    await readProfile(f.db, { mentorado: "Pessoa" }),
    /Não encontrei/,
  );
  assert.equal(f.calls.length, 1);
});
test("limite é restrito e curingas do nome não ampliam leitura", async () => {
  const f = fixture(
    undefined,
    Array.from({ length: 31 }, (_, i) => ({ id: i })),
  );
  const r = JSON.parse(
    await readProfile(f.db, { mentorado: "%_Pessoa", limite: 1000 }),
  );
  assert.equal(r.fontes.length, 30);
  assert.equal(r.mais_fontes, true);
  assert.equal(f.calls[0].ilike[1], "%\\%\\_Pessoa%");
  const empty = fixture();
  assert.match(await readProfile(empty.db, { mentorado: "A" }), /pelo menos/);
  assert.equal(empty.calls.length, 0);
});
