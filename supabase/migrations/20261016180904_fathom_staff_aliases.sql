-- Confirmed internal names are private registry data, never inferred from meetings.
create table memoria_operacional.staff_aliases (
  staff_id uuid not null references public.staff(id),
  alias text not null check (alias = btrim(alias) and length(alias) between 2 and 200),
  confirmed_by text not null check (length(btrim(confirmed_by)) between 2 and 200),
  created_at timestamptz not null default now(),
  primary key (staff_id, alias)
);

alter table memoria_operacional.staff_aliases enable row level security;
revoke all on memoria_operacional.staff_aliases from public, anon, authenticated;
comment on table memoria_operacional.staff_aliases is
  'Aliases explicitly confirmed by an operator. Read by the private Fathom worker; no client access.';
