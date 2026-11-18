# Etapa 7 — Validação local

Execução em Linux x86-64 com Node 24.22.3, usando bases temporárias e DLIS sintéticos. A verificação de referência com dlisio 1.0.4 comparou os hashes de todas as amostras numéricas após conferir frame, canal, dimensões e unidades. Os 201.768 valores de seis canais coincidiram.

| Verificação | Resultado |
| --- | --- |
| TypeScript, build, testes unitários e ciência em Python | Compilação aprovada, 55 testes unitários e 5 testes Python passaram. |
| Segurança e persistência | Integração local com 105 chamadas ao provedor simulado. Passaram os cenários de sessão, origem, isolamento de contas, permissões de exclusão, preservação de relatórios e migração. |
| Exportações | Releitura de CSV, JSON e XLSX. Verificados identificadores, valores brutos, sentinela negativa, Unicode, aspas e texto iniciado por sinal de igual. XLSX conservou o texto como string e o SHA-256 na folha de rastreabilidade. |
| Interface | Controles em DOM emulado, dashboard, interpretação antiga e atual, renderização inicial em quatro idiomas e inicialização manual passaram. |

## Desempenho

Medianas em milissegundos de cinco execuções após um aquecimento com `pnpm test:performance`. A geração da massa de teste ocorre antes da medição. O índice USIT também foi comparado a um resultado calculado pelas lacunas conhecidas do gerador.

| Linhas | Células | Bytes DLIS | Hash, leitura e decodificação | Tracks e indicadores | Tempo total |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1.201 | 201.768 | 829.208 | 5,61 | 9,16 | 14,84 |
| 4.801 | 806.568 | 3.313.208 | 18,93 | 23,53 | 45,95 |

Cada coluna tem sua própria mediana. Os tempos medem processamento em Node no ambiente de teste. Latência de renderização no navegador e comportamento próximo ao limite de 512 MB continuam sem medição.

## Reprodução

Na pasta `strata-dlis`, execute `pnpm typecheck`, `pnpm test`, `pnpm test:database`, `pnpm test:ui-controls`, `pnpm build`, `pnpm test:integration`, `pnpm test:dev-startup`, `pnpm test:ssr` e `pnpm test:performance`. Para as verificações independentes, use um ambiente Python com as dependências científicas e execute:

```bash
pnpm test:python
reference_dir=$(mktemp -d)
node tests/fixtures/dlis.mjs "$reference_dir/synthetic.dlis"
python3 scripts/verify-reference.py "$reference_dir"
```

## Pendências

O Chromium instalado falhou ao criar o socket de inicialização e o download alternativo do Playwright retornou um arquivo incompleto. As suítes de navegador real ficam pendentes. O lint geral reportou 117 erros e 17 avisos, incluindo 114 ocorrências da regra de tipagem explícita de `any`; os dois testes alterados passaram no lint. Também seguem pendentes a autenticação com uma conta real e a validação dos critérios científicos em dados de campo.
