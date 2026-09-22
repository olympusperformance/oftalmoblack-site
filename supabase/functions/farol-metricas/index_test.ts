import { handleFarol } from "./index.ts";
const assert = (value: unknown) => { if (!value) throw new Error("assertion failed"); };
const assertEquals = (actual: unknown, expected: unknown) => {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const MEMBER = "11111111-1111-4111-8111-111111111111";
const CLINIC = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";
const originalFetch = globalThis.fetch;

function answer(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers:{ "Content-Type":"application/json" } });
}
function fakeApi(options: { admin?: boolean; member?: boolean; linked?: boolean; badFunnel?: boolean } = {}) {
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push(url.host + url.pathname);
    if (url.pathname === "/auth/v1/user") return answer({ id:USER, aud:"authenticated", role:"authenticated", email:"admin@example.com", app_metadata:{}, user_metadata:{} });
    if (url.pathname === "/rest/v1/rpc/is_admin") return answer(options.admin !== false);
    if (url.pathname === "/rest/v1/members") return answer(options.member === false ? null : { id:MEMBER, ativo:true });
    if (url.pathname === "/rest/v1/rpc/cerebro_clinica_do_membro") return answer(options.linked === false ? [] : [{ clinic_id:CLINIC, clinica:"Clínica teste" }]);
    if (url.pathname === "/rest/v1/clinics") return answer({ id:CLINIC, name:"Clínica teste", timezone:"America/Sao_Paulo" });
    if (url.pathname === "/rest/v1/rpc/get_funil_metrics") return answer(options.badFunnel ? {} : {
      periodo:{ novos:5, agendadas:4, realizadas:3, indicacoes:2, cirurgias:1, perdidos:0 },
      anterior:{ novos:2, agendadas:1, realizadas:0, indicacoes:0, cirurgias:0, perdidos:0 },
      trilha_desde:"2026-01-01T00:00:00Z", dados_desde:"2026-01-01T00:00:00Z", patient_name:"NÃO ENVIAR",
    });
    if (url.pathname === "/rest/v1/rpc/get_period_commercial_revenue") return answer({
      total:1200, count:3, missing_price_count:1, groups:[{ kind:"consulta", amount:1200, count:3, missing_price_count:1, patient_name:"NÃO ENVIAR" }], patient_name:"NÃO ENVIAR",
    });
    if (url.pathname === "/rest/v1/rpc/get_period_revenue") {
      const body = JSON.parse(String(init?.body || "{}"));
      return answer({ access:true, basis:body.p_basis, currency:"BRL", current:{ amount:600, record_count:1,
        groups:[{ key:"consultations", amount:600, record_count:1, patient_name:"NÃO ENVIAR" }] },
        previous:{ amount:0, record_count:0, groups:[] }, processor_receivable_amount:0,
        processor_receivable_count:0, other_currency_count:0, history_record_count:0, patient_name:"NÃO ENVIAR" });
    }
    throw new Error("Unexpected request: " + url.pathname);
  };
  return calls;
}
function env() {
  Deno.env.set("SUPABASE_URL", "https://site.test");
  Deno.env.set("SUPABASE_ANON_KEY", "site-anon");
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "site-service");
  Deno.env.set("CRM_URL", "https://crm.test");
  Deno.env.set("CRM_KEY", "crm-service");
}
function request(body: unknown, token = "valid") {
  return new Request("https://site.test/functions/v1/farol-metricas", {
    method:"POST", headers:token ? { Authorization:"Bearer " + token, "Content-Type":"application/json" } : { "Content-Type":"application/json" },
    body:JSON.stringify(body),
  });
}

Deno.test("nega anônimo e não consulta fontes", async () => {
  env(); const calls = fakeApi();
  try {
    const response = await handleFarol(request({ member_id:MEMBER, days:30 }, ""));
    assertEquals(response.status, 401); assertEquals(calls, []);
  } finally { globalThis.fetch = originalFetch; }
});

Deno.test("nega não admin antes de consultar membro ou CRM", async () => {
  env(); const calls = fakeApi({ admin:false });
  try {
    const response = await handleFarol(request({ member_id:MEMBER, days:30 }));
    assertEquals(response.status, 403);
    assert(!calls.some((call) => call.includes("/members") || call.startsWith("crm.test")));
  } finally { globalThis.fetch = originalFetch; }
});

Deno.test("valida payload e membro ativo", async () => {
  env(); const calls = fakeApi({ member:false });
  try {
    assertEquals((await handleFarol(request({ member_id:"not-uuid", days:30 }))).status, 400);
    assertEquals((await handleFarol(request({ member_id:MEMBER, days:30 }))).status, 404);
    assert(!calls.some((call) => call.startsWith("crm.test")));
  } finally { globalThis.fetch = originalFetch; }
});

Deno.test("sem vínculo devolve fontes independentes sem tocar CRM", async () => {
  env(); const calls = fakeApi({ linked:false });
  try {
    const response = await handleFarol(request({ member_id:MEMBER, days:7 }));
    const data = await response.json();
    assertEquals(response.status, 200); assertEquals(data.status, "unlinked");
    assertEquals(data.clinic, null); assertEquals(data.member_id, MEMBER);
    assert(!calls.some((call) => call.startsWith("crm.test")));
  } finally { globalThis.fetch = originalFetch; }
});

Deno.test("normaliza fonte inválida como parcial e remove dados não autorizados", async () => {
  env(); fakeApi({ badFunnel:true });
  try {
    const response = await handleFarol(request({ member_id:MEMBER, days:30 }));
    const data = await response.json();
    assertEquals(response.status, 200); assertEquals(data.status, "partial");
    assertEquals(data.funnel.status, "error"); assertEquals(data.funnel.data, null);
    assertEquals(data.commercial.data.total, 1200);
    assert(!JSON.stringify(data).includes("NÃO ENVIAR"));
    assertEquals(data.clinic.timezone, "America/Sao_Paulo");
    assertEquals(data.period.days, 30);
    const localStart = new Intl.DateTimeFormat("en-GB", { timeZone:"America/Sao_Paulo", hour:"2-digit", minute:"2-digit", hourCycle:"h23" }).format(new Date(data.period.start));
    assertEquals(localStart, "00:00");
    assertEquals(data.period.date_end, new Intl.DateTimeFormat("en-CA", { timeZone:"America/Sao_Paulo", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date()));
  } finally { globalThis.fetch = originalFetch; }
});
