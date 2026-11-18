/** A read model over the existing metadata; never copies or transforms samples. */
export interface Curve {
  id: string;
  frameId: string;
  channelIndex: number;
  key: string | null;
  name: string | null;
  units: string | null;
  kind: string | null;
  dimension: number[] | null;
  metadata: Record<string, unknown>;
}
export interface Frame {
  id: string;
  logicalFileId: string;
  frameIndex: number;
  key: string | null;
  name: string | null;
  indexType: string | null;
  metadata: Record<string, unknown>;
  curves: Curve[];
}
export interface LogicalFile {
  id: string;
  logicalFileIndex: number;
  declaredIndex: number | null;
  name: string | null;
  origin: unknown;
  parameters: unknown;
  frames: Frame[];
}
const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
const text = (value: unknown) => (typeof value === "string" ? value : null);
export function fileModel(hash: string, source: unknown) {
  const issues: string[] = [];
  let parsed: unknown = source;
  if (typeof source === "string") {
    try {
      parsed = JSON.parse(source);
    } catch {
      parsed = null;
    }
  }
  const metadata = record(parsed);
  const logicalFiles: LogicalFile[] = [];
  if (!metadata || !Array.isArray(metadata.logicalFiles)) {
    return {
      schemaVersion: 1,
      sourceHash: hash,
      logicalFiles,
      issues: ["INVALID_METADATA"],
    };
  }
  metadata.logicalFiles.forEach((value, logicalFileIndex) => {
    const lf = record(value);
    if (!lf) {
      issues.push(`INVALID_LOGICAL_FILE:${logicalFileIndex}`);
      return;
    }
    const id = JSON.stringify([hash, logicalFileIndex]);
    const logical: LogicalFile = {
      id,
      logicalFileIndex,
      declaredIndex: typeof lf.index === "number" ? lf.index : null,
      name: text(lf.id),
      origin: lf.origin ?? null,
      parameters: lf.parameters ?? null,
      frames: [],
    };
    logicalFiles.push(logical);
    if (!Array.isArray(lf.frames)) {
      issues.push(`INVALID_FRAMES:${logicalFileIndex}`);
      return;
    }
    lf.frames.forEach((value, frameIndex) => {
      const raw = record(value);
      if (!raw) {
        issues.push(`INVALID_FRAME:${logicalFileIndex}:${frameIndex}`);
        return;
      }
      const frameId = JSON.stringify([hash, logicalFileIndex, frameIndex]);
      const { channels, ...frameMetadata } = raw;
      const frame: Frame = {
        id: frameId,
        logicalFileId: id,
        frameIndex,
        key: text(raw.key),
        name: text(raw.name),
        indexType: text(raw.indexType),
        metadata: frameMetadata,
        curves: [],
      };
      logical.frames.push(frame);
      if (!Array.isArray(channels)) {
        issues.push(`INVALID_CHANNELS:${logicalFileIndex}:${frameIndex}`);
        return;
      }
      channels.forEach((value, channelIndex) => {
        const channel = record(value);
        if (!channel) {
          issues.push(
            `INVALID_CHANNEL:${logicalFileIndex}:${frameIndex}:${channelIndex}`,
          );
          return;
        }
        frame.curves.push({
          id: JSON.stringify([
            hash,
            logicalFileIndex,
            frameIndex,
            channelIndex,
          ]),
          frameId,
          channelIndex,
          key: text(channel.key),
          name: text(channel.name),
          units: text(channel.units),
          kind: text(channel.kind),
          dimension:
            Array.isArray(channel.dimension) &&
            channel.dimension.every((n) => Number.isInteger(n) && n > 0)
              ? [...channel.dimension]
              : null,
          metadata: { ...channel },
        });
      });
    });
  });
  return { schemaVersion: 1, sourceHash: hash, logicalFiles, issues };
}
