import { handleFarol } from "../supabase/functions/farol-metricas/index.ts";

const OWN = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const USER = "33333333-3333-4333-8333-333333333333";

Deno.test("Farol libera o próprio mentorado e bloqueia outro antes da service role", async () => {
  const oldFetch = globalThis.fetch;
  const keys = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "CRM_URL", "CRM_KEY"];
  const previous = keys.map((key) => Deno.env.get(key));
  const values = ["https://site.test", "anon-test", "service-test", "https://crm.test", "crm-test"];
  keys.forEach((key, i) => Deno.env.set(key, values[i]));
  let isAdmin = false;
  const serviceReads = { count: 0 };
  const readCount = () => serviceReads.count;
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof Request ? input.url : input.toString());
    const headers = new Headers(init?.headers);
    const service = headers.get("apikey") === "service-test";
    let body: unknown;
    if (url.pathname === "/auth/v1/user") body = { id: USER, email: "member@test.local" };
    else if (url.pathname === "/rest/v1/rpc/is_admin") body = isAdmin;
    else if (url.pathname === "/rest/v1/members" && service) {
      serviceReads.count++;
      body = [{ id: url.searchParams.get("id")?.slice(3), ativo: true }];
    } else if (url.pathname === "/rest/v1/members") {
      const requested = url.searchParams.get("id")?.slice(3);
      body = requested === OWN ? [{ id: OWN }] : [];
    } else if (url.pathname === "/rest/v1/rpc/cerebro_clinica_do_membro") body = [];
    else throw new Error(`Unexpected fetch: ${url}`);
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  };
  const ask = (member_id: string) => handleFarol(new Request("https://site.test/farol", {
    method: "POST", headers: { Authorization: "Bearer valid-token", "Content-Type": "application/json" },
    body: JSON.stringify({ member_id, days: 30 }),
  }));
  try {
    const denied = await ask(OTHER);
    if (denied.status !== 403 || readCount() !== 0) throw new Error("Cross-member request reached service role");
    const own = await ask(OWN);
    if (own.status !== 200 || (await own.json()).member_id !== OWN || readCount() !== 1) throw new Error("Own member was not authorized");
    isAdmin = true;
    const admin = await ask(OTHER);
    if (admin.status !== 200 || (await admin.json()).member_id !== OTHER || readCount() !== 2) throw new Error("Admin could not open another member");
  } finally {
    globalThis.fetch = oldFetch;
    keys.forEach((key, i) => previous[i] === undefined ? Deno.env.delete(key) : Deno.env.set(key, previous[i]!));
  }
});

Deno.test("Farol resolve período explícito e 60 dias no fuso da clínica", async () => {
  const oldFetch = globalThis.fetch;
  const keys = ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "CRM_URL", "CRM_KEY"];
  const previous = keys.map((key) => Deno.env.get(key));
  const values = ["https://site.test", "anon-test", "service-test", "https://crm.test", "crm-test"];
  keys.forEach((key, i) => Deno.env.set(key, values[i]));
  const reads: any[] = [];
  const stages = {novos:100,agendadas:20,realizadas:14,indicacoes:6,cirurgias:2,perdidos:3};
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === "string" ? input : input instanceof Request ? input.url : input.toString());
    let body: unknown;
    if (url.pathname === "/auth/v1/user") body = {id:USER};
    else if (url.pathname === "/rest/v1/rpc/is_admin") body = true;
    else if (url.pathname === "/rest/v1/members") body = [{id:OWN,ativo:true}];
    else if (url.pathname === "/rest/v1/rpc/cerebro_clinica_do_membro") body = [{clinic_id:OTHER}];
    else if (url.pathname === "/rest/v1/clinics") body = [{id:OTHER,name:"Clínica exemplo",timezone:"America/Manaus"}];
    else if (url.pathname === "/rest/v1/rpc/get_funil_metrics") {
      reads.push(JSON.parse(String(init?.body)));
      body = {periodo:stages,anterior:stages,trilha_desde:null,dados_desde:null};
    } else if (["/rest/v1/rpc/get_period_commercial_revenue","/rest/v1/rpc/get_period_revenue"].includes(url.pathname)) body = null;
    else throw new Error(`Unexpected fetch: ${url}`);
    return new Response(JSON.stringify(body), {headers:{"content-type":"application/json"}});
  };
  const ask = (period: Record<string, unknown>) => handleFarol(new Request("https://site.test/farol", {
    method:"POST",headers:{Authorization:"Bearer valid-token","Content-Type":"application/json"},
    body:JSON.stringify({member_id:OWN,...period}),
  }));
  try {
    const explicit = await ask({preset:"custom",from:"2026-10-01",to:"2026-10-20"});
    const data = await explicit.json();
    if (explicit.status !== 200 || data.period.start !== "2026-10-01T04:00:00.000Z" ||
        data.period.end !== "2026-10-21T03:59:59.999Z" || data.funnel.data.periodo.novos !== 100) throw new Error("Calendar/funnel drift");
    if (reads[0].p_clinic_id !== OTHER || reads[0].p_period_start !== data.period.start || reads[0].p_period_end !== data.period.end) throw new Error("RPC interval drift");
    const rolling = await ask({days:60});const next = await rolling.json();
    if (rolling.status !== 200 || next.period.days !== 60 || !next.period.start.endsWith("T04:00:00.000Z")) throw new Error("Rolling period ignored clinic timezone");
    if ((await ask({days:-1})).status !== 400) throw new Error("Invalid period became default");
  } finally {
    globalThis.fetch = oldFetch;
    keys.forEach((key, i) => previous[i] === undefined ? Deno.env.delete(key) : Deno.env.set(key, previous[i]!));
  }
});
