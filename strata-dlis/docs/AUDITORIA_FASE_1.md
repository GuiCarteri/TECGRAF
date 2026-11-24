# Auditoria de confiabilidade · STRATA DLIS

**Rodada de 23 e 24 de novembro de 2026.** Uma cópia limpa da aplicação abriu o catálogo com `npm run dev` a partir da raiz. Após a carga de exemplos, o navegador exibiu dois poços fictícios. A segunda carga e o reinício preservaram os dois registros. O lint terminou com zero erros e zero avisos.

## Base e ambiente

- Repositório `GuiCarteri/TECGRAF`, aplicação em `strata-dlis/`. A inspeção cobriu a árvore dos 240 arquivos versionados, documentação, configurações, fontes, dependências e testes, além das issues e dos commits recentes. A base foi `test/strata-validation` em `a761809`. Os sete PRs abertos e as pendências documentadas constam no [roteiro](../../ROADMAP.md).
- Ambiente Linux, Node 24.22.3, npm 11.19.1, pnpm 11.25.0, Python 3.12 e dlisio 1.0.4. O navegador dos testes automatizados foi Chromium headless 153 com Playwright 1.62.1. A prévia também foi aberta em navegador com a biblioteca populada.
- O teste de instalação começou em um diretório sem `node_modules`, `.dev.vars`, `.wrangler` ou credenciais. O cache de pacotes da máquina pôde ser reutilizado. Foram aplicadas as migrações `0000_fuzzy_prism.sql` e `0001_data_model.sql`.

## Falhas observadas e correções

| Observação | Correção e evidência |
| --- | --- |
| O ESLint da base retornava 117 erros e 17 avisos. O TypeScript, o build e os 55 testes unitários já passavam. | Tipos das curvas, frames, mensagens do Worker, análises, usuários e respostas da API. Limpeza de imports e funções órfãs, efeitos e navegação. O lint agora falha também com qualquer aviso. O inventário abaixo identifica todas as ocorrências originais. |
| Não havia comando `dev` na raiz, nem comandos `doctor` e `seed`. | O ponto de entrada da raiz instala pelo lockfile, prepara as variáveis e aplica as migrações antes do Vite. Abrir o Codespace continua sendo independente de iniciar o servidor. |
| Na execução limpa em ambiente restrito, Vite encerrou com `uv_interface_addresses` ao enumerar interfaces de rede. | O desenvolvimento local escuta em `127.0.0.1:5173`. O Codespaces usa o endereço encaminhado e a escuta de rede do container. O teste verificou o encaminhamento HTTPS, a origem e a recusa de uma segunda instância na porta ocupada. |
| `GET /api/me` retornava 503 para um visitante sem cookie quando o Supabase estava sem configuração. | A consulta verifica a existência da sessão antes de consultar o provedor. A biblioteca abre com HTTP 200 e `{"user":null}`. Operações que exigem conta continuam verificando o provedor. |
| Na revisão administrativa, uma publicação sem visibilidade declarada podia derrubar o diálogo. No catálogo, o contador mostrava “2arquivo”. | Registros incompletos mostram “Não informado”. O teste de publicações abriu o diálogo, cancelou, simulou falha e testou uma nova tentativa. O contador passou pelo ciclo “2 arquivos → 1 arquivo → 2 arquivos” na aplicação real. |
| O visualizador tinha efeitos que dependiam de valores omitidos. A carga remota e a janela de profundidade podiam usar estado anterior. | A seleção do arquivo tem identidade explícita, a leitura usa os valores atuais e o zoom acompanha a seleção. Foram testados zoom, troca de idioma preservando arquivo/ponto e abertura e fechamento de arquivos consecutivos. |
| A instalação anterior apresentava 12 alertas no grafo total, incluindo um crítico e um alto. | Atualizações do conjunto React/RSC, Next, Drizzle Kit e dependências transitivas. A auditoria integral com o novo lockfile retornou zero. A tabela de avisos lista os doze identificadores. |
| Havia componentes e dependências sem consumidores. | Removidos 49 componentes de interface, um hook, uma entrada de banco sem importadores, o scanner auxiliar de canal sem chamadas e 12 dependências diretas. O parser usado pela aplicação continua versionado com sua licença. Build, testes do Worker e releitura das exportações passaram. |
| O teste científico inicial falhou com `ModuleNotFoundError: dlisio`. O Chromium completo da máquina teve falha de inicialização por restrição de socket, e o download do navegador do Playwright recebeu HTTP 403. O Vite da suíte isolada também carregava o link do Next e gerava `process is not defined`. | O ambiente Python instalado a partir de `science/requirements.txt` passou nos cinco testes. O ambiente de componentes passou a usar o mesmo link do Vinext que a aplicação. As suítes foram executadas com o Chromium headless alternativo. |
| No primeiro CI, o Vite abriu a porta em quatro segundos, mas o teste esgotou o prazo de 60 segundos. Os códigos de cor do terminal separavam a palavra `Local` dos dois-pontos. | Os três testes que aguardam o Vite normalizam os códigos ANSI da saída antes de detectar o servidor. A validação local incluiu a execução com `FORCE_COLOR=1`. |

