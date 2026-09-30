# Alterações da entrega

37 arquivos modificados, 26 criados e 15 removidos em relação ao ZIP anexado (além deste inventário).

## Modificados

- `.dev.vars.example` — Configuração independente, bindings, dependências ou regras de exclusão.
- `.env.example` — Configuração independente, bindings, dependências ou regras de exclusão.
- `.gitignore` — Configuração independente, bindings, dependências ou regras de exclusão.
- `README.md` — Instruções de configuração, migração, escopo e evidências de validação.
- `app/account/page.tsx` — Interface localizada e remoção da integração de acesso anterior.
- `app/admin/page.tsx` — Interface localizada e remoção da integração de acesso anterior.
- `app/auth/refresh/route.ts` — Autenticação Supabase, sessões, destinos seguros e autorização.
- `app/help/page.tsx` — Interface localizada e remoção da integração de acesso anterior.
- `app/layout.tsx` — Interface localizada e remoção da integração de acesso anterior.
- `app/login/page.tsx` — Interface localizada e remoção da integração de acesso anterior.
- `app/publish/page.tsx` — Interface localizada e remoção da integração de acesso anterior.
- `app/register/page.tsx` — Interface localizada e remoção da integração de acesso anterior.
- `app/viewer/page.tsx` — Interface localizada e remoção da integração de acesso anterior.
- `cloudflare-env.d.ts` — Configuração independente, bindings, dependências ou regras de exclusão.
- `components/auth/email-form.tsx` — Autenticação Supabase, sessões, destinos seguros e autorização.
- `components/strata/account.tsx` — Interface localizada e remoção da integração de acesso anterior.
- `components/strata/admin.tsx` — Interface localizada e remoção da integração de acesso anterior.
- `components/strata/library.tsx` — Interface localizada e remoção da integração de acesso anterior.
- `components/strata/points-table.tsx` — Interface localizada e remoção da integração de acesso anterior.
- `components/strata/publish.tsx` — Interface localizada e remoção da integração de acesso anterior.
- `components/strata/shell.tsx` — Interface localizada e remoção da integração de acesso anterior.
- `components/strata/track-canvas.tsx` — Interface localizada e remoção da integração de acesso anterior.
- `components/strata/viewer.tsx` — Interface localizada e remoção da integração de acesso anterior.
- `components/ui/dialog.tsx` — Interface localizada e remoção da integração de acesso anterior.
- `db/index.ts` — Configuração independente, bindings, dependências ou regras de exclusão.
- `docs/VALIDACAO.md` — Instruções de configuração, migração, escopo e evidências de validação.
- `lib/api.ts` — Configuração independente, bindings, dependências ou regras de exclusão.
- `lib/server/auth-handlers.ts` — Autenticação Supabase, sessões, destinos seguros e autorização.
- `lib/server/auth.ts` — Autenticação Supabase, sessões, destinos seguros e autorização.
- `lib/server/handlers.ts` — Autenticação Supabase, sessões, destinos seguros e autorização.
- `lib/server/provider.ts` — Autenticação Supabase, sessões, destinos seguros e autorização.
- `package.json` — Configuração independente, bindings, dependências ou regras de exclusão.
- `pnpm-lock.yaml` — Configuração independente, bindings, dependências ou regras de exclusão.
- `pnpm-workspace.yaml` — Configuração independente, bindings, dependências ou regras de exclusão.
- `styles/strata.css` — Seletor acessível e ajustes responsivos do cabeçalho.
- `tests/integration.mjs` — Validação isolada de integração, idiomas, exportação, migração ou renderização.
- `vite.config.ts` — Configuração independente, bindings, dependências ou regras de exclusão.

## Criados

