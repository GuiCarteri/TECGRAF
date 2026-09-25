# STRATA — Biblioteca e visualizador DLIS

Plataforma em português para catálogo público, publicação sob revisão, leitura RP66 V1 no navegador, seleção de amostras e análises pessoais. Não há dados fictícios no produto. A biblioteca começa vazia.

## Abrir e desenvolver no VS Code

Requisitos: Node.js 22.13 ou superior e pnpm 11 (o arquivo `pnpm-lock.yaml` fixa as dependências).

```bash
corepack enable
pnpm install --frozen-lockfile
cp .dev.vars.example .dev.vars
pnpm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_fuzzy_prism.sql
pnpm run dev
```

Abra a URL impressa no terminal (normalmente `http://localhost:5173`). Em Windows, copie `.dev.vars.example` para `.dev.vars` pelo Explorer/VS Code se não tiver `cp`. O código HTML está nos componentes React/TSX; CSS e lógica técnica estão separados. Não é necessário nenhum aplicativo proprietário para editar, instalar, compilar ou executar o projeto.

**Desenvolvimento local:** o starter fornece uma identidade simulada apenas em loopback (`localhost`), claramente limitada ao desenvolvimento. Ela nunca é incluída na autenticação de produção. Acesse `/signin-with-chatgpt?return_to=/account` localmente para usá-la. Se precisar testar a administração local, inclua `seedy@sites.test` em `ADMIN_EMAILS` de `.dev.vars`. Nunca adicione esse e-mail à instalação de produção.

**GitHub Codespaces:** crie um Codespace com Node 22+, execute os comandos acima e encaminhe a porta de desenvolvimento. O login simulado é deliberadamente restrito a loopback e não funciona em URLs públicas do Codespaces. Para testar contas nesse domínio, configure o modo Supabase real descrito abaixo. Use a opção HTTPS do domínio encaminhado; não exponha a porta sem a proteção de acesso do Codespaces.

## Estrutura

| Diretório                  | Responsabilidade                                                 |
| -------------------------- | ---------------------------------------------------------------- |
| `app/`                     | Rotas, HTML em React/TSX, layout, login e APIs                   |
| `components/strata/`       | Biblioteca, visualizador, publicação, conta e administração      |
| `components/auth/`         | Formulários do provedor de e-mail opcional                       |
| `components/ui/`           | Componentes acessíveis da interface                              |
| `styles/strata.css`        | Estilo da aplicação; `app/globals.css` contém os tokens          |
| `lib/dlis/core.js`         | Validação, unidades, cores USIT, índices, CSV e detecção         |
| `lib/dlis/client.ts`       | Comunicação com o Web Worker                                     |
| `lib/dlis/plotting.ts`     | Desenho Canvas e correspondência de profundidade                 |
| `lib/dlis/points.ts`       | Rastreabilidade e leitura direta dos arrays                      |
| `lib/dlis/export.ts`       | CSV, XLSX e JSON                                                 |
| `workers/dlis.worker.ts`   | Parse e decodificação de frames fora da thread da interface      |
| `lib/vendor/dlis-parser/`  | Fork conservador do parser MIT; veja `CHANGES.md`                |
| `lib/server/`              | Autorização, D1, R2, upload, análises e provedores               |
| `db/schema.ts`, `drizzle/` | Esquema relacional e migrações versionadas                       |
| `tests/`                   | Testes técnicos, permissões e restrições do banco                |
| `docs/`                    | Resultado e alcance da validação                                 |
| `scripts/`                 | Desenvolvimento, validação e configuração de deploy independente |

## Autenticação e papéis

A instalação no Sites usa **Sign in with ChatGPT**, autenticação real gerenciada pelo provedor. Cadastro, login, sessão, logout e recuperação pertencem à conta ChatGPT. O STRATA não recebe nem armazena a senha. A biblioteca pode ser pública e as rotas `/viewer`, `/account`, `/publish` e `/admin` exigem identidade. O destino do arquivo é preservado no retorno do login.

Todos os endpoints que leem conteúdo de arquivo, salvam pontos ou alteram dados verificam o usuário no servidor. D1 organiza análises por `owner_id` e SHA-256. Visitantes não recebem os bytes de DLIS.

