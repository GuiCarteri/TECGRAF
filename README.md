# STRATA — entrega completa, 06/11/2026

Projeto original preservado em `strata-dlis/`. Base: `revert-2-TESTE`, commit `5b379a38575b6d99bb74969d003dd2bf61347ff6`. Branch: `improvement/strata-scientific-viewer-20261029`.

Abra esta pasta no VS Code ou crie um novo Codespace nessa branch. `.devcontainer/` prepara Node 24, pnpm e Python; a construção do container não foi testada neste ambiente e nenhum Codespace existente foi alterado.

```bash
cd strata-dlis
corepack enable
corepack prepare pnpm@11.25.0 --activate
pnpm install --frozen-lockfile
cp .env.example .dev.vars
# Preencha .dev.vars com seu ambiente Supabase autorizado.
pnpm db:migrate:local
pnpm dev
```

Acesse o endereço mostrado pelo Vite. No Codespaces, mantenha a porta 5173 privada; se necessário, use `pnpm dev --host 0.0.0.0`. Não existe conta/senha padrão. Autenticação e rotas privadas exigem configuração própria.

- [Instalação e autenticação detalhadas](strata-dlis/README.md)
- [Resultados e limitações](strata-dlis/docs/VALIDACAO.md)
- [Diagnóstico e melhorias](strata-dlis/docs/ATUALIZACAO.md)
- [Antes/depois](strata-dlis/docs/COMPARACAO_VISUAL.md)
- [Segurança e infraestrutura institucional](strata-dlis/docs/SEGURANCA.md)
- [Motor Python opcional](strata-dlis/science/README.md)

O ZIP contém todo o código versionado e a estrutura original; exclui dependências instaladas, caches, builds, banco, DLIS reais e segredos. Instale dependências pelo lockfile. Não houve deploy. Revise e homologue os serviços reais antes de substituir a versão anterior.

Atualização de cores e marcações: [guia e limitações](strata-dlis/docs/MARCACOES.md).
