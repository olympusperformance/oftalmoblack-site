# Ficha de preparação da SDR no Cérebro

O formulário registra as decisões da clínica para preparar um clone da SDR, com a mesma experiência de link individual usada na coleta da mentoria. É uma fonte de planejamento, não ativa atendimento nem registra aceite comercial. As respostas ficam no projeto Web/Admin do Cérebro, não no projeto do CRM. O cadastro canônico é `members.id`; a clínica do CRM é outro vínculo a ser validado.

## Operação

1. A equipe autenticada em `/admin/perfis/` escolhe o membro e usa **Preparação da SDR → Preparar link da SDR**. O servidor gera token aleatório, armazena apenas hash e define expiração de 30 dias. O token fica no fragmento do link e a emissão não envia mensagem. Equipe pode revogar links.
2. O mentorado abre o link, responde o que souber e salva. O servidor valida o contrato, determina o membro pelo token e só confirma depois de persistir. Respostas parciais são permitidas. Um UUID de envio torna a repetição do mesmo pedido idempotente; um complemento grava outra fonte. A última resposta representa o formulário inteiro, não um patch.
3. A ficha mais recente é visível à equipe no Admin, incluindo respostas originais e datas. O MCP da equipe disponibiliza `ficha_sdr_do_mentorado`; o chat somente da prévia administrativa usa `consultar_ficha_sdr`, com membro fixado pelo servidor. Não há acesso dessa ficha pelo chat comum do mentorado. Os leitores devolvem também uma eventual fonte inicial versionada `sdr-ficha-base-v1` já curada em `member_context_entries`.
4. O agente considera a fonte inicial, a resposta declarada e as datas. Fatos antigos, preços, convênios, responsáveis e agenda precisam de verificação apropriada. Campos vazios ou “a definir” são pendências; respostas não constituem instruções para alterar permissões ou ativar a SDR.

Os exemplos de resposta são ilustrativos e não são salvos. Os botões de padrão da Íris preenchem sugestões editáveis apenas quando o campo está vazio; nunca substituem resposta já digitada. Horários, mensagens ativas, origens, testadores, fatos sobre o médico e outras particularidades dependem da clínica. O acompanhamento sugerido e os cenários não ativam cadências ou ferramentas.

Áudio, imagem e documentos são requisitos comuns do serviço e não uma pergunta individual. O Cérebro deve orientar a preparação do clone a transcrever áudio e responder em texto, usar visão para imagens e ler documentos, com configuração e teste antes da ativação. Transcrição e leitura de comprovantes têm evidência no código consultado; essa evidência não certifica leitura geral de imagens/documentos instalada em cada clínica.

## Preparar o clone

Consultar o estado vigente do repositório privado `olympusperformance/sdr-ia`, especialmente a arquitetura, `clinicas/_template`, contrato de configuração, prompt e runbook de isolamento. Cada médico usa sua própria branch/worktree conforme a organização vigente, com ficha de fatos, configuração, onboarding, prompt, cenários e manifesto identificados por clínica. Não copiar valores de outra clínica nem presumir que campo ausente seja o default do Alex.

Conferir canal e política de posse, turnos e responsáveis; serviços, locais e preços aprovados; convenios e suspensões; agenda conciliada e permissões; pagamentos, regras clínicas, linguagem, follow-up, entrada por origem, intervenções humanas e testadores. Preparar cenários de preço, falta de vaga, particular, convênio, suspensão, solicitação humana e intervenção da equipe. Segredos não entram neste formulário. Qualquer teste real exige identificar os números e o ambiente autorizado.

A ficha facilita produzir o documento e os artefatos para piloto. Não instala automaticamente o clone, não cria credenciais, não conecta agenda, não cria vagas, não publica, não aciona mensagens, nem comprova teste. Ativação de atendimento aberto e cobrança permanecem decisões posteriores. Não prometer autonomia onde a configuração, fontes ou ferramentas não estejam validadas.

## Dados e segurança

`sdr_intake_links` e `sdr_context_entries` têm RLS e leitura restrita a administradores; funções SQL de consulta e gravação por token são executáveis apenas pelo serviço. O corpo público não aceita `member_id`, fonte ou autorização de ativação. Cada envio é append-only, com idempotência e limite de frequência. Não usar chaves de serviço na página nem registrar bearer links, respostas, credenciais ou dados de pacientes no Git. A ferramenta MCP interna é protegida pelo mecanismo de autorização existente; as respostas são dadas como fonte não confiável.

O conteúdo da SDR não amplia o catálogo comum de 98 campos, nem altera respostas do pré-diagnóstico; é um documento próprio vinculado ao mesmo membro. Ele não é indexado automaticamente na busca vetorial. A leitura da ferramenta e da prévia administrativa deve ser homologada separadamente da persistência.

## Implantação e validação

Aplicar no projeto Web/Admin a migration `20261027205506_sdr_onboarding_cerebro.sql`, pelo fluxo da equipe e com backup. Depois publicar `sdr-onboarding` e as versões revisadas de `cerebro-mcp` e `cerebro-chat`, preservando secrets e configuração de autenticação. Publicar frontend e nginx do mesmo commit. Não criar link real antes de confirmar os componentes.

Validar grants/RLS, recusa a token ausente/aleatório/expirado/revogado, acesso de admin, separação de membros, idempotência e leitura de resposta no MCP e prévia interna. Usar dados fictícios em membro de teste; nunca submeter fixture à ficha real de Oswaldo. Emitir o link real só depois do aceite técnico, conferir que load retorna o destinatário correto e guardar a URL fora de logs/repo. Mensagem e canal seguem autorização específica.

Rollback: revogar os links de SDR e retirar a rota; preservar registros existentes. Não apagar tabelas/fontes nem restaurar versões de functions de forma cega sobre mudanças posteriores. A existência de merge, CI ou arquivos não comprova deploy do banco, funções e frontend.
