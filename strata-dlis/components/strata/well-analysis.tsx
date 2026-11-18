"use client";
import { useState } from "react";
import { useI18n } from "@/lib/i18n/provider";
import type { WellAssessment } from "@/lib/model/well-assessment";
import { qualityLabels } from "./curve-quality";

export function WellAnalysis({
  current,
  saved,
  hasAnalysis,
}: {
  current: () => WellAssessment;
  saved: WellAssessment | null;
  hasAnalysis: boolean;
}) {
  const { translate: t, number } = useI18n();
  const [open, setOpen] = useState(false);
  const render = (assessment: WellAssessment) =>
    assessment.groups.length ? (
      assessment.groups.map((group) => (
        <section key={group.lf}>
          <h4>
            {group.well || t("Não informado")} · LF {group.lf + 1}
          </h4>
          <dl className="meta-grid">
            {(
              [
                ["USIT", group.usit],
                ["CBL/VDL", group.cblVdl],
              ] as const
            ).map(([kind, score]) => (
              <div key={kind}>
                <dt>IPD {kind}</dt>
                <dd>
                  {score === null
                    ? t("Não disponível")
                    : number(score, { maximumFractionDigits: 1 }) + " / 100"}
                </dd>
              </div>
            ))}
          </dl>
          {group.curves.map((c) => (
            <details key={c.kind}>
              <summary>
                {c.kind} · {c.name} · {c.frame} · {c.depth}
              </summary>
              <dl className="meta-grid">
                {(
                  Object.keys(qualityLabels) as (keyof typeof qualityLabels)[]
                ).map((key) => (
                  <div key={key}>
                    <dt>{t(qualityLabels[key])}</dt>
                    <dd>
                      {c.quality[key].fraction === null
                        ? t("Não disponível")
                        : number(c.quality[key].fraction, {
                            style: "percent",
                            maximumFractionDigits: 1,
                          })}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          ))}
        </section>
      ))
    ) : (
      <p>{t("Nenhum canal selecionado")}</p>
    );
  return (
    <details className="panel" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{t("Análise do poço")}</summary>
      {open && (
        <>
          <h3>{t("Curvas atuais")}</h3>
          {render(current())}
          {hasAnalysis && (
            <>
              <h3>{t("Indicadores salvos na interpretação")}</h3>
              {saved ? render(saved) : <p>{t("Não disponível")}</p>}
            </>
          )}
        </>
      )}
    </details>
  );
}
