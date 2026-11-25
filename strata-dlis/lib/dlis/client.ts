import DlisWorker from "../../workers/dlis.worker.ts?worker";
import type { DecodedFrame, DlisMetadata, InspectedDlis } from "./types";

type WorkerReply = DlisMetadata | DecodedFrame;

export class DlisClient {
  private worker: Worker;
  private seq = 0;
  private pending = new Map<
    number,
    { resolve: (value: WorkerReply) => void; reject: (error: Error) => void }
  >();

  constructor(onProgress?: (phase: string, percent?: number) => void) {
    this.worker = new DlisWorker();
    this.worker.onmessage = ({ data }) => {
      if (data.progress) {
        onProgress?.(data.progress, data.percent);
        return;
      }
      const request = this.pending.get(data.id);
      if (!request) return;
      this.pending.delete(data.id);
      if (data.error) request.reject(new Error(data.error));
      else request.resolve(data.result);
    };
    this.worker.onerror = () =>
      this.rejectPending(
        "A leitura foi interrompida. Tente um arquivo menor ou outro navegador.",
      );
  }

  private rejectPending(message: string) {
    for (const request of this.pending.values())
      request.reject(new Error(message));
    this.pending.clear();
  }

  private request(
    type: "inspect",
    data: { file: File },
  ): Promise<InspectedDlis>;
  private request(
    type: "parse",
    data: { buffer: ArrayBuffer },
    transfer: Transferable[],
  ): Promise<DlisMetadata>;
  private request(
    type: "decode",
    data: { logicalFileIndex: number; frameKey: string; channels?: string[] },
  ): Promise<DecodedFrame>;
  private request(
    type: string,
    data: object,
    transfer: Transferable[] = [],
  ): Promise<WorkerReply> {
    return new Promise((resolve, reject) => {
      const id = ++this.seq;
      this.pending.set(id, { resolve, reject });
      try {
        this.worker.postMessage({ id, type, ...data }, transfer);
      } catch (error) {
        this.pending.delete(id);
        reject(error);
      }
    });
  }

  inspect(file: File) {
    return this.request("inspect", { file });
  }

  async parse(file: File) {
    const buffer = await file.arrayBuffer();
    return this.request("parse", { buffer }, [buffer]);
  }

  decode(logicalFileIndex: number, frameKey: string, channels?: string[]) {
    return this.request("decode", { logicalFileIndex, frameKey, channels });
  }

  destroy() {
    this.worker.terminate();
    this.rejectPending("Arquivo fechado.");
  }
}
