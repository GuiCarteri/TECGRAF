"use client";
import { LibraryLink, Shell } from "@/components/strata/shell";
import { useI18n } from "@/lib/i18n/provider";
export default function NotFound() {
  const { translate } = useI18n();
  return (
    <Shell active="">
      <div className="standard-page stack">
        <span className="eyebrow">404</span>
        <h1>{translate("Página não encontrada")}</h1>
        <LibraryLink className="file-open">
          {translate("Biblioteca")}
        </LibraryLink>
      </div>
    </Shell>
  );
}
