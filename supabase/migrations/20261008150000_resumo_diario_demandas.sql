-- Resumo diário das demandas no WhatsApp de cada pessoa da equipe.
-- A função `resumo-demandas` lê `staff.whatsapp` e manda, às 7h45 de Brasília,
-- as demandas abertas em que a pessoa é responsável.

alter table public.staff add column if not exists whatsapp text;
alter table public.staff add column if not exists resumo_ativo boolean not null default true;

comment on column public.staff.whatsapp is 'Número com DDI e DDD, só dígitos (ex.: 5592999999999). Vazio = não recebe o resumo diário.';
comment on column public.staff.resumo_ativo is 'Desligue para parar o resumo diário de demandas sem apagar o número.';

create or replace function cerebro.resumo_demandas_disparar()
returns bigint
language plpgsql
security definer
set search_path to 'pg_catalog'
as $$
declare
  projeto_url text;
  resumo_token text;
begin
  select decrypted_secret into projeto_url
    from vault.decrypted_secrets where name = 'instagram_project_url';
  select decrypted_secret into resumo_token
    from vault.decrypted_secrets where name = 'resumo_demandas_token';

  if coalesce(projeto_url, '') = '' or coalesce(resumo_token, '') = '' then
    raise exception 'Configure instagram_project_url e resumo_demandas_token no Vault';
  end if;

  return net.http_post(
    url := rtrim(projeto_url, '/') || '/functions/v1/resumo-demandas',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-resumo-token', resumo_token),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
end;
$$;

revoke all on function cerebro.resumo_demandas_disparar() from public, anon, authenticated;

-- 7h45 em Brasília = 10h45 UTC, todos os dias.
select cron.unschedule('resumo-demandas-diario')
 where exists (select 1 from cron.job where jobname = 'resumo-demandas-diario');
select cron.schedule('resumo-demandas-diario', '45 10 * * *', 'select cerebro.resumo_demandas_disparar();');
