# Perfil comum do mentorado Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Uma aba interna e uma consulta de agentes com os mesmos campos fixos, fontes e datas, preenchendo somente o piloto autorizado.

**Architecture:** Catálogo JSON versionado e módulo puro comum produzem o mesmo DTO para a API interna, MCP e chat de prévia da equipe. Patches estruturados são append-only, ligados às fontes existentes; respostas do formulário são normalizadas na leitura pelo mesmo módulo. Cadastros vêm de members, independentemente de login ou cobertura de coletores.

**Tech Stack:** Site estático JS/HTML/CSS, Supabase Web/Admin, Edge Functions Deno, Postgres/RLS, Node test/PGlite.

**Spec:** `../specs/2026-10-27-perfil-comum.md`, cópia genérica do catálogo aprovado em27/10/2026. Importação real do piloto fica fora do repo público.

## Global Constraints

- Mesmas14seções, nomes, IDs, tipos e campos presentes para todos; valor desconhecido nulo e Não informado na tela.
- Não informado, ausência confirmada, não aplicável e a confirmar são distintos; zero/false não desaparecem.
- Listas crescem por registros do mesmo tipo, sem campos por pessoa, cidade, fornecedor ou caso.
- Perguntas gerais do negócio; estimativas/faixas aceitas, distinção por vínculo opcional.
- Perfil interno da equipe/agentes autorizados; não expor conteúdo interno ao chat de mentorado ou a anônimos.
- Fontes, datas, períodos e autoria preservados; documento/atualização não viram data do fato.
- Nome, e-mail, ativo, turma e fase vêm do cadastro; não criar cópia concorrente nem login.
- Somente dados do piloto são importados. Nenhum envio, CRM, paciente, convite ou reativação de coletores.
- Nenhum dado real, documento privado, credencial ou link secreto no código/repo público.

## Review Focus

- Informação antiga importada depois não pode parecer fato atual ou reativar ex-integrantes.
- Troca rápida de mentorado e respostas fora de ordem não podem exibir a ficha/token de outra pessoa.
- Uma lista longa de fontes/patches não pode truncar silenciosamente o último valor conhecido.
- Novo acesso no chat de prévia não pode liberar notas internas para usuários mentorados.
- Um campo faltante não pode sumir, virar zero ou obter valor de um mentorado diferente.

## File Structure and Interfaces

- `supabase/functions/_shared/member-profile-catalog.json`: catálogo único, campos, tipos repetíveis e indicadores.
- `supabase/functions/_shared/member-profile-model.mjs`: `emptyProfile(member)`, `normalizePatch(patch)`, `intakeToPatch(source)`, `buildProfile(member, patches, sources, connections)` e `selectProfile(profile, sections)`.
- `supabase/functions/_shared/member-profile-store.mjs`: `loadMemberProfile(db, memberId, sections?)` com leitura paginada e escopo exato.
- `supabase/migrations/*_member_profile_standard.sql`: catálogo e patches, RPC append `member_profile_apply`, RPC de cobertura/cadastro. Nome alocado pelo CLI.
- `supabase/functions/member-profile/{core.mjs,index.ts}`: leitura de perfil por POST, JWT validado no Auth e app_admins, sem criar estado em GET/leitura.
- `supabase/functions/cerebro-mcp/profile.mjs`: consulta do DTO comum e diretório por members.
- `supabase/functions/cerebro-chat/index.ts`: nova ferramenta de perfil somente para prévia autenticada de admin, sempre vinculada ao member_id já resolvido.
- `public/assets/admin-perfis.js`, `public/admin/perfis/index.html`, CSS próprio: navegação14seções, campos vazios, fontes, valores tipados e consulta atualizável; controles de link existentes preservados.
- Testes Node/modelo, Postgres/RLS, endpoints, chat, integração de leitores e UI. Fixtures de navegador locais sem dados reais.

### Task1: Contrato e normalização

**Produces:** DTO2.0 com `mentorado_id`, `revision`, `catalogo`, `campos`, `fontes`, `updated_at`. `campos` é mapa de caminhos estáveis; indicadores expandem os dez códigos em referência inicial/atual. Cada informação inclui valor, situação, natureza, fontes, referência temporal e atualização. Tipos repetíveis têm ID/estado e os mesmos campos internos, inclusive vazios.

