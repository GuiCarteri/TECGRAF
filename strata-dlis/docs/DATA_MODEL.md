# Etapa 2 — Data Model

## Fontes e relações

| Entidade | Fonte oficial | Relação / identidade |
| --- | --- | --- |
| Poço | Nova tabela `wells` | ID próprio, proprietário, nome, campo, empresa, identificador opcional, origem e datas |
| Arquivo publicado | `files` existente | SHA-256 único e chave R2 preservados; `file_wells` aponta para seu poço principal |
| Arquivo lógico, frame, curva | Projeção tipada de `files.metadata` | Identidade composta por SHA-256 e posições de LF/frame/canal; chaves originais também preservadas |
| Interpretação | `analyses` existente | Titular, hash do arquivo, pontos, configurações e regiões; não há segunda cópia editável |
| Relatório | Nova tabela `reports` | Privado, versão de esquema, conteúdo manual, hash e snapshot imutável da interpretação de origem |

Um poço pode reunir vários arquivos. O vínculo de um arquivo é explícito e restrito ao espaço do seu proprietário. O nome declarado em `files.well` permanece intacto quando o vínculo muda. A origem por logical file também permanece nos metadados; o vínculo principal não afirma que todos os logical files representem o mesmo poço.

As curvas são uma **projeção de leitura**, sem uma tabela duplicada de canais e sem copiar amostras para D1. `GET /files/:id/model` entrega LF → frames → curvas, mantendo unidade, dimensão, tipo, posição e metadados originais. Nomes repetidos não colidem. Metadados antigos inválidos geram `issues` explícitos; campos ausentes ficam nulos. Esses avisos são de estrutura, não indicadores de qualidade, IPD ou plausibilidade.

## Migração e compatibilidade

`drizzle/0001_data_model.sql` adiciona três tabelas e um trigger, sem alterar as colunas das tabelas antigas. O snapshot Drizzle e seu journal acompanham a mudança.

- Arquivos existentes recebem um poço **provisório** (`origin=publication`, ID `publication:<file-id>`), mesmo sem nome informado. Nomes iguais não são usados para unir poços.
- Um trigger cria o mesmo vínculo para novos arquivos, na transação que registra a publicação.
- É possível criar um poço explícito (`origin=manual`) e associar vários arquivos a ele. Poços provisórios sem arquivos permanecem privados; não há remoção automática de registros históricos.
- Hashes, metadados, R2, pontos, regiões e exportações existentes permanecem intactos.
- A ferramenta offline de migração de identidades também transfere a titularidade de poços e relatórios, preservando snapshots históricos e aceitando backups anteriores à Etapa 2.

Aplicar antes de executar esta versão: `pnpm db:migrate:local`. Em produção, usar backup e o procedimento existente de migração D1; **nenhuma migração remota ou implantação foi executada**.

## APIs

Todas exigem sessão. Escritas usam a verificação de origem existente; respostas têm `Cache-Control: no-store`.

| Método e caminho (prefixo `/api`) | Comportamento |
| --- | --- |
| `GET /files/:id/model` | Modelo do arquivo, com a mesma permissão de leitura do visualizador |
| `GET /wells` | Até 500 poços do usuário autenticado |
| `GET /wells/:id` | Poço próprio e seus arquivos próprios, excluindo os que estão sendo apagados |
| `POST /wells` | `{name, field?, company?, identifier?}`; identidade e titularidade geradas no servidor |
| `PUT /files/:id/well` | `{wellId}`; autor ou admin, sempre vinculando um poço do proprietário do arquivo |
| `GET /interpretations` e `GET /interpretations/:id` | Até 200 análises próprias, com pontos/regiões e vínculo ao arquivo quando ainda acessível |
| `POST /analyses`, `DELETE /analyses/:id` | Fluxos existentes continuam responsáveis pela escrita das interpretações |
| `GET /reports` | Até 200 resumos de relatórios próprios |
| `GET /reports/:id` | Relatório próprio com conteúdo e snapshot |
| `POST /reports` | Cria relatório manual; não calcula resultados científicos |
| `DELETE /reports/:id` | Apaga somente relatório próprio |

Corpo de `POST /reports`:

```json
{
  "title": "Revisão manual",
  "fileId": "arquivo-opcional",
  "analysisId": "analise-opcional",
  "content": {
    "summary": "Observações do autor",
    "sections": [{ "heading": "Notas", "text": "Texto do relatório" }]
  }
}
```

É obrigatório informar arquivo ou análise. Uma análise precisa pertencer ao usuário; um arquivo precisa estar acessível. Se ambos forem fornecidos, os hashes devem coincidir. Relatórios de análises locais funcionam sem publicação. O snapshot registra hash, vínculo de poço quando informado um arquivo, nome e estado da interpretação no momento da criação. Não inclui credenciais nem a chave R2. Limites: 500 KB de entrada e 1 MB de snapshot. Relatórios não são atualizados: para uma nova versão do conteúdo, cria-se outro registro.

Relatórios e interpretações são privados inclusive em arquivos públicos; papel de administrador não dá acesso a relatórios de terceiros por estas APIs. Após apagar uma publicação, seu vínculo é removido por FK, e `reports.file_id` fica nulo. Apagar uma análise torna `reports.analysis_id` nulo. Conteúdo e snapshot do relatório permanecem, sem links quebrados nem perda de evidência. A confirmação de exclusão foi atualizada nos quatro idiomas para informar essa preservação.

## Validação

- 28 testes unitários: identidades de curvas, metadados incompletos, contratos e regressão dos testes existentes.
- SQLite com FKs: migração sobre registros legados, campos originais intactos, nomes iguais separados, vínculos válidos, exclusão e preservação dos snapshots.
- Integração D1/R2: poços, curvas, interpretações, relatórios, autorizações, CSRF, associação explícita, fontes incompatíveis, edição e exclusão das fontes. Provedor de autenticação simulado somente nos testes.
- TypeScript, build, SSR e lint dos novos módulos verificados.

O lint global ainda possui a dívida registrada na Etapa 1. Infraestrutura real e teste visual continuam pendentes. A interface, os gráficos e os fluxos de edição existentes foram preservados; somente o texto da confirmação de exclusão inclui relatórios. Telas de analytics, indicadores, IPD e integração ao visualizador pertencem às etapas seguintes.
