# Presença diária do Black na TV do evento

Felipe aprovou em 22/10 o uso do nível 1 na TV e pediu somente nome para membros, com registro do dia. O nível 2 do Instagram foi informado por ele como aprovado pelo Dr. Alex. Níveis 0 e 2 preservados.

## Uso no evento

- Formulário: https://oftalmoblack.com.br/perfil-clinica/nivel-1/?origem=presencial
- Arte 1920×1080 para TV: https://oftalmoblack.com.br/perfil-clinica/nivel-1/tv-presenca.png
- QR avulso: https://oftalmoblack.com.br/perfil-clinica/nivel-1/qr-presenca.png

QR abre a página no celular de cada participante. “Sim, sou membro” pede somente **Nome completo**, sem login, e-mail ou leitura da sessão do operador. “Ainda não sou membro” segue ao nível 0. Sucesso limpa o nome e oferece “Registrar outra presença”, sem reinício automático.

## Data e identidade

O banco define `dia_presenca` com `now() at time zone 'America/Sao_Paulo'`. Não aceita data enviada pelo navegador. A confirmação mostra o dia devolvido pelo recibo. Uma presença por evento, dia e identidade. Novo dia admite nova presença; repetir um UUID já recebido continua mostrando o dia original, inclusive quando foi deduplicado por outro UUID e a confirmação se perdeu antes da meia-noite.

Nome informado é autodeclaração. Associação a membro somente se o nome completo normalizado corresponde a um único cadastro ativo; nada da lista é exposto ao navegador. Normalização ignora caixa, acentos, espaços repetidos e prefixo Dr./Dra. Nomes iguais sem associação única são deduplicados no mesmo dia e precisam de conferência em caso de homônimos; grafias diferentes podem exigir conciliação. Não altera graduação ou os registros do método.

## Integração

Migração `20261022105534_black_presencas_diarias.sql` no Supabase Web/Admin `zpyxnkuvircukjlfexrv`. Nova RPC `black_presenca_receber_v2`, recibos privados em `black_presenca_recibos` e wrapper compatível da RPC anterior. RLS/grants somente service_role. Hashes de requests legados por e-mail/sessão preservados. Tabela de presença passou de unicidade por evento/e-mail para evento/dia/identity_key estável. Retry confirmado não consome nova cota; tentativas novas limitadas por hash de rede.

Function `black-presenca` v2 com JWT ativo. Aba privada Presenças mantém as 15 colunas e ganha P **Dia de presença**, data numérica formatada dd/MM/yyyy. Cron de retentativa continua ativo. Receptor e tabelas dos níveis 0 e 2 não mudaram.

Sete testes Node, SQL transacional legado e diário com rollback passaram, incluindo recibo alternativo através da meia-noite, case/acentos e upgrade de identificação. QA de navegador em quatro larguras confirma ausência de uso da sessão, payload só com nome, ACK com data válida, falha/retry e limpeza. QR avulso e QR da arte final decodificados por OpenCV.

Publicação, recibo vivo e envio direto ao João Felipe serão registrados após a validação final. Nenhuma publicação automática em TV/Instagram ou alteração no Quadro.
