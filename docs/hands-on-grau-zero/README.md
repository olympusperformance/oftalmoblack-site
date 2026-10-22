# Hands-on Grau Zero

Página B2B em `/hands-on-grau-zero/`, publicada a pedido de Felipe em 21/10/2026. Benefício central: segurança para indicar lentes de alta tecnologia, com Protocolo Grau Zero e vivência de três dias com o Dr. Alex Sá. Público: oftalmologistas, inclusive quem ainda não opera catarata e quer se habilitar a indicar essas lentes.

Revisão do Dr. Alex incorporada com autorização de Felipe em 22/10/2026: uma cirurgia por participante, dez cirurgias ao todo; todos participam do planejamento premium de todos os casos. Experiência cirúrgica prévia e clínica própria não são requisitos. O formulário aceita `ainda_nao_opero` e volume cirúrgico zero, mantendo as perguntas para conhecer o perfil.

Formulário em duas etapas. A primeira valida identificação sem enviar dados. A segunda qualifica experiência, volume cirúrgico, lentes de alta tecnologia e clínica; envio único ao concluir. Sucesso exige `ok=true` e eco do `request_id`. Retentativa idêntica usa o mesmo UUID; edição cria outro UUID. Não há abertura automática ou mensagem de WhatsApp.

## Receptor

Configuração em `receptor.json`; lógica da nova versão em `Code.gs`. Nova implantação versão 2 no projeto Apps Script já autorizado da Olympus, usando aba própria `Candidaturas Hands-on Grau Zero` na planilha de aplicações existente. A implantação antiga da mentoria continua fixada na versão 1 e sua URL não foi alterada. Não apontar o deployment legado para a versão 2 sem tratar a compatibilidade.

Google Apps Script: https://script.google.com/home/projects/1LzVoLTJsm6-wCIuKnwKx-q9R9aXS6nmv_1unb7ml4uLq1viR3NGB1Rvz/edit

Planilha de candidaturas, acesso da conta Olympus: https://docs.google.com/spreadsheets/d/1F5KdFbuHM99pgqBcdNtqsccqpDxEzK8FwPrY5NvUSwI/edit

O código da nova versão valida o esquema, grava literalmente conteúdo que possa virar fórmula, deduplica com lock e confirma apenas após flush. Não expõe registros pelo GET. Cabeçalho e aba legados preservados. Não guardar dados de leads/pacientes, credenciais ou recibos privados neste repositório público.

## Links orgânicos

Bio: https://oftalmoblack.com.br/hands-on-grau-zero/?utm_source=ig&utm_medium=social&utm_campaign=hands-on-grau-zero&utm_content=link_in_bio

Stories: https://oftalmoblack.com.br/hands-on-grau-zero/?utm_source=ig&utm_medium=stories&utm_campaign=hands-on-grau-zero&utm_content=link_stories

GA4 B2B `G-5NMXL3LD47`, Pixel B2B `919253591198015`; PageView na visita, Lead/generate_lead somente após recibo. Não enviar respostas ou dados pessoais aos eventos. `utm_source=qa` não carrega analytics, permitindo homologação sem eventos. O front armazena atribuição somente na memória da página, sem criar UTM para links internos.

HTML revalidado a cada visita. CSS/JS têm hash na query e assets com cache de 30 dias; atualizar o hash quando alterar seu conteúdo. A moldura de celular usada na revisão local não faz parte deste pacote.

## Validação

QA local em cinco larguras e testes de erro, timeout, falta/divergência de recibo, repetição e clique duplo executados antes da publicação. A confirmação de produção exige prova adicional de HTML/assets reais e de candidatura técnica recebida com todos os campos e UTMs na aba correta, seguida da retirada exclusiva do registro de teste. CI verde não substitui essa conferência.
