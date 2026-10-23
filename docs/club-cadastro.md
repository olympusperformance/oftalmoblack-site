# Club OftalmoBlack: página curta e cadastro

Pedido de Felipe em 23/10/2026: resumir a apresentação do Club, deixar claro o que é e para quem, pedir somente nome completo e telefone e liberar o WhatsApp do Jean depois do cadastro. Sem checkout.

## Página

Rota `/club/`, home existente preservada. Hero, três entregas, perfil do médico, mentor compacto e duas dúvidas. Identidade Black, Cinzel local e fotos reais. Revisão autorizada por Felipe em 23/10: “Sua clínica particular, com método e execução.” O Black orienta, treina e também pode executar frentes combinadas conforme o diagnóstico e o plano da clínica. A home antiga não é fonte atual da oferta.

A fala da imersão informa a jornada de captação, chamada consultiva, vendas, encantamento e recorrência. Cérebro Black é apresentado como a área do mentorado com planos, roteiros, materiais e acompanhamento das entregas; não confundir com o agente clínico homônimo. Mentoria com Dr. Alex e troca entre donos de clínica permanecem. Sem ofertas avulsas, preços, datas, descontos, execução ilimitada ou promessas de resultado.

Fonte: `public/club/`. Somente dois campos visíveis. Sem JavaScript, o botão permanece desabilitado e o formulário usa POST como proteção contra dados na query. O script habilita o envio após instalar a validação e o listener. Dados pessoais ficam somente na memória da página e no receptor privado; nenhum rascunho em localStorage.

## Cadastro e contato

`POST https://zpyxnkuvircukjlfexrv.supabase.co/functions/v1/club-cadastro`, no projeto OftalmoBlack Web, com a chave anon pública já usada no domínio. Payload: `submission_id` UUIDv4, `nome`, `whatsapp` E.164, `pagina: /club/`, `utm` limitada. Recibo HTTP 2xx com `{ok:true,id}` correspondente é obrigatório. Erro, timeout ou recibo inválido conserva os campos e permite reenvio com o mesmo ID. Alteração dos dados cria nova tentativa lógica. Duplo envio em andamento é bloqueado.

Após o recibo, a página limpa os campos e mostra `Cadastro recebido` e o CTA `Falar com o Jean no WhatsApp`. A conversa só abre por clique do visitante. Destino `5511993436267`; mensagem fixa natural: `Olá, Jean! Fiz meu cadastro na página do Club OftalmoBlack e quero saber mais sobre a mentoria.` Nenhum código, nome, telefone ou parâmetro de aquisição é incluído no texto. Cadastro não significa ingresso confirmado no Club.

Backend isolado em `supabase/functions/club-cadastro/`. Tabela `black_club_cadastros`, RLS e RPC service-only. Reenvio idêntico retorna o mesmo recibo; colisão de ID com conteúdo diferente retorna 409. Espelho na aba exclusiva `Club OftalmoBlack` da planilha B2B já existente. ID e linha exclusivos; gravação RAW e verificação do ocupante antes de escrever. Falha no espelho mantém o cadastro durável e agenda retentativa. Não alterar a aba Cadastros, os receptores anteriores, membros, presenças ou Sistema Black.

## Medição

Reutiliza Pixel B2B `919253591198015` e GA4 `G-5NMXL3LD47` no navegador. PageView/ViewContent, início, tentativa e erro de formulário; Lead/generate_lead somente após recibo validado. Contact/whatsapp_click somente no CTA liberado. Nenhum Purchase, InitiateCheckout ou CAPI novo. Sem campanhas ou conversões personalizadas novas nesta entrega.

`?qa=1` ou `utm_source=qa`, sem distinção de maiúsculas nesta última, suprime os SDKs/eventos. Queries desconhecidas são removidas antes de carregar SDKs em produção. Preserva UTMs permitidas, aid e identificadores de clique válidos. Valores do formulário não entram em analytics. Acesso pelo navegador à URL do WhatsApp não comprova envio da mensagem.

## Verificação

Suíte visual/funcional no espelho privado testa quatro larguras, validação, CTA condicionado ao recibo, erro e reenvio, timeout, recibo inválido, limite, dois cliques, UTMs/privacidade, telemetria sem PII e fallback sem JS. Os transportes de cadastro, analytics e WhatsApp são interceptados nessa suíte. A homologação real usa fixture técnica em modo QA, confirma banco e planilha e remove somente a fixture criada. Evidências ficam no espelho privado.

Publicação pelo fluxo GitHub Actions normal, sem reiniciar a VPS. HTML sempre revalidado; CSS e JS referenciados por hash. Reversão da página: retirar a rota nova em commit, mantendo os dados captados privados para avaliação; não excluir tabela ou registros para reverter uma mudança visual.
