# Livro: compra com frete manual após o pagamento

Felipe autorizou em22/10 liberar a compra imediatamente com frete calculado depois, pelo comercial do Jean, sem outra rodada de revisão. Esta entrega usa o fluxo existente da Greenn e atendimento humano por WhatsApp.

## Caminho para o comprador

1. QR do livro: `https://oftalmoblack.com.br/livro/`. Os cinco botões abrem `https://payfast.greenn.com.br/199173?ch_id=144678`, preservando UTMs, `aid`, identificadores permitidos e `src=lp-livro`.
2. O comprador paga somente o livro. Frete separado após a compra está explicado antes do checkout, na descrição Greenn, no título da oferta e no botão de pagamento.
3. Greenn mantém Link externo como destino após pagamento: `/livro/obrigado/`. Tema dedicado usa confirmação flash de2s antes de seguir para a página.
4. A página de pedido recebido orienta tocar em **Calcular frete no WhatsApp**. Abre uma mensagem preenchida para `559284654390`; o comprador a envia. A URL não carrega e-mail, telefone, endereço ou parâmetros recebidos da Greenn.
5. Jean/equipe conferem a venda na Greenn usando o e-mail informado, confirmam CEP/endereço/quantidade, cotam o pacote real e informam a cobrança separada de frete antes do envio. Pré-venda de45dias preservada; prazo de transporte começa após postagem.

Não foi implantado disparo automático para compradores nem integração nova com um sistema chamado “setmaster”. O termo foi solicitado para esclarecimento no chat; o caminho manual já usa o destino comercial identificado. Abrir a página de obrigado ou enviar mensagem não comprova pagamento. Nunca despachar sem conferir a venda e o acerto do frete.

## Configuração comprovada

- Número comercial do Jean `+55 92 8465-4390`: referência Olympus de01/10, WABA `1680338993066186`; Evolution pessoal confirmou `exists=true` para o mesmoJID em22/10. A Evolution foi usada somente para essa leitura; nenhum WhatsApp foi enviado nesta entrega.
- Produto199173 e oferta padrão4kswBg preservados. Tema criado exclusivamente para o livro, ID144678, selecionado no linkMAIN; não altera tema do curso de catarata.
- Botão nativo: **Comprar livro · frete à parte**. Contato WhatsApp do tema persistido como `BR.55.9284654390`, com mensagem sobre o livro/frete.
- Título da oferta: **Livro Presbiopia Cirúrgica · Frete calculado e cobrado após a compra**. Descrição confirma cobrança manual posterior e o número comercial. Página de vendas corrigida para `/livro/`.
- PreçoR$1.050 e até6xR$175 mantidos. CupomOFTALMOBLACK conferido no checkout novo: descontoR$525, totalR$525, até6xR$87,50. Não foi autoaplicado ao público geral.
- Frete dinâmico continua desligado: a ausência da conexão de transporte não é chamada pelo fluxo atual. **A Greenn ainda exibe “Grátis” na linha de frete zerado.** Isso não foi removido; as condições de cobrança posterior foram explicitadas no título, botão, descrição e páginas. Não afirmar que a etiqueta foi corrigida ou que o frete está incluído.
- A resposta pública ainda informa `status_product=REVISION` e `status_offer=REVISION`; checkout renderiza e aceita cupom. Nenhuma compra real/liquidação foi realizada ou homologada por esta entrega. Não tratar abertura do formulário ou cupom como prova de pagamento.
- Campos físicos antigos da Greenn continuam estimativas e não são usados para calcular este frete manual. Peso do exemplar informado por Felipe é1,05kg; medir/pesar as caixas antes da cobrança efetiva. Origem Barueri permanece provisória até confirmação da expedição.

## Tracking e testes

Purchase real continua na Greenn. Removidos `CompraLivro`/`compra_livro` com valor fixoR$1.050 da página pública de obrigado: qualquer acesso era contado, sem comprovar pagamento e ignorando o cupom. PageView e configuração dos SDKs preservados, sem criar uma nova conversão. Eventos e decoração de checkout da LP continuam existentes.

`node tests/livro-frete.browser.cjs`:320/390/768/1280px, aviso de frete, destino comercial, ausência dePII nos links, ausência de conversão ao abrir obrigado, nenhum overflow/erroJS. `BOOK_BASE=https://oftalmoblack.com.br/` testa produção, com analytics/WhatsApp/checkout externo bloqueados; clique interceptado conserva `ch_id`, UTM da credencial e `src`. Revisão independente sem achados; conferência visual corrigiu quebra do número comercial no aviso.

Códigoe74aed3 + ajuste380e8b9, deploys39819256304 e39819714563 concluídos. Conteúdo público comparado à fonte normalizada: LP SHA`f1ef19880756a33d3cc2996f799757e006c5300e547d8d9b12abdfc942f78256`; obrigado SHA`6bd5b19bfb70407389795e865aa3b8102d321193cd73177af7625954c2b5b968`. Brutos/capturas ficam no espelho privado em `_qa/liberacao-frete-manual-2026-10-22/`, fora doGit.

O QR de presença do João Felipe continua separado: `/perfil-clinica/nivel-1/?origem=presencial`. Membro registra presença diária; não membro segue à ficha. Não trocar o destino desse QR pelo checkout do livro.
