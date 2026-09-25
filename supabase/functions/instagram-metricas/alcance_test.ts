import { assertEquals } from "jsr:@std/assert@1";
import { normalizarAlcance } from "./alcance.ts";

Deno.test("alcance diário usa end_time da Meta e preserva zero", () => {
  assertEquals(normalizarAlcance("ig-1", [
    { end_time: "2026-09-23T07:00:00+0000", value: 2455 },
    { end_time: "2026-09-24T07:00:00+0000", value: 0 },
    { end_time: "2026-09-25T07:00:00+0000", value: null },
  ]), [
    { ig_user_id: "ig-1", dia: "2026-09-23", alcance_dia: 2455 },
    { ig_user_id: "ig-1", dia: "2026-09-24", alcance_dia: 0 },
  ]);
});
