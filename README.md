# STRATA DLIS

Biblioteca pública e análise de arquivos DLIS RP66 V1, com autenticação por e-mail/senha e interface em português, inglês, chinês simplificado e espanhol.

## Arquitetura

- React 19 + TypeScript. As rotas `app/` usam a API do App Router, executada por **Vinext sobre Vite**. Não execute `next build` neste projeto.
- Cloudflare Workers executa páginas e API. **D1 (`DB`)** mantém usuários, permissões, metadados, análises, pontos, histórico e registros de exportação. **R2 (`BUCKET`)** armazena arquivos publicados.
- Supabase Auth gerencia senhas, confirmação, recuperação e sessões. Não é necessário migrar os dados da aplicação para um banco Supabase.
- Arquivos locais são processados no navegador por Web Worker. O parser incluído, os critérios técnicos, as cores e as exportações foram preservados.
- Nenhum login por headers, identidade simulada ou infraestrutura de editor é utilizado pela aplicação. O ambiente de testes tem fixtures isoladas, que nunca entram no build de produção.

O processamento do arquivo é client-side; biblioteca, autenticação, publicação e sincronização requerem o backend. Esta aplicação completa não é um site estático nem oferece funcionamento integral offline. **GitHub Pages, isoladamente, não executa Workers, D1, R2 ou as rotas da API.** O GitHub pode armazenar o código; a execução proposta usa contas próprias Cloudflare e Supabase.

## Instalação local

Requisitos: Node.js **22.18 ou superior** (validado com 24.19), pnpm **11.25.0** e Python 3 para os testes SQLite/migração. Não há requisito de conta em ferramenta de geração de código.

```bash
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
cp .dev.vars.example .dev.vars
pnpm db:migrate:local
pnpm dev
```

Abra o endereço local exibido pelo Vite, normalmente `http://127.0.0.1:5173`. No Windows sem `cp`, copie o arquivo pelo VS Code/Explorador. `.dev.vars` e o estado local `.wrangler/` são ignorados pelo Git.

Preencha `.dev.vars` com o seu projeto Supabase antes de testar contas. Sem configuração, a biblioteca pública e o guia continuam acessíveis quando o D1 está inicializado; login informa a configuração ausente e as rotas privadas permanecem bloqueadas. **Não existe conta padrão ou login de demonstração.**

O ID D1 zerado em `wrangler.json` serve apenas como placeholder local. `pnpm deploy` recusa esse ID. O Vite/Miniflare pode buscar informações auxiliares da Cloudflare; em um ambiente local sem essa conectividade, use `CLOUDFLARE_CF_FETCH_ENABLED=false`. Isso não substitui o provedor de autenticação nem altera permissões.

## Variáveis do servidor

| Variável | Finalidade |
| --- | --- |
| `SUPABASE_URL` | URL HTTPS do projeto próprio, sem `/auth/v1` no final. |
| `SUPABASE_ANON_KEY` | Chave pública legada `anon` do projeto, usada pelo adaptador REST no servidor. Não use `service_role`. |
| `ADMIN_USER_IDS` | Lista opcional de UUIDs Supabase confirmados, separados por vírgulas, para inicializar novos administradores. Nunca e-mails. |

Mesmo a chave pública deve ser configurada no ambiente, não embutida no repositório. Credenciais administrativas Cloudflare/Supabase, tokens de CI e evidências de titularidade não pertencem ao código.

## Supabase: e-mail e senha

