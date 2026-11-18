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