## Testes executados

| Verificação | Resultado observado |
| --- | --- |
| `npm run lint`, `npm run typecheck`, `npm run build` | Saída 0 nas três verificações. O Worker e os recursos do cliente foram gerados. |
| `npm test` | 55 passaram, 0 falharam e 0 foram pulados. |
| `npm run test:database` e `npm run test:seed` | Migrações sobre base legada, isolamento, vínculos e relatórios passaram. Dois arquivos, dois vínculos a poços, conteúdo R2 conferido por SHA-256, 121 e 251 amostras. |
| `npm run test:integration` | Worker compilado com D1/R2 isolados. Login, expiração, renovação, recuperação, permissões, publicação e exclusão passaram. O teste fez 105 chamadas ao provedor simulado. |
| `npm run test:ui-controls`, `npm run test:ssr` e `npm run test:dev-startup` | Controles React, dashboard, SSR em quatro idiomas, rotas públicas e protegidas, porta fixa, idioma sem JavaScript e origem no encaminhamento HTTPS passaram. |
| `npm run test:browser`, `npm run test:browser:scientific` e `npm run test:browser:publications` | Chromium passou na troca de idioma preservando estado, nos fluxos de conta/administração e no teste científico com Worker real. O DLIS sintético produziu quatro trilhas, zoom, leitura de forma de onda e exportações PNG/CSV. |
| Navegação na aplicação com D1 local | Biblioteca com dois poços, busca, mudança de idioma, painel de dados, guia e redirecionamento do visualizador. Zero exceções, avisos do console da aplicação ou respostas HTTP inesperadas nesse percurso. |
| `npm run test:python` e `npm run test:performance` | Cinco testes científicos passaram. O benchmark completou cinco repetições para massas de 201.768 e 806.568 células numéricas. |
| `npm run test:browser:real` e `scripts/verify-reference.py` | Os cinco DLIS distintos abriram, renderizaram quatro trilhas cada e fecharam. O comparador com dlisio conferiu unidades, dimensões, linhas e valores numéricos acessíveis por canal. |
| `pnpm audit --json` | Zero avisos na rodada final, incluindo dependências de desenvolvimento. |

### Rotas e respostas

| Entrada verificada | Resposta esperada e observada |
| --- | --- |
| `/`, `/help`, `/login`, `/favicon.svg` | HTTP 200. |
| `/api/files`, `/api/me`, `/api/auth/config` | HTTP 200 como visitante. |
| `/viewer`, `/account`, `/admin`, `/publish` como visitante | HTTP 307 para login com o destino preservado. |
| `/register` | HTTP 307 para o formulário de cadastro. |
| `/api/locale?lang=en` | HTTP 303, cookie de idioma e retorno à página. |
| Página e endpoint deliberadamente inexistentes | HTTP 404 nas duas verificações. |

### Arquivos DLIS fornecidos

Os nove anexos DLIS continham cinco conteúdos distintos por SHA-256. Foram comparados **18 frames, 1.395 ocorrências de canal em frame e 124.136.933 valores**. Em dois arquivos, o leitor pulou metadados criptografados e emitiu o aviso correspondente. A conferência abrangeu apenas os registros acessíveis. A massa variou de 17.025.932 a 98.426.012 bytes. Os arquivos foram lidos localmente e ficaram fora do catálogo de exemplo e do commit.

| Arquivo distinto | Frames | Canais em frames | Valores conferidos | Concordância |
| --- | ---: | ---: | ---: | --- |
| 1 | 4 | 304 | 29.951.964 | Exata |
| 2 | 4 | 304 | 7.392.324 | Exata |
| 3 | 3 | 310 | 42.764.682 | Exata |
| 4 | 3 | 238 | 17.747.261 | Exata |
| 5 | 4 | 239 | 26.280.702 | Exata |

