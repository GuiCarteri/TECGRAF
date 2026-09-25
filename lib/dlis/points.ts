import { rawAt, validity, usit } from "./core.js";
import type { Track } from "./plotting";
export function pointFromTrack(
  track: Track,
  sample: number,
  component: number,
  file: any,
  meta: any,
  calibration: any = {},
) {
  const raw = rawAt(
    track.result.data[track.channel.name],
    track.stride,
    sample,
    component,
  );
  const extras: any = { timeUs: null, azimuth: null, microDebonding: null };
  for (const [key, name, unit] of [
    ["timeUs", track.timeName, "us"],
    ["azimuth", track.azimuthName, "deg"],
  ] as const) {
    if (!name) continue;
    const ch = track.frame.channels.find((c: any) => c.name === name),
      s = track.result.strides[name];
    if (s !== track.stride) continue;
    const v = rawAt(track.result.data[name], s, sample, component);
    if (validity(v) !== "Válido") continue;
    if (key === "timeUs" && /^(us|µs|μs)$/i.test(ch?.units)) extras.timeUs = v;
    if (key === "azimuth" && /^(deg|degree|degrees|°)$/i.test(ch?.units))
      extras.azimuth = v;
  }
  let automaticClassification = null,
    reference = null;
  if (track.kind === "CBL" && calibration.reference > 0) {
    reference = {
      value: calibration.reference,
      unit: "mV",
      source: calibration.source || "Informado pelo usuário",
      goodMax: calibration.goodMax,
      badMin: calibration.badMin,
    };
    if (
      validity(raw) === "Válido" &&
      raw >= 0 &&
      Number.isFinite(calibration.goodMax) &&
      Number.isFinite(calibration.badMin) &&
      calibration.badMin > calibration.goodMax
    ) {
      const r = raw / calibration.reference;
      automaticClassification =
        r <= calibration.goodMax
          ? "Bom"
          : r >= calibration.badMin
            ? "Ruim"
            : "Moderado";
    }
  }
  const md = track.frame.channels.find(
    (c: any) =>
      /micro.?debond.*flag/i.test(c.name + " " + c.longName) &&
      track.result.strides[c.name] === track.stride,
  );
  if (md) {
    const v = rawAt(
      track.result.data[md.name],
      track.stride,
      sample,
      component,
    );
    if (v === 0 || v === 1) extras.microDebonding = v === 1 ? "SIM" : "NÃO";
  }
  return {
    id: crypto.randomUUID(),
    fileHash: meta.hash,
    fileName: file.name,
    logicalFile: meta.logicalFiles[track.lf].id,
    logicalFileIndex: track.lf,
    frame: track.frame.name,
    frameKey: track.frame.key,
    channel: track.channel.name,
    channelKey: track.channel.key,
    sampleIndex: sample,
    frameNumber: track.result.frameNumbers[sample],
    componentIndex: component,
    dimensions: track.channel.dimension.join(" × "),
    depth: track.depth[sample],
    depthRaw: track.result.data[track.depthName][sample],
    depthRawUnit: track.frame.channels.find(
      (c: any) => c.name === track.depthName,
    )?.units,
    depthUnit: "m",
    curve: track.kind,
    rawValue: Number.isFinite(raw) ? raw : null,
    rawRepresentation: String(raw),
    unit: track.channel.units || "Não informada",
    validity: validity(raw),
    ...extras,
    zone: track.kind === "USIT" ? usit(raw).zone : null,
    automaticClassification,
    manualClassification: "",
    reference,
    observation: "",
  };
}
