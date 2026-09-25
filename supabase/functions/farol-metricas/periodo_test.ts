import { assertEquals } from "jsr:@std/assert@1";
import { resolvePeriod } from "./periodo.ts";

Deno.test("presets do CRM respeitam semanas e meses de calendário", () => {
  const today = "2026-09-25";
  assertEquals(resolvePeriod("last7days", today)?.date_start, "2026-09-19");
  assertEquals(resolvePeriod("thisWeek", today)?.date_start, "2026-09-20");
  assertEquals(resolvePeriod("lastWeek", today)?.date_end, "2026-09-19");
  assertEquals(resolvePeriod("lastMonth", today)?.date_start, "2026-08-01");
  assertEquals(resolvePeriod("lastMonth", today)?.date_end, "2026-08-31");
  assertEquals(resolvePeriod("monthBeforeLast", today)?.date_start, "2026-07-01");
  assertEquals(resolvePeriod("last90days", today)?.days, 90);
  assertEquals(resolvePeriod("all", today)?.date_start, "2000-01-01");
  assertEquals(resolvePeriod("yesterday", today)?.date_end, "2026-09-24");
});

Deno.test("personalizado rejeita datas inválidas ou futuras", () => {
  assertEquals(resolvePeriod("custom", "2026-09-25", "2026-09-01", "2026-09-10")?.days, 10);
  assertEquals(resolvePeriod("custom", "2026-09-25", "2026-09-20", "2026-09-10"), null);
  assertEquals(resolvePeriod("custom", "2026-09-25", "2026-09-01", "2026-09-26"), null);
  assertEquals(resolvePeriod("custom", "2026-09-25", "2026-02-30", "2026-09-10"), null);
});
