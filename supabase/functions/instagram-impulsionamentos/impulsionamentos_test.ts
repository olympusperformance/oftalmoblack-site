import { ehImpulsionamento, montarLinhas, orcamentoTotal } from "./impulsionamentos.ts";

function igual(atual: unknown, esperado: unknown) {
  const a = JSON.stringify(atual);
  const e = JSON.stringify(esperado);
  if (a !== e) throw new Error(`esperado ${e}; recebido ${a}`);
}

Deno.test("reconhece o nome que a Meta dá ao impulsionamento, em português e inglês", () => {
  igual(ehImpulsionamento("Post do Instagram: “Doutora, eu não consigo mais..."), true);
  igual(ehImpulsionamento("Instagram post: Não é para todo mundo que eu..."), true);
  igual(ehImpulsionamento("AlexSa_Branding_Trafego_Agost"), false);
  igual(ehImpulsionamento("Tráfego Perfil junho 2026 - Instagram post"), false);
});

Deno.test("orçamento vitalício da campanha vem em centavos", () => {
  igual(orcamentoTotal({ lifetime_budget: "24500" }), 245);
});

Deno.test("orçamento no conjunto, diário, vira total pelos dias", () => {
  igual(orcamentoTotal({
    start_time: "2026-09-17T17:30:19-0300", stop_time: "2026-09-24T17:30:19-0300",
    adsets: { data: [{ daily_budget: "3500" }] },
  }), 245);
  igual(orcamentoTotal({ adsets: { data: [] } }), null);
});

Deno.test("cruza campanha com insights e ignora o que não é impulsionamento", () => {
  const linhas = montarLinhas(
    { ad_account_id: "act_1", member_id: "m1" },
    [
      { id: "10", name: "Post do Instagram: Isso é incrível", start_time: "2026-10-01T10:00:00-0300",
        stop_time: "2026-10-08T10:00:00-0300", effective_status: "ACTIVE", lifetime_budget: "24500",
        ads: { data: [{ creative: { instagram_permalink_url: "https://www.instagram.com/p/ABC/" } }] } },
      { id: "11", name: "Felipe_Quiz_Manaus" },
      { id: "12", name: "Instagram post: sem gasto ainda" },
    ],
    [{ campaign_id: "10", spend: "475.94", instagram_profile_follow: "17",
       instagram_profile_visits: "489", reach: "9000", account_currency: "BRL" }],
    "2026-10-13T12:00:00Z",
  );
  igual(linhas.length, 2);
  igual([linhas[0].gasto, linhas[0].seguidores, linhas[0].visitas_perfil, linhas[0].orcamento_total,
         linhas[0].post_url], [475.94, 17, 489, 245, "https://www.instagram.com/p/ABC/"]);
  igual([linhas[1].gasto, linhas[1].seguidores, linhas[1].alcance], [0, 0, null]);
});
