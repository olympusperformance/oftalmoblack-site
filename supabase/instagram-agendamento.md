# Coleta do Instagram

O admin e os membros consultam `public.instagram_resumo` e
`public.instagram_serie`. A tela so muda quando uma nova coleta grava
`cerebro.instagram_metricas`.

Em 11/09/2026 o banco ainda mostrava 04/09: o coletor estava no repositorio,
mas faltavam a Edge Function publicada, seus secrets e o agendamento.

## Instalacao

1. Aplicar `supabase/instagram.sql` em projetos novos.
2. Configurar os secrets `META_SYSTEM_USER_TOKEN` e `METRICAS_TOKEN` da Edge
   Function. O primeiro e o token do system user com acesso as contas; o segundo
   deve ser um segredo aleatorio exclusivo do coletor.
3. Publicar a funcao com o comando abaixo. A autenticacao e feita pelo header
   `x-metricas-token`; chamadas sem o segredo sao recusadas.
4. Criar no Supabase Vault os secrets `instagram_project_url` (URL do projeto)
   e `instagram_metricas_token` (mesmo valor de `METRICAS_TOKEN`). Nunca colocar
   esses valores em arquivos versionados ou no frontend.
5. Aplicar `supabase/instagram-agendamento.sql`.

```sh
supabase functions deploy instagram-metricas --project-ref zpyxnkuvircukjlfexrv --no-verify-jwt --use-api
supabase db query --linked --file supabase/instagram-agendamento.sql
```

O agendamento executa todos os dias as 7h e 19h de Manaus (11h e 23h UTC).
Uma segunda coleta no mesmo dia atualiza o retrato, sem duplicar registros.
O payload automatico e `{}`: a funcao sempre usa a data atual em UTC e rejeita
datas antigas porque a Meta retorna o total de seguidores do momento.

## Operacao

Para disparar uma coleta pelo SQL Editor ou pelo CLI autenticado:

```sql
SELECT cerebro.instagram_coletar_agora();
```

A chamada retorna um `request_id` e executa depois do commit. Consultar a
resposta HTTP usando esse ID; o sucesso do job SQL sozinho nao confirma que a
Meta respondeu nem que todas as contas foram coletadas.

```sql
SELECT id, status_code, timed_out, error_msg, content
FROM net._http_response
WHERE id = <request_id>;

SELECT dia, count(*) AS contas
FROM public.instagram_resumo
GROUP BY dia
ORDER BY dia DESC;

SELECT jobname, schedule, active
FROM cron.job
WHERE jobname = 'instagram-metricas-diario';
```

Conferir `coletadas`, `contas` e `falhas` na resposta da funcao. Uma falha de
insights ainda permite salvar seguidores e publicacoes daquela conta; nenhuma
conta coletada retorna HTTP 502. Os dias sem coleta nao sao preenchidos com
totais de seguidores atuais, pois isso inventaria uma progressao historica.

Agendamento com pg_cron, pg_net e Vault conforme a
[documentacao do Supabase](https://supabase.com/docs/guides/functions/schedule-functions).
