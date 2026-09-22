import { normalizarGanhos } from "./seguidores.ts";

function igual(atual: unknown, esperado: unknown) {
  const a = JSON.stringify(atual);
  const e = JSON.stringify(esperado);
  if (a !== e) throw new Error(`esperado ${e}; recebido ${a}`);
}

Deno.test("usa a data do end_time e preserva zero como dado valido", () => {
  igual(
    normalizarGanhos("ig-1", [
      { value: 15, end_time: "2026-09-04T07:00:00+0000" },
      { value: 0, end_time: "2026-09-05T07:00:00+0000" },
    ]),
    [
      { ig_user_id: "ig-1", dia: "2026-09-04", seguidores_ganhos: 15 },
      { ig_user_id: "ig-1", dia: "2026-09-05", seguidores_ganhos: 0 },
    ],
  );
});

Deno.test("ignora valores incompletos e mantem a ultima versao de cada dia", () => {
  igual(
    normalizarGanhos("ig-2", [
      { value: 7, end_time: "2026-09-10T07:00:00+0000" },
      { value: "8", end_time: "2026-09-11T07:00:00+0000" },
      { value: 9 },
      { value: 10, end_time: "invalido" },
      { value: 11, end_time: "2026-09-10T08:00:00+0000" },
    ]),
    [
      { ig_user_id: "ig-2", dia: "2026-09-10", seguidores_ganhos: 11 },
    ],
  );
});
