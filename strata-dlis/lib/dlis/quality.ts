import { isMRayl, metersFactor, validity } from "./core.js";
import type { Track } from "./plotting";

function ratio(passed: number, total: number) {
  return { passed, total, fraction: total > 0 ? passed / total : null };
}

/** Audit the selected raw curve, over its observed depth interval, before scaling or gain. */
export function curveQuality(track: Track, sourceHash: string) {
  const { channel, frame, result, stride, depth, index, kind } = track;
  const values = result.data[channel.name] as ArrayLike<number>;
  const rows = result.frameCount as number;
  const present = new Uint8Array(rows);
  const unit = String(channel.units ?? "").trim();
  // VDL waveforms may use tool-specific units. Only presence can be checked.
  const unitOK =
    kind === "USIT"
      ? isMRayl(unit)
      : kind === "GR"
        ? /^(gapi|api)$/i.test(unit)
        : kind === "CBL"
          ? /^mv$/i.test(unit)
          : !!unit;
  const depthChannel = frame.channels.find(
    (c: { name: string }) => c.name === track.depthName,
  );
  const depthUnitOK = metersFactor(depthChannel?.units) !== null;
  const nonnegative = unitOK && (kind === "USIT" || kind === "CBL");
  let valid = 0,
    plausible = 0,
    ascending = 0,
    descending = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < stride; col++) {
      const value = values[row * stride + col];
      if (validity(value) !== "Válido") continue;
      present[row] = 1;
      valid++;
      if (nonnegative && value >= 0) plausible++;
    }
    if (row && Number.isFinite(depth[row - 1]) && Number.isFinite(depth[row])) {
      if (depth[row] > depth[row - 1]) ascending++;
      if (depth[row] < depth[row - 1]) descending++;
    }
  }
  // Count a measured interval only when both endpoints contain observations.
  // Merge coincident depths so coverage is independent of duplicate row order.
  let first = NaN,
    previous = NaN,
    previousPresent = false,
    covered = 0;
  const indices: number[] = index.indices;
  for (let i = 0; i < indices.length;) {
    const z = depth[indices[i]];
    let observed = false;
    do {
      if (present[indices[i]]) observed = true;
      i++;
    } while (i < indices.length && depth[indices[i]] === z);
    if (!Number.isFinite(first)) first = z;
    const distance = z - previous;
    if (previousPresent && observed && distance <= 1.5 * index.step)
      covered += distance;
    previous = z;
    previousPresent = observed;
  }
  const uniqueChannel =
    frame.channels.filter((c: { name: string }) => c.name === channel.name)
      .length === 1;
  const provenance = [
    /^[a-f0-9]{64}$/i.test(sourceHash),
    Number.isInteger(track.lf) && track.lf >= 0,
    !!frame.key,
    !!channel.key && uniqueChannel,
    rows > 0 && result.frameNumbers?.length === rows,
  ];
  return {
    completeness: ratio(valid, rows * stride),
    coverage: ratio(covered, Number.isFinite(first) ? previous - first : 0),
    consistency: ratio(Math.max(ascending, descending), Math.max(0, rows - 1)),
    units: ratio(Number(unitOK) + Number(depthUnitOK), 2),
    plausibility: ratio(plausible, nonnegative ? valid : 0),
    traceability: ratio(provenance.filter(Boolean).length, provenance.length),
  };
}