| Papel         | Capacidades                                              |
| ------------- | -------------------------------------------------------- |
| Visitante     | Biblioteca de metadados aprovados                        |
| Usuário       | Visualizador, análises próprias, histórico e exportações |
| Publicador    | Capacidades anteriores e envio para revisão              |
| Administrador | Revisão, organização, arquivamento e gestão de papéis    |

`ADMIN_EMAILS` contém os e-mails autorizados a inicializar administradores. O primeiro visitante **não** vira administrador. O proprietário da instalação hospedada foi configurado pelo ambiente, sem e-mail ou segredo embutido no repositório. Administradores existentes alteram os papéis de outras contas em `/admin`. Autenticar com ChatGPT não significa ser membro de um workspace; permissões são verificadas separadamente.

### Autenticação fora do Sites (Supabase)

O projeto inclui um adaptador para o Supabase Auth via HTTPS. Não usa service-role key e não mantém senhas em D1. Em sua instalação independente, defina:

```dotenv
AUTH_MODE=supabase
ADMIN_EMAILS=seu-email-verificado@exemplo.com
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=SUA-CHAVE-PUBLICA-DO-PROJETO
```

1. Crie seu projeto Supabase e habilite o provedor de e-mail/senha. Exija confirmação do e-mail.
2. Configure a URL do seu site e um serviço SMTP adequado no Supabase.
3. Nos templates **Confirm signup** e **Reset password**, inclua o código `{{ .Token }}`. Esta interface usa o código digitado pelo usuário, não um link com tokens no fragmento da URL.
4. Configure as variáveis no servidor e reinicie. O login passa a oferecer cadastro, senha, confirmação de código e recuperação.
5. O servidor troca as credenciais com o Supabase e mantém access/refresh tokens em cookies `HttpOnly`, `SameSite=Lax` e `Secure` em HTTPS. A sessão é renovada ao reabrir uma área protegida; senhas não são registradas pelo código.
6. Preserve os limites de requisição e a confirmação de e-mail do provedor. Fluxos dependem do serviço e SMTP que você configurar.

Esse adaptador é opcional: não foi conectado a uma conta Supabase durante esta entrega. A autenticação ativa do site hospedado é a nativa do ChatGPT. Não confie nos headers `oai-authenticated-user-*` em uma instalação pública fora do dispatcher Sites; use `AUTH_MODE=supabase` nesse caso.

## Banco e armazenamento

D1 guarda usuários, metadados, análises/pontos, histórico e registros de exportação. R2 guarda os bytes dos DLIS. As ligações lógicas são `DB` e `BUCKET`. Na instalação Sites, o ambiente provisiona os recursos. Localmente, Wrangler/Miniflare usam `.wrangler/state`, ignorado pelo Git. Não há dados pessoais autoritativos em `localStorage`.

Migrações novas:

```bash
pnpm run db:generate
```

Revise o SQL e aplique em ordem. Não edite uma migração já aplicada em produção. Os arquivos SQL entregues contêm apenas o esquema, sem exemplos fictícios.

## Publicar um arquivo

1. Entre como publicador/administrador e abra **Publicar DLIS**.
2. Selecione um arquivo RP66 V1 de até 512 MB. O navegador calcula SHA-256, lê logical files, frames, canais, unidades e intervalos.
3. Confirme ou corrija poço, campo, empresa, coleção e run. A coleção é escolhida por uma pessoa; “Volve” não é deduzido como empresa. Ambiente onshore/offshore também não é adivinhado.
4. Confirme os metadados e marque a autorização de publicação.
5. Veja a prévia e envie. Upload usa partes de 8 MB e verificação do SHA-256 completo no servidor por streaming.
6. Divergências de empresa, ausência de empresa ou avisos do parser resultam em **Revisão necessária**. Os demais envios ficam **Pendentes**. Nenhum envio é aprovado automaticamente.
7. Um administrador abre o arquivo real no visualizador, confere os metadados e a autorização e registra o parecer.
8. Somente `validated` + `public` entra no catálogo. `private` é restrito ao autor e administradores; `unlisted` aprovado exige login e o link exato. Arquivar remove o arquivo do catálogo sem apagar os bytes.

Metadados enviados pelo cliente são candidatos, nunca prova suficiente para aprovação. A revisão humana precisa conferir o conteúdo real. A integridade dos bytes é conferida pelo servidor. O índice único de hash evita duplicatas inclusive em condições de concorrência.

