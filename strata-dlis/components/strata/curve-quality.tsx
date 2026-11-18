"use client";
import { useMemo } from "react";
import type { Track } from "@/lib/dlis/plotting";
import { curveQuality } from "@/lib/dlis/quality";
import { useI18n } from "@/lib/i18n/provider";

const labels = {
  completeness: "Completude das amostras",
  coverage: "Cobertura do intervalo observado",
  consistency: "Consistência da direção da profundidade",
  units: "Unidades da curva e da profundidade",
  plausibility: "Plausibilidade da amplitude ou impedância",
  traceability: "Rastreabilidade da origem",
} as const;

export function CurveQuality({ track, hash }: { track: Track; hash: string }) {
  const { translate, number } = useI18n();
  const metrics = useMemo(() => curveQuality(track, hash), [track, hash]);
  return (
    <section>
      <h4>
        {track.kind} · {track.channel.name} · LF {track.lf + 1} ·{" "}
        {track.frame.name}
      </h4>
      <dl className="meta-grid">
        {(Object.keys(labels) as (keyof typeof labels)[]).map((key) => {
          const { fraction, passed, total } = metrics[key];
          return (
            <div key={key}>
              <dt>{translate(labels[key])}</dt>
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
