/* Farol: agrega somente métricas de uma clínica vinculada a um membro ativo.
   O JWT do site autoriza o admin antes de qualquer leitura com service_role. */
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const METRICS = ["novos", "agendadas", "realizadas", "indicacoes", "cirurgias", "perdidos"] as const;
const GROUPS = ["consultations", "surgeries", "exams", "other"] as const;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
function dateInZone(value: Date, zone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}
function addDays(day: string, offset: number) {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
function zonedMidnight(day: string, zone: string) {
  const [year, month, date] = day.split("-").map(Number);
  const wanted = Date.UTC(year, month - 1, date);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  let guess = wanted;
  // Two passes account for zones whose UTC offset changes at midnight.
  for (let i = 0; i < 3; i++) {
    const p = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((part) => [part.type, Number(part.value)]));
    const seen = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess += wanted - seen;
  }
  return new Date(guess);
}
function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value :
    typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null;
}
function finite(value: unknown, nonnegative = false): number {
  const n = number(value);
  if (n === null || (nonnegative && n < 0)) throw new Error("invalid_metric");
  return n;
}
function count(value: unknown): number {
  const n = finite(value, true);
  if (!Number.isInteger(n)) throw new Error("invalid_count");
  return n;
}
function funnel(raw: any) {
  if (!raw?.periodo || !raw?.anterior) throw new Error("invalid_funnel");
  const stages = (part: any) => Object.fromEntries(METRICS.map((key) => [key, count(part?.[key])]));
  return { periodo: stages(raw?.periodo), anterior: stages(raw?.anterior),
    trilha_desde: typeof raw?.trilha_desde === "string" ? raw.trilha_desde : null,
    dados_desde: typeof raw?.dados_desde === "string" ? raw.dados_desde : null };
}
function commercial(raw: any) {
  return { total:finite(raw?.total, true), count:count(raw?.count), missing_price_count:count(raw?.missing_price_count),
    groups:Array.isArray(raw?.groups) ? raw.groups.filter((g: any) => ["consulta", "cirurgia", "exame"].includes(g?.kind))
      .map((g: any) => ({ kind:g.kind, count:count(g.count), amount:finite(g.amount, true), missing_price_count:count(g.missing_price_count) })) : [] };
}
function revenuePart(part: any) {
  if (!part || !Array.isArray(part.groups)) throw new Error("invalid_revenue");
  return { amount:finite(part.amount), record_count:count(part.record_count),
    groups:Array.isArray(part.groups) ? part.groups.filter((g: any) => GROUPS.includes(g?.key))
      .map((g: any) => ({ key:g.key, amount:finite(g.amount), record_count:count(g.record_count) })) : [] };
}
function revenue(raw: any, basis: "billed" | "received") {
  if (raw?.access !== true || raw?.basis !== basis || raw?.currency !== "BRL") throw new Error("invalid_revenue");
  return { current:revenuePart(raw.current), previous:revenuePart(raw.previous),
    processor_receivable_amount:finite(raw.processor_receivable_amount, true),
    processor_receivable_count:count(raw.processor_receivable_count),
    other_currency_count:count(raw.other_currency_count),
    history_record_count:count(raw.history_record_count) };
}

