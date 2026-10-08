/* Monta o texto do resumo diário de demandas de uma pessoa da equipe.
   Função pura: recebe as demandas e a data de hoje (no fuso de Brasília) e
   devolve o texto pronto para o WhatsApp. Sem demanda aberta, devolve null —
   ninguém recebe mensagem vazia. */

export interface Demanda {
  titulo: string;
  status: string;
  prioridade: string;
  vence_em: string | null; // AAAA-MM-DD
  mentorado: string | null;
}

const PESO_PRIORIDADE: Record<string, number> = { Alta: 0, Média: 1, Baixa: 2 };

function somaDias(dia: string, n: number) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

function linha(d: Demanda, mostrarData: boolean) {
  const partes = [d.titulo.trim()];
  if (d.mentorado) partes.push(d.mentorado);
  const detalhes: string[] = [];
  if (mostrarData && d.vence_em) detalhes.push(ddmm(d.vence_em));
  if (d.prioridade === "Alta") detalhes.push("prioridade alta");
  if (d.status && d.status !== "A fazer") detalhes.push(d.status.toLowerCase());
  return `• ${partes.join(" — ")}${detalhes.length ? ` (${detalhes.join(" · ")})` : ""}`;
}

export function montaResumo(nome: string, demandas: Demanda[], hoje: string, link: string): string | null {
  if (demandas.length === 0) return null;
  const amanha = somaDias(hoje, 1);
  const semana = somaDias(hoje, 7);
  const ordena = (a: Demanda, b: Demanda) =>
    (a.vence_em ?? "9999").localeCompare(b.vence_em ?? "9999") ||
    (PESO_PRIORIDADE[a.prioridade] ?? 1) - (PESO_PRIORIDADE[b.prioridade] ?? 1) ||
    a.titulo.localeCompare(b.titulo, "pt-BR");
  const grupos: Array<[string, Demanda[], boolean]> = [
    ["🔴 *Atrasadas*", demandas.filter((d) => d.vence_em && d.vence_em < hoje), true],
    ["🟡 *Vencem hoje*", demandas.filter((d) => d.vence_em === hoje), false],
    ["🟠 *Vencem amanhã*", demandas.filter((d) => d.vence_em === amanha), false],
    ["🔵 *Próximos 7 dias*", demandas.filter((d) => d.vence_em && d.vence_em > amanha && d.vence_em <= semana), true],
    ["⚪ *Mais adiante*", demandas.filter((d) => d.vence_em && d.vence_em > semana), true],
    ["⚫ *Sem prazo*", demandas.filter((d) => !d.vence_em), false],
  ];
  const primeiroNome = nome.trim().split(/\s+/)[0];
  const blocos = grupos
    .filter(([, lista]) => lista.length > 0)
    .map(([titulo, lista, data]) =>
      `${titulo} (${lista.length})\n${[...lista].sort(ordena).map((d) => linha(d, data)).join("\n")}`
    );
  const total = demandas.length;
  return [
    `Bom dia, ${primeiroNome}! Suas demandas no Cérebro Black hoje (${ddmm(hoje)}): ${total} em aberto.`,
    ...blocos,
    `Abrir o quadro: ${link}`,
  ].join("\n\n");
}
