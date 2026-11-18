# Correções de inicialização, idioma e login — 18/11/2026

A Etapa 2 permanece pausada. Design, dados e autenticação Supabase preservados.

- Codespaces: desativada a restauração de terminais e tarefas automáticas; nenhuma inicialização do servidor nos hooks do container.
- `pnpm dev`: comando manual que aplica migrações somente no D1 local e inicia a porta 5173; porta ocupada gera erro.
- Encaminhamento HTTPS do Codespaces: host específico e WebSocket seguro.
- Idioma: seletor controlado, aplicação sem recarregar/perder campos, fallback HTML e tolerância a cookies bloqueados.
- Login: formulário HTML funcional sem hidratação, configuração validada e credenciais existentes preservadas; reutilizada a política de senhas já presente no repositório.
- `pnpm setup:env`: cria `.dev.vars` somente se ainda não existir.

Validação: typecheck, 43 testes unitários, testes DOM dos controles, banco/migração, build, integração (69 requisições com Supabase simulado), inicialização manual e SSR nos quatro idiomas passaram. ESLint dos arquivos alterados passou.

Limites: Chromium não pôde iniciar neste ambiente (restrição de socket); controles testados em DOM emulado. Não foi feito login com conta real, deploy nem alteração de um Codespace existente. O lint global possui pendências anteriores a estas correções.

Depois de atualizar a branch e instalar dependências, execute **Codespaces: Rebuild Container** uma vez. Para iniciar, use `cd strata-dlis` e `pnpm dev`; para parar, `Ctrl+C`. Configure Supabase em `.dev.vars` se ainda não estiver configurado, sem sobrescrever valores existentes.
