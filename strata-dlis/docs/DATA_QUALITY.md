# Qualidade da curva selecionada

No visualizador, abra **Metadados e auditoria** após carregar uma curva. O cálculo local usa o frame decodificado e as amostras originais, inclusive em publicações abertas com permissão. Cada fração é apresentada com seu numerador e denominador. Um denominador vazio gera “Não disponível”.

| Indicador | Cálculo |
| --- | --- |
| Completude | Células finitas que passam pela regra de sentinelas do leitor / células esperadas (linhas × componentes). |
| Cobertura | Metros cobertos / extensão entre as profundidades observadas extremas. Um segmento precisa ter alguma leitura nas duas extremidades e distância até 1,5 vezes o passo típico estimado pelo índice de profundidade do visualizador. Profundidades repetidas contam uma vez. O resultado descreve o intervalo observado; a extensão planejada do poço pode ser diferente. |
| Consistência | Pares adjacentes na direção predominante / todos os pares na ordem de aquisição. Repetições, inversões e profundidades ausentes reduzem o resultado. |
| Unidades | Dois controles: unidade de profundidade conversível e unidade da curva compatível com o track (CBL em mV, USIT em MRayl, GR em API). Para VDL, verifica-se apenas se a unidade foi declarada. |
| Plausibilidade | Amplitudes CBL ou impedâncias USIT não negativas / células válidas com unidade compatível. VDL e GR ficam sem avaliação física por esta regra. Nenhum limite superior de ferramenta é presumido. |
| Rastreabilidade | Controles presentes / cinco: SHA-256, índice do logical file, chave do frame, chave do canal com nome inequívoco no frame e numeração das linhas. |

As métricas são por curva carregada. A plausibilidade avalia uma propriedade do sinal. A classificação do cimento exige interpretação própria.

## IPD v1 por modalidade

Em **Metadados e auditoria**, os dois índices medem a prontidão das curvas selecionadas para inspeção no intervalo observado, de 0 a 100. A regra operacional v1 é conservadora e ainda requer validação com dados de campo. Uma pontuação alta não atesta a qualidade da cimentação.

- **USIT:** 100 vezes a menor fração entre os seis critérios de qualidade da curva de impedância.
- **CBL/VDL:** menor valor entre a prontidão de cada curva e o percentual de metros com cobertura simultânea, relativo à extensão entre os extremos das duas curvas. Para VDL, entram cinco critérios: a forma de onda admite valores negativos e a regra de amplitude não se aplica.
- Curva necessária ausente ou profundidade sem intervalo mensurável produz “Não disponível”. Para o par, exigem-se o mesmo logical file e o mesmo nome de canal de profundidade. Os eixos são convertidos em metros pelo leitor. Essa comparação pressupõe a mesma referência de profundidade.
- Curvas comparáveis sem sobreposição recebem zero. Em CBL e USIT, a ausência total de leituras válidas em um intervalo mensurável também resulta em zero. Os limites e as lacunas são os mesmos da cobertura individual.
