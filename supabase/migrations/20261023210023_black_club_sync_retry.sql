-- Retomada exclusiva da fila Club. O receptor e o job Perfil não são alterados.
-- Aproveita somente autenticação e formato do job B2B já validado; segredo fica no Vault.
do $setup$
declare source_command text; club_command text;
begin
 select command into strict source_command from cron.job where jobname='black-perfil-planilha';
 if source_command not like '%/perfil-clinica?sync=1%'
    or source_command not like '%x-perfil-sync-token%'
    or source_command not like '%perfil_sync_token%'
    or source_command not like '%vault.decrypted_secrets%' then
   raise exception 'Revisar contrato do agendador B2B antes de criar retomada Club';
 end if;
 if not exists(select 1 from vault.secrets where name='perfil_sync_token') then
   raise exception 'Credencial de sincronizacao indisponivel';
 end if;
 source_command:=replace(replace(source_command,'/perfil-clinica?sync=1','/club-cadastro?sync=1'),'x-perfil-sync-token','x-club-sync-token');
 -- Quando não há pendências vencidas, não chama função ou Google.
 club_command:=format($template$
do $club_job$
begin
 if exists(select 1 from public.black_club_cadastros where synced_at is null and next_sync_at<=now() and (sync_lock_until is null or sync_lock_until<now())) then
   execute %L;
 end if;
end
$club_job$;
$template$,source_command);
 perform cron.schedule('black-club-planilha','*/5 * * * *',club_command);
end
$setup$;
