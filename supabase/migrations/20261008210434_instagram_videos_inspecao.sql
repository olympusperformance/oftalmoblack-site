-- Link público da publicação para inspeção. Mantém as políticas existentes.
alter table public.cb_instagram_videos add column permalink text check(permalink is null or permalink ~ '^https://(www\.)?instagram\.com/(p|reel|tv)/[A-Za-z0-9_-]+/?$');
create or replace function cerebro_private.sync_instagram_videos(p_ig_user_id text,p_desde date,p_ate date,p_videos jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare member uuid; n integer;
begin
 if p_desde is null or p_ate is null or p_ate<p_desde or p_ate>=(now() at time zone 'America/Manaus')::date then raise exception 'Janela de coleta inválida'; end if;
 if jsonb_typeof(p_videos)<>'array' then raise exception 'Publicações inválidas'; end if;
 select c.member_id into member from cerebro.instagram_contas c join public.members m on m.id=c.member_id and m.ativo
 where c.ig_user_id=p_ig_user_id and c.ativo;
 if member is null then return jsonb_build_object('linked',false,'videos',0); end if;
 insert into public.cb_instagram_videos(ig_user_id,media_id,member_id,published_at,media_type,product_type,permalink)
 select p_ig_user_id,x.media_id,member,x.published_at,x.media_type,x.product_type,x.permalink
 from jsonb_to_recordset(p_videos) x(media_id text,published_at timestamptz,media_type text,product_type text,permalink text)
 where x.media_type='VIDEO' and x.product_type is distinct from 'STORY'
 and (x.published_at at time zone 'America/Manaus')::date between p_desde and p_ate
 on conflict(ig_user_id,media_id) do update set published_at=excluded.published_at,product_type=excluded.product_type,permalink=coalesce(excluded.permalink,cb_instagram_videos.permalink),member_id=excluded.member_id,collected_at=now();
 get diagnostics n=row_count;
 -- A janela de um trimestre encerrado não desaparece nas coletas seguintes.
 insert into public.cb_instagram_video_sync(ig_user_id,period,member_id,covered_from,covered_until)
 select p_ig_user_id,to_char(q,'YYYY')||'-T'||extract(quarter from q)::integer,member,
   greatest(p_desde,q::date),least(p_ate,(q+interval '3 months - 1 day')::date)
 from generate_series(date_trunc('quarter',p_desde)::date,p_ate,interval '3 months') q
 on conflict(ig_user_id,period) do update set member_id=excluded.member_id,
   covered_from=case when excluded.covered_from<=cb_instagram_video_sync.covered_until+1 and excluded.covered_until>=cb_instagram_video_sync.covered_from-1 then least(cb_instagram_video_sync.covered_from,excluded.covered_from) else excluded.covered_from end,
   covered_until=case when excluded.covered_from<=cb_instagram_video_sync.covered_until+1 and excluded.covered_until>=cb_instagram_video_sync.covered_from-1 then greatest(cb_instagram_video_sync.covered_until,excluded.covered_until) else excluded.covered_until end,
   updated_at=now();
 return jsonb_build_object('linked',true,'videos',n);
end$$;
