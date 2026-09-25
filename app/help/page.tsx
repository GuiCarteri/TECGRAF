import { Shell } from "@/components/strata/shell";
export default function Help() {
  return (
    <Shell active="help">
      <div className="standard-page prose">
        <div className="eyebrow">GUIA TÉCNICO</div>
        <h1>Do arquivo à amostra.</h1>
        <h2>Uma biblioteca com origem identificada</h2>
        <p>
          A biblioteca reúne arquivos aprovados por um administrador. Empresa
          registrada no DLIS, prestador de serviço e coleção são informações
          diferentes. O publicador confirma a organização; divergências precisam
          de revisão. Um envio não autoriza a divulgação de outros arquivos.
        </p>
        <h2>Leitura rastreável</h2>
        <p>
          O visualizador decodifica frames em arrays numéricos. Cada ponto
          registra SHA-256 do arquivo, logical file, chave do frame e canal,
          sample index e component index (base zero). O hover e a exportação
          acessam esses arrays. A imagem nunca é usada para recuperar números.
        </p>
        <h2>Tracks e profundidade</h2>
        <p>
          A profundidade cresce para baixo. A unidade original é preservada no
          ponto, com conversão explícita para metros no eixo. Cada track pode
          ter um frame e canal de profundidade próprios. Nenhuma amostra é
          criada entre frames ou para cobrir lacunas. Se a seleção automática
          for ambígua, escolha o canal em “Configurar tracks”.
        </p>
        <h2>CBL e classificação</h2>
        <p>
          A curva CBL é vermelha (#FF0000). Referência de free pipe e limiares
          devem ser adequados à ferramenta e ao arquivo. Sem parâmetros
          explícitos, o sistema não classifica automaticamente. É possível
          informar uma referência manual e os limites da razão
          amplitude/referência. As classificações manuais ficam separadas das
          automáticas.
        </p>
        <h2>VDL e ganho local</h2>
        <p>
          Waveforms usam escala de cinza. O AGC normaliza cada linha apenas para
          visualização; o valor bruto não muda. O tempo em microssegundos só é
          mostrado quando houver um canal temporal associado, com dimensão
          compatível e correspondência confirmada. Sem isso, o eixo mostra o
          índice do componente.
        </p>
        <h2>USIT e paleta do projeto</h2>
        <ul>
          <li>0 ≤ Z &lt; 0,3 MRayl: gás, vermelho puro #FF0000.</li>
          <li>0,3 ≤ Z &lt; 2,6 MRayl: líquido, ciano puro #00FFFF.</li>
          <li>
            2,6 ≤ Z &lt; 10 MRayl: cimento, amarelo claro #FFFFCC até preto.
          </li>
          <li>Z ≥ 10 MRayl: preto #000000.</li>
          <li>
            −2000: sem leitura, verde #008000. Outros negativos: cinza #808080.
          </li>
        </ul>
        <p>
          Essas zonas de impedância não constituem, sozinhas, uma avaliação
          universal da qualidade da cimentação. Azimutes não são distribuídos
          artificialmente em 360°. Micro-debonding exige um flag explicitamente
          identificado; uma imagem com esse nome não é, por si só, um flag
          SIM/NÃO.
        </p>
        <h2>Compatibilidade e limites</h2>
        <p>
          A leitura é feita no navegador com uma adaptação conservadora do
          parser RP66 V1. Registros criptografados, representações não numéricas
          e metadados incompletos podem impedir um frame de ser desenhado. A
          interface apresenta o motivo. Não há promessa de compatibilidade com
          todos os arquivos ou extensões proprietárias. Arquivos grandes
          dependem da memória disponível no navegador.
        </p>
        <h2>Pontos e exportações</h2>
        <p>
          Salve a análise na sua conta para recuperar os pontos ao reabrir o
          mesmo SHA-256. CSV e JSON mantêm a representação numérica JavaScript
          dos dados decodificados. O formato Excel tem limite de 15 dígitos
          significativos em células numéricas; prefira JSON para auditoria de
          precisão. Células vazias representam dados indisponíveis.
        </p>
      </div>
    </Shell>
  );
}
