# Perfil comum do mentorado V2

Catálogo aprovado por Felipe em27/10/2026. Documento genérico de especificação, sem dados reais.

## Regra central

- Um único catálogo versionado define seções, ordem, nomes, IDs, tipos e significado dos campos para todos.
- Campos desconhecidos continuam presentes. A tela mostra **Não informado** e a API devolve valor nulo com situação explícita.
- Nenhum médico, operador ou agente cria uma chave diferente dentro de um perfil. Campo novo exige evolução do catálogo comum; todos passam a ter esse campo, inicialmente vazio.
- Listas podem ter quantidades diferentes de pessoas, locais, objetivos, sistemas ou eventos. Cada item da mesma lista conserva os mesmos campos. Não existem seis lugares fixos para pessoas porque um caso de referência tinha seis integrantes.
- O perfil pertence ao mentorado. Negócios e pessoas vinculadas são registros relacionados. Segunda cadeira não vira um segundo conjunto de campos improvisados.
- Perguntas e respostas são gerais do negócio. Detalhes por negócio/local são opcionais nas respostas e nos vínculos conhecidos; não exigir um formulário por unidade ou criar campos com nomes de cidades.
- O formulário coleta parte do perfil. Venda, pesquisa, Tatame e reuniões preenchem outros campos do mesmo catálogo. Ter o campo disponível não obriga a perguntar novamente, coletar tudo no onboarding ou exigir precisão que a fonte não tem.

## Catálogo comum: campos de leitura e manutenção

Os nomes entre crases são IDs locais dentro da seção. Um campo raiz tem caminho estável, por exemplo `equipe.papel_sdr`. Tipos repetíveis são detalhados abaixo. Esta é a lista proposta de dados de negócio, não um novo formulário.

| Seção estável | Campos comuns propostos |
| --- | --- |
| `identidade` · Identidade e vínculo | `nome_completo`, `nome_tratamento`, `crm_numero`, `crm_uf`, `especialidades`, `cidade_base`, `uf_base`, `email`, `telefone_contato`, `segunda_cadeira`, `data_entrada`, `grupo`, `turma`, `fase`, `situacao_cadastro`. |
| `resumo` · Consulta rápida | `sintese`, `cenario_inicial`, `situacao_atual`. Indicadores, objetivo prioritário, pendências e data da última atualização aparecem como leitura dos campos oficiais das demais seções, sem outra cópia editável desses valores. |
| `atuacao` · Atuação e negócios | `modelo_atendimento`, `servicos_principais`, `agenda_semanal`, `estrutura_disponivel`, `centro_cirurgico_proprio`, `equipamentos`, `projetos_estrutura`, `contexto_tributario`, `historia_negocio`, `convenios`, `vinculos_negocios`. |
| `baseline` · Ponto de partida e números conhecidos | `data_entrada_referencia`, `primeira_captura`, `indicadores`. Cada indicador possui referência inicial e leitura atual com datas/limites próprios. Catálogo de indicadores fixo abaixo. |
| `tatame` · Acompanhamento por ciclo | `ciclo_atual`, `cenario_ciclo`, `prioridades_ciclo`, `condutas_ciclo`, `tatames`. Metas e indicadores dos ciclos referenciam os mesmos códigos de objetivos/indicadores, sem produzir um segundo número atual concorrente. |
| `instagram` · Instagram | `primeira_leitura`, `ultima_leitura`, `comparacao`, `situacao_coleta`, `limites_serie`. Username e URL são lidos do canal Instagram em `presenca.canais`; seguidores e publicações vêm dos snapshots, sem duplicação editável. Comparação é calculada somente com medições compatíveis. |
| `objetivos` · Objetivos e prioridades | `objetivo_principal`, `prioridade_atual`, `gargalos`, `objetivos`. Cada objetivo pode ter alvo textual ou numérico, horizonte e estado; não exige que todo desejo já tenha uma meta exata. |
| `equipe` · Estrutura comercial, equipe e parceiros | `papel_sdr`, `responsaveis_sdr`, `papel_closer`, `responsaveis_closer`, `outras_pessoas_jornada`, `organizacao_trafego`, `responsaveis_trafego`, `organizacao_social_media`, `responsaveis_social_media`, `pessoas_parceiros`. Papéis referenciam pessoas conhecidas; podem estar informados mesmo sem nome do responsável. |
| `solucoes` · Sistemas e soluções | `agenda`, `prontuario`, `crm_comercial`, `outras_ferramentas`, `solucoes_olympus`, `contexto_declarado`. Os cinco primeiros campos são listas do tipo solução. Contexto declarado preserva relato ainda sem classificação segura. |
| `presenca` · Presença e canais | `canais`, `whatsapp_comercial`, `grupo_operacional`. Canal tem tipo, endereço, titularidade/vínculo e finalidade; permite várias contas do mesmo tipo sem inventar campos “Instagram2” ou “Site_da_unidade_X”. |
| `comunicacao` · Como acompanhar | `canal_preferencial`, `horarios_preferenciais`, `preferencias_acompanhamento`, `feedbacks_relevantes`, `referencias_comportamentais`, `responsaveis_acompanhamento`. Perfil comportamental identifica instrumento e natureza da informação; não é inferido pelo agente. |
| `relacionamento` · Relacionamento e experiência | `pessoas_importantes`, `datas_importantes`, `interesses`, `preferencias_experiencias`, `restricoes_informadas`, `notas_cs`. Informações espontâneas ou autorizadas, relacionadas ao titular/segunda cadeira. Ausência não autoriza inferir pessoas, preferências ou iniciar coleta pessoal. |
| `confirmacoes` · A confirmar | `pontos`. Cada ponto indica o campo relacionado, dúvida, evidências, situação e resolução quando conhecida. Campo vazio não cria automaticamente uma tarefa ou pergunta ao médico. |
| `evolucao` · Linha do tempo | `eventos`. Data/período do fato, precisão, natureza do evento, descrição, campos afetados e fontes. Histórico de edição técnico permanece separado da evolução real do mentorado. |

