# Roteiro de desenvolvimento do STRATA DLIS

Este roteiro acompanha a branch `feat/redesign-dlis`. A base foi `test/strata-validation` em `a761809`, que reúne sete PRs encadeados. A contagem das fases abaixo corresponde ao pedido de redesign. Os números de etapas nos documentos antigos se referem ao ciclo anterior.

## Entregas por fase

| Fase | O que a base já oferece | O que falta / situação |
| --- | --- | --- |
| 1 · Auditoria e setup | Emuladores D1 e R2, migrações, testes unitários, SSR e integração | Início manual pela raiz, `doctor`, seed local idempotente, limpeza, dependências, regressões e workflow de CI preparados nesta revisão. Aprovada para avanço à fase 2. Resultados no relatório e no histórico do Actions. |
| 2 · Contas e catálogo | Conta local Argon2id, Supabase no build, código de confirmação e recuperação, sessões com expiração e limite de tentativas. Upload em partes, miniatura medida, índice automático, filtros técnicos e reindexação de publicações anteriores. | Implementação e testes locais concluídos. O catálogo público atualiza após aprovação. A entrega real de e-mail pelo Supabase/SMTP institucional depende das credenciais do projeto. [Evidências da fase 2](strata-dlis/docs/FASE_2.md). |
| 3 · Interface, tema e idiomas | Tokens e componentes compartilhados, temas claro/escuro/sistema por conta, detecção do idioma, quatro dicionários e paleta com busca de poços. | Integração, SSR, teclado, responsividade e verificações automáticas de acessibilidade em Chromium. Homologação manual com leitor de tela e navegadores adicionais prevista no QA final. [Evidências da fase 3](strata-dlis/docs/FASE_3.md). |
| 4 · Visualizador | Canvas para CBL, VDL, USIT e GR, unidades e profundidade declaradas, zoom, pontos, marcações, PNG de intervalo, exportação CSV/JSON/XLSX de pontos | LTTB e níveis de zoom, trilhas gerais com escalas linear/log, paletas acessíveis por curva e tema, crossover, sombreamento, cursor sincronizado, minimapa, régua, formações, SVG/PDF/PNG em alta resolução, modo apresentação e comparação entre poços. Revalidar unidades e valores após mudar a renderização. |
| 5 · Rascunhos e pasta local | Análises, pontos e interpretações por conta, relatórios com snapshot, regiões vinculadas por hash e leitura de arquivo local | Rascunhos com autosave, versões, estado completo do visualizador, importação/exportação JSON, publicação/reversão, IndexedDB e sincronização. Galeria por diretório, atualização de miniaturas e fallback por arraste. Provar isolamento entre contas nos novos fluxos. |
| 6 · Landing | A entrada atual é a biblioteca com filtros, contadores e painel analítico | Landing interativa, demonstração navegável, animação por rolagem, redução de movimento e medição Lighthouse. Meta de 90 em cada categoria. |
| 7 · QA e PR | Suítes Playwright de componentes, comparador independente com dlisio, relatórios históricos e verificação de APIs | E2E das funcionalidades novas em conjunto, capturas por idioma/tema, arquivo de pelo menos 500 MB se disponível, README PT/EN, CHANGELOG, QA e PR. |

## Histórico que deu origem ao roteiro

A busca nos 240 arquivos versionados da base não encontrou marcadores literais `TODO` ou `FIXME`. A consulta a issues abertas e fechadas não retornou issues independentes. Os PRs abaixo permaneciam abertos durante a inspeção. Seus commits fazem parte da base desta branch.

| PR | Conteúdo incorporado na base |
| --- | --- |
| [#6](https://github.com/GuiCarteri/TECGRAF/pull/6) | Validação inicial, início manual no Codespaces, seletor de idioma e correções de login. |
| [#7](https://github.com/GuiCarteri/TECGRAF/pull/7) | Poços, arquivos, curvas, interpretações e relatórios. |
| [#8](https://github.com/GuiCarteri/TECGRAF/pull/8) | Completude, cobertura, consistência, unidades, plausibilidade e rastreabilidade. |
| [#9](https://github.com/GuiCarteri/TECGRAF/pull/9) | Índices de prontidão distintos para USIT e CBL/VDL. |
| [#10](https://github.com/GuiCarteri/TECGRAF/pull/10) | Dashboard público com filtros, gráficos e rankings. |
| [#11](https://github.com/GuiCarteri/TECGRAF/pull/11) | Integração das métricas com interpretações salvas. |
| [#12](https://github.com/GuiCarteri/TECGRAF/pull/12) | Validação das exportações, benchmark e testes científicos. |

## Pendências registradas nos documentos

| Origem | Situação e encaminhamento |
| --- | --- |
| [Validação](strata-dlis/docs/VALIDACAO.md), [login e idioma](strata-dlis/docs/CORRECOES_LOGIN_IDIOMA.md) e [testes](strata-dlis/docs/TESTING.md) | A auditoria atualiza o lint, os alertas de dependências e os resultados do Chromium. A homologação do Supabase/SMTP fica na fase 2. Codespace hospedado, Firefox, WebKit, leitor de tela, uso prolongado e arquivo grande seguem como validações de ambiente ou de QA. |
| [Modelo de dados](strata-dlis/docs/DATA_MODEL.md) e [qualidade](strata-dlis/docs/DATA_QUALITY.md) | Os PRs posteriores já integraram indicadores, IPD e interpretações às telas. Calibração dos limiares e validação em campo dependem de referência técnica do projeto. |
| [Atualização do visualizador](strata-dlis/docs/ATUALIZACAO.md) e [motor científico](strata-dlis/science/README.md) | Comparação visual é entrega da fase 4. Eixos de tempo/azimute calibrados e fatias de tensores exigem dados de referência. A portabilidade do pipeline Tkinter/imagens/barreiras ficou registrada para decisão técnica. |
| [Marcações](strata-dlis/docs/MARCACOES.md) | Pincel, polígonos, redimensionamento de regiões existentes e interoperabilidade com Label Studio continuam como propostas históricas a priorizar. |
| [Segurança](strata-dlis/docs/SEGURANCA.md) e [migração de identidades](strata-dlis/docs/MIGRACAO_IDENTIDADES.md) | Backups e restauração, IAM, DNS/TLS e migração de produção exigem ambiente autorizado. Isolamento por instituição, MCP e IA permanecem propostas futuras que dependem de decisão do projeto. |

[Resultados da auditoria da fase 1](strata-dlis/docs/AUDITORIA_FASE_1.md)