1. Crie um projeto próprio e habilite o provedor Email, com **Confirm email** ativado. Configure senha mínima de 8 caracteres; o formulário limita a 200.
2. Configure o Site URL e as URLs permitidas para seus domínios locais e de produção. Configure SMTP e limites de envio adequados. A aplicação não solicita OAuth.
3. Em **Email Templates**, os modelos de **Confirm signup** e **Reset password** devem exibir o código `{{ .Token }}`. O fluxo implementado usa **código de seis dígitos**, digitado na aplicação. Configure o tamanho do OTP em seis dígitos e sua expiração no provedor. Não dependa somente do link padrão `{{ .ConfirmationURL }}`: este projeto não implementa callback por fragmento da URL.
4. Cadastre-se no STRATA; confirme o código enviado. Há opção para reenviar a confirmação, inclusive para um cadastro iniciado anteriormente.
5. A opção “Esqueci minha senha” envia código de recuperação. Após validá-lo, defina a nova senha. As respostas de cadastro/recuperação evitam confirmar publicamente se um endereço já possui conta.
6. O servidor valida o access token em `/auth/v1/user`, incluindo confirmação do e-mail. Tokens são mantidos em cookies `HttpOnly`, `SameSite=Lax` e `Secure` em HTTPS. Não são persistidos em `localStorage`.
7. A API tenta uma renovação quando recebe 401; chamadas simultâneas na mesma página compartilham a tentativa. As páginas protegidas possuem rota de renovação antes de redirecionar ao login. Refresh tokens inválidos limpam os cookies. O parâmetro `next` aceita somente destinos internos seguros.

A duração do access token, a política de rotação e a validade do refresh token são determinadas pelo Supabase. O cookie de refresh tem retenção máxima de 30 dias; ele não estende a validade da sessão no provedor. Uma sessão definitivamente expirada exige novo login. Para preservar um arquivo local aberto nesse caso, faça o login em outra aba do mesmo domínio e retome a operação.

### Permissões

Papéis D1: `user`, `publisher` e `admin`. Usuários visualizam arquivos autorizados e mantêm suas próprias análises. Publicadores enviam arquivos para revisão. Administradores revisam publicações e alteram papéis de outras contas. A API verifica os papéis e a titularidade no servidor; esconder um botão não concede nem revoga acesso.

Para inicializar o primeiro administrador, obtenha seu UUID confirmado em Supabase e configure `ADMIN_USER_IDS` **antes do primeiro login dessa identidade no STRATA**. O bootstrap só se aplica à criação da linha; não promove contas existentes a cada login e não restaura papéis revogados. Se a conta já existe, um operador autorizado pode atualizar explicitamente a linha `users` em D1, identificada por `supabase:<UUID>`. Remova a lista de bootstrap após a inicialização. Nunca promova automaticamente o primeiro visitante.

Identidades antigas não são associadas por e-mail. Veja [docs/MIGRACAO_IDENTIDADES.md](docs/MIGRACAO_IDENTIDADES.md).

## Banco e armazenamento

As migrações em `drizzle/` preservam o esquema existente. `pnpm db:migrate:local` aplica apenas na emulação local. Arquivos são enviados em partes ao R2 e têm seu SHA-256 conferido no servidor; a visibilidade pública depende de revisão e aprovação. Não habilite acesso público direto ao bucket: o download passa pela API autorizada.

Para desenvolvimento, D1/R2 são emulados localmente. Para recuperar dados existentes, faça backup D1 e inventário/cópia R2 antes de qualquer migração de infraestrutura. As chaves `object_key` e os bytes dos arquivos devem ser preservados. Esta entrega não contém registros, arquivos DLIS reais, credenciais ou cópias de banco de produção.

## Implantação em contas próprias

Os comandos abaixo são instruções para o operador. **Nenhum serviço foi provisionado ou publicado nesta entrega.**

1. Autentique o Wrangler na sua conta Cloudflare.
2. Crie D1 e R2 ou selecione recursos existentes autorizados:

```bash
pnpm exec wrangler login
pnpm exec wrangler d1 create strata-dlis-db
pnpm exec wrangler r2 bucket create strata-dlis-files
```

3. Edite `wrangler.json`: nome do Worker, `database_id`, `database_name`, `bucket_name` e, se necessário, `account_id`. Preserve os bindings `DB` e `BUCKET`.
4. Em banco novo, aplique as migrações. Em banco existente, faça backup e confira o histórico antes de aplicar:

```bash
pnpm exec wrangler d1 migrations apply DB --remote
pnpm exec wrangler secret put SUPABASE_URL
pnpm exec wrangler secret put SUPABASE_ANON_KEY
pnpm exec wrangler secret put ADMIN_USER_IDS
pnpm build
pnpm deploy
```