### Indicadores fixos

Todos os perfis expõem os mesmos códigos, ainda que vazios:

| Código | Unidade padrão |
| --- | --- |
| `faturamento_mensal` | BRL/mês |
| `consultas_mensais` | consultas/mês |
| `cirurgias_indicadas_mensais` | indicações/mês |
| `cirurgias_realizadas_mensais` | cirurgias/mês |
| `cirurgias_lentes_premium_mensais` | cirurgias/mês, com definição da fonte preservada |
| `ticket_medio_cirurgia` | BRL/cirurgia |
| `investimento_mensal_marketing` | BRL/mês |
| `margem_operacional` | percentual, com definição/limite da fonte |
| `seguidores_instagram` | seguidores |
| `publicacoes_instagram` | publicações, com cobertura/tipo informado |

Leitura de indicador contém: `tipo_valor` (número/faixa/texto), `numero`, `minimo`, `maximo`, `texto_original`, `unidade`, `precisao` (exata/aproximada/faixa/não definida), `periodo`, `escopo`, `vinculo_id` quando informado, `natureza` e fontes. Chaves não usadas ficam nulas. Uma estimativa livre permanece em texto quando não permite normalização segura.

Escopo pode ser geral do negócio, vínculo explicitamente identificado ou não definido. Não repartir uma média entre praças, somar valores incompatíveis ou atribuir a uma unidade por inferência. Um registro conhecido em23/10 não se torna automaticamente medição da entrada em26/10. As visões inicial/atual apontam aos snapshots correspondentes; reimportar a mesma ficha não é nova medição.

### Valores categóricos comuns

- `modelo_atendimento`: particular, convênio, misto. Dado ausente usa a situação do campo, não um palpite.
- `papel_sdr` e `papel_closer`: pessoa dedicada, função acumulada, próprio mentorado, sem responsável. “Não sei” vira ausência identificada, com a resposta original preservada.
- `organizacao_trafego` e `organizacao_social_media`: equipe interna, agência/profissional externo, próprio mentorado, não possui.
- `centro_cirurgico_proprio`: sim/não; informação desconhecida não vira não.
- `situacao_cadastro`: ativo/inativo, derivada do cadastro do Admin. Não comprova login criado, acesso entregue ou mentoria encerrada.
- `situacao_coleta`: não vinculada, vinculada sem dados, com dados, falha de coleta, a confirmar. Não confundir URL pública com conta conectada.

As opções aprovadas do formulário continuam iguais na apresentação. O perfil usa esses códigos comuns e conserva a declaração original como evidência.

## Tipos de registro repetível

Cada tipo tem ID próprio, estado (atual/histórico/removido/a confirmar) e os mesmos campos em todos os perfis. Dados de um participante são referenciados por ID, sem derivar IDs do nome. Todo campo de negócio abaixo utiliza os metadados de informação da seção seguinte.

