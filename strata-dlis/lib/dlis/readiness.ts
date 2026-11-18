import { curveQuality } from "./quality.ts";
import type { Track } from "./plotting";

type Interval = [number, number];
type Assessment = ReturnType<typeof assess>;
function assess(track: Track, hash: string) {
  const intervals: Interval[] = [];
  const record = (start: number, end: number) => {
    const last = intervals.at(-1);
    if (last && last[1] === start) last[1] = end;
    else intervals.push([start, end]);
  };
  const paired = track.kind === "CBL" || track.kind === "VDL";
  const quality = curveQuality(track, hash, paired ? record : undefined);
  return { track, quality, intervals };
}

function commonLength(a: Interval[], b: Interval[]) {
  let i = 0,
    j = 0,
    length = 0;
  while (i < a.length && j < b.length) {
    const [left, right] = a[i],
      [start, end] = b[j];
    length += Math.max(0, Math.min(right, end) - Math.max(left, start));
    if (right <= end) i++;
    if (end <= right) j++;
  }
  return length;
}

function signalScore({ quality: q, track }: Assessment) {
  if (
    q.completeness.total === 0 ||
    q.coverage.fraction === null ||
    q.consistency.fraction === null
  )
    return null;
  const factors = [
    q.completeness.fraction!,
    q.coverage.fraction,
    q.consistency.fraction,
    q.units.fraction!,
    q.traceability.fraction!,
  ];
  if (track.kind !== "VDL") factors.push(q.plausibility.fraction ?? 0);
  return 100 * Math.min(...factors);
}
function pairScore(cbl?: Assessment, vdl?: Assessment) {
  if (!cbl || !vdl) return null;
  const a = signalScore(cbl),
    b = signalScore(vdl);
  if (a === null || b === null) return null;
  // The application has no depth-datum transformation between logical files.
  if (
    cbl.track.lf !== vdl.track.lf ||
    cbl.track.depthName !== vdl.track.depthName
  )
    return null;
  const bounds = [cbl.track, vdl.track].map((t) => {
    const rows = t.index.indices;
    return [t.depth[rows[0]], t.depth[rows[rows.length - 1]]];
  });
  const span =
    Math.max(bounds[0][1], bounds[1][1]) - Math.min(bounds[0][0], bounds[1][0]);
  return Math.min(
    a,
    b,
    (100 * commonLength(cbl.intervals, vdl.intervals)) / span,
  );
}
/** IPD v1: percentage of readiness limited by the weakest applicable criterion. */
export function assessReadiness(tracks: Record<string, Track>, hash: string) {
  const curves = Object.values(tracks).map((track) => assess(track, hash));
  const byKind = new Map(curves.map((c) => [c.track.kind, c]));
  const usit = byKind.get("USIT");
  return {
    curves,
    usit: usit ? signalScore(usit) : null,
    cblVdl: pairScore(byKind.get("CBL"), byKind.get("VDL")),
  };
}
