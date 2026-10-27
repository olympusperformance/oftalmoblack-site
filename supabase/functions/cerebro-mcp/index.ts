// MCP do Cérebro Black — fala JSON-RPC sobre HTTP, que é o que o Claude entende.
// Três ferramentas: listar quem existe, buscar por sentido, e ler o que um
// mentorado andou conversando.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { profileTool, readProfile, listMemberProfiles } from "./profile.mjs";
import { sdrTool, readSdrDocument } from "./sdr-document.mjs";
import { authorized } from "./auth.mjs";

const db = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const TOKEN = Deno.env.get("MCP_TOKEN");

// A tela de conector do Claude nao oferece "Authorization" na lista de nomes de
// cabecalho — ela reserva esse nome para o fluxo OAuth — e so deixa escolher
// nomes de chave de API. Entao a senha vale em qualquer um deles. O
// "authorization" fica na lista porque e o que o Claude Code e a ponte
// mcp-remote usam.
const CABECALHOS = [
  "authorization", "x-api-key", "x-functions-key", "app-key", "x-client-secret",
  "x-gateway-api-key", "x-gateway-key", "x-rapidapi-key", "ocp-apim-subscription-key",
];
const OPENAI = Deno.env.get("OPENAI_API_KEY");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-session-id, mcp-protocol-version",
  "Access-Control-Expose-Headers": "mcp-session-id",
};

