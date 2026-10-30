# Segurança e ambiente institucional

Nenhum chatbot, SDK de IA, deploy ou publicação de DLIS foi feito nesta atualização. A nuvem atual não foi homologada para dados confidenciais da CNOOC.

| Ação | Processamento/destino |
|---|---|
| Abrir arquivo local | Bytes/metadados/arrays/hash no navegador/Web Worker. Sem upload automático. |
| Login/cadastro/recuperação | API STRATA → Supabase Auth configurado pelo operador. Cookies HttpOnly, SameSite=Lax, Secure sob HTTPS. |
| Habilitar histórico/sincronização | Hash/nome/ID e consultas de análises → API/D1. Inicialmente desligado. |
| Salvar análise | Pontos, valores, observações e identificadores → D1 por ação explícita; também podem ser confidenciais. |
| Exportar | Downloads locais; registro na API apenas com sincronização habilitada. |
| Publicar | Upload multipart → R2; metadados → D1, com autorização e revisão. Bucket não deve ser público diretamente. |
| Motor Python | Arquivos/saídas locais autorizados. Sem rede no módulo. |
| Instalação/build | Registros de pacotes, CDN oficial SheetJS e infraestrutura. Não recebem DLIS no fluxo implementado. Cloudflare pode consultar serviços auxiliares; `CLOUDFLARE_CF_FETCH_ENABLED=false` limita isso localmente. |

Autorização preservada por usuário, proprietário e papéis user/publisher/admin. Privados exigem propriedade ou administrador; aprovados não privados seguem política pública existente. Testes locais cobrem CSRF, cookies, sessão, papéis, acesso cruzado e fronteiras de upload.

**Empresa de catálogo não é tenant de segurança.** Não há membresia corporativa nem administrador por empresa. Antes de hospedar dados confidenciais de empresas distintas, implementar tenant em todas as consultas/objetos e testes, ou usar instâncias segregadas. Não se declara isolamento corporativo completo. Supabase/SMTP, IAM, domínio, backup e publicação remota reais exigem homologação.

Exemplos de ambiente usam placeholders; ZIP exclui segredos, dados e caches. O histórico Git não foi reescrito: revisar/rotacionar valores anteriormente versionados que não deveriam ser públicos. Logs de metadados do cliente foram removidos; erros inesperados da API não serializam exceções. Operadores controlam logs de infraestrutura.

Licença MIT do parser e avisos existentes preservados. Dependências mantêm suas licenças distribuídas; SheetJS CE 0.20.3 é obtido do CDN oficial com integridade no lockfile. Verificar obrigações antes de redistribuir binários Python/JavaScript.

Atualizados Next/eslint-config-next 16.4.1, React/RSC 19.2.8, Vite 8.1.6, SheetJS 0.20.3, Zod 4.6.6 e transitivas. Audit de produção: zero alertas. Audit geral: **três alertas** (Zod transitivo do ESLint, alto; esbuild antigo do drizzle-kit, moderado; Satori via Vinext/geração SVG, moderado). Não se forçou migração incompatível para silenciá-los. Não expor servidores de desenvolvimento nem usar geração SVG com entrada não confiável até atualizar esse caminho. DevDependencies podem participar do runtime via build; não são automaticamente irrelevantes.

## Institucional / MCP futuro

Para execução integral interna, adaptar banco/identidade/armazenamento em `lib/server/db.ts`, `provider.ts`, `session.ts` e bindings, preservando autorização, hashes e titularidade. A aplicação atual completa ainda usa D1/R2/Supabase; não é integralmente offline.

Nenhum servidor MCP foi implementado. Futuras funções `catalog.list/describe` e `analysis.list/describe` devem consultar resultados já processados com identidade do usuário, escopo de empresa/projeto, limites e auditoria. Modelo não ganha privilégios de administrador, shell/SQL livre ou acesso automático ao acervo.

DLIS, tokens e resultados confidenciais não saem do ambiente por padrão. Claude externo exigiria decisão institucional explícita sobre dados/contrato/retenção e exportação por tarefa. Modelo local pode usar os mesmos contratos autorizados com egresso bloqueado. Não se exige contratação/chave de IA para esta entrega.
