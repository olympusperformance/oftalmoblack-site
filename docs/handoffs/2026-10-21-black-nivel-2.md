# Nível 2: interessados pelo Instagram

Variante aprovada em 21/10 para quem acompanha o evento pelo Instagram e quer conhecer melhor o Club OftalmoBlack, mesmo sem estar presencialmente. Mesma ficha e receptor do nível 0; abertura curta, título e CTA inicial próprios. Perguntas, envio final, múltipla escolha, condicionais e tratamento de falhas preservados. Níveis 0 e 1 mantidos.

Título: “Quer saber se o Black faz sentido para sua clínica?”. Texto: “Está acompanhando o evento e quer conhecer melhor o Black? Conte um pouco sobre sua clínica e o momento do seu negócio.” Botão dos contatos: “Quero conhecer o Black”. Perguntas usam Continuar; envio final explícito “Enviar minhas respostas”. Sem etapa adicional antes dos contatos.

## Links para encaminhamento à Larissa

- Bio: https://oftalmoblack.com.br/perfil-clinica/nivel-2/?origem=direto&utm_source=ig&utm_medium=social&utm_campaign=perfil-black-evento&utm_content=link_in_bio
- Stories: https://oftalmoblack.com.br/perfil-clinica/nivel-2/?origem=stories&utm_source=ig&utm_medium=stories&utm_campaign=perfil-black-evento&utm_content=link_stories

UTMs seguem o contrato Olympus. Bio mantém `origem=direto` para preservar o enum existente, com aquisição identificada por `ig/social/link_in_bio`. Stories usa `origem=stories`. Campanha orgânica comum `perfil-black-evento`. A coluna Página distingue a variante em ambos os destinos. Sem novas conversões Meta/GA4, alterações em campanha ou CRM.

## Recebimento e revisão

`perfil-clinica` no Web/Admin, tabela privada `black_perfis_clinica`, planilha privada Olympus na aba Cadastros. Sem mudança de banco, function ou secrets. Sucesso depende do ACK do receptor. Dados são enviados somente ao concluir todas as respostas.

QA local em quatro larguras, revisão visual e de código. Perguntas e JS comparados ao nível 0, com apenas o texto do CTA dos contatos mudando no JS. Uptime usa o marcador exclusivo `data-variant="nivel-2"`.

Felipe pediu envio direto ao Dr. Alex pela Evolution para revisar abertura e perguntas, contextualizando a finalidade. Encaminhamento à Larissa fica com Felipe. Recibos de publicação, submit e mensagem serão registrados no fechamento.
