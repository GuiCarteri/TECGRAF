# Gráficos e marcações — 06/11/2026

## Tabela de cores recuperada

Referência: briefing `dlis-estrutura.html` de setembro de 2026, recuperado na conversa. A paleta SWS/YlOrBr não substitui esta tabela.

| Valor USIT/AIBK (MRayl) | Cor |
|---|---|
| 0 ≤ Z < 0,3 | Vermelho puro #FF0000 |
| 0,3 ≤ Z < 2,6 | Ciano puro #00FFFF |
| 2,6 ≤ Z < 10 | Amarelo-claro #FFFFCC → preto |
| Z ≥ 10 | Preto #000000 |
| −2000 | Verde #008000, sem leitura |
| Outros negativos, não finitos ou ausência de amostra | Cinza #808080 |

As cores básicas já existiam. Esta alteração fixa a faixa física USIT em 0–10, remove a grade sobreposta que alterava visualmente os pixels e pinta as lacunas em cinza. VDL continua em escala de cinza; AGC é opcional. CBL depende de calibração por poço para classificação. As cores não constituem diagnóstico automático.

## Marcação no STRATA

1. Abra um arquivo e selecione os canais e o eixo de profundidade.
2. Abaixo de cada gráfico, escolha **Marcar intervalo** ou **Marcar região**.
3. Selecione a classe manual e arraste sobre o gráfico. A borda roxa é uma camada de anotação, não uma nova cor da impedância.
4. Confira os valores em **Limites da marcação** e clique em **Adicionar marcação**. Também é possível preencher os limites sem usar o mouse.
5. Edite a classe e a observação na lista. Use **Remover** ou **Desfazer** quando necessário.
6. **Salvar análise** preserva as regiões na conta, usando a mesma autorização dos pontos. **Exportar marcações JSON** salva localmente, sem envio externo.
7. Ao importar JSON, o SHA-256 precisa corresponder ao DLIS aberto. IDs já existentes são preservados; regiões de outro canal aparecem quando o canal original estiver selecionado.

As regiões preservam hash, logical file/frame/channel, canal de profundidade, limites em metros, componentes inclusivos, classe e observação. Coordenadas de tela são convertidas para esses limites; não se recuperam valores por leitura de cores. Dados brutos permanecem inalterados. Limite: 1.000 regiões por análise. O JSON utiliza `strata-regions-v1` e não é diretamente o formato do Label Studio.

## O que foi aprendido com Label Studio

A documentação oficial descreve marcação de séries preparadas (CSV/JSON) e regiões em imagens, não um leitor DLIS nativo. O fluxo adaptado é selecionar uma ferramenta, delimitar região, atribuir classe, revisar e preservar coordenadas junto à fonte. Não foi instalado servidor Label Studio nem conectada IA; não há envio automático de DLIS.

- Importação: https://labelstud.io/guide/tasks.html
- Séries: https://labelstud.io/templates/time_series.html
- Retângulos: https://labelstud.io/tags/rectanglelabels.html

Ainda não implementados: pincel/polígonos, exportação/importação direta do formato Label Studio e redimensionamento de regiões já confirmadas pelo mouse. Para mudar limites, remova e recrie a região pelos campos numéricos.

## Validação desta entrega

Instalação congelada, TypeScript, build, 25 testes Node e integração local passaram. Os quatro testes novos cobrem limites de cores, arraste invertido, geometria após zoom e rejeição de marcações inválidas. Integração verifica gravação/leitura de regiões e rejeição de hash divergente, além de autorização por conta. Provedor de identidade simulado no teste.

Lint geral continua com 119 erros e 19 avisos herdados da base recuperada; os novos módulos de regiões não apresentaram erros de lint. A refatoração ampla citada em uma sessão anterior não foi salva antes da manutenção do ambiente e não integra esta entrega.

A interface desta revisão ainda não foi homologada no navegador. A prévia gerenciada falhou ao iniciar; não foi usado outro caminho de navegador. Também não houve nova comparação com DLIS reais, execução Python, homologação Supabase/SMTP ou deploy. Resultados anteriores em VALIDACAO.md e capturas no ZIP são históricos.
