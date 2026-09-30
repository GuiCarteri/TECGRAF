# Validação da entrega independente

Executada em 30/09/2026, Node.js 24.19 e pnpm 11.25.0. Nenhum serviço de produção foi alterado.

## Resultados executados

| Verificação | Resultado e alcance |
| --- | --- |
| Instalação com lockfile congelado | Passou. Foi utilizado um diretório de cache compartilhado apenas como argumento do comando de instalação neste ambiente; o projeto não exige esse caminho. |
| TypeScript (`pnpm typecheck`) | Passou. |
| Build Vinext/Vite/Cloudflare | Passou. Gera cliente e Worker independentes. Avisos de imports dinâmicos ineficazes no Vinext permanecem; não bloquearam o build. |
| Testes Node | 14 passaram: cores/limites USIT, índices brutos, lacunas, assinatura, metadados, detecção, permissões, CSV, SHA-256, destinos seguros, exportações CSV/JSON/XLSX, quatro dicionários, ausência de autenticação legada e integridade dos módulos técnicos. |
| SQLite | Passou: unicidade de hash e consulta de análise isolada por usuário. |
| Migração de identidade offline | Passou com fixtures: pontos e papéis preservados, usuário antigo mantido para auditoria, evidência obrigatória e colisões de histórico recusadas. |
| Integração Worker/D1/R2 | Passou: cadastro, confirmação, reenvio, recuperação, nova senha, login, cookies, refresh, expiração, logout, CSRF, papéis, isolamento de análises/histórico/exportações e fronteiras de upload. Provedor simulado somente no processo de teste; 39 chamadas de autenticação nesse cenário. |
| Provedor ausente | Passou: erro 503 com `AUTH_NOT_CONFIGURED`, sem identidade fictícia ou fallback de autenticação. |
| Renderização HTTP/SSR | Passou: português, inglês, chinês e espanhol já no HTML inicial e no atributo `lang`; login público e redirecionamento protegido preservando destino. Não substitui um teste de hidratação em navegador. |
| Código técnico preservado | Comparação SHA-256 passou para parser, Worker, cliente DLIS, curvas, pontos e exportações. |
| Lint | **Não passou.** O ZIP original tinha 134 erros e 22 avisos. A versão entregue tem dívida herdada, principalmente `any` nos dados heterogêneos do parser, `setState` em efeitos e links HTML. **Contagem final: 118 erros e 19 avisos.** As regras não foram desabilitadas. |

Os testes de exportação efetivamente geram Blob CSV/JSON/XLSX e leem o XLSX novamente. Validam valor bruto, nomes, observação, classificação canônica e ausência de mutação do ponto. Não validam precisão além do limite intrínseco do Excel.

## Não executado / homologação necessária

- **Supabase real e entrega de e-mail:** dependem das variáveis externas, SMTP, templates com OTP, duração de sessão e domínio. Os testes simulados não comprovam que e-mails reais chegaram, nem a política de limites do projeto do operador.
- **Navegador, hidratação e layout responsivo:** o download do Chromium falhou por arquivo de distribuição inválido/truncado neste ambiente. O navegador alternativo bloqueou o endereço local (`ERR_BLOCKED_BY_CLIENT`). Portanto, não há alegação de validação visual desktop/celular ou de troca de idioma com pontos carregados efetivamente executada. O cenário `tests/browser.mjs` foi entregue para essa homologação, com respostas sintéticas de Worker. Ele também verifica formulário e observação sem perda de estado; ainda precisa ser executado.
- **DLIS real representativo:** nenhum DLIS foi anexado à tarefa. Não houve novo teste ponta a ponta de parsing/Worker, publicação multipart completa, aprovação e download de um arquivo real. Use `scripts/validate-dlis.mjs` e os fluxos da aplicação com um arquivo autorizado, em homologação. Preservar os módulos técnicos e passar testes unitários não prova compatibilidade universal.
- **Migração de dados reais:** não acessada nem executada. O procedimento inclui backup, prova de titularidade, ensaio de importação, validação e rollback.
- **Implantação real:** não realizada, por instrução do usuário. IDs D1/R2, Supabase, SMTP, domínio e segredos precisam ser configurados em contas próprias.

## Revisões de segurança incluídas

Identidade é obtida pelo Supabase no servidor. Headers de identidade antigos são ignorados, inclusive em teste de falsificação. Administradores novos são inicializados por UUID explícito, sem promoção por e-mail. A API filtra os dados por `owner_id`, verifica papéis e impede sobrescrever uma análise de outro usuário. O upsert também verifica titularidade e hash no banco para reduzir a janela entre consulta e escrita. A administração exige papel no servidor tanto para a página quanto para as operações. A migração não transfere papéis privilegiados automaticamente.

O modo de autenticação anterior, suas rotas, o plugin de infraestrutura e o arquivo de hospedagem exclusivo foram removidos. Avisos legais de terceiros foram preservados. O repositório remoto não foi modificado.