| Tipo | Campos comuns de cada item |
| --- | --- |
| Pessoa/segunda cadeira/parceiro | `id`, `nome`, `papel`, `funcao`, `responsabilidades`, `vinculo_id`, `contexto`, `estado`. Contato, quando necessário e autorizado, usa `contato`; não criar campos com o nome da pessoa. |
| Vínculo de negócio/local | `id`, `nome`, `tipo_vinculo`, `papel_mentorado`, `cidades`, `endereco`, `modelo_atendimento`, `contexto`, `estado`. Tipo e propriedade podem ficar desconhecidos. Três praças não geram três unidades próprias. |
| Convênio | `id`, `nome`, `contexto`, `estado`. Um nome como Unimed é valor, nunca uma chave exclusiva de um mentorado. |
| Equipamento | `id`, `nome`, `tipo`, `uso`, `vinculo_id`, `contexto`, `estado`. |
| Solução/sistema | `id`, `nome`, `categoria`, `finalidade`, `fornecedor`, `executor`, `estagio`, `vinculo_id`, `contexto`, `estado`. Estágio documentado: planejada, em implantação, em operação, descontinuada ou não informado. |
| Canal | `id`, `tipo`, `nome`, `endereco`, `pessoa_ref`, `vinculo_id`, `finalidade`, `estado`. URLs de acesso são dados de canal, não prova de integração. |
| Objetivo | `id`, `descricao`, `indicador_codigo`, `alvo`, `horizonte`, `prioridade`, `situacao`, `contexto`. Uma meta não atualiza o indicador realizado. |
| Tatame | `id`, `ciclo`, `data_referencia`, `cenario`, `prioridades`, `condutas`, `objetivos_refs`, `snapshots_refs`, `documento_ref`, `estado`. |
| Referência comportamental | `id`, `pessoa_ref`, `instrumento`, `resultado_declarado`, `natureza`, `contexto`, `estado`. Autodeclaração e teste identificado permanecem distintos. |
| Pessoa importante | `id`, `pessoa_ref`, `nome`, `relacao`, `contexto`, `estado`. Não presumir parentesco. |
| Data importante | `id`, `pessoa_ref`, `evento`, `data`, `precisao`, `contexto`, `estado`. |
| Preferência/interesse/restrição/nota da CS | `id`, `pessoa_ref`, `tema`, `descricao`, `finalidade`, `estado`. |
| Ponto a confirmar | `id`, `campo_ref`, `duvida`, `fontes_refs`, `situacao`, `resolucao`. |
| Evento de evolução | `id`, `data_referencia`, `natureza`, `tipo`, `descricao`, `campos_refs`, `fontes_refs`. |

Listas de textos simples, como especialidades/serviços, conservam o mesmo ID de campo; os itens são valores, não novas propriedades. Links de responsáveis e canais apontam para registros tipados quando conhecidos. Não exigir esse vínculo para aceitar um relato parcial.

## Metadados comuns: o que cada informação significa

Todo campo tem:

| Propriedade | Regra |
| --- | --- |
| `valor` | Valor do tipo previsto ou nulo. Texto, booleano, número e lista não são intercambiados silenciosamente. |
| `situacao` | `informado`, `nao_informado`, `nao_aplicavel` ou `a_confirmar`. |
| `natureza` | Declarado, pesquisado ou medido, quando conhecido. Precisão e aproximação de números são registradas à parte. |
| `fontes_refs` | Fontes que sustentam aquele campo, com origem, referência verificável e data no catálogo de fontes. |
| `data_referencia` | Data/período do fato ou indicador e sua precisão. Pode ser desconhecida; data de atualização não substitui essa referência. |
| `updated_at` e `updated_by` | Momento/autor da atualização da síntese. Agente é identificado como agente. |

Listas também têm situação. Lista vazia desconhecida aparece como “Não informado”; lista vazia com ausência explicitamente confirmada aparece como “Nenhum informado para este caso”, com a fonte correspondente. Número0 e booleanofalse podem ser valores informados e não são apagados. Não aplicável exige razão/evidência, não apenas ausência de coleta. Conflito conserva as versões/fontes e sinaliza a confirmar; não escolher silenciosamente uma delas.

Casos de leitura padronizada:

| Campo | Mentorado com informação | Mentorado sem informação |
| --- | --- | --- |
| Papel de SDR | Função acumulada, com fonte/data | Não informado |
| CRM comercial | Nome do sistema conhecido | Não informado |
| Tráfego pago | Não possui, se explicitamente informado | Não informado |
| Consultas mensais | Cerca de200, como estimativa | Não informado |

## Uma leitura humana e uma leitura para agentes

**Equipe:** mesmas seções e campos, na mesma ordem. Resumo de consulta rápida seguido dos detalhes. Fontes ficam disponíveis no campo, sem a pessoa precisar ler cinco documentos inteiros para descobrir quem faz o comercial. Vazio aparece; não desaparecer com o campo porque não foi preenchido.

