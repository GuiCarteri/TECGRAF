import {
  extractMetadata,
  defaultDepthChannel,
  numericRange,
  metersFactor,
  validity,
} from "./core.js";

// A miniatura usa somente pares medidos. Uma lacuna interrompe a linha.
function trace(channel, depths, values, factor, frame, lf) {
  if (!channel || !depths || !values) return null;
  const points = [];
  const step = Math.max(1, Math.ceil(values.length / 64));
  let last = -step,
    gap = true;
  for (let i = 0; i < values.length; i++) {
    if (validity(depths[i]) !== "Válido" || validity(values[i]) !== "Válido") {
      gap = true;
      continue;
    }
    if (i - last < step && i !== values.length - 1) continue;
    if (gap && points.length) points.push(null);
    points.push([values[i], depths[i] * factor]);
    gap = false;
    last = i;
  }
  return points.length > 1
    ? { channel: channel.name, unit: channel.units, lf, frame, points }
    : null;
}

/** @param {import("../vendor/dlis-parser/index.js").DLISFile} parsed @param {((done:number,total:number)=>void)} [progress] */
export function inspectFrames(parsed, progress) {
  const metadata = extractMetadata(parsed);
  const validation = [];
  let thumbnail = null;
  const total = metadata.logicalFiles.reduce(
    (n, lf) => n + lf.frames.length,
    0,
  );
  for (const lf of metadata.logicalFiles) {
    for (const frame of lf.frames) {
      try {
        if (frame.channels.length !== frame.channelNames.length)
          throw Error("Frame contém canais sem metadados completos.");
        const depth = defaultDepthChannel(frame);
        const factor = metersFactor(
          frame.channels.find((c) => c.name === depth)?.units,
        );
        const candidates = frame.channels.filter(
          (c) =>
            c.name !== depth &&
            c.kind !== "DEPTH" &&
            c.dimension.reduce((a, b) => a * b, 1) === 1,
        );
        const channel =
          !thumbnail && depth
            ? candidates.find((c) => c.kind === "GR") ||
              candidates.find((c) => c.kind === "CBL") ||
              candidates[0]
            : undefined;
        const selected = [depth, channel?.name].filter(Boolean);
        const decoded = parsed.logicalFiles[lf.index].frames
          .get(frame.key)
          .decode({ channels: selected });
        if (!decoded?.frameCount) throw Error("Frame sem amostras legíveis.");
        const depths = depth && decoded.data[depth];
        const range =
          depths && factor !== null
            ? numericRange(depths)?.map((v) => v * factor)
            : null;
        validation.push({
          lf: lf.index,
          frame: frame.key,
          samples: decoded.frameCount,
          depthRangeMeters: range || null,
          ok: true,
        });
        if (channel && range)
          thumbnail = trace(
            channel,
            depths,
            decoded.data[channel.name],
            factor,
            frame.key,
            lf.index,
          );
      } catch (error) {
        validation.push({
          lf: lf.index,
          frame: frame.key,
          ok: false,
          error: error.message,
        });
        metadata.warnings.push(frame.name + ": " + error.message);
      }
      progress?.(validation.length, total);
    }
  }
  if (!validation.some((v) => v.ok))
    throw Error(
      metadata.warnings.at(-1) || "Nenhum frame com amostras legíveis.",
    );
  return { ...metadata, validation, thumbnail };
}
