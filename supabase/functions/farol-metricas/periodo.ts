export const PRESETS = [
  "today", "yesterday", "last7days", "thisWeek", "lastWeek",
  "thisMonth", "lastMonth", "monthBeforeLast", "last30days",
  "last90days", "custom", "all",
] as const;
export type Preset = typeof PRESETS[number];

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