const TOOLS = [
  profileTool,
  sdrTool,
  {
    name: "listar_mentorados",
    description:
      "Lista os mentorados pelo cadastro canônico, inclusive quem ainda não tem grupo/mensagens ou formulário. Informa ID, situação e cobertura de fontes do perfil. Use para escolher de quem consultar a ficha.",
    inputSchema: { type: "object", properties: { incluir_inativos: {type:"boolean"} }, additionalProperties: false },
  },
  {
    name: "buscar_no_cerebro",
    description:
      "Busca por SENTIDO em tudo que o mentorado disse — conversa do grupo de WhatsApp E transcrição de reunião do Fathom — e encontra o assunto mesmo quando as palavras são outras. Use para perguntas como 'o que andaram falando sobre agenda vazia', 'quem reclamou de captação' ou 'o que ficou combinado na última reunião'. Cada trecho vem marcado com a fonte.",
    inputSchema: {
      type: "object",
      properties: {
        pergunta: { type: "string", description: "o que você quer encontrar, em português" },
        mentorado: { type: "string", description: "opcional: limita a um mentorado (nome parcial serve)" },
        limite: { type: "number", description: "quantos trechos devolver (padrão 6)" },
      },
      required: ["pergunta"],
      additionalProperties: false,
    },
  },
  {
    name: "metricas_da_clinica",
    description:
      "Números da clínica de um mentorado no CRM: leads, agendamentos, comparecimentos, cancelamentos, faltas, taxa de comparecimento e pacientes novos. Só agregados — nunca dado de paciente.",
    inputSchema: {
      type: "object",
      properties: {
        mentorado: { type: "string", description: "nome, mesmo parcial" },
        dias: { type: "number", description: "periodo em dias (padrao 30)" },
      },
      required: ["mentorado"],
      additionalProperties: false,
    },
  },
  {
    name: "metricas_de_todas_as_clinicas",
    description:
      "Painel do funil comercial das 16 clínicas de uma vez, uma linha por clínica: leads novos, consultas agendadas, comparecimentos, cirurgias indicadas e cirurgias fechadas, mais o que a agenda registrou. Use para 'como estão as clínicas', comparar entre elas ou somar o total da mentoria. Só agregados — nunca dado de paciente.",
    inputSchema: {
      type: "object",
      properties: {
        dias: { type: "number", description: "periodo em dias (padrao 30)" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "conversas_do_mentorado",
    description:
      "Devolve as conversas mais recentes do grupo de um mentorado, em ordem cronológica. Use quando a pergunta é sobre uma pessoa específica e não sobre um tema.",
    inputSchema: {
      type: "object",
      properties: {
        mentorado: { type: "string", description: "nome, mesmo parcial" },
        limite: { type: "number", description: "quantas conversas (padrão 10)" },
      },
      required: ["mentorado"],
      additionalProperties: false,
    },
  },
];

// As duas ferramentas de número batem na mesma porta do CRM: RPC pela REST, com
// a chave do servidor. O CRM é outro projeto Supabase — daí não usar o `db`.
async function rpcDoCrm(nome: string, corpo: unknown): Promise<any[]> {
  const r = await fetch(`${Deno.env.get("CRM_URL")}/rest/v1/rpc/${nome}`, {
    method: "POST",
    headers: {
      apikey: Deno.env.get("CRM_KEY")!,
      Authorization: `Bearer ${Deno.env.get("CRM_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(corpo),
  });
  if (!r.ok) throw new Error(`CRM respondeu ${r.status} em ${nome}: ${await r.text()}`);
  return await r.json();
}

async function vetor(texto: string): Promise<number[]> {
  const r = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { Authorization: `Bearer ${OPENAI}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "text-embedding-3-small", input: texto }),
  });
  if (!r.ok) throw new Error(`embedding falhou: ${r.status}`);
  return (await r.json()).data[0].embedding;
}

// De onde o trecho veio. Reunião traz o título; conversa de grupo não tem
// título nenhum, e chamar as duas de "conversa" faria a resposta citar o
// lugar errado.
function onde(b: any): string {
  return b.fonte === "reuniao" ? `reunião: ${b.titulo ?? "sem título"}` : "WhatsApp";
}

async function executar(nome: string, args: any): Promise<string> {
  if (nome === "perfil_do_mentorado") return readProfile(db, args);
  if (nome === "ficha_sdr_do_mentorado") return readSdrDocument(db, args);
  if (nome === "listar_mentorados") {
    return listMemberProfiles(db,args.incluir_inativos??false);
  }

  if (nome === "buscar_no_cerebro") {
    const emb = await vetor(args.pergunta);
    const { data, error } = await db.rpc("cerebro_buscar", {
      p_vetor: JSON.stringify(emb),
      p_mentorado: args.mentorado ?? null,
      p_limite: args.limite ?? 6,
    });
    if (error) throw error;
    if (!data?.length) return "Nada encontrado sobre isso nas conversas.";
    return data
      .map((b: any) =>
        `— ${b.mentorado} · ${String(b.inicio).slice(0, 10)} · ${onde(b)} (proximidade ${Number(b.parecido).toFixed(2)})\n${b.texto}`)
      .join("\n\n");
  }

  if (nome === "conversas_do_mentorado") {
    const { data, error } = await db.rpc("cerebro_do_mentorado", {
      p_mentorado: args.mentorado,
      p_limite: args.limite ?? 10,
    });
    if (error) throw error;
    if (!data?.length) return `Não achei conversa de "${args.mentorado}".`;
    return data
      .map((b: any) => `— ${String(b.inicio).slice(0, 16).replace("T", " ")} · ${onde(b)}\n${b.texto}`)
      .join("\n\n");
  }

  if (nome === "metricas_de_todas_as_clinicas") {
    const dias = args.dias ?? 30;
    const linhas = await rpcDoCrm("cerebro_metricas_todas", { p_dias: dias });
    if (!linhas.length) return "O CRM nao devolveu clinica nenhuma.";

    const soma = (c: string) => linhas.reduce((t: number, l: any) => t + Number(l[c] ?? 0), 0);
    const n = (v: any) => String(v ?? 0);

    // Tabela de largura fixa: o Claude le melhor coluna alinhada do que frase
    // corrida, e o Dr. quer comparar clinica com clinica.
    const cab = "clinica".padEnd(34) + ["leads", "agend", "compar", "indic", "fech"]
      .map((c) => c.padStart(7)).join("");
    const corpo = linhas.map((l: any) =>
      String(l.clinica ?? "").trim().slice(0, 33).padEnd(34) +
      [l.leads, l.agendadas, l.compareceram, l.indicadas, l.fechadas]
        .map((v) => n(v).padStart(7)).join(""));
    const total = "TOTAL".padEnd(34) +
      ["leads", "agendadas", "compareceram", "indicadas", "fechadas"]
        .map((c) => String(soma(c)).padStart(7)).join("");

    // Onde a agenda tem movimento, ela é o registro mais fiel de comparecimento
    // — e a divergência com o funil é justamente o que mostra quem registra.
    const comAgenda = linhas
      .filter((l: any) => Number(l.agenda_marcados) > 0)
      .map((l: any) =>
        `  ${String(l.clinica).trim()}: ${l.agenda_marcados} na agenda, ${l.agenda_realizados} realizados` +
        (l.taxa_comparecimento ? ` (${l.taxa_comparecimento}% de comparecimento)` : ""));

    return [
      `Funil das clinicas — ultimos ${dias} dias`,
      "",
      cab, corpo.join("\n"), total,
      "",
      "Agenda, onde ha movimento:",
      comAgenda.length ? comAgenda.join("\n") : "  nenhuma clinica com agenda no periodo",
      "",
      "agend/compar/indic/fech vem do marco do funil no Kanban, que existe nas 16",
      "clinicas. Zero em indicadas quer dizer que a clinica ainda nao marca a",
      "indicacao cirurgica — nao que nao houve indicacao.",
      "",
      "O periodo conta pela data em que o fato aconteceu. Onde nao havia como",
      "recuperar essa data, vale a data em que o marco foi gravado" +
        (soma("marcos_sem_data_do_fato") ? ` (${soma("marcos_sem_data_do_fato")} marcos)` : "") + ".",
      "Indicacao e cirurgia fechada so tem historico a partir de 25/08/2026:",
      "antes disso a informacao nunca foi registrada, entao comparar com meses",
      "anteriores nao tem base.",
    ].join("\n");
  }

  if (nome === "metricas_da_clinica") {
    const { data } = await db.rpc("cerebro_clinica_por_mentorado", { p_nome: args.mentorado });
    const alvo = data?.[0];
    if (!alvo) return `Nao achei a clinica de "${args.mentorado}" ligada a um mentorado.`;
    const m = (await rpcDoCrm("cerebro_metricas",
      { p_clinic: alvo.clinic_id, p_dias: args.dias ?? 30 }))[0] ?? {};
    return [
      `Clinica: ${alvo.clinica} — ultimos ${args.dias ?? 30} dias`,
      "",
      "Funil comercial (marco do Kanban):",
      `  consultas agendadas: ${m.funil_agendadas}`,
      `  compareceram: ${m.funil_compareceram}`,
      `  cirurgias indicadas: ${m.cirurgias_indicadas}`,
      `  cirurgias fechadas: ${m.cirurgias_fechadas}`,
      "",
      "Agenda:",
      `  agendamentos criados: ${m.agendamentos}`,
      `  compareceram: ${m.compareceram}`,
      `  cancelados: ${m.cancelados}`,
      `  faltaram: ${m.faltaram}`,
      `  taxa de comparecimento: ${m.taxa_comparecimento ?? "—"}%`,
      "",
      `leads novos: ${m.leads}`,
      `pacientes novos: ${m.pacientes_novos}`,
    ].join("\n");
  }

  throw new Error(`ferramenta desconhecida: ${nome}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // Caminho de descoberta de OAuth: precisa responder 404, nao 401.
  //
  // A tela de conector do Claude Enterprise, ao topar com 401, conclui que existe
  // um servidor de login ali e tenta registrar um cliente (RFC 7591). Como este
  // servidor respondia 401 em QUALQUER caminho, ela achava um login que nao
  // existe e falhava com "nao foi possivel registrar no servico de login".
  //
  // 404 aqui quer dizer "nao ha OAuth neste servidor" — e o cliente entao usa a
  // URL como ela e, com o ?k=.
  const caminho = new URL(req.url).pathname;
  if (/\/(\.well-known|register|authorize|token)(\/|$)/.test(caminho)) {
    return new Response(JSON.stringify({ error: "sem oauth aqui" }), {
      status: 404, headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // A senha vem pelo cabecalho OU pela URL (?k=). O ?k= existe porque a tela de
  // Connectors do Claude so tem campo de URL. Preco aceito: senha em URL fica no
  // log de invocacao, no print de tela e no historico de quem colar o endereco.
  if (!authorized(req, TOKEN, CABECALHOS)) {
      return new Response(JSON.stringify({ error: "não autorizado" }), {
        status: 401, headers: { ...cors, "Content-Type": "application/json" },
      });
  }

  let body: any;
  try { body = await req.json(); } catch { return new Response("bad request", { status: 400, headers: cors }); }

  const responder = (result: any) =>
    new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });

  try {
    switch (body.method) {
      case "initialize":
        return responder({
          protocolVersion: "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: { name: "cerebro-black", version: "1.0.0" },
        });
      case "notifications/initialized":
        return new Response(null, { status: 202, headers: cors });
      case "tools/list":
        return responder({ tools: TOOLS });
      case "tools/call": {
        const texto = await executar(body.params.name, body.params.arguments ?? {});
        return responder({ content: [{ type: "text", text: texto }] });
      }
      case "ping":
        return responder({});
      default:
        return new Response(JSON.stringify({
          jsonrpc: "2.0", id: body.id,
          error: { code: -32601, message: `método não suportado: ${body.method}` },
        }), { headers: { ...cors, "Content-Type": "application/json" } });
    }
  } catch (e) {
    return new Response(JSON.stringify({
      jsonrpc: "2.0", id: body.id,
      error: { code: -32000, message: String((e as Error).message ?? e) },
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  }
});

