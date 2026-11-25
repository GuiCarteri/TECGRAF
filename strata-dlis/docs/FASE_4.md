# Fase 4 · Perfis de poço

## Abrir o visualizador

Na raiz do repositório, execute `npm run dev`. Faça login, abra **Visualizador** (`/viewer`), escolha um DLIS e clique em **Perfil composto**. Para reproduzir a comparação da captura, execute o comando abaixo em um segundo terminal, também na raiz.

```sh
npm --prefix strata-dlis run sample:profiles
```

O comando gera `Aurora-synthetic.dlis` e `Boreal-synthetic.dlis` em `strata-dlis/test-results/phase4-samples/`. No Codespaces, baixe os exemplos pelo explorador de arquivos para poder selecioná-los no navegador. Abra Aurora primeiro e escolha Boreal em **Comparar poços**. Os dois arquivos contêm medições fictícias, um intervalo sem amostras e curvas de densidade e porosidade neutrônica.

## Ler o perfil

- Cada coluna de poço mostra os canais selecionados, suas unidades e escalas. A profundidade aumenta para baixo. Em telas estreitas, deslize horizontalmente dentro da coluna para ver as outras trilhas. Em **Escalas e paleta**, escolha escala linear ou logarítmica para cada curva escalar e ative as cores para daltonismo. Os sinais científicos matriciais preservam o mapa de amplitude ou impedância da trilha.
- O cursor acompanha a mesma profundidade nas duas colunas. Use as setas para mover o cursor com foco no gráfico, ou digite um valor em **Consultar profundidade (m)**. O STRATA consulta a amostra original. Valores inválidos e lacunas de aquisição aparecem como interrupções.
- Use zoom, arraste verticalmente ou navegue pelo minimapa. Com a régua ativa, marque duas profundidades com o ponteiro ou com Enter. O modo apresentação percorre o intervalo com o zoom atual. A comparação sincroniza o valor de profundidade expresso em metros. Verifique o tipo de índice e a referência de cada poço antes de atribuir significado geológico ao alinhamento.
- Em **Formações e litologia**, informe o topo e, para sombrear um intervalo, a base e a litologia interpretada. As marcações pertencem à coluna principal e à sessão atual.
- O crossover sobrepõe um par compatível de densidade e porosidade neutrônica do mesmo frame. A escala de referência desta visualização usa 1,95–2,95 g/cm³ e 0,45 a −0,15 v/v. Os cabeçalhos das trilhas de origem conservam as unidades declaradas. O preenchimento mostra a posição relativa das curvas nessa escala. Matriz, calibração e demais perfis são necessários para interpretar o intervalo.
- PNG e SVG incluem as colunas no intervalo de profundidade escolhido. O SVG mantém curvas escalares e texto vetoriais e incorpora os mapas de imagem. O PDF gera uma página por poço.

[Comparação dos dois poços sintéticos no tema escuro](evidence/phase4-compare.jpg) · [Trilhas petrofísicas e crossover no tema claro](evidence/phase4-curves.jpg)

## Conferência com dados reais

Nove arquivos locais continham cinco DLIS distintos por SHA-256. O comparador independente usou o dlisio 1.0.4 e conferiu os canais numéricos acessíveis, unidades, dimensões, índice e valores, inclusive matrizes. A comparação de valores usa a representação numérica normalizada e SHA-256. O teste de navegador também escolheu quatro pontos de referência por arquivo e confrontou a leitura apresentada pelo cursor com a biblioteca independente.

| Verificação | Resultado observado |
| --- | --- |
| Cinco arquivos distintos, de 17,0 a 98,4 MB | 18 frames, 1.395 ocorrências de canais numéricos e 120.193 linhas de frame |
| Valores numéricos comparados | 124.136.933 coincidiram |
| Leituras exibidas pelo cursor | 20 de 20 coincidiram em valor exibido e unidade |
| Unidades em campo | GR em gAPI, amplitude de cimentação em mV, AIBK em Mrayl e profundidade declarada em décimos de polegada, convertida para metros no eixo |
| Limitações dos dados | Dois arquivos sinalizaram metadados criptografados. Há canais VDL com unidade de amplitude em branco. O par densidade–neutrão usado para validar o crossover é sintético. |

## Reproduzir os testes

Na pasta `strata-dlis`, com as dependências instaladas, rode `npm test` e `npm run test:phase4`. O segundo comando inicia a aplicação de teste, abre Chromium, analisa dois DLIS sintéticos, exercita os controles com teclado e ponteiro e baixa os três formatos. Para usar um Chrome já instalado, defina `PLAYWRIGHT_EXECUTABLE_PATH` com o caminho do executável. Para usar o Chromium do Playwright, instale o navegador com `./node_modules/.bin/playwright install chromium`.

| Teste local | Resultado |
| --- | --- |
| Unitários do projeto | 61 aprovados |
| Perfil no Chromium | 11 trilhas do primeiro poço, comparação sincronizada, régua, litologia, apresentação e exportações |
| Arquivos exportados no teste | PNG de 9.588 × 2.316 px, SVG válido com curvas e imagens, PDF 1.4 com duas páginas |
| Uma curva escalar sintética de 2 milhões de pontos | 902 ms para criar trilha, preparar os níveis de detalhe e desenhar pela primeira vez. Em 50 redesenhos, mediana de 0,3 ms e percentil 95 de 0,5 ms. Os tempos medem a chamada de desenho em Chromium local e excluem abertura do DLIS e composição da tela. |

Para conferir dados sob sua guarda, instale `dlisio==1.0.4` e `numpy` em um ambiente Python e execute na pasta `strata-dlis`, substituindo os caminhos pelos locais autorizados.

```sh
/caminho/venv/bin/python scripts/verify-reference.py /caminho/dlis
DLIS_TEST_DIR=/caminho/dlis DLIS_REFERENCE_PYTHON=/caminho/venv/bin/python npm run test:browser:real
```

As capturas e os arquivos de demonstração usam poços fictícios. O maior DLIS real disponível nesta conferência tinha 98.426.012 bytes. O teste de arquivo de pelo menos 500 MB permanece no roteiro de QA.
