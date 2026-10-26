# Agente de comentários em Módulos à parte

Pedido de Ítalo em 26/10/2026: mover o agente de comentários para Módulos à parte, junto da Íris Black.

Os acessos “O bot respondeu” (`botFila`) e “Voz do bot” (`botExemplos`) passam de “Operação da equipe” para “Módulos à parte”, logo após “Fábrica · Íris Black”, no menu do Admin. As chaves de navegação, telas e permissões permanecem iguais.

Verificação: `node --check public/assets/admin.js`, `git diff --check` e inspeção executável da configuração de navegação confirmando grupo, ordem, ausência de duplicação e existência das duas telas de destino. Não há alteração de banco ou serviço do agente.

Entrega por PR na branch `fix/comment-agent-modules`. Publicação não executada nesta etapa.