Use os comandos de secrets sem informar valores na linha de comando; o Wrangler solicita os valores. O deploy utiliza a configuração gerada em `dist/server/wrangler.json`. Alterações de bindings exigem novo build. `pnpm start` executa o build localmente; copie as variáveis para o ambiente que o Wrangler indicar se necessário. Para implantação, escolha um domínio HTTPS próprio e atualize Site URL, SMTP e a configuração do provedor.

Um ícone ou selo injetado por um editor ou hospedagem externa fica fora do DOM controlado por este projeto. A implantação no Worker da sua conta serve apenas o conteúdo deste código. Não há CSS para ocultar selos externos. Os ícones azuis do anexo são ícones do React, não uma afiliação comercial.

## Idiomas e integridade

O seletor compartilhado oferece Português (`pt-BR`, padrão), English (`en`), 简体中文 (`zh-CN`) e Español (`es`). A preferência fica em cookie por um ano. O servidor lê esse cookie para gerar `<html lang>` e a primeira renderização; o provedor React inicia com o mesmo valor. Mudanças atualizam o contexto sem navegação, recarregamento ou mudança da chave do visualizador.

`lib/i18n/` contém quatro dicionários separados, chaves tipadas, fallback português e mapeamento de mensagens/diagnósticos. O seletor nativo oferece teclado e foco visível. Títulos, formulários, menus, estados vazios, tabelas, diálogos, ajuda e mensagens são traduzidos. Datas e tamanhos usam o locale na apresentação. Diagnósticos não reconhecidos são preservados para evitar perder informações técnicas.

Nomes de arquivo, empresas, nomes dos canais, unidades, IDs, observações e dados brutos não são traduzidos. Classificações persistidas continuam com seus valores canônicos; somente seus rótulos mudam. CSV/XLSX/JSON mantêm cabeçalhos e esquema `strata-points-v1`, independentemente do idioma. Excel limita números a 15 dígitos significativos; prefira JSON para auditoria de precisão. A aplicação mantém as exportações existentes, sem acrescentar um importador de análises que não existia no original.

## Verificações

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:database
python3 tests/migration.py
pnpm build
pnpm test:integration
node tests/ssr.mjs
```

`tests/integration.mjs` executa o Worker compilado com D1/R2 isolados e um provedor simulado apenas no processo de teste. Não substitui a homologação com Supabase e e-mail reais. O teste de integridade compara o SHA-256 dos módulos técnicos com os originais.

Teste de navegador (duas janelas de terminal):

```bash
pnpm exec playwright install chromium
pnpm test:browser:serve
# Em outro terminal:
pnpm test:browser
```

O cenário utiliza respostas de Worker sintéticas para verificar a interface, alternância de idioma, pontos, observações e formulários. Não é prova de compatibilidade com um DLIS real. Leia [docs/VALIDACAO.md](docs/VALIDACAO.md) para resultados executados e limitações. O lint ainda aponta dívida técnica herdada; as regras não foram desligadas para produzir um resultado artificialmente verde.

## Fontes oficiais consultadas

- [Supabase Auth REST](https://supabase.github.io/auth/): signup, verify, recover, user, logout e token.
- [Sessões Supabase](https://supabase.com/docs/guides/auth/sessions).
- [Verificação de OTP](https://supabase.com/docs/reference/javascript/auth-verifyotp).
- [Exemplo Cloudflare/Vinext](https://github.com/cloudflare/vinext/tree/main/examples/app-router-cloudflare).

A configuração segue as versões fixadas no lockfile. Exemplos upstream mais recentes podem usar outras versões do plugin Cloudflare; não migre automaticamente durante uma correção de autenticação.

## Licenças

Avisos de terceiros foram mantidos em `lib/vendor/dlis-parser/` e `vendor/`. Um aviso do plugin de infraestrutura anteriormente incluído foi preservado como registro legal, embora seu código não seja mais utilizado. Não foram criados créditos de autoria humana.
