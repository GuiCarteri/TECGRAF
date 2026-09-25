import { DLISFile } from "../lib/vendor/dlis-parser/index.js";
import { validateHeader, extractMetadata, sha256 } from "../lib/dlis/core.js";
let dlis: any = null;
self.onmessage = async ({ data }) => {
  const { id, type, buffer, logicalFileIndex, frameKey } = data;
  try {
    if (type === "parse") {
      validateHeader(buffer);
      const hash = await sha256(buffer);
      dlis = DLISFile.fromBuffer(buffer);
      if (!dlis.logicalFiles.some((lf: any) => lf.frames.size))
        throw new Error(
          "Nenhum frame com metadados reconhecidos. O arquivo pode usar uma extensão não suportada.",
        );
      (self as any).postMessage({
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
      const result = frame.decode();
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
      console.info("[STRATA] Frame validado", frame.key, result.channels);
      (self as any).postMessage({ id, result }, [
        ...Object.values(result.data).map((a: any) => a.buffer),
        result.frameNumbers.buffer,
      ]);
    }
  } catch (e: any) {
    (self as any).postMessage({
      id,
      error: e.message || "Falha na leitura do DLIS.",
    });
  }
};