export async function handleFarol(req: Request): Promise<Response> {
  try {
  if (req.method === "OPTIONS") return new Response(null, { headers:CORS });
  if (req.method !== "POST") return json({ error:"method_not_allowed" }, 405);

  const siteUrl = Deno.env.get("SUPABASE_URL");
  const siteAnon = Deno.env.get("SUPABASE_ANON_KEY");
  const siteService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SECRET_KEY");
  const crmUrl = Deno.env.get("CRM_URL");
  const crmKey = Deno.env.get("CRM_KEY");
  if (!siteUrl || !siteAnon || !siteService || !crmUrl || !crmKey) return json({ error:"not_configured" }, 503);

  const authorization = req.headers.get("authorization") || "";
  const token = /^Bearer\s+(.+)$/i.exec(authorization)?.[1];
  if (!token) return json({ error:"unauthorized" }, 401);
  const boundedFetch: typeof fetch = (input, init) => fetch(input, { ...init, signal:AbortSignal.timeout(15000) });
  const userClient = createClient(siteUrl, siteAnon, {
    global:{ headers:{ Authorization:`Bearer ${token}` }, fetch:boundedFetch },
    auth:{ persistSession:false, autoRefreshToken:false },
  });
  const { data:userData, error:userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error:"unauthorized" }, 401);
  const { data:isAdmin, error:adminError } = await userClient.rpc("is_admin");
  if (adminError || isAdmin !== true) return json({ error:"forbidden" }, 403);

  let body: any;
  try { body = await req.json(); } catch { return json({ error:"invalid_body" }, 400); }
  if (!body || typeof body !== "object" || !UUID.test(body.member_id) || ![7, 30].includes(body.days)) {
    return json({ error:"invalid_parameters" }, 400);
  }

  const site = createClient(siteUrl, siteService, { global:{ fetch:boundedFetch }, auth:{ persistSession:false, autoRefreshToken:false } });
  const crm = createClient(crmUrl, crmKey, { global:{ fetch:boundedFetch }, auth:{ persistSession:false, autoRefreshToken:false } });
  const { data:member, error:memberError } = await site.from("members").select("id,ativo").eq("id", body.member_id).maybeSingle();
  if (memberError) return json({ error:"member_lookup_failed" }, 503);
  if (!member || member.ativo === false) return json({ error:"member_not_found" }, 404);

  const { data:links, error:linkError } = await site.rpc("cerebro_clinica_do_membro", { p_member:member.id });
  if (linkError) return json({ error:"clinic_lookup_failed" }, 503);
  const linked = Array.isArray(links) ? links[0] : null;
  if (!linked?.clinic_id) {
    return json({ status:"unlinked", member_id:member.id, clinic:null, period:null,
      updated_at:new Date().toISOString(), funnel:{ status:"unlinked", data:null },
      commercial:{ status:"unlinked", data:null }, finance:{ status:"unlinked", billed:null, received:null } });
  }

  const { data:clinicRow, error:clinicError } = await crm.from("clinics").select("id,name,timezone").eq("id", linked.clinic_id).maybeSingle();
  if (clinicError || !clinicRow) return json({ error:"clinic_lookup_failed" }, 503);
  let zone = clinicRow.timezone || "America/Sao_Paulo";
  try { new Intl.DateTimeFormat("en-US", { timeZone:zone }); } catch { zone = "America/Sao_Paulo"; }
  const today = dateInZone(new Date(), zone);
  const first = addDays(today, 1 - body.days);
  const start = zonedMidnight(first, zone).toISOString();
  const end = new Date(zonedMidnight(addDays(today, 1), zone).getTime() - 1).toISOString();
  const args = { p_clinic_id:clinicRow.id, p_period_start:start, p_period_end:end };
  const [funilResult, commercialResult, billedResult, receivedResult] = await Promise.allSettled([
    crm.rpc("get_funil_metrics", args),
    crm.rpc("get_period_commercial_revenue", args),
    crm.rpc("get_period_revenue", { ...args, p_basis:"billed" }),
    crm.rpc("get_period_revenue", { ...args, p_basis:"received" }),
  ]);
  const value = (result: PromiseSettledResult<any>) => result.status === "fulfilled" && !result.value.error ? result.value.data : null;
  const rawFunnel = value(funilResult), rawCommercial = value(commercialResult);
  const rawBilled = value(billedResult), rawReceived = value(receivedResult);
  let billed = null, received = null, safeFunnel = null, safeCommercial = null;
  try { if (rawBilled) billed = revenue(rawBilled, "billed"); } catch { /* fonte independente */ }
  try { if (rawReceived) received = revenue(rawReceived, "received"); } catch { /* fonte independente */ }
  try { if (rawFunnel) safeFunnel = funnel(rawFunnel); } catch { /* fonte independente */ }
  try { if (rawCommercial) safeCommercial = commercial(rawCommercial); } catch { /* fonte independente */ }
  const partialHistory = !!safeFunnel && [safeFunnel.trilha_desde, safeFunnel.dados_desde]
    .some((since) => since !== null && since > start);
  const complete = !!safeFunnel && !!safeCommercial && !!billed && !!received && !partialHistory;
  return json({ status:complete ? "ready" : "partial", member_id:member.id,
    clinic:{ id:clinicRow.id, name:clinicRow.name, timezone:zone },
    period:{ days:body.days, start, end, date_start:first, date_end:today }, updated_at:new Date().toISOString(),
    funnel:{ status:safeFunnel ? "ready" : "error", data:safeFunnel },
    commercial:{ status:safeCommercial ? "ready" : "error", data:safeCommercial },
    finance:{ status:billed && received ? "ready" : "error", billed, received } });
  } catch {
    return json({ error:"temporarily_unavailable" }, 503);
  }
}

if (import.meta.main) Deno.serve(handleFarol);