- [ ] Escrever `tests/member-profile-model.test.mjs`: duas identidades têm o mesmo conjunto de campos; campos/itens desconhecidos rejeitados; zero/false/faixas preservados; listas tipadas completas; campos canônicos prevalecem; fonte velha não sobrescreve recente; ausência/conflito explícitos; dez perguntas mapeiam aos mesmos campos.
- [ ] Rodar e observar RED antes de implementar exports/catálogo.
- [ ] Implementar o catálogo e módulo puro. Dados de fonte não criam chaves. Metadados por item/campo são herdados apenas para valores efetivamente informados, nunca para inventar valores ausentes.
- [ ] Rodar testes de modelo e toda a suíte; esperado todos passando.
- [ ] Commit do contrato e normalização.

### Task2: Persistência e API interna

**Consumes:** catálogo e `buildProfile`. **Produces:** `loadMemberProfile`, endpoint member-profile e RPC de patch com revisão, idempotência e fontes do mesmo membro.

- [ ] Escrever `tests/member-profile-db.test.mjs` e `tests/member-profile-api.test.mjs`: anon/mentorado barrados; leitura não cria perfil; Admin autorizado; patch desconhecido/cross-member rejeitado; append imutável; conflito/duplicata; identidade canônica não é alterada por patch.
- [ ] Observar RED; criar a migração pelo CLI e preencher DDL com catálogo idêntico ao módulo. Conservar dados/fontes existentes.
- [ ] Implementar armazenamento append-only e RPC service-only; RLS de leitura da equipe e grants mínimos. Ler todas as páginas, sem truncamento silencioso; testar mais de1000fontes em fixture.
- [ ] Implementar API com validação JWT/app_admins, UUID, CORS, no-store e falha sem sucesso falso. Respostas do formulário entram via normalizador de leitura; não há novo webhook nem trigger de envio.
- [ ] Rodar testes/modelo/Postgres/API e suíte completa; commit.

### Task3: Leitores agênticos e cadastro

**Consumes:** `loadMemberProfile`. **Produces:** MCP perfil_do_mentorado com mesmo DTO e lista por cadastro; ferramenta de chat restrita à prévia de equipe.

- [ ] Escrever testes RED para equivalência dos leitores, nome ambíguo, perfil sem mensagens, usuário comum sem ferramenta interna e tentativa de consultar outro ID por argumentos.
- [ ] Atualizar perfil MCP, preservando autenticação e ferramentas existentes. A listagem usa cadastro ativo e cobertura; não exigir mensagens para listar.
- [ ] Incorporar a versão atual de cerebro-chat com mudança pontual: ferramenta somente no escopo admin e ID resolvido pelo handler. Não alterar autorização do chat/CRM/Fathom.
- [ ] Rodar suíte, Deno check e comparação do handler com snapshot anterior; commit.

### Task4: Aba humana, piloto e publicação

**Consumes:** DTO da API. **Produces:** aba comum validada em móvel/desktop e piloto preenchido com provas.

- [ ] Escrever testes RED para renderizar todas as seções/campos, valores nulos/false/zero, listas históricas e corrida de troca de membro. Manter teste de link da PR37.
- [ ] Adaptar aba existente para consumir a API comum; fontes são evidência de cada campo, com área própria para aprofundar. Adicionar link de perfil na Rede, sem liberar acesso de mentorado.
- [ ] Validar UI por CUA com fixture local e dados fictícios; enviar/recarregar somente em fixture. Rodar suíte e Deno check; commit.
- [ ] Solicitar revisão independente do branch completo; corrigir achados importantes com RED→GREEN. Abrir/anexar PR e monitor periódico conforme instruções do projeto.
- [ ] Após revisão, publicar componentes no projeto Web/Admin e frontend. Importar somente o piloto por patch padronizado, com snapshot privado anterior/fontes reais; nenhum dado real no commit.
- [ ] Verificar hashes/versões, RLS/grants, tela autenticada, leitura por agente no mesmo contrato e respostas vazias no perfil real. Registrar limites factuais e encerrar monitor após diagnóstico dos componentes.

## Execution

Execução nesta sessão, aproveitando a autorização e o fluxo já usado no piloto, com revisão independente ao final. Não criar nova sessão ou trabalho em lote.
