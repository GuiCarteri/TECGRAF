# Diagnóstico e alterações

O catálogo usa metadados EFLR; o plot depende também de referências, dimensões, FDATA e profundidade. Corrigidos OBNAME (cópia USHORT de um byte), ASCII/UVARI, FSHORT, FDOUB1/2, ATTREF e atributos ausentes. Dimensões foram alinhadas à ordem dos arrays de referência. Limites de leitura, continuação/comprimentos e truncamento são verificados.

O primeiro canal de frames indexados em profundidade agora prevalece sobre TDEP/DEPTH auxiliares. Metadados opacos criptografados são ignorados com aviso; cabeçalho/FDATA criptografados continuam bloqueados. Não há descriptografia. Cada track mostra seus erros e deixa de exibir dados antigos ao trocar canais.

Implementados: CBL/GR com escala ajustável, VDL com intensidade/AGC opcional e waveform original, AIBK/USIT em MRayl, zoom/arraste/teclado, pontos brutos, PNG do intervalo, decodificação seletiva, cache limitado, progresso/cancelamento e proteção contra respostas atrasadas. Layout navy/teal, foco e responsividade melhorados; quatro idiomas, autenticação, catálogo, publicação e exportações preservados. Sincronização automática local começa desligada.

Motor Python local separado para leitura dlisio, métricas, grade derivada e classificação provisória. Dependências corrigidas, devcontainer, README e testes incluídos. Arquitetura React/TypeScript + Vinext/Vite + Workers/D1/R2 + Supabase preservada. Nenhuma integração de IA ou deploy.

## Limites

Não há eixos tempo/azimute inferidos, projeção angular calibrada, seleção de fatias de tensores ou comparação visual lado a lado. Associação explícita de canais compatíveis permite ler coordenadas no painel. Tensores com múltiplos eixos não unitários são recusados no plot 2D. Comparação numérica está nas funções Python e requer alinhamento físico confirmado.

Não foi transportado o pipeline integral Tkinter/imagens/barreiras do SWS. Os limiares são provisórios e requerem especialista. Seletores são nativos, sem nova biblioteca de virtualização. Limite preventivo de 512 MiB não garante suporte universal/hardware de campo.

Veja [inventário](ARQUIVOS_ALTERADOS.md), [validação](VALIDACAO.md), [segurança](SEGURANCA.md) e `science/README.md`.

Referências: [RP66 representações](https://energistics.org/sites/default/files/RP66/V1/rp66v1_appb.html), [RP66 registros](https://energistics.org/sites/default/files/RP66/V1/rp66v1_sec2.html), [dlisio](https://dlisio.readthedocs.io/en/stable/dlis/api.html). Script SWS fornecido tratado como referência parcial, não como leitor universal ou diagnóstico validado.
