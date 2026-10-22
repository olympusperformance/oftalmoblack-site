import {createHandler,EVENTO,readAll} from './core.mjs';
const db=Deno.env.get('SUPABASE_URL')!,service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
Deno.serve(createHandler({keyHash:Deno.env.get('BLACK_PRESENCA_LISTA_HASH'),read:()=>readAll(async(offset:number)=>{
 const query=new URLSearchParams({select:'id,nome,created_at,dia_presenca',evento:'eq.'+EVENTO,order:'created_at.asc,id.asc',limit:'500',offset:String(offset)});
 const r=await fetch(db+'/rest/v1/black_presencas_evento?'+query,{headers:{apikey:service,Authorization:'Bearer '+service,Prefer:'count=exact'},signal:AbortSignal.timeout(12000)});
 if(!r.ok)throw new Error('read_failed');
 return {rows:await r.json(),total:Number((r.headers.get('content-range')||'').split('/')[1])};
})}));
