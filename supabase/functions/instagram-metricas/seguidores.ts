export type GanhoFollower = {
  ig_user_id: string;
  dia: string;
  seguidores_ganhos: number;
};

type ValorFollower = {
  value?: unknown;
  end_time?: unknown;
};

/* O end_time que a Meta devolve ja identifica o dia da metrica. Nao usamos
   a data da coleta: a mesma chamada traz ate 30 dias e e repetida justamente
   para completar/revisar dias que a API consolidou depois. */
export function normalizarGanhos(
  igUserId: string,
  valores: ValorFollower[],
): GanhoFollower[] {
  const porDia = new Map<string, number>();

  for (const item of valores ?? []) {
    const data = typeof item?.end_time === "string"
      ? item.end_time.match(/^(\d{4}-\d{2}-\d{2})T/)?.[1]
      : undefined;
    const valor = typeof item?.value === "number" && Number.isFinite(item.value)
      ? item.value
      : null;
    if (data && valor !== null) porDia.set(data, Math.trunc(valor));
  }

  return [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dia, seguidores_ganhos]) => ({
      ig_user_id: igUserId,
      dia,
      seguidores_ganhos,
    }));
}
