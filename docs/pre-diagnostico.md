# Pré-diagnóstico e fontes do perfil no Cérebro

Formulário individual, sem login do mentorado, com dez perguntas em três áreas. A coleta contextualiza o negócio e aceita estimativas, “não sei” e campos em branco. A distinção entre negócios ou unidades fica livre nas respostas. Nenhum envio de WhatsApp/e-mail faz parte deste recurso.

## Operação

1. Equipe autenticada abre `/admin/perfis/` e escolhe o membro. O cadastro de membro é separado do acesso de Auth; não criar login, senha ou convite ao preparar a ficha. Turma e fase desconhecidas ficam vazias.
2. Fontes internas recuperadas são registradas em `member_context_entries` com `member_id`, tipo, referência verificável, data da fonte, versão e síntese operacional em `data`. Cada fonte usa `source_key` estável por membro. O mesmo documento não é reimportado com outra chave para simular mais evidência. Não importar documentos pessoais, contratos, conversas brutas ou dados de pacientes.
3. “Preparar link individual” cria uma chave aleatória de 256 bits, válida por30dias. O banco guarda apenas SHA-256. O segredo é mostrado uma vez e fica no fragmento `#t=`, sem entrar no request HTTP da página. A equipe pode encerrar links. Preparar/copiar não envia mensagem.
4. O mentorado responde o que souber. O servidor resolve o membro pelo link, valida a versão/opções/limites e grava antes de confirmar. Um UUID de envio permite repetir uma tentativa sem duplicar. Novo complemento gera outro registro, preservando o anterior. O último envio é a versão atual do conjunto de respostas; campos removidos deixam de ser atuais, sem apagar o histórico.
5. Conferir fontes e respostas no perfil interno antes do diagnóstico. Uma resposta declarada não vira dado medido por API. Ausência de resposta não vira zero. Local de atendimento não prova propriedade de unidade.

## O que alimenta esta ficha

`member_context_entries` concentra sínteses de cadastro, Imersão, pesquisa, conversa, auditoria e os envios do formulário. Todas ficam vinculadas a `public.members.id`. Fontes manuais são append-only: uma correção entra como nova fonte, identificando a anterior. Somente admins podem ler o contexto; não há leitura anônima das tabelas. O link individual só dá acesso ao nome do destinatário e à última resposta da própria coleta.

Quando só o dia da fonte for conhecido, importar `source_at=AAAA-MM-DDT00:00:00Z` e `source_precision=day`. Esse calendário é exibido sem conversão de fuso. Quando houver instante original, preservar o offset/UTC e usar `timestamp`; o Admin exibe esse horário por Brasília.

Este recurso implementa a captura inicial e a leitura das fontes na área de equipe. Não implementa os14blocos do protótipo V1.1, edição por LLM ou atualização automática de panoramas. A ferramenta `perfil_do_mentorado` no `cerebro-mcp` permite consultar explicitamente as fontes da ficha, com desambiguação de nomes e limite de registros. As novas entradas **não entram automaticamente** na busca vetorial, no `cerebro-chat` ou no pipeline de `memoria_operacional`. Não apresentar o armazenamento no Supabase como prova de consulta pela IA; verificar também a publicação da ferramenta e seu retorno.

Fontes como WhatsApp, Fathom e Instagram exigem os vínculos/coletores próprios. A mera presença de uma URL, nome ou arquivo local não configura conexão. Registrar a auditoria por fonte com data. Não reativar rotinas antigas do Hermes para preencher esta coleta.

## Implantação, nesta ordem

Projeto **Web/Admin** `zpyxnkuvircukjlfexrv`, distinto do CRM/Sistema Black. Migração: `supabase/migrations/20261027032839_member_pre_diagnostico.sql`. Depois publicar `supabase/functions/pre-diagnostico` com `verify_jwt=false`: o handler autentica o link individual nas operações públicas e valida JWT pelo Auth + `app_admins` nas ações de equipe. Não existe autenticação por segredo exposto no frontend.

Publicar também `supabase/functions/cerebro-mcp` com a ferramenta `perfil_do_mentorado`, preservando `verify_jwt=false` e o segredo `MCP_TOKEN` já usado pelo conector. O arquivo index parte da versão26 lida em produção em26/10/2026; fora da ferramenta nova e do pin da dependência, o controle de acesso passa a falhar fechado se esse segredo estiver ausente. Os métodos existentes de autenticação permanecem. Validar tools/list e a consulta com a credencial existente, sem registrar segredo ou URL autenticada em logs/commits.

Por último publicar frontend/nginx pelo fluxo do site. Antes de liberar um link real: verificar tabelas/RLS/grants, versões das Edge Functions, 200 da página e assets, rejeição de token ausente/aleatório, acesso de equipe e leitura da ficha correta. Não preencher dados fictícios no perfil real. Registrar importação e validação do piloto em documento privado, fora deste repo público.

## Validação reproduzível

```sh
npm ci --ignore-scripts
npm test
node tests/pre-diagnostico-preview.mjs
```

O servidor de prévia é exclusivamente local, com dados fictícios e estado descartável. Os testes SQL usam Postgres real em memória (PGlite) com Auth/membros mínimos, sem acessar projetos remotos. Cobrem RLS, limites, vínculo por token, expiração/revogação, duplicata/conflito, histórico e imutabilidade. Testes HTTP cobrem validação, CORS, cache, autorização e falha de persistência.

Rollback: encerrar links e retirar navegação/rota pública; guardar fontes e respostas já recebidas. Não reverter tabelas com DROP nem apagar histórico. A function pode ser retirada depois de garantir que não há coleta em curso.
