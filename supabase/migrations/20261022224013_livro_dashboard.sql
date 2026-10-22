-- Painel exclusivo de administradores. Somente agregados e metadados de origem.
create table public.book_dashboard_snapshots (
  source text primary key check (source in ('ga4','greenn')),
  payload jsonb not null default '{"rows":[]}'::jsonb check (jsonb_typeof(payload)='object'),
  last_success_at timestamptz,
  updated_at timestamptz not null default now(),
  error text check (length(error)<=500)
);
create table public.book_publications (
  media_id text primary key check (media_id ~ '^[0-9]{5,25}$'),
  title text not null check (length(title)<=180),
  permalink text check (permalink ~ '^https://(www\.)?instagram\.com/(reel|p|tv)/[A-Za-z0-9_-]+/$'),
  published_at timestamptz,
  updated_at timestamptz not null default now()
);
create table public.book_sale_attributions (
  sale_id bigint primary key check (sale_id>0),
  product_id integer check (product_id in (199173,199893)),
  utm_source text not null default '' check (utm_source ~ '^[A-Za-z0-9_-]{0,180}$'),
  utm_medium text not null default '' check (utm_medium ~ '^[A-Za-z0-9_-]{0,180}$'),
  utm_campaign text not null default '' check (utm_campaign ~ '^[A-Za-z0-9_-]{0,180}$'),
  utm_content text not null default '' check (utm_content ~ '^[A-Za-z0-9_-]{0,180}$'),
  origin_mode text not null check (origin_mode in ('greenn_csv','greenn_ui','greenn_webhook')),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
create function public.book_attribution_stamp() returns trigger
language plpgsql set search_path=public as $$
begin
 new.updated_at:=now(); new.updated_by:=auth.uid(); return new;
end $$;
create trigger book_attribution_stamp before insert or update on public.book_sale_attributions
for each row execute function public.book_attribution_stamp();
revoke all on function public.book_attribution_stamp() from public, anon, authenticated;

alter table public.book_dashboard_snapshots enable row level security;
alter table public.book_publications enable row level security;
alter table public.book_sale_attributions enable row level security;
revoke all on public.book_dashboard_snapshots,public.book_publications,public.book_sale_attributions from public,anon,authenticated;
grant select on public.book_dashboard_snapshots,public.book_publications,public.book_sale_attributions to authenticated;
grant insert(sale_id,product_id,utm_source,utm_medium,utm_campaign,utm_content,origin_mode),
 update(product_id,utm_source,utm_medium,utm_campaign,utm_content,origin_mode)
 on public.book_sale_attributions to authenticated;
grant all on public.book_dashboard_snapshots,public.book_publications,public.book_sale_attributions to service_role;
create policy book_snapshots_admin_read on public.book_dashboard_snapshots for select to authenticated using ((select public.is_admin()));
create policy book_publications_admin_read on public.book_publications for select to authenticated using ((select public.is_admin()));
create policy book_origins_admin_read on public.book_sale_attributions for select to authenticated using ((select public.is_admin()));
create policy book_origins_admin_insert on public.book_sale_attributions for insert to authenticated with check ((select public.is_admin()) and origin_mode='greenn_csv');
create policy book_origins_admin_update on public.book_sale_attributions for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()) and origin_mode='greenn_csv');
notify pgrst,'reload schema';
