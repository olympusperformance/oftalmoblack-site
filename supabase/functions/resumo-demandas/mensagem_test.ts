import { assert, assertEquals } from "jsr:@std/assert@1";
import { montaResumo, type Demanda } from "./mensagem.ts";

const d = (titulo: string, vence_em: string | null, extra: Partial<Demanda> = {}): Demanda =>
  ({ titulo, vence_em, status: "A fazer", prioridade: "Média", mentorado: null, ...extra });

Deno.test("sem demanda aberta não manda nada", () => {
  assertEquals(montaResumo("Ítalo Monte", [], "2026-10-08", "https://x"), null);
});

Deno.test("agrupa por prazo, ordena e mostra mentorado, prioridade e status", () => {
  const texto = montaResumo("Ítalo Monte", [
    d("Sem data", null),
    d("Depois", "2026-10-30"),
    d("Semana", "2026-10-12"),
    d("Amanhã", "2026-10-09"),
    d("Hoje B", "2026-10-08"),
    d("Hoje A", "2026-10-08", { prioridade: "Alta" }),
    d("Atrasada", "2026-10-01", { mentorado: "Dr. João", status: "Em risco" }),
  ], "2026-10-08", "https://oftalmoblack.com.br/admin/#demandas")!;
  assert(texto.startsWith("Bom dia, Ítalo! Suas demandas no Cérebro Black hoje (08/10): 7 em aberto."));
  const ordem = ["Atrasadas", "Vencem hoje", "Vencem amanhã", "Próximos 7 dias", "Mais adiante", "Sem prazo"]
    .map((g) => texto.indexOf(g));
  assertEquals([...ordem].sort((a, b) => a - b), ordem);
  assert(ordem.every((i) => i >= 0));
  assert(texto.includes("• Atrasada — Dr. João (01/10 · em risco)"));
  assert(texto.indexOf("Hoje A (prioridade alta)") < texto.indexOf("• Hoje B"), "alta primeiro no mesmo dia");
  assert(texto.includes("• Semana (12/10)"));
  assert(texto.includes("🟡 *Vencem hoje* (2)"));
  assert(texto.endsWith("Abrir o quadro: https://oftalmoblack.com.br/admin/#demandas"));
});

Deno.test("grupo vazio não aparece", () => {
  const texto = montaResumo("Lenize", [d("Só hoje", "2026-10-08")], "2026-10-08", "l")!;
  assert(!texto.includes("Atrasadas"));
  assert(!texto.includes("Sem prazo"));
  assert(texto.includes("Bom dia, Lenize!"));
});
