# Motor científico local opcional

Adaptação parcial de `sws_impedance_tool.py`, sem Tkinter, servidor HTTP ou IA. Não modifica o DLIS nem envia dados pela rede.

A partir de `strata-dlis/`:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r science/requirements.txt
.venv/bin/python -m unittest discover -s science -p test_science.py
cd science
../.venv/bin/python -m strata_science /caminho/autorizado/arquivo.dlis
../.venv/bin/python -m strata_science /caminho/autorizado/arquivo.dlis --channel AIBK --logical-file 0 --output /caminho/autorizado/aibk.npz
```

Adicione `--frame NOME` quando necessário. Seleção ambígua e saída existente são recusadas. NPZ conserva `values`, `depth_m`, `raw_depth` e `metadata`; sentinelas originais permanecem em `values`. No Windows, use `.venv\Scripts\python.exe`.

| Módulo | Escopo |
|---|---|
| `reader.py` | Leitura `dlisio`, seleção exata e índice declarado; `load_aibk` exige matriz MRayl; CBL/VDL preservam seus frames. |
| `metrics.py` | Máscara derivada, comparação pareada (viés, MAE, RMSE e correlação), sem clipping; grade por vizinho próximo com lacunas preservadas. |
| `vdl_measures` | RMS em janelas explicitamente fornecidas sobre eixo temporal verificado. Não separa ondas nem diagnostica cimentação. |
| `classification.py` | Limiares SWS 2,6 / 3,5 / 4,5 / 5,5 MRayl, separados do leitor e marcados como provisórios. |
| CLI | Inspeção JSON local ou extração NPZ explícita. |

A CLI pode exibir metadados sensíveis: use terminal e diretório autorizados. Confirme alinhamento físico e unidades antes de comparar matrizes; formatos iguais não comprovam correspondência.

Não foram portados: Tkinter, reconstrução numérica de screenshots/cores, `run_pipeline` de imagens, `run_cbl_vdl` e `classify_section` de barreiras/isolações. Exigem calibração e validação especializada. Não se declara reprodução integral ou validação científica do SWS. O site preserva exportação JSON/CSV de pontos; matrizes locais usam NPZ.
