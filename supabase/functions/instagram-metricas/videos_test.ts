import { coletarVideos,diaManaus } from './videos.ts';
function equal(a:unknown,b:unknown){if(JSON.stringify(a)!==JSON.stringify(b))throw new Error(`Esperado ${JSON.stringify(b)}, recebido ${JSON.stringify(a)}`);}
const media=(id:string,type='VIDEO',time='2026-10-04T12:00:00Z',product='REELS')=>({id,media_type:type,timestamp:time,media_product_type:product});
Deno.test('paginação, identidade única e só vídeos/reels de feed',async()=>{
 const calls:unknown[]=[];
 const result=await coletarVideos(async params=>{calls.push(params.after);return params.after?{data:[media('video2','VIDEO','2026-10-02T12:00:00Z','FEED'),media('old','VIDEO','2026-09-30T12:00:00Z')]}:{data:[media('video1'),media('video1'),media('photo','IMAGE'),media('carousel','CAROUSEL_ALBUM'),media('story','VIDEO','2026-10-04T12:00:00Z','STORY')],paging:{next:'ignored',cursors:{after:'page2'}}};},'2026-10-01','2026-10-08');
 equal(result.map(r=>r.media_id),['video1','video2']);equal(calls,[undefined,'page2']);
});
Deno.test('usa data de Manaus, não o dia UTC',async()=>{
 equal(diaManaus('2026-10-05T02:00:00Z'),'2026-10-04');
 const r=await coletarVideos(async()=>({data:[media('ok','VIDEO','2026-10-02T02:00:00Z'),media('before','VIDEO','2026-10-01T02:00:00Z')]}),'2026-10-01','2026-10-08');equal(r.map(x=>x.media_id),['ok']);
});
Deno.test('zero confirmado é diferente de falha ou página truncada',async()=>{
 equal(await coletarVideos(async()=>({data:[]}),'2026-10-01','2026-10-08'),[]);
 for(const reply of [{},{data:[media('a')],paging:{next:'yes'}},{data:[media('a','VIDEO','2026-10-01T12:00:00Z'),media('b')]}]){
  let failed=false;try{await coletarVideos(async()=>reply,'2026-10-01','2026-10-08');}catch{failed=true;}equal(failed,true);
 }
 let failed=false;try{await coletarVideos(async p=>{if(p.after)throw new Error('Meta indisponível');return {data:[media('a')],paging:{next:'yes',cursors:{after:'b'}}};},'2026-10-01','2026-10-08');}catch{failed=true;}equal(failed,true);
});