## Leitura e integridade dos dados

O fork local parte de `@geoharkat/dlis-parser` 1.0.4 (MIT). Ele remove heurísticas que criavam canais, inferiam dimensões sem metadados ou juntavam logical files. Nomes iguais em arquivos lógicos diferentes permanecem separados. Canais sem referência exata, dimensões ausentes, representações não suportadas e frames truncados são recusados com mensagem.

O Web Worker mantém a estrutura do arquivo. Frames são decodificados sob demanda e transferem seus TypedArrays à interface, sem converter curvas em JSON. Os tracks reutilizam o resultado do frame. Não há geração de pontos em lacunas nem médias automáticas de componentes.

O endereço de uma amostra é:

```js
rawValue = result.data[channelName][sampleIndex * stride + componentIndex];
```

O sample index e component index são base zero; `frameNumber` preserva o número RP66 original. O JSON também preserva profundidade bruta, unidade original e sua conversão para metros. Unidades reconhecidas: m, ft, in, 0.1 in, cm e mm. Não se assume metros para unidades desconhecidas.

A detecção combina nome/descrição, unidade e dimensão. Se houver candidatos ambíguos, a associação fica manual. É possível selecionar canais e profundidade de frames diferentes em **Configurar tracks**. Todos os tracks usam o mesmo eixo vertical em metros; não se interpolam valores de um frame para outro.

### CBL

Curva escalar em mV, vermelho puro `#FF0000`. Referência de free pipe só é sugerida quando há parâmetro explícito com descrição compatível e unidade mV. Caso contrário, o usuário informa a referência. Para classificar automaticamente, também deve informar limites válidos da razão amplitude/referência. Não foram inventados limites universais. A origem e os parâmetros ficam registrados no ponto.

### VDL

Matriz preservada, escala de cinza. AGC visual por linha (média local e ganho RMS) melhora contraste; o array bruto não é alterado. Sem AGC, a escala usa a faixa numérica do canal. O hover continua acessando o valor original.

O tempo em µs só é mostrado com um canal temporal real, de dimensão correspondente e associação confirmada. Não se deduz período de amostragem de parâmetros proprietários sem um modelo documentado. Na ausência de eixo temporal verificado, o eixo horizontal usa **índice do componente** e o tempo aparece como indisponível.

### USIT

| Valor Z (MRayl)                | Zona               | Cor                   |
| ------------------------------ | ------------------ | --------------------- |
| 0 ≤ Z < 0,3                    | Gás                | `#FF0000`, constante  |
| 0,3 ≤ Z < 2,6                  | Líquido            | `#00FFFF`, constante  |
| 2,6 ≤ Z < 10                   | Cimento            | `#FFFFCC` → `#000000` |
| Z ≥ 10                         | Impedância elevada | `#000000`             |
| Z = −2000                      | Sem leitura        | `#008000`             |
| Outros negativos / não finitos | Inválido           | `#808080`             |

Amarelo claro não veio com um hexadecimal no briefing; o projeto fixa `#FFFFCC`. A escala é uma regra solicitada pelo projeto, não uma afirmação de calibração universal de todas as ferramentas Volve.

Azimute exige um canal real em graus, dimensão compatível e associação confirmada; não existe `component/N*360` automático. Micro-debonding SIM/NÃO exige um canal explicitamente identificado como flag e valores 0/1. Uma imagem de impedância com “micro-debonding” no nome pode ser visualizada separadamente, mas não é convertida em flag. Zonas de impedância são distintas da classificação manual Bom/Moderado/Ruim.

Os quatro presets do briefing só aparecem quando campo, poço, run 2 e Main Pass Up estão confirmados nos metadados. Os demais arquivos recebem toda a profundidade e intervalo manual.

## Selecionar, salvar e exportar

Passe o cursor para ler; clique para fixar. Também é possível escolher sample/component por campos numéricos, inclusive por teclado. O painel mostra valores brutos, unidades, índices, validade e informações disponíveis. **Salvar análise** grava na conta até 5.000 pontos por análise. As alterações ainda não salvas são indicadas; trocar de arquivo pede confirmação.

