/* ============================================================================
   instagram-metricas — o retrato diário do Instagram de cada mentorado

   O acompanhamento hoje é por print e memória: ninguém diz se o mentorado
   cresceu ou encolheu no mês sem abrir o celular dele. Esta função anda pelas
   contas que o system user do BM `Dr. Alex Sá | Manager` alcança por parceria,
   grava um retrato por dia em `cerebro.instagram_metricas` e mantém
   `cerebro.instagram_contas` casada com `members`.

   Por que uma função e não o navegador: o token é permanente e vale para as
   contas de 15 clínicas. Ele não pode chegar perto do /config.js, que é
   público por definição. Fica aqui como variável de ambiente
   (META_SYSTEM_USER_TOKEN) e nunca sai.

   Duas naturezas de número, guardadas separadas de propósito:
     * estoque  — `followers_count`, `media_count`: o total naquele dia;
     * janela   — `views`, `reach`, `total_interactions`: o que o Instagram
                  entrega para os últimos 7 dias. Somar dia a dia contaria a
                  mesma pessoa muitas vezes, então guardamos a janela como ela
                  vem, e a progressão sai da diferença entre dias.

   Chamada:
     POST { }                        → coleta o dia de hoje
     POST { "dia": "AAAA-MM-DD" }    → recoleta somente o dia atual
     POST { "so_mapear": true }      → só recasa contas com mentorados

   Autorização: header `x-metricas-token` igual a METRICAS_TOKEN. Sem o segredo
   definido a função não responde — segredo esquecido não vira porta aberta.
   ========================================================================= */

import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { normalizarGanhos } from "./seguidores.ts";
import { normalizarAlcance } from "./alcance.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-metricas-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const G = "https://graph.facebook.com/v21.0";

const mensagemErro = (e: unknown) => e instanceof Error ? e.message : String(e);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

