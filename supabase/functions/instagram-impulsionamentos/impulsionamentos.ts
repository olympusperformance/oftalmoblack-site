/* Lê a resposta da Marketing API e devolve as linhas de
   cerebro.impulsionamentos. Sem rede aqui, para dar para testar. */

// "Post do Instagram: “Doutora, eu não consigo mais..." / "Instagram post: ..."
const PREFIXO = /^\s*(post do instagram|instagram post)\s*:/i;

export function ehImpulsionamento(nome: unknown): boolean {
  return typeof nome === "string" && PREFIXO.test(nome);
}

const num = (v: unknown): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/* Orçamento em centavos da moeda da conta. Impulsionamento costuma ter
   orçamento vitalício na campanha; quando está no conjunto, soma os conjuntos.
   Orçamento diário vira total pelos dias entre início e término. */
export function orcamentoTotal(c: any): number | null {
  const dias = (ini?: string, fim?: string) => {
    if (!ini || !fim) return null;
    const d = (Date.parse(fim) - Date.parse(ini)) / 86400000;
    return Number.isFinite(d) && d > 0 ? Math.round(d) : null;
  };
  const deUm = (o: any, ini?: string, fim?: string): number | null => {
    const vit = num(o?.lifetime_budget);
    if (vit && vit > 0) return vit;
    const dia = num(o?.daily_budget);
    const n = dias(ini, fim);
    return dia && dia > 0 && n ? dia * n : null;
  };
  const daCampanha = deUm(c, c?.start_time, c?.stop_time);
  if (daCampanha !== null) return daCampanha / 100;
  const conjuntos = (c?.adsets?.data ?? [])
    .map((a: any) => deUm(a, a?.start_time ?? c?.start_time, a?.end_time ?? c?.stop_time))
    .filter((v: number | null): v is number => v !== null);
  return conjuntos.length ? conjuntos.reduce((a: number, b: number) => a + b, 0) / 100 : null;
}

export function linkDoPost(c: any): string | null {
  for (const ad of c?.ads?.data ?? []) {
    const url = ad?.creative?.instagram_permalink_url;
    if (typeof url === "string" && url.startsWith("https://")) return url;
  }
  return null;
}

export interface Conta { ad_account_id: string; member_id: string }

export function montarLinhas(conta: Conta, campanhas: any[], insights: any[], agora: string) {
  const porCampanha = new Map<string, any>();
  for (const i of insights) if (i?.campaign_id) porCampanha.set(String(i.campaign_id), i);
  return campanhas
    .filter((c) => ehImpulsionamento(c?.name) && /^\d+$/.test(String(c?.id ?? "")))
    .map((c) => {
      const i = porCampanha.get(String(c.id)) ?? {};
      return {
        campaign_id: String(c.id),
        ad_account_id: conta.ad_account_id,
        member_id: conta.member_id,
        nome: String(c.name).trim(),
        post_url: linkDoPost(c),
        inicio: c.start_time ?? null,
        termino: c.stop_time ?? null,
        status: c.effective_status ?? null,
        orcamento_total: orcamentoTotal(c),
        gasto: num(i.spend) ?? 0,
        seguidores: Math.round(num(i.instagram_profile_follow) ?? 0),
        visitas_perfil: Math.round(num(i.instagram_profile_visits) ?? 0),
        alcance: num(i.reach) === null ? null : Math.round(num(i.reach)!),
        moeda: typeof i.account_currency === "string" ? i.account_currency : null,
        atualizado_em: agora,
      };
    });
}
