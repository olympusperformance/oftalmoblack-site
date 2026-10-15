# Campanha de Branding

Nova aba em Admin/Membros, imediatamente após Instagram, no endereço
`#branding`. A tabela de impulsionamentos saiu de Instagram e usa um componente
compartilhado. Mantidos indicadores, faixas de custo, links dos posts e filtros
de 90 dias/todo o histórico. Admin escolhe qualquer mentorado; pré-visualização
preserva a escolha e retorna à mesma aba. Membro consulta apenas seu cadastro.

Sem campanha disponível, o membro lê: “Você ainda não está realizando a
campanha de branding ou ainda não liberou acesso à sua conta Meta. Fale com a
equipe para começar ou conferir o acesso.” Não se infere qual das duas causas
ocorreu. Conta aguardando primeira coleta e falha de coleta/consulta têm estados
próprios. Mensagens brutas do provedor não são mostradas. Dados já coletados
continuam visíveis com aviso quando há erro de atualização.

A carga acontece ao abrir a aba. Atualizar relê as views, sem disparar campanha
ou coleta na Meta. Respostas atrasadas de outro mentorado são descartadas.
Paginação de 500 registros evita o corte do PostgREST; erro em qualquer página
não exibe histórico parcial. Só links HTTPS do Instagram são clicáveis.

## Validação

- 14 testes de dados Branding e Instagram aprovados, incluindo 1.123 registros,
  filtro em todas as páginas, erro intermediário e ausência de membro.
- Suíte Playwright completa aprovada: Admin/Membro, navegação, seletor, estado
  sem campanha, erro/retry, privacidade visual, desktop/mobile e demais áreas.
- Capturas de Branding inspecionadas em desktop e 390 px; rolagem horizontal
  fica contida na tabela.
- RLS hospedado conferido em leitura com papel authenticated de membro:
  campanhas próprias acessíveis; zero campanhas/contas de terceiros.
  Acesso anônimo negado. Nenhum dado real alterado.

## Publicação e reversão

Somente front-end; nenhuma migration, conta Meta ou rotina de coleta alterada.
As views existentes de impulsionamentos usam security_invoker e RLS.
Assets versionados nos dois HTMLs. Publicação pela workflow existente após PR.
Reversão: reverter o commit; a tabela volta à posição anterior no Admin.