async function graph(path: string, params: Record<string, string>) {
  const u = new URL(`${G}/${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const r = await fetch(u.toString(), { signal: AbortSignal.timeout(15000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || (j as any)?.error) {
    const msg = (j as any)?.error?.message ?? `HTTP ${r.status}`;
    throw new Error(msg);
  }
  return j as any;
}

/* Casa "@dr.pedrofabiopinese" com "Pedro Fábio de Mello Pinese".

   Sem acento, sem pontuação, sem os prefixos que todo médico usa no perfil
   (dr, dra, clinica) e sem o sufixo da especialidade. Vale quando duas partes
   do nome do mentorado aparecem no username — duas, e não uma, porque
   "pinese" sozinho casaria com qualquer Pinese da turma. Nome que casa com
   mais de um mentorado não casa com nenhum: preencher errado mostra o
   Instagram de um mentorado na tela de outro. */
function semAcento(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function pistas(username: string): string[] {
  return semAcento(username)
    .replace(/^@/, "")
    .replace(/\b(dr|dra|doutor|doutora|clinica|oftalmo|oftalmologista|oficial)\b/g, " ")
    .split(/[^a-z0-9]+/)
    .filter((p) => p.length >= 4);
}

function casaMentorado(
  username: string,
  membros: Array<{ id: string; nome: string; instagram: string | null }>,
): string | null {
  // 1. O que já está escrito no cadastro manda — inclusive contra este palpite.
  const alvo = semAcento(username).replace(/^@/, "");
  const porCadastro = membros.filter(
    (m) => m.instagram && semAcento(m.instagram).replace(/^@/, "") === alvo,
  );
  if (porCadastro.length === 1) return porCadastro[0].id;

  const p = pistas(username);
  if (p.length === 0) return null;

  const candidatos = membros.filter((m) => {
    const partes = semAcento(m.nome).split(/\s+/).filter((x) => x.length >= 4);
    const encontrados = partes.filter((parte) =>
      p.some((pi) => pi.includes(parte) || parte.includes(pi)),
    );
    return encontrados.length >= 2;
  });
  return candidatos.length === 1 ? candidatos[0].id : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const esperado = Deno.env.get("METRICAS_TOKEN") ?? "";
  const token = Deno.env.get("META_SYSTEM_USER_TOKEN") ?? "";
  if (!esperado || !token) return json({ error: "nao_configurado" }, 503);
  if (req.headers.get("x-metricas-token") !== esperado) {
    return json({ error: "unauthorized" }, 401);
  }

  const body = await req.json().catch(() => ({}));
  // O perfil entrega o estoque atual, nunca o total historico de seguidores.
  // Uma data fixa em uma automacao nao pode sobrescrever um retrato antigo.
  const dia = new Date().toISOString().slice(0, 10);
  if (body?.dia != null && body.dia !== dia) {
    return json({ error: "dia_deve_ser_hoje", dia }, 400);
  }
  const soMapear: boolean = body?.so_mapear === true;

  const db = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1) Contas que o token alcança, com a Página de onde sai o Page token.
    const contas = await graph("me/accounts", {
      fields: "id,name,access_token,instagram_business_account{id,username}",
      limit: "200",
      access_token: token,
    });
    const alvos = (contas.data ?? []).filter(
      (p: any) => p?.instagram_business_account?.id && p?.access_token,
    );

    // 2) Casamento com os mentorados.
    const { data: membros, error: erroMembros } = await db
      .from("members")
      .select("id, nome, instagram")
      .eq("ativo", true);
    if (erroMembros) throw new Error(`membros: ${erroMembros.message}`);

    const mapeadas: Array<Record<string, unknown>> = alvos.map((p: any) => {
      const ig = p.instagram_business_account;
      return {
        ig_user_id: ig.id,
        username: ig.username ?? null,
        page_id: p.id,
        page_nome: p.name ?? null,
        member_id: casaMentorado(ig.username ?? "", (membros ?? []) as any),
        ativo: true,
        atualizado_em: new Date().toISOString(),
      };
    });
    if (mapeadas.length > 0) {
      // O schema `cerebro` não é alcançável pelo PostgREST — de propósito.
      // A escrita passa pelas funções SECURITY DEFINER (ver supabase/instagram.sql).
      const { error } = await db.rpc("instagram_sync_contas", { p: mapeadas });
      if (error) throw new Error(`sync contas: ${error.message}`);
    }

    const semMentorado = mapeadas.filter((m) => !m.member_id).map((m) => m.username);
    if (soMapear) {
      return json({
        ok: true,
        contas: mapeadas.length,
        sem_mentorado: semMentorado,
      });
    }

    // 3) Retrato do dia, conta por conta. Uma conta que falha não derruba as
    //    outras: a coleta parcial de hoje vale mais que erro em bloco.
    const desde = new Date(`${dia}T00:00:00Z`);
    desde.setUTCDate(desde.getUTCDate() - 7);
    const since = desde.toISOString().slice(0, 10);

    // follower_count e uma serie diaria de ate 30 dias. Pedir desde=ate (como
    // antes) cria uma janela sem duracao e a Meta devolve []: nao era zero.
    // Reconsultar a janela inteira tambem recupera consolidacoes atrasadas.
    const desdeFollower = new Date(`${dia}T00:00:00Z`);
    desdeFollower.setUTCDate(desdeFollower.getUTCDate() - 29);
    const ateFollower = new Date(`${dia}T00:00:00Z`);
    ateFollower.setUTCDate(ateFollower.getUTCDate() + 1);
    const followerSince = String(Math.floor(desdeFollower.getTime() / 1000));
    const followerUntil = String(Math.floor(ateFollower.getTime() / 1000));

    // A serie de reach aceita ate 30 dias por consulta. Reconsultar a janela
    // recupera dias que a Meta consolidou depois da primeira coleta.
    const desdeAlcance = new Date(`${dia}T00:00:00Z`);
    desdeAlcance.setUTCDate(desdeAlcance.getUTCDate() - 30);
    const alcanceSince = String(Math.floor(desdeAlcance.getTime() / 1000));
    const alcanceUntil = String(Math.floor(new Date(`${dia}T00:00:00Z`).getTime() / 1000));

    const linhas: Array<Record<string, unknown>> = [];
    const linhasGanhos: Array<Record<string, unknown>> = [];
    const linhasAlcance: Array<Record<string, unknown>> = [];
    const falhas: Array<{ username: string; erro: string }> = [];
    const pendenciasGanhos: Array<{ username: string; erro: string }> = [];
    const pendenciasAlcance: Array<{ username: string; erro: string }> = [];

    // Limita a concorrencia para concluir a turma dentro do tempo da funcao.
    for (let inicio = 0; inicio < alvos.length; inicio += 3) {
      await Promise.all(alvos.slice(inicio, inicio + 3).map(async (p: any) => {
      const ig = p.instagram_business_account;
      const pageToken = p.access_token as string;
      try {
        const perfil = await graph(ig.id, {
          fields: "followers_count,follows_count,media_count",
          access_token: pageToken,
        });

        const janela: Record<string, number | null> = {};
        try {
          const ins = await graph(`${ig.id}/insights`, {
            metric: "views,reach,total_interactions,accounts_engaged,profile_views",
            metric_type: "total_value",
            period: "day",
            since,
            until: dia,
            access_token: pageToken,
          });
          for (const d of ins.data ?? []) {
            janela[d.name] = d?.total_value?.value ?? null;
          }
        } catch (e) {
          // Conta nova ou sem audiência não tem insights — o perfil ainda vale.
          console.warn(`[instagram-metricas] insights @${ig.username}: ${mensagemErro(e)}`);
        }

        let ganhos: number | null = null;
        try {
          const fc = await graph(`${ig.id}/insights`, {
            metric: "follower_count",
            period: "day",
            since: followerSince,
            until: followerUntil,
            access_token: pageToken,
          });
          const vals = fc.data?.[0]?.values ?? [];
          const historico = normalizarGanhos(ig.id, vals);
          linhasGanhos.push(...historico);
          ganhos = historico.find((x) => x.dia === dia)?.seguidores_ganhos ?? null;
        } catch (e) {
          // Perfil com menos de 100 seguidores ou indisponibilidade da Meta:
          // o estoque ainda e salvo, mas o fluxo fica explicitamente pendente.
          pendenciasGanhos.push({
            username: ig.username ?? ig.id,
            erro: mensagemErro(e),
          });
        }

        try {
          const alcanceDiario = await graph(`${ig.id}/insights`, {
            metric: "reach",
            period: "day",
            metric_type: "time_series",
            since: alcanceSince,
            until: alcanceUntil,
            access_token: pageToken,
          });
          linhasAlcance.push(...normalizarAlcance(ig.id, alcanceDiario.data?.[0]?.values));
        } catch (e) {
          pendenciasAlcance.push({
            username: ig.username ?? ig.id,
            erro: mensagemErro(e),
          });
        }

        linhas.push({
          ig_user_id: ig.id,
          dia,
          seguidores: perfil.followers_count ?? null,
          seguindo: perfil.follows_count ?? null,
          publicacoes: perfil.media_count ?? null,
          seguidores_ganhos: ganhos,
          visualizacoes: janela["views"] ?? null,
          alcance: janela["reach"] ?? null,
          interacoes: janela["total_interactions"] ?? null,
          contas_engajadas: janela["accounts_engaged"] ?? null,
          visitas_perfil: janela["profile_views"] ?? null,
          coletado_em: new Date().toISOString(),
        });
      } catch (e) {
        falhas.push({ username: ig.username ?? ig.id, erro: mensagemErro(e) });
      }
      }));
    }

    if (linhas.length > 0) {
      const { error } = await db.rpc("instagram_sync_metricas", { p: linhas });
      if (error) throw new Error(`sync metricas: ${error.message}`);
    }

    let ganhosAtualizados = 0;
    if (linhasGanhos.length > 0) {
      const { data, error } = await db.rpc("instagram_sync_seguidores_ganhos", {
        p: linhasGanhos,
      });
      if (error) throw new Error(`sync seguidores ganhos: ${error.message}`);
      ganhosAtualizados = Number(data) || 0;
    }

    let alcanceAtualizado = 0;
    if (linhasAlcance.length > 0) {
      const { data, error } = await db.rpc("instagram_sync_alcance_diario", {
        p: linhasAlcance,
      });
      if (error) throw new Error(`sync alcance diario: ${error.message}`);
      alcanceAtualizado = Number(data) || 0;
    }

    return json({
      ok: linhas.length > 0,
      dia,
      contas: mapeadas.length,
      coletadas: linhas.length,
      sem_mentorado: semMentorado,
      falhas,
      ganhos: {
        recebidos: linhasGanhos.length,
        atualizados: ganhosAtualizados,
        contas_pendentes: pendenciasGanhos,
      },
      alcance_diario: {
        recebidos: linhasAlcance.length,
        atualizados: alcanceAtualizado,
        contas_pendentes: pendenciasAlcance,
      },
    }, linhas.length > 0 ? 200 : 502);
  } catch (e) {
    console.error("[instagram-metricas]", e);
    return json({ error: mensagemErro(e) }, 500);
  }
});
