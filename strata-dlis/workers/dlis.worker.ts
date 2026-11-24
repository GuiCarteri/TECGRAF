import { DLISFile } from "../lib/vendor/dlis-parser/index.js";
import { validateHeader, extractMetadata, sha256 } from "../lib/dlis/core.js";
import type { DecodedFrame } from "../lib/dlis/types";
let dlis: DLISFile | null = null;
self.onmessage = async ({ data }) => {
  const { id, type, buffer, logicalFileIndex, frameKey, channels } = data;
  try {
    if (type === "parse") {
      dlis = null;
      self.postMessage({
        id,
        progress: "Verificando integridade do arquivo…",
      });
      validateHeader(buffer);
      const hash = await sha256(buffer);
      self.postMessage({
        id,
        progress: "Lendo estrutura e metadados do DLIS…",
      });
      dlis = DLISFile.fromBuffer(buffer);
      if (
        !dlis.logicalFiles.some(
          (lf: { frames: Map<string, unknown> }) => lf.frames.size,
        )
      )
        throw new Error(
          "Nenhum frame com metadados reconhecidos. O arquivo pode usar uma extensão não suportada.",
        );
      self.postMessage({
        id,
        result: { ...extractMetadata(dlis), hash },
      });
    } else if (type === "decode") {
      const lf = dlis?.logicalFiles[logicalFileIndex],
        frame = lf?.frames.get(frameKey);
      if (!frame) throw new Error("Frame não encontrado.");
      if (frame.channels.length !== frame.channelNames.length)
        throw new Error(
          "Frame contém canais sem metadados completos. Decodificação bloqueada.",
        );
      self.postMessage({
        id,
        progress: "Decodificando canais selecionados…",
      });
      const result: DecodedFrame | null = frame.decode({ channels });
      if (!result?.frameCount)
        throw new Error(
          "Frame não pôde ser decodificado ou não contém amostras.",
        );
      for (const c of result.channels) {
        const stride = result.strides[c.name];
        if (
          !stride ||
          result.data[c.name].length !== result.frameCount * stride
        )
          throw new Error("Channel possui dimensão incompatível.");
      }

      self.postMessage(
        { id, result },
        {
          transfer: [
            ...Object.values(result.data).map((array) => array.buffer),
            result.frameNumbers.buffer,
          ],
        },
      );
    }
  } catch (e) {
    self.postMessage({
      id,
      error: e instanceof Error ? e.message : "Falha na leitura do DLIS.",
    });
  }
};
