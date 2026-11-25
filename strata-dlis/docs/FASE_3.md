# Fase 3 · Interface, idiomas e acessibilidade

## Experimentar a interface

1. Execute `npm run dev` na raiz de `feat/redesign-dlis` e abra a porta 5173. Execute `npm run seed` em outro terminal para incluir os exemplos sintéticos.
2. No cabeçalho, escolha um idioma e uma aparência. No tema automático, altere a aparência do sistema com a página aberta. Na primeira visita, o STRATA escolhe um dos idiomas disponíveis usando a preferência do navegador. A escolha manual tem prioridade.
3. Abra a paleta com a lupa, **Ctrl+K** ou **⌘K**. Digite parte do nome de um poço da biblioteca, de uma página, de um tema ou de um idioma. Use ↑ e ↓ para selecionar, Enter para executar e Esc para fechar. O visualizador solicita login aos visitantes.
4. Entre em uma conta, escolha o tema escuro e abra a mesma conta em outro navegador. O servidor lê a preferência da conta antes de enviar a página. No modo visitante, a escolha vale para aquele navegador.
5. Com um DLIS aberto, troque o idioma e o tema. Confira o valor do ponto, a anotação e o canal selecionado. As unidades e os valores exportados têm origem no DLIS. A interface apresenta números e datas conforme o idioma.

## Evidências no Chromium

As capturas mostram a publicação de um **poço sintético**. O teste gerou o arquivo, passou os bytes pelo parser, enviou-o ao armazenamento local e aprovou-o antes de abrir o catálogo com uma sessão de visitante.

[Catálogo claro](evidence/phase3-light.jpg) · [Catálogo escuro](evidence/phase3-dark.jpg) · [Busca de poço na paleta](evidence/phase3-palette.jpg)

| Verificação | Como repetir |
| --- | --- |
| 562 chaves em PT-BR, EN, ES e zh-CN, correspondência dos parâmetros e busca de texto literal em JSX, atributos acessíveis e chamadas de tradução | `npm run i18n:check` na raiz |
| HTML inicial, idioma por prioridade do navegador, cookie, tema explícito, quatro idiomas e página 404 | `npm run test:ssr` em `strata-dlis/` |
| Duas contas com preferências distintas, mudança de um campo preservando o outro, origem inválida e requisição sem sessão | `npm run build && npm run test:integration` em `strata-dlis/` |
| Tema restaurado em outra sessão sem o cookie de aparência, cadastro, catálogo, publicação e revisão | `npm run test:phase2` em `strata-dlis/` |
| Atalhos, foco, busca do poço, movimento reduzido, quatro trilhas de um DLIS sintético, contraste e sete telas a 320, 390, 768 e 1100 px | `npm run test:phase3` em `strata-dlis/` |
| Arquivo, pontos e observações preservados na troca entre os quatro idiomas | `npm run test:browser` em `strata-dlis/` |

Os testes de navegador aceitam `PLAYWRIGHT_EXECUTABLE_PATH` com o caminho de um Chrome instalado. Outra opção é executar `pnpm exec playwright install chromium --only-shell` dentro de `strata-dlis/`. Para reproduzir as três imagens, execute `PHASE3_EVIDENCE=docs/evidence npm run test:phase2` na mesma pasta.

A verificação automática de acessibilidade usa axe-core com regras WCAG A/AA nas sete telas, na paleta e no visualizador com dados. O teste mede também o contraste de seis elementos da biblioteca nos dois temas. A validação manual com VoiceOver ou NVDA e a comparação com Safari e Firefox seguem no QA final.
