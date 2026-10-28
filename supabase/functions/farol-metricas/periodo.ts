export const PRESETS = [
  "today", "yesterday", "last7days", "thisWeek", "lastWeek",
  "thisMonth", "lastMonth", "monthBeforeLast", "last30days",
  "last90days", "custom", "all", "quarter",
] as const;
export type Preset = typeof PRESETS[number];

export function requestPreset(body: any): Preset | null {
  if (body?.preset === 'quarter') return typeof body.quarter === 'string' && /^20\d{2}-T[1-4]$/.test(body.quarter) ? 'quarter' : null;
  if (body?.preset !== undefined) return PRESETS.includes(body.preset) ? body.preset : null;
  if (!Number.isInteger(body?.days) || body.days < 1 || body.days > 366) return null;
  return body.days === 7 ? 'last7days' : body.days === 30 ? 'last30days' : body.days === 90 ? 'last90days' : 'custom';
}

// Resolve dias no calendário da clínica, incluindo o dia atual como no painel.
export function resolveRequestedPeriod(body: any, today: string) {
  const preset = requestPreset(body);
  if (!preset || !validDay(today)) return null;
  // O cliente envia a identidade do trimestre, nunca "hoje" no fuso do navegador.
  if (preset === 'quarter') {
    const year = Number(body.quarter.slice(0,4)), month = (Number(body.quarter.slice(-1))-1)*3;
    const first = new Date(Date.UTC(year,month,1)).toISOString().slice(0,10);
    const last = new Date(Date.UTC(year,month+3,0)).toISOString().slice(0,10);
    const notStarted = first > today;
    const range = resolvePeriod('custom',notStarted ? last : today,first,notStarted || last < today ? last : today);
    return range && {...range,preset:'quarter' as const,quarter:body.quarter,planned_end:last,not_started:notStarted};
  }
  const rolling = body.preset === undefined && preset === 'custom';
  return resolvePeriod(preset,today,rolling ? move(today,1-body.days) : body.from,rolling ? today : body.to);
}

function move(day: string, offset: number): string {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}
function monthStart(day: string): string { return day.slice(0, 7) + "-01"; }
function monthShift(day: string, offset: number): string {
  const [year, month] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1 + offset, 1)).toISOString().slice(0, 10);
}
function validDay(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T12:00:00Z`)) &&
    new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value;
}

export function resolvePeriod(
  preset: Preset,
  today: string,
  from?: unknown,
  to?: unknown,
): { preset: Preset; date_start: string; date_end: string; days: number } | null {
  if (!validDay(today) || !PRESETS.includes(preset)) return null;
  let start = today, end = today;
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  switch (preset) {
    case "quarter": return null; // Exige quarter e o resolvedor de pedido acima.
    case "today": break;
    case "yesterday": start = end = move(today, -1); break;
    case "last7days": start = move(today, -6); break;
    case "thisWeek": start = move(today, -weekday); break;
    case "lastWeek": start = move(today, -weekday - 7); end = move(start, 6); break;
    case "thisMonth": start = monthStart(today); break;
    case "lastMonth": start = monthShift(today, -1); end = move(monthStart(today), -1); break;
    case "monthBeforeLast": start = monthShift(today, -2); end = move(monthShift(today, -1), -1); break;
    case "last30days": start = move(today, -29); break;
    case "last90days": start = move(today, -89); break;
    case "custom":
      if (!validDay(from) || !validDay(to) || from > to || to > today) return null;
      start = from; end = to; break;
    case "all": start = "2000-01-01"; break;
  }
  const days = Math.round((Date.parse(`${end}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86400000) + 1;
  if (days < 1 || days > 36600) return null;
  return { preset, date_start:start, date_end:end, days };
}
