import { test } from "node:test";
import assert from "node:assert/strict";
import { authorized } from "../supabase/functions/cerebro-mcp/auth.mjs";
test("MCP nunca libera leitura com segredo de implantação ausente ou vazio", () => {
  for (const value of [undefined, null, "", "  "])
    for (const url of ["https://fixture.invalid", "https://fixture.invalid?k="])
      assert.equal(
        authorized(new Request(url), value, ["authorization"]),
        false,
      );
});
test("MCP preserva clientes existentes por cabeçalho ou chave de URL", () => {
  const token = "fixture-only",
    headers = ["authorization", "x-api-key"];
  assert.equal(
    authorized(
      new Request("https://fixture.invalid", {
        headers: { authorization: "Bearer fixture-only" },
      }),
      token,
      headers,
    ),
    true,
  );
  assert.equal(
    authorized(
      new Request("https://fixture.invalid", {
        headers: { "x-api-key": token },
      }),
      token,
      headers,
    ),
    true,
  );
  assert.equal(
    authorized(
      new Request("https://fixture.invalid?k=fixture-only"),
      token,
      headers,
    ),
    true,
  );
  assert.equal(
    authorized(new Request("https://fixture.invalid?k=wrong"), token, headers),
    false,
  );
  assert.equal(
    authorized(new Request("https://fixture.invalid"), token, headers),
    false,
  );
});
