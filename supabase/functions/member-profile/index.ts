import {createClient} from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import {createHandler} from './core.mjs';
import {loadMemberProfile} from '../_shared/member-profile-store.mjs';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
Deno.serve(createHandler({
 authorize:async(header:string)=>{
  if(!header.startsWith('Bearer '))return false;
  const user=await db.auth.getUser(header.slice(7));if(user.error||!user.data.user)return false;
  const admin=await db.from('app_admins').select('user_id').eq('user_id',user.data.user.id).maybeSingle();return !admin.error&&!!admin.data;
 },
 load:(memberId:string,sections?:string[])=>loadMemberProfile(db,memberId,sections)
}));
