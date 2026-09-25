// A Meta identifica cada valor diário pela data de fechamento em end_time.
// Descartamos respostas parciais ou inválidas sem inventar zero para esses dias.
export function normalizarAlcance(
  igUserId: string,
  valores: unknown,
): Array<{ ig_user_id: string; dia: string; alcance_dia: number }> {
  if (!Array.isArray(valores)) return [];
  return valores.flatMap((item) => {
    const dia = item?.end_time?.slice?.(0, 10);
    const valor = item?.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dia ?? "") ||
      !Number.isSafeInteger(valor) || valor < 0) return [];
    return [{ ig_user_id: igUserId, dia, alcance_dia: valor }];
  });
}
