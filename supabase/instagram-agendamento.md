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

## Graduação automática (desde 2026-T4)

Aplicar `20261008192117_instagram_graduacao_automatica.sql` antes de publicar
o coletor e a interface. O mesmo agendamento coleta vídeos/Reels pela lista de
publicações, com paginação, ID único e data em Manaus. A janela inclui o
trimestre anterior para fechar sua última semana; a cobertura certificada vai
até ontem. Fotos, carrosséis e stories não contam. Erro de paginação não
certifica uma semana sem vídeos. Conferir também `videos.contas_pendentes`.

`cb_instagram_videos` guarda as publicações e `cb_instagram_video_sync` guarda
a cobertura por conta/trimestre. A RPC de gravação aceita apenas o serviço;
as tabelas têm leitura protegida por RLS. `cb_scoring_profiles.entered_on`
define a entrada elegível e pode ser corrigida pela equipe.

`cb_instagram_scores` combina as leituras com ajustes auditados em
`cb_quarters`; `cb_scores` calcula os pontos usados pela graduação e ranking.
O coletor nunca escreve os ajustes. Manual, inclusive zero, prevalece até a
equipe selecionar **Usar automático** em **Apurar rotina e resultado**.
A base inicial de seguidores pode ser ajustada sem desligar a leitura atual.
Sem conexão, base ou cobertura suficiente, a métrica fica pendente.

Em 08/10/2026, a coleta de validação retornou 16 contas, 49 publicações e
nenhuma pendência de vídeos. Dos 32 mentorados da planilha, 15 tinham ambas
as fontes automáticas disponíveis e 17 aguardavam coleta/conexão. Foram
importadas 32 datas de entrada e 29 bases de seguidores com referência às
células da planilha v2.2; duas bases já coincidiam e uma estava vazia.
Não havia ajustes de vídeos preenchidos no T4. Esta importação é pontual;
o arquivo Excel não é sincronizado continuamente.

Agendamento com pg_cron, pg_net e Vault conforme a
[documentacao do Supabase](https://supabase.com/docs/guides/functions/schedule-functions).