### Evidências visuais

A biblioteca mostra os dois DLIS do `seed` no banco local. A segunda captura usa uma fixture RP66 com sessão simulada e o mesmo Worker do visualizador.

[Captura da biblioteca real com o seed](evidence/phase1-catalog.jpg) · [Captura das quatro trilhas com dados sintéticos](evidence/phase1-viewer.png)

## Como reproduzir

Com Node 24, na raiz do checkout:

```bash
npm run doctor
npm run dev
```

Em outro terminal, na mesma raiz, execute `npm run seed` e atualize a página. O catálogo mostra **Poço sintético Aurora** e **Poço sintético Boreal**. Executar a carga novamente mantém os dois registros. Para as verificações sem servidor, execute:

```bash
npm run setup
npm run lint
npm run typecheck
npm test
npm run build
```

As suítes adicionais ficam em `strata-dlis/`. O teste de integração usa o resultado do build. Os testes Python científicos exigem `python -m pip install -r science/requirements.txt` em um ambiente virtual. As regressões de navegador aceitam Playwright com Chromium instalado ou `PLAYWRIGHT_EXECUTABLE_PATH` apontando para um executável compatível. O teste com arquivos reais lê o diretório indicado em `DLIS_TEST_DIR`. O [workflow do GitHub Actions](../../.github/workflows/strata-ci.yml) define os comandos do CI. [Execuções da branch](https://github.com/GuiCarteri/TECGRAF/actions?query=branch%3Afeat%2Fredesign-dlis).

## Limites da rodada

- Supabase/SMTP reais, entrega de códigos, IAM, D1/R2 de produção e um Codespace hospedado dependem de homologação no ambiente correspondente. A primeira execução local usa o modo visitante. A autenticação em integração usa um provedor de teste.
- O build emite avisos do Vinext sobre módulos importados simultaneamente de forma estática e dinâmica. O Vite também pode avisar sobre a pré-otimização interna de um componente RSC. Os avisos permaneceram visíveis nos logs. A renderização, os comandos e as respostas HTTP testadas passaram.
- O instalador sinalizou ESLint 9 e três dependências transitivas descontinuadas de desenvolvimento. Os avisos de descontinuação coexistem com a auditoria de segurança zerada. O npm e o Wrangler também registraram a presença de proxy nesta máquina.
- O maior arquivo disponível tinha 98,4 MB decimais. O ensaio com 500 MB ou mais, Firefox/WebKit, Lighthouse e a validação de critérios de cimentação em campo continuam no [roteiro](../../ROADMAP.md).

## Inventário da base

### Lint original por arquivo e regra

As coordenadas indicam linha e coluna no commit `a761809`. Os erros foram 114 usos de `any` e três links internos. Os avisos foram dez variáveis sem uso, cinco dependências de efeitos, uma expressão sem efeito e uma atribuição de navegação.

| Arquivo em `strata-dlis/` | Regra | Ocorrências (linha:coluna) |
| --- | --- | --- |
| `components/strata/account.tsx` | `@typescript-eslint/no-explicit-any` | 26:36, 87:26, 154:45, 156:31, 196:44, 226:42, 242:40, 295:49 |
| `components/strata/account.tsx` | `@next/next/no-location-assign-relative-destination` | 106:23 |
| `components/strata/admin.tsx` | `@typescript-eslint/no-explicit-any` | 28:38, 29:34, 32:36, 53:17, 70:17, 151:38, 251:30 |
| `components/strata/points-table.tsx` | `@typescript-eslint/no-explicit-any` | 17:11, 18:22 |
| `components/strata/publish.tsx` | `@typescript-eslint/no-unused-vars` | 22:34, 132:9 |
| `components/strata/publish.tsx` | `@typescript-eslint/no-explicit-any` | 35:36, 38:32, 45:36, 102:19, 120:23, 131:46, 137:24, 138:27, 158:17, 201:17, 233:35, 374:37, 458:43, 465:31 |
| `components/strata/shell.tsx` | `@typescript-eslint/no-explicit-any` | 25:36 |
| `components/strata/shell.tsx` | `@next/next/no-html-link-for-pages` | 35:9, 46:11 |
| `components/strata/viewer.tsx` | `@typescript-eslint/no-explicit-any` | 78:32, 86:34, 87:36, 92:46, 98:40, 109:44, 125:44, 129:26, 175:40, 176:33, 177:38, 187:30, 189:11, 218:40, 225:15, 231:18, 265:17, 322:15, 329:15, 344:51, 346:15, 374:17, 435:17, 508:17, 553:17, 560:10, 567:32, 863:50, 1279:40, 1297:34, 1321:43, 1367:37, 1391:58, 1430:37, 1438:40 |
| `components/strata/viewer.tsx` | `@typescript-eslint/no-unused-vars` | 109:6 |
| `components/strata/viewer.tsx` | `react-hooks/exhaustive-deps` | 172:6, 393:6, 415:6, 416:5, 558:37 |
| `components/strata/viewer.tsx` | `@next/next/no-html-link-for-pages` | 575:11 |
| `lib/api.ts` | `@typescript-eslint/no-explicit-any` | 40:69 |
| `lib/dlis/client.ts` | `@typescript-eslint/no-explicit-any` | 7:20, 31:31, 32:24 |
| `lib/dlis/client.ts` | `@typescript-eslint/no-unused-expressions` | 19:7 |
| `lib/dlis/export.ts` | `@typescript-eslint/no-explicit-any` | 3:11 |
| `lib/dlis/plotting.ts` | `@typescript-eslint/no-explicit-any` | 17:10, 18:12, 19:11, 22:10, 33:10, 34:12, 35:11, 39:29 |
| `lib/dlis/points.ts` | `@typescript-eslint/no-explicit-any` | 7:9, 8:9, 9:16, 17:17, 23:46, 59:9, 89:11 |
| `lib/dlis/points.ts` | `@typescript-eslint/no-unused-vars` | 18:26 |
| `lib/server/auth.ts` | `@typescript-eslint/no-explicit-any` | 24:11 |
| `lib/server/db.ts` | `@typescript-eslint/no-explicit-any` | 11:45 |
| `lib/server/handlers.ts` | `@typescript-eslint/no-explicit-any` | 12:17, 14:20, 15:21, 23:23, 41:43, 42:69, 145:15, 230:21, 239:29, 240:39, 241:38, 244:27, 306:39, 350:17, 490:15 |
| `lib/vendor/dlis-parser/parser.js` | `@typescript-eslint/no-unused-vars` | 11:3, 15:43, 240:31, 299:7, 300:7 |
| `scripts/validate-dlis.mjs` | `@typescript-eslint/no-unused-vars` | 4:34 |
| `workers/dlis.worker.ts` | `@typescript-eslint/no-explicit-any` | 3:11, 9:16, 15:16, 20:40, 24:16, 36:16, 54:16, 55:47, 59:15, 60:14 |

### Avisos originais do gerenciador de pacotes

| Pacote | Severidade | Identificador |
| --- | --- | --- |
| `react-server-dom-webpack` | Crítica | [GHSA-xqc2-xf4c-x3h3](https://github.com/advisories/GHSA-xqc2-xf4c-x3h3) |
| `zod` | Alta | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) |
| `esbuild` | Moderada | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) |
| `minimatch` | Moderada | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) |
| `next` | Moderada | [GHSA-7qx7-33qx-rqx2](https://github.com/advisories/GHSA-7qx7-33qx-rqx2) |
| `next` | Moderada | [GHSA-f3mh-rxg3-f5g2](https://github.com/advisories/GHSA-f3mh-rxg3-f5g2) |
| `next` | Moderada | [GHSA-mfr8-8qww-v76h](https://github.com/advisories/GHSA-mfr8-8qww-v76h) |
| `next` | Moderada | [GHSA-pc58-hwjq-p385](https://github.com/advisories/GHSA-pc58-hwjq-p385) |
| `next` | Moderada | [GHSA-rhh4-g77r-r9qj](https://github.com/advisories/GHSA-rhh4-g77r-r9qj) |
| `next` | Moderada | [GHSA-vc7v-qv4w-wrv8](https://github.com/advisories/GHSA-vc7v-qv4w-wrv8) |
| `next` | Moderada | [GHSA-vvgp-ww4w-46vf](https://github.com/advisories/GHSA-vvgp-ww4w-46vf) |
| `satori` | Moderada | [GHSA-wx4j-mvgx-mqwp](https://github.com/advisories/GHSA-wx4j-mvgx-mqwp) |
