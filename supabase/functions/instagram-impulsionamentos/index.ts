/* ============================================================================
   instagram-impulsionamentos — a planilha "Controle de Anúncios" sozinha

   Para cada conta de anúncios em cerebro.impulsionamento_contas, lê as
   campanhas de impulsionamento de post (nome começando por "Post do
   Instagram:" ou "Instagram post:") e grava em cerebro.impulsionamentos o
   que a planilha pedia: início, término, link do post, gasto, total do
   impulsionamento, seguidores ganhos e visitas ao perfil. Os custos (por
   seguidor, por visita) saem da divisão na tela, para nunca ficarem velhos.

   Token: o mesmo META_SYSTEM_USER_TOKEN do instagram-metricas.
   Autorização: header `x-metricas-token` igual a METRICAS_TOKEN.

   Chamada:
     POST { }                                  → todas as contas ativas
     POST { "ad_account_id": "act_..." }       → só uma conta
   ========================================================================= */

import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { montarLinhas } from "./impulsionamentos.ts";

const G = "https://graph.facebook.com/v26.0";
const FILTRO_NOME = JSON.stringify([{ field: "name", operator: "CONTAIN", value: "nstagram" }]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const mensagemErro = (e: unknown) => e instanceof Error ? e.message : String(e);

async function graph(path: string, params: Record<string, string>, token: string) {
  const u = new URL(`${G}/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(45000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || (j as any)?.error) {
    // Só o código: a mensagem da Meta pode trazer URL com cursor.
    throw new Error(`Meta HTTP ${r.status}; código ${Number((j as any)?.error?.code) || 0}`);
  }
  return j as any;
}

// Pagina pelo cursor `after`, sem seguir `paging.next` (que leva o token na URL).
async function todas(path: string, params: Record<string, string>, token: string) {
  const linhas: any[] = [];
  const vistos = new Set<string>();
  for (let pagina = 0; pagina < 100; pagina++) {
    const d = await graph(path, params, token);
    linhas.push(...(d.data ?? []));
    const after = d.paging?.cursors?.after;
    if (!d.paging?.next || !after || vistos.has(after)) return linhas;
    vistos.add(after);
    params = { ...params, after };
  }
  throw new Error("paginação excedeu 100 páginas");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const esperado = Deno.env.get("METRICAS_TOKEN") ?? "";
  const token = Deno.env.get("META_SYSTEM_USER_TOKEN") ?? "";
  if (!esperado || !token) return json({ error: "nao_configurado" }, 503);
  if (req.headers.get("x-metricas-token") !== esperado) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  // O schema `cerebro` não é exposto ao PostgREST: lê e grava pelas RPCs
  // public.impulsionamento_contas_ativas / public.impulsionamentos_sync.
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: contas, error } = await db.rpc("impulsionamento_contas_ativas", {
    p_conta: typeof body?.ad_account_id === "string" ? body.ad_account_id : null,
  });
  if (error) return json({ error: error.message }, 500);

  // Em paralelo: a conta do Daniel sozinha leva ~25 s na Meta.
  const resultado = await Promise.all(((contas ?? []) as any[]).map(async (conta) => {
    const agora = new Date().toISOString();
    try {
      const campanhas = await todas(`${conta.ad_account_id}/campaigns`, {
        fields: "id,name,start_time,stop_time,effective_status,lifetime_budget,daily_budget," +
          "adsets.limit(5){lifetime_budget,daily_budget,start_time,end_time}," +
          "ads.limit(1){creative{instagram_permalink_url}}," +
          // Por campanha, e não /insights da conta: o relatório da conta inteira
          // desde sempre a Meta recusa por "número excessivo de linhas".
          "insights.date_preset(maximum){spend,reach,instagram_profile_visits,instagram_profile_follow,account_currency}",
        filtering: FILTRO_NOME,
        limit: "100",
      }, token);
      const insights = campanhas
        .filter((c) => c?.insights?.data?.[0])
        .map((c) => ({ ...c.insights.data[0], campaign_id: c.id }));
      const linhas = montarLinhas(conta, campanhas, insights, agora);
      const { error: e } = await db.rpc("impulsionamentos_sync", { p_conta: conta.ad_account_id, p: linhas });
      if (e) throw new Error(e.message);
      return { conta: conta.ad_account_id, impulsionamentos: linhas.length };
    } catch (e) {
      const msg = mensagemErro(e);
      await db.rpc("impulsionamentos_sync", { p_conta: conta.ad_account_id, p: null, p_erro: msg });
      return { conta: conta.ad_account_id, erro: msg };
    }
  }));
  return json({ ok: true, contas: resultado });
});
