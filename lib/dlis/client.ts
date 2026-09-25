export class DlisClient {
  worker: Worker;
  seq = 0;
  pending = new Map<
    number,
    { resolve: (d: any) => void; reject: (e: Error) => void }
  >();
  constructor() {
    this.worker = new Worker(
      new URL("../../workers/dlis.worker.ts", import.meta.url),
      { type: "module" },
    );
    this.worker.onmessage = ({ data }) => {
      const p = this.pending.get(data.id);
      if (!p) return;
      this.pending.delete(data.id);
      data.error ? p.reject(new Error(data.error)) : p.resolve(data.result);
    };
    this.worker.onerror = () => {
      for (const p of this.pending.values())
        p.reject(
          new Error(
            "A leitura foi interrompida. Tente um arquivo menor ou outro navegador.",
          ),
        );
      this.pending.clear();
    };
  }
  request(type: string, data: any = {}, transfer: Transferable[] = []) {
    return new Promise<any>((resolve, reject) => {
      const id = ++this.seq;
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage({ id, type, ...data }, transfer);
    });
  }
  async parse(file: File) {
    const buffer = await file.arrayBuffer();
    return this.request("parse", { buffer }, [buffer]);
  }
  decode(logicalFileIndex: number, frameKey: string) {
    return this.request("decode", { logicalFileIndex, frameKey });
  }
  destroy() {
    this.worker.terminate();
    for (const p of this.pending.values())
      p.reject(new Error("Arquivo fechado."));
    this.pending.clear();
  }
}
