# Validação e limitações

Testes executados em 29–30/10/2026, incluindo a versão de código preservada no GitHub em `f7807b3b10adc55b926175b0587ef19e2f9b3d95`. Linux, Node 24.22.1, pnpm 11.25.0, Python 3.12, dlisio 1.0.4. Motor Python validado com NumPy 2.5.4. Nenhum deploy.

| Verificação | Resultado e alcance |
|---|---|
| Instalação congelada, TypeScript e build | Passaram. Avisos upstream Vinext de import dinâmico ineficaz/tamanho de chunks permanecem. |
| Node | 21 testes passaram: primitivas RP66, bounds, criptografia/truncamento, decode seletivo, índice de profundidade, unidades/escalas, arrays brutos, lacunas, exportações, quatro idiomas e controles existentes. |
| Python | 5 testes passaram: leitura real de fixture RP66 codificada, unidades, lacunas, métricas, tempo explícito e classificação provisória. |
| SQLite/migração | Passaram: unicidade, isolamento por usuário e preservação de identidades/pontos com fixtures. |
| Integração Worker/D1/R2 | Passou: login/cadastro/OTP/recuperação, refresh/expiração/logout, cookies, CSRF, headers falsos, papéis, acesso cruzado e limites multipart. Provider simulado apenas no teste (39 requests). |
| SSR | Quatro idiomas no HTML inicial; login público e redirecionamento protegido passaram. |
| Navegador | Estado preservado entre idiomas; quatro canvases com pixels desenhados a partir de DLIS codificado pelo parser real, zoom, waveform, PNG/CSV, privacidade padrão, tablet 1024/768 px. |
| Arquivos fornecidos | Nove anexos deduplicados por SHA-256 resultaram em cinco arquivos distintos, aproximadamente 17–98 MB. Quatro gráficos abriram em cada um; zoom/fechamento passaram. |
| Precisão | **124.136.933 valores numéricos suportados coincidiram integralmente com dlisio**, incluindo contagens, unidades, identidades e dimensões. |
| Lint | **Falhou: 119 erros e 19 avisos.** Base: 118 erros/19 avisos. Principalmente any, efeitos React e links HTML. Regras não foram desativadas. |
| Audit produção | Zero alertas conhecidos na execução. |
| Audit geral | **Três alertas**, um alto e dois moderados, descritos abaixo. |

A comparação independente converte todos os arrays para Float64 little-endian e NaNs canônicos, compara digests SHA-256 e metadados estruturais. Não é amostragem de poucos pontos nem inspeção visual. Conversões físicas são verificadas separadamente em testes unitários. O teste de integridade de código ficou limitado ao exportador/avisos legais realmente inalterados; o parser foi intencionalmente corrigido, e a base já continha expectativa antiga divergente para points.ts.

Os resultados agregados em `evidence/numeric-reference.json` registram a rodada numérica inicial; `evidence/browser-real.json` registra a rodada dos cinco arquivos, sem nomes de poços/amostras. Rodadas posteriores confirmaram os mesmos valores. Pico RSS Node variou aproximadamente 201–752 MB, incluindo decode completo e digests; não equivale ao heap do navegador. A interface decodifica canais selecionados e usa cache limitado. Tempos observados de abertura/plot ficaram na ordem de 0,9–2,2 s neste host, sem garantia de SLA ou hardware de campo. Não houve teste contínuo de memória/horas de uso.

Nos dois primeiros casos, metadados opacos criptografados foram ignorados com aviso. Os dados acessíveis coincidiram com dlisio; não houve descriptografia.

## Pendências de dependências

- Alto: Zod 3.25.76 transitivo do ESLint/react-hooks, GHSA-mrhx-c7xc-m3w5. A dependência direta foi corrigida.
- Moderado: esbuild 0.18.20 transitivo do drizzle-kit/esm-loader, GHSA-67mh-4wv8-2f99. Não expor servidor de desenvolvimento.
- Moderado: Satori 0.16.0 via Vinext/@vercel/og, GHSA-wx4j-mvgx-mqwp. Não há rota SVG/OG com entrada de usuário no site; esse caminho não foi homologado e exige atualização antes de uso.

Não foram forçadas migrações incompatíveis para silenciar a auditoria. DevDependencies podem ser empacotadas no runtime, especialmente via Vinext. Consulte SEGURANCA.md.

## Não verificado ou não implementado integralmente

Supabase/SMTP e entrega real de e-mail, IAM/DNS/TLS, publicação R2 de produção, backups e Codespaces/devcontainer reais dependem de homologação. Não foi modificado Codespace existente. Catálogo por empresa não é isolamento de tenant institucional.

Limiares SWS/CBL e classificação de cimentação permanecem provisórios. Não há certificação universal RP66, eixos físicos inventados, projeção angular calibrada, fatias de tensores, comparação visual lado a lado ou pipeline integral Tkinter/imagem/barreiras. Veja ATUALIZACAO.md e science/README.md.

Navegador testado com Playwright 1.56.1/Chromium headless 141 como alternativa à distribuição indisponível da versão fixada. Firefox/WebKit e leitor de tela não foram testados; chinês depende de fontes locais para todos os glifos. O limite preventivo de 512 MiB não garante suporte a qualquer arquivo/dispositivo.

Comandos exatos no README. A reprodução da comparação real requer arquivos em diretório autorizado, deliberadamente excluídos do ZIP. Evidências visuais são sintéticas e não mostram os arquivos fornecidos.
