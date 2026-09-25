# Validação técnica

## Arquivo real

`WL_RAW_PROD_AC-AIMG-CCL-GR_2013-10-09_3.DLIS` (61.323.104 bytes), utilizado somente em ambiente local de validação, sem publicação nem inclusão no código.

- Poço: 15/9-F-15 C; campo: Volve; empresa: Statoil; run: 6, conforme ORIGIN.
- Frames: 10B (11.952 amostras), 60B (2.000), 30B (3.755), 20B (5.753).
- 239 canais, total de 26.280.702 valores decodificados.
- VDL: 500 componentes; AIBK: 36 componentes.
- Unidade original TDEP: `0.1 in`, convertida explicitamente por fator 0,00254 para metros.

Os arrays foram exportados em Float64 e comparados em Python, componente a componente, com `dlisio` da Equinor. Todos os 26.280.702 valores coincidiram, incluindo equivalência de NaNs. Nenhuma divergência.

## Testes executados

- Nove testes automatizados: fronteiras/paleta USIT, índices e rejeição de índices inválidos, gaps, extensão e cabeçalho RP66, empresa, detecção de canais/unidades, papéis/visibilidade, CSV, SHA-256.
- Esquema SQLite: unicidade do SHA-256 e consulta de análises por proprietário.
- Worker isolado com D1/R2 temporários: autenticação exigida, permissões, isolamento entre contas, persistência de pontos, histórico e promoção de papéis. Identidades controladas de teste; nenhuma chamada à produção.
- Ciclo completo com o arquivo real de 61.323.104 bytes no Worker isolado: upload multipart, autorização obrigatória, revisão pendente, aprovação administrativa, download protegido com SHA-256 idêntico, rejeição de duplicação e arquivamento.
- TypeScript: verificação sem erros.
- Compilação Worker e cliente: concluída.
- Interface pública: catálogo vazio real, filtros e controles renderizados no navegador; biblioteca sem dados demonstrativos.

## Alcance

A comparação independente cobre um arquivo real. Outros fornecedores, múltiplos logical files e extensões incompletas precisam de arquivos próprios de aceitação para ampliar a cobertura. A implementação conserva os limites, recusa associações incertas e informa ausências. O teste automatizado de cores valida a regra definida no briefing, não certifica a interpretação petrofísica.

A autenticação hospedada usa o provedor ChatGPT. A verificação completa de fluxo com uma conta real, envio/revisão e persistência de produção não foi executada por uma sessão de navegador autenticada durante o desenvolvimento. O adaptador opcional Supabase não foi conectado a um projeto real. A extensão WebMCP não estava disponível no navegador de validação; o site usa detecção de suporte.
