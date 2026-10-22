# Nível 1: check-in individual no evento Black

Entrada `/perfil-clinica/nivel-1/`: pergunta se é membro. Não membro vai à ficha existente, preservando origem e UTMs permitidos. O nível 0 permanece byte a byte idêntico. Membro com sessão ativa envia com um clique; sem identificação, informa somente e-mail de cadastro. Uma sessão expirada deve abrir esse mesmo formulário curto.

Receptor novo `black-presenca` no Supabase Web/Admin `zpyxnkuvircukjlfexrv`, JWT habilitado. Token de membro opcional em `x-member-token`, validado no Auth antes de resolver `members.user_id` ativo. Nenhum ID de membro vindo do navegador é aceito. O retorno não informa se o e-mail pertence à base. E-mail informado é autodeclaração, mesmo quando associado a um cadastro existente.

Tabela privada `black_presencas_evento` e RPCs somente service_role, RLS e grants restritos. Chave de evento fixada pelo servidor: `imersao-marketing-2026-10`, uma presença por evento/e-mail. Para um próximo evento, alterar a chave antes de distribuir o link. Check-in não comprova localização física e não altera pontuação/graduação, `cb_encontros` ou `cb_quarters`.

Uma sessão autenticada pode qualificar um registro anterior por e-mail sem duplicar a presença. Esse upgrade incrementa `revision`; o sincronizador antigo não pode marcar a revisão nova como sincronizada. Lease de cinco minutos e lote máximo de três registros, retentativa via cron `black-presenca-planilha` a cada cinco minutos.

Planilha privada existente da Olympus, aba **Presenças**, 15 colunas. Mesma SA e secrets `PERFIL_*` do nível 0. Escrita RAW em linha estável, proteção da aba, datas numéricas locais, conferência de ID antes de sobrescrever e expansão da grade. Usar visualizações de filtro, sem mover linhas físicas.

Migração aplicada: `20261022021522_black_presencas_evento.sql`. Function v1. Cron job 5. Código do nível 0 e seu receptor preservados. Testes: `node --test tests/black-presenca.test.mjs`; SQL em `tests/black-presenca.sql` usa rollback, inclusive quando lê um membro existente para exercitar associação autenticada, sem persistir presença dessa pessoa.

Publicação e recibos reais serão registrados após o teste da URL viva. Não houve mensagens ou eventos de marketing.
