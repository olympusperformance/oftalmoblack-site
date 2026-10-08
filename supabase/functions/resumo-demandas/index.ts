/* ============================================================================
   resumo-demandas — as demandas de cada pessoa da equipe no WhatsApp, de manhã

   O pg_cron chama esta função todo dia às 7h45 (Brasília). Para cada pessoa
   ativa de `staff` com `whatsapp` preenchido e `resumo_ativo`, junta as
   demandas abertas em que ela é responsável e manda uma mensagem só pela
   Evolution API (mesma instância dos avisos dos robôs).

   Chamada:
     POST { }                                  → envia para todo mundo
     POST { "simular": true }                  → monta e devolve os textos, sem enviar
     POST { "staff_id": "<uuid>" }             → só uma pessoa (com ou sem "simular")

   Autorização: header `x-resumo-token` igual a RESUMO_TOKEN. Sem o segredo
   definido a função não responde.
   ========================================================================= */

import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { montaResumo, type Demanda } from "./mensagem.ts";

const ABERTAS_FORA = ["Concluída", "Cancelada"];
const LINK = Deno.env.get("RESUMO_LINK") || "https://oftalmoblack.com.br/admin/#demandas";
const EVOLUTION_URL = Deno.env.get("EVOLUTION_URL") || "https://evolutionapi.oftalmoblack.com.br";
const EVOLUTION_INSTANCIA = Deno.env.get("EVOLUTION_INSTANCIA") || "Atendimento Oftalmoblack";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function igual(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let dif = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) dif |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return dif === 0;
}

const hojeEmBrasilia = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" })
    .format(new Date());

Deno.serve(async (req) => {
  const segredo = Deno.env.get("RESUMO_TOKEN");
  if (!segredo) return json({ error: "RESUMO_TOKEN não configurado" }, 503);
  if (req.method !== "POST" || !igual(req.headers.get("x-resumo-token") ?? "", segredo)) {
    return json({ error: "não autorizado" }, 401);
  }
  const body = await req.json().catch(() => ({}));
  const simular = body?.simular === true;
  const evolutionKey = Deno.env.get("EVOLUTION_API_KEY");
  if (!simular && !evolutionKey) return json({ error: "EVOLUTION_API_KEY não configurado" }, 503);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let pessoas = db.from("staff").select("id,nome,whatsapp,resumo_ativo").eq("ativo", true);
  if (body?.staff_id) pessoas = pessoas.eq("id", body.staff_id);
  const { data: equipe, error: erroEquipe } = await pessoas;
  if (erroEquipe) return json({ error: erroEquipe.message }, 500);

  const { data: demandas, error: erroDemandas } = await db
    .from("demands")
    .select("titulo,status,prioridade,vence_em,responsaveis,members(nome)")
    .is("excluida_em", null)
    .not("status", "in", `(${ABERTAS_FORA.map((s) => `"${s}"`).join(",")})`);
  if (erroDemandas) return json({ error: erroDemandas.message }, 500);

  const hoje = hojeEmBrasilia();
  const resultado: Array<Record<string, unknown>> = [];

  for (const pessoa of equipe ?? []) {
    const numero = String(pessoa.whatsapp ?? "").replace(/\D/g, "");
    if (!simular && (!numero || pessoa.resumo_ativo === false)) {
      resultado.push({ nome: pessoa.nome, enviado: false, motivo: numero ? "resumo desligado" : "sem WhatsApp" });
      continue;
    }
    const minhas: Demanda[] = (demandas ?? [])
      .filter((d: any) => Array.isArray(d.responsaveis) && d.responsaveis.includes(pessoa.id))
      .map((d: any) => ({
        titulo: d.titulo,
        status: d.status,
        prioridade: d.prioridade,
        vence_em: d.vence_em,
        mentorado: d.members?.nome ?? null,
      }));
    const texto = montaResumo(pessoa.nome, minhas, hoje, LINK);
    if (!texto) {
      resultado.push({ nome: pessoa.nome, enviado: false, motivo: "nenhuma demanda aberta" });
      continue;
    }
    if (simular) {
      resultado.push({ nome: pessoa.nome, numero: numero || null, demandas: minhas.length, texto });
      continue;
    }
    try {
      const resposta = await fetch(
        `${EVOLUTION_URL}/message/sendText/${encodeURIComponent(EVOLUTION_INSTANCIA)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: evolutionKey! },
          body: JSON.stringify({ number: numero, text: texto }),
          signal: AbortSignal.timeout(20000),
        },
      );
      resultado.push({
        nome: pessoa.nome,
        enviado: resposta.ok,
        demandas: minhas.length,
        ...(resposta.ok ? {} : { motivo: `Evolution ${resposta.status}: ${(await resposta.text()).slice(0, 200)}` }),
      });
    } catch (erro) {
      resultado.push({ nome: pessoa.nome, enviado: false, motivo: String(erro) });
    }
  }

  console.log(JSON.stringify({ hoje, simular, resultado: resultado.map(({ texto, ...r }) => r) }));
  return json({ hoje, simular, resultado });
});
