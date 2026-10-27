// npm install --no-save --package-lock=false --ignore-scripts @electric-sql/pglite@0.5.12
// Runs real Postgres in memory; no remote project or patient/member data.
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { test, after } from "node:test";
import assert from "node:assert/strict";
const db = await PGlite.create();
after(() => db.close());
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
create schema auth;create table auth.users(id uuid primary key);
create table public.members(id uuid primary key,nome text not null);
create function public.is_admin() returns boolean language sql stable as $$ select coalesce(current_setting('test.admin',true),'false')='true' $$;
grant usage on schema public to anon,authenticated,service_role;
grant select on public.members to service_role;`);
await db.exec(
  await readFile(
    new URL(
      "../supabase/migrations/20261027032839_member_pre_diagnostico.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
const memberA = "00000000-0000-4000-8000-000000000001",
  memberB = "00000000-0000-4000-8000-000000000002";
await db.query("insert into public.members values ($1,$2),($3,$4)", [
  memberA,
  "Pessoa A",
  memberB,
  "Pessoa B",
]);
async function role(name, admin, fn) {
  return db.transaction(async (tx) => {
    await tx.exec(
      `set local role ${name};select set_config('test.admin','${admin}',true);`,
    );
    return fn(tx);
  });
}
const tokenA = "a".repeat(64),
  tokenB = "b".repeat(64),
  contentHash = "c".repeat(64);
await db.query(
  `insert into public.member_intake_links(member_id,token_hash,version,expires_at) values($1,$2,'pre-diagnostico-v1',now()+interval '30 days'),($3,$4,'pre-diagnostico-v1',now()+interval '30 days')`,
  [memberA, tokenA, memberB, tokenB],
);
const submit = (
  tx,
  token,
  id,
  data = { consultas: "Cerca de 200" },
  h = contentHash,
) =>
  tx
    .query(
      "select public.member_intake_submit($1,$2,'pre-diagnostico-v1',$3::jsonb,$4) as result",
      [token, id, JSON.stringify(data), h],
    )
    .then((r) => r.rows[0].result);
test("SQL: anonymous/member cannot read sources or execute token RPC; admins only read", async () => {
  await assert.rejects(
    role("anon", false, (tx) =>
      tx.query("select * from public.member_context_entries"),
    ),
    /permission denied/,
  );
  await assert.rejects(
    role("authenticated", false, (tx) =>
      tx.query("select public.member_intake_load($1)", [tokenA]),
    ),
    /permission denied/,
  );
  const rows = await role("authenticated", false, (tx) =>
    tx.query("select * from public.member_intake_links"),
  );
  assert.equal(rows.rows.length, 0);
  assert.equal(
    (
      await role("authenticated", true, (tx) =>
        tx.query("select * from public.member_intake_links"),
      )
    ).rows.length,
    2,
  );
  await assert.rejects(
    role("authenticated", true, (tx) =>
      tx.exec("delete from public.member_intake_links"),
    ),
    /permission denied/,
  );
});
test("SQL: token determines member; ACK creates one immutable context entry", async () => {
  const id = "10000000-0000-4000-8000-000000000001";
  assert.equal(
    (await role("service_role", false, (tx) => submit(tx, tokenA, id))).status,
    "created",
  );
  assert.equal(
    (await role("service_role", false, (tx) => submit(tx, tokenA, id))).status,
    "duplicate",
  );
  assert.equal(
    (
      await role("service_role", false, (tx) =>
        submit(tx, tokenA, id, { consultas: "300" }),
      )
    ).status,
    "conflict",
  );
  assert.equal(
    (await role("service_role", false, (tx) => submit(tx, tokenB, id))).status,
    "conflict",
  );
  const rows = await db.query(
    "select member_id,data from public.member_context_entries where id=$1",
    [id],
  );
  assert.equal(rows.rows.length, 1);
  assert.equal(rows.rows[0].member_id, memberA);
  assert.equal(rows.rows[0].data.consultas, "Cerca de 200");
  await assert.rejects(
    role("authenticated", true, (tx) =>
      tx.exec("update public.member_context_entries set version=version"),
    ),
    /permission denied/,
  );
  await assert.rejects(
    role("service_role", false, (tx) =>
      tx.exec("update public.member_context_entries set version=version"),
    ),
    /permission denied/,
  );
  await assert.rejects(
    role("service_role", false, (tx) =>
      tx.exec("delete from public.member_context_entries"),
    ),
    /permission denied/,
  );
  await assert.rejects(
    role("service_role", false, (tx) =>
      tx.exec("truncate public.member_context_entries"),
    ),
    /permission denied/,
  );
  assert.equal(
    (
      await role("authenticated", false, (tx) =>
        tx.query("select * from public.member_context_entries"),
      )
    ).rows.length,
    0,
  );
});
test("SQL: invalid/expired/revoked links reject without exposing member", async () => {
  assert.equal(
    (
      await role("service_role", false, (tx) =>
        tx.query("select public.member_intake_load($1) as result", [
          "d".repeat(64),
        ]),
      )
    ).rows[0].result,
    null,
  );
  const id = "10000000-0000-4000-8000-000000000002";
  await db.query(
    "update public.member_intake_links set revoked_at=now() where token_hash=$1",
    [tokenB],
  );
  assert.equal(
    (await role("service_role", false, (tx) => submit(tx, tokenB, id))).status,
    "invalid_link",
  );
  await db.query(
    "update public.member_intake_links set revoked_at=null,created_at=now()-interval '2 days',expires_at=now()-interval '1 day' where token_hash=$1",
    [tokenB],
  );
  assert.equal(
    (await role("service_role", false, (tx) => submit(tx, tokenB, id))).status,
    "invalid_link",
  );
});
test("SQL: second dated response preserves original and loads latest, not internal sources", async () => {
  const id = "10000000-0000-4000-8000-000000000003";
  await role("service_role", false, (tx) =>
    submit(tx, tokenA, id, { consultas: "210 estimadas", sistemas: "Não sei" }),
  );
  const r = await role("service_role", false, (tx) =>
    tx.query("select public.member_intake_load($1) as result", [tokenA]),
  );
  assert.equal(r.rows[0].result.answers.consultas, "210 estimadas");
  assert.deepEqual(Object.keys(r.rows[0].result).sort(), [
    "answers",
    "nome",
    "version",
  ]);
  assert.equal(
    (
      await db.query(
        "select * from public.member_context_entries where member_id=$1",
        [memberA],
      )
    ).rows.length,
    2,
  );
});
test("SQL: durable boundary rejects unknown fields, numbers and invalid enum", async () => {
  for (const data of [
    { secret: "x" },
    { consultas: 20 },
    { sdr: "yes" },
    { trafego: "dedicada" },
    {},
  ])
    await assert.rejects(
      role("service_role", false, (tx) =>
        submit(tx, tokenA, crypto.randomUUID(), data),
      ),
    );
});
test("SQL: internal source insert is admin-only and cannot forge a form submission", async () => {
  const query =
    "insert into public.member_context_entries(member_id,source_type,source_ref,source_key,source_at,version,data) values($1,'pesquisa','Pesquisa fictícia','fixture',now(),'v1','{\"contexto\":\"exemplo\"}')";
  await assert.rejects(
    role("authenticated", false, (tx) => tx.query(query, [memberA])),
    /row-level security/,
  );
  await role("authenticated", true, (tx) => tx.query(query, [memberA]));
  await assert.rejects(
    role("authenticated", true, (tx) =>
      tx.query(
        query
          .replace("'pesquisa'", "'pre_diagnostico'")
          .replace("'fixture'", "'forged'"),
        [memberA],
      ),
    ),
  );
});
test("SQL: member rate limit is durable and repeated receipt still succeeds", async () => {
  for (let i = 0; i < 8; i++)
    assert.equal(
      (
        await role("service_role", false, (tx) =>
          submit(tx, tokenA, crypto.randomUUID()),
        )
      ).status,
      "created",
    );
  assert.equal(
    (
      await role("service_role", false, (tx) =>
        submit(tx, tokenA, crypto.randomUUID()),
      )
    ).status,
    "rate_limit",
  );
  assert.equal(
    (
      await role("service_role", false, (tx) =>
        submit(tx, tokenA, "10000000-0000-4000-8000-000000000001"),
      )
    ).status,
    "duplicate",
  );
});