- `components/auth/login-content.tsx` — Autenticação Supabase, sessões, destinos seguros e autorização.
- `components/strata/help.tsx` — Interface localizada e remoção da integração de acesso anterior.
- `components/strata/language-selector.tsx` — Dicionários, preferência persistente, formatação e tradução da interface.
- `docs/MIGRACAO_IDENTIDADES.md` — Instruções de configuração, migração, escopo e evidências de validação.
- `lib/auth-policy.ts` — Autenticação Supabase, sessões, destinos seguros e autorização.
- `lib/i18n/en.json` — Dicionários, preferência persistente, formatação e tradução da interface.
- `lib/i18n/es.json` — Dicionários, preferência persistente, formatação e tradução da interface.
- `lib/i18n/index.ts` — Dicionários, preferência persistente, formatação e tradução da interface.
- `lib/i18n/provider.tsx` — Dicionários, preferência persistente, formatação e tradução da interface.
- `lib/i18n/pt-BR.json` — Dicionários, preferência persistente, formatação e tradução da interface.
- `lib/i18n/zh-CN.json` — Dicionários, preferência persistente, formatação e tradução da interface.
- `lib/server/errors.ts` — Autenticação Supabase, sessões, destinos seguros e autorização.
- `lib/server/session.ts` — Autenticação Supabase, sessões, destinos seguros e autorização.
- `scripts/check-deploy.mjs` — Operação independente e migração offline segura.
- `scripts/migrate-identities.py` — Operação independente e migração offline segura.
- `tests/browser.mjs` — Validação isolada de integração, idiomas, exportação, migração ou renderização.
- `tests/browser/index.html` — Validação isolada de integração, idiomas, exportação, migração ou renderização.
- `tests/browser/main.tsx` — Validação isolada de integração, idiomas, exportação, migração ou renderização.
- `tests/browser/vite.config.ts` — Validação isolada de integração, idiomas, exportação, migração ou renderização.
- `tests/export.test.mjs` — Validação isolada de integração, idiomas, exportação, migração ou renderização.
- `tests/i18n.test.mjs` — Dicionários, preferência persistente, formatação e tradução da interface.
- `tests/migration.py` — Validação isolada de integração, idiomas, exportação, migração ou renderização.
- `tests/ssr.mjs` — Validação isolada de integração, idiomas, exportação, migração ou renderização.
- `tests/technical-integrity.json` — Validação isolada de integração, idiomas, exportação, migração ou renderização.
- `vendor/sites-vite-plugin.LICENSE` — Aviso legal preservado, sem dependência operacional.
- `wrangler.json` — Configuração independente, bindings, dependências ou regras de exclusão.

## Removidos

- `.openai/hosting.json` — Substituído por autenticação Supabase ou configuração/comandos Wrangler independentes.
- `app/chatgpt-auth.ts` — Substituído por autenticação Supabase ou configuração/comandos Wrangler independentes.
- `build/sites-vite-plugin.LICENSE` — Substituído por autenticação Supabase ou configuração/comandos Wrangler independentes.
- `build/sites-vite-plugin.ts` — Substituído por autenticação Supabase ou configuração/comandos Wrangler independentes.
- `scripts/build-verified.sh` — Substituído por autenticação Supabase ou configuração/comandos Wrangler independentes.
- `scripts/deploy-config.mjs` — Substituído por autenticação Supabase ou configuração/comandos Wrangler independentes.
- `scripts/execution-profile.mjs` — Substituído por autenticação Supabase ou configuração/comandos Wrangler independentes.
- `scripts/install-ci.mjs` — Substituído por autenticação Supabase ou configuração/comandos Wrangler independentes.
- `scripts/install-ci.sh` — Substituído por autenticação Supabase ou configuração/comandos Wrangler independentes.
- `scripts/install-pnpm.sh` — Substituído por autenticação Supabase ou configuração/comandos Wrangler independentes.
- `scripts/npm-install.mjs` — Substituído por autenticação Supabase ou configuração/comandos Wrangler independentes.
- `scripts/pnpm-install.mjs` — Substituído por autenticação Supabase ou configuração/comandos Wrangler independentes.
- `scripts/run-framework.mjs` — Substituído por autenticação Supabase ou configuração/comandos Wrangler independentes.
- `scripts/sites-env.mjs` — Substituído por autenticação Supabase ou configuração/comandos Wrangler independentes.
- `scripts/sites-env.sh` — Substituído por autenticação Supabase ou configuração/comandos Wrangler independentes.

## Pontos de revisão

- 465 chaves em cada um dos quatro dicionários; fallback em português.
- Parser, Worker, regras técnicas, cores, pontos e exportação mantidos byte a byte, com teste de integridade.
- Bootstrap administrativo agora usa UUID explícito. Dados antigos não são vinculados por e-mail.
- Build, TypeScript, testes Node, D1/R2 isolados, exportações, migração e SSR passaram. Lint: 118 erros e 19 avisos, predominantemente herdados; validação visual e provedor real pendentes.
- Nenhum commit, push, provisionamento ou deploy remoto foi realizado.