Ao reabrir o mesmo SHA-256, selecione uma análise salva. Para arquivos locais, é preciso escolher novamente o arquivo: salvar pontos não envia seu DLIS. CSV, XLSX e JSON incluem rastreabilidade, observação, classificação manual e automática separadas. Exportações ficam registradas na conta. Excel limita células numéricas a 15 dígitos significativos; JSON/CSV são preferíveis para a representação numérica completa do JavaScript. Textos potencialmente interpretados como fórmula são escapados no CSV.

## Testes e validação

```bash
pnpm test
pnpm run typecheck
python3 tests/database.py
node scripts/validate-dlis.mjs /caminho/arquivo.DLIS
pnpm run build
pnpm run test:integration
```

`tests/database.py` usa SQLite temporário em memória, sem afetar sua base.

`tests/integration.mjs` testa o Worker compilado com banco e armazenamento isolados. As identidades de teste nunca acessam a produção. Para incluir o ciclo de envio, aprovação, download e duplicação de um arquivo real, execute `node tests/integration.mjs /caminho/arquivo.DLIS`; os bytes ficam somente no ambiente temporário do teste.

Foi comparado um arquivo Volve real de 61.323.104 bytes contra `dlisio`, da Equinor: **239 canais e 26.280.702 valores idênticos**, em quatro frames. Veja `docs/VALIDACAO.md`. Esse resultado cobre esse arquivo; não prova compatibilidade com todo DLIS existente. O arquivo real não acompanha o repositório e não foi publicado no catálogo.

## Deploy sem Sites

O projeto gera um Cloudflare Worker ESM e assets estáticos com ferramentas públicas. GitHub Pages sozinho não executa autenticação, banco nem armazenamento deste aplicativo.

1. Em sua conta Cloudflare, crie D1 e R2 (`pnpm exec wrangler d1 create strata-db` e `pnpm exec wrangler r2 bucket create strata-dlis`).
2. Execute `pnpm run build`.
3. Gere configuração com seus identificadores:

```bash
node scripts/deploy-config.mjs strata SEU_DATABASE_ID seu-bucket
pnpm exec wrangler secret put SUPABASE_URL --config dist/server/wrangler.standalone.json
pnpm exec wrangler secret put SUPABASE_ANON_KEY --config dist/server/wrangler.standalone.json
pnpm exec wrangler secret put ADMIN_EMAILS --config dist/server/wrangler.standalone.json
pnpm exec wrangler d1 migrations apply DB --remote --config dist/server/wrangler.standalone.json
pnpm exec wrangler deploy --config dist/server/wrangler.standalone.json
```

`AUTH_MODE=supabase` já está na configuração independente. Configure o provedor conforme a seção de autenticação. Não envie `.env`, `.dev.vars`, tokens, arquivos DLIS privados ou `.wrangler` ao GitHub.

Na instalação Sites, preserve `.openai/hosting.json` e use o fluxo do Sites para atualizar a mesma aplicação. A identidade de um Site não é uma credencial de acesso.

## Limites conhecidos

- RP66 V1 é um formato amplo; extensões proprietárias, criptografia, certos representation codes e metadados incompletos podem ser recusados. Não existe garantia de “qualquer DLIS”.
- O parser usa memória do navegador e decodifica um frame inteiro quando ele é solicitado. O limite de envio de 512 MB não garante que todo navegador tenha memória para interpretá-lo.
- O eixo temporal e o azimute não são reconstruídos a partir de parâmetros proprietários genéricos. É necessária associação comprovada de canais; caso contrário, mostram-se índices.
- A paleta solicitada está implementada, mas uma imagem visual não substitui avaliação petrofísica e calibração da ferramenta.
- O modo Supabase requer projeto, SMTP e variáveis próprios; foi entregue como adaptador, sem credenciais fictícias nem configuração implícita.
- A extensão WebMCP é opcional e depende do navegador. A API de filtros está protegida por detecção de suporte; a interface normal funciona sem ela.

Referências primárias: [RP66 parser](https://dlis-parser.readthedocs.io/en/latest/), [dlisio](https://github.com/equinor/dlisio), [Supabase Auth](https://supabase.com/docs/guides/auth/passwords), [Cloudflare Workers](https://developers.cloudflare.com/workers/), [D1](https://developers.cloudflare.com/d1/), [R2](https://developers.cloudflare.com/r2/).
