"use client";
import type { CatalogFile } from "@/lib/catalog";
import { catalogAnalytics } from "@/lib/catalog-analytics";
import { useI18n } from "@/lib/i18n/provider";
import { formatBytes } from "@/lib/api";

function Bars({
  title,
  entries,
  total,
}: {
  title: string;
  entries: [string, number][];
  total: number;
}) {
  const { number } = useI18n();
  return (
    <section className="analytics-card">
      <h3>{title}</h3>
      <ul>
        {entries.map(([label, count], i) => (
          <li key={i}>
            <div className="analytics-label">
              <span>{label}</span>
              <strong>
                {number(count)} ·{" "}
                {number(count / total, {
                  style: "percent",
                  maximumFractionDigits: 1,
                })}
              </strong>
            </div>
            <div className="analytics-rail" aria-hidden="true">
              <span style={{ width: (100 * count) / total + "%" }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function CatalogDashboard({ files }: { files: CatalogFile[] }) {
  const { translate: t, locale, number } = useI18n();
  const summary = catalogAnalytics(files, locale);
  if (!summary.count) return null;
  const profiles: [string, number][] = [...summary.profiles];
  if (summary.unclassified)
    profiles.push([t("Não informado"), summary.unclassified]);
  return (
    <section className="catalog-analytics" aria-label={t("Painel de dados")}>
      <dl className="analytics-stats">
        {[
          [t("Arquivos publicados"), number(summary.count)],
          [t("Coleções disponíveis"), number(summary.collections.length)],
          [t("Volume dos arquivos"), formatBytes(summary.bytes, locale)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="analytics-panels">
        <Bars
          title={t("Arquivos por tipo de perfil")}
          total={summary.count}
          entries={profiles}
        />
        <Bars
          title={t("Arquivos por ambiente")}
          total={summary.count}
          entries={[
            [t("Terrestre / Onshore"), summary.environments.onshore],
            [t("Marítimo / Offshore"), summary.environments.offshore],
            [t("Não informado"), summary.environments.unknown],
          ]}
        />
        <section className="analytics-card">
          <h3>{t("Cinco coleções com mais arquivos")}</h3>
          <ol>
            {summary.collections.slice(0, 5).map(([name, count]) => (
              <li key={name}>
                <div className="analytics-label">
                  <span>{name || t("Não informado")}</span>
                  <strong>{number(count)}</strong>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section className="analytics-card">
          <h3>{t("Cinco maiores arquivos")}</h3>
          <ol>
            {summary.largest.map((f) => (
              <li key={f.id}>
                <div className="analytics-label">
                  <a href={"/viewer?file=" + encodeURIComponent(f.id)}>
                    {f.original_name || f.id}
                  </a>
                  <strong>{formatBytes(f.size, locale)}</strong>
                </div>
              </li>
            ))}
          </ol>
        </section>
      </div>
      <p className="muted">
        {t(
          "Os percentuais usam os arquivos filtrados. Um arquivo pode conter mais de um tipo de perfil.",
        )}
      </p>
    </section>
  );
}
