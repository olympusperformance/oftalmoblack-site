-- Encerramento das respostas e resultado publicado da rodada.
-- O resultado é a decisão da equipe: cada item liga um mentorado a um benefício.
alter table public.cb_vitrine_rounds
 add column responses_closed_at timestamptz,
 add column results jsonb not null default '[]'::jsonb check (jsonb_typeof(results)='array');
comment on column public.cb_vitrine_rounds.results is 'Contemplados: [{member_id,name,benefit,offer,choice,points,note}]. offer nulo = data a confirmar.';
