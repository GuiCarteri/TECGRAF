"use client";
import { useMemo } from "react";
import type { Track } from "@/lib/dlis/plotting";
import { assessReadiness } from "@/lib/dlis/readiness";
import type { curveQuality } from "@/lib/dlis/quality";
import { useI18n } from "@/lib/i18n/provider";

export const qualityLabels = {
  completeness: "Completude das amostras",
  coverage: "Cobertura do intervalo observado",
  consistency: "Consistência da direção da profundidade",
  units: "Unidades da curva e da profundidade",
  plausibility: "Plausibilidade da amplitude ou impedância",
  traceability: "Rastreabilidade da origem",
} as const;

function CurveQuality({
  track,
  metrics,
}: {
  track: Track;
  metrics: ReturnType<typeof curveQuality>;
}) {
  const { translate, number } = useI18n();
  return (
    <section>
      <h4>
        {track.kind} · {track.channel.name} · LF {track.lf + 1} ·{" "}
        {track.frame.name}
      </h4>
      <dl className="meta-grid">
        {(Object.keys(qualityLabels) as (keyof typeof qualityLabels)[]).map((key) => {
          const { fraction, passed, total } = metrics[key];
          return (
            <div key={key}>
              <dt>{translate(qualityLabels[key])}</dt>
              <dd>
                {fraction === null
                  ? translate("Não disponível")
                  : `${number(fraction, { style: "percent", maximumFractionDigits: 1 })} (${number(passed)} / ${number(total)}${key === "coverage" ? " m" : ""})`}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

export function QualityAudit({
  tracks,
  hash,
}: {
  tracks: Record<string, Track>;
  hash: string;
}) {
  const { translate, number } = useI18n();
  const { curves, usit, cblVdl } = useMemo(
    () => assessReadiness(tracks, hash),
    [tracks, hash],
  );
  const score = (value: number | null) =>
    value === null
      ? translate("Não disponível")
      : number(value, { maximumFractionDigits: 1 }) + " / 100";
  return (
    <>
      <section>
        <h3>{translate("Prontidão dos dados")}</h3>
        <dl className="meta-grid">
          <div>
            <dt>IPD USIT</dt>
            <dd>{score(usit)}</dd>
          </div>
          <div>
            <dt>IPD CBL/VDL</dt>
            <dd>{score(cblVdl)}</dd>
          </div>
        </dl>
        <p>
          {translate(
            "O menor critério define o IPD. CBL e VDL exigem profundidades comparáveis e o índice considera a cobertura comum.",
          )}
        </p>
      </section>
      {curves.map(({ track, quality }) => (
        <CurveQuality key={track.kind} track={track} metrics={quality} />
      ))}
    </>
  );
}