**Agentes:** mesmo catálogo, com caminhos fixos e todos os campos presentes, incluindo nulos/situações. A resposta de perfil identifica `schema_version`, `mentorado_id`, `revision` e a data de atualização. O agente consulta `equipe.papel_sdr`, por exemplo, em qualquer mentorado. Busca a evidência original quando precisar aprofundar ou resolver uma divergência. Texto de fonte é evidência, nunca instrução para mudar o esquema ou permissões.

Coleções retornam IDs e estado. O perfil atual apresenta atuais/a confirmar; históricos ficam em coleção/visão identificada, sem misturar ex-integrantes à equipe de hoje. Catálogo de fontes e histórico de edição acompanham o perfil ou são consultáveis pela referência, com os mesmos controles de acesso. Uma consulta de agente não pode misturar nomes semelhantes ou ampliar o escopo para outros mentorados.

## Cadastro único, sem cópias concorrentes

- `public.members.id` é a identidade canônica usada no perfil. Nome, e-mail, situação de cadastro, turma e fase continuam tendo origem nesse cadastro. A edição humana/agêntica desses campos passa pela mesma operação de cadastro; o perfil não mantém uma segunda cópia independente.
- `baseline.data_entrada_referencia` é leitura de `identidade.data_entrada`, nunca uma segunda data editável. A data de criação da linha no sistema não comprova entrada na mentoria. Referência inicial e primeira captura continuam separadas.
- Username/URL do Instagram já cadastrados precisam ser conciliados com o canal correspondente, mantendo uma referência canônica, sem duas versões editáveis. Detalhe de implementação fica para o planejamento técnico.
- O perfil comum é a síntese consultada pela equipe e pelos agentes. `member_context_entries` permanece repositório de fontes datadas, não define o formato da ficha e não é uma resposta equivalente ao perfil consolidado.
- O campo de cadastro ativo é separado de login/usuário Auth. Grupo, Fathom, Instagram e CRM são vínculos de fontes ou sistemas. A ausência de uma conexão não exclui o mentorado do cadastro.
- A listagem geral da IA deve partir do cadastro e indicar cobertura de fontes, em vez de usar somente quem já tem conversa importada. O registro paralelo de memória/panoramas deve referenciar o mesmo ID. Isso é requisito de integração, não migração executada nesta proposta.

O destino deste perfil é a consulta interna da equipe e dos agentes autorizados, respeitando o escopo de mentorados de cada credencial. Não há liberação automática da ficha interna para a área do mentorado ou para terceiros. A implementação preserva os controles do Admin; um agente não recebe autorização de escrita apenas por poder ler.

## Preenchimento e manutenção

1. Resolver mentorado pelo ID canônico e carregar a mesma estrutura vazia/completa.
2. Reaproveitar dados existentes e mapear a evidência para campos do catálogo. Rótulos da fonte não viram automaticamente novos campos.
3. Preencher apenas o que a evidência permite; manter lacunas e conflitos visíveis. Não transformar pesquisa pública em resposta declarada nem meta em resultado.
4. Equipe e agentes atualizam os mesmos campos por uma operação autorizada, com revisão esperada, autor, motivo e fonte. Não substituir o documento inteiro ao incorporar uma reunião.
5. Mudanças inequívocas atualizam a síntese com histórico. Evidência antiga não reativa ex-integrante ou desfaz fato recente. Reprocessar a mesma fonte não duplica pessoa, valor ou evento.
6. Campo necessário ainda inexistente é proposto para o catálogo global. A informação original pode permanecer na fonte enquanto a evolução é decidida. Não criar um campo particular para contornar o padrão.

## Critérios para considerar o padrão atendido

- Dois mentorados novos recebem exatamente os mesmos campos, tipos e ordem, inclusive campos vazios.
- Um perfil com mais pessoas/negócios cresce por itens dos mesmos tipos, sem novas chaves de campo.
- Uma consulta humana e uma consulta de agente retornam o mesmo valor atual, situação e fonte para um campo.
- “Não informado”, “Não possui” e “Não aplicável” permanecem distintos; médias, faixas, zero e estimativas são preservados.
- Não há campo com nome de cidade, fornecedor, pessoa ou particularidade exclusiva de um caso.
- O perfil deixa de depender de quem tem grupo conectado para existir/ser listado.
- As fontes e respostas já guardadas permanecem preservadas. A mudança é sua organização em uma síntese comum, sem apagar evidências.
- O piloto permanece um caso; expansão aos demais só após validar o catálogo e sua leitura.

