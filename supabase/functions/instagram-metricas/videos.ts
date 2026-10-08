// /media usa cursores. Nunca inferir vídeos pela diferença de media_count.
// Referência: https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/
export type Video = { media_id: string; published_at: string; media_type: string; product_type: string | null; permalink: string | null };
type Page = { data?: Array<Record<string, unknown>>; paging?: { next?: string; cursors?: { after?: string } } };

export function diaManaus(timestamp: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone:'America/Manaus',year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date(timestamp));
}

export async function coletarVideos(ler: (params: Record<string,string>) => Promise<Page>, desde: string, ate: string) {
  const videos = new Map<string, Video>();
  const cursors = new Set<string>();
  let after: string | undefined;
  let anterior = Infinity;
  for (let pagina=0;pagina<20;pagina++) {
    const p=await ler({ fields:'id,media_type,media_product_type,timestamp,permalink',limit:'100',...(after?{after}:{}) });
    if (!Array.isArray(p.data)) throw new Error('Resposta de publicações incompleta');
    let passouInicio=false;
    for (const m of p.data) {
      const ts=Date.parse(String(m.timestamp||''));
      if(!m.id||!Number.isFinite(ts))throw new Error('Publicação sem identidade ou data');
      // Não certificar uma janela se a API não estiver ordenada por data.
      if(ts>anterior)throw new Error('Publicações fora da ordem cronológica');
      anterior=ts;
      const dia=diaManaus(String(m.timestamp));
      if(dia<desde)passouInicio=true;
      if(dia>=desde&&dia<=ate&&m.media_type==='VIDEO'&&m.media_product_type!=='STORY') {
        videos.set(String(m.id),{media_id:String(m.id),published_at:new Date(ts).toISOString(),media_type:'VIDEO',product_type:typeof m.media_product_type==='string'?m.media_product_type:null,permalink:typeof m.permalink==='string'&&/^https:\/\/(www\.)?instagram\.com\/(p|reel|tv)\/[A-Za-z0-9_-]+\/?$/.test(m.permalink)?m.permalink:null});
      }
    }
    if(passouInicio||!p.paging?.next)return [...videos.values()];
    const cursor=p.paging.cursors?.after;
    if(!cursor||cursors.has(cursor))throw new Error('Paginação de publicações incompleta');
    cursors.add(cursor);after=cursor;
  }
  throw new Error('Limite de páginas: janela de vídeos não certificada');
}
