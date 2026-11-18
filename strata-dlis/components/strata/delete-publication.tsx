"use client";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n/provider";

export function DeletePublication({
  id,
  name,
  onDeleted,
}: {
  id: string;
  name: string;
  onDeleted: (id: string) => void;
}) {
  const { translate, message } = useI18n();
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function remove() {
    if (
      pending.current ||
      !window.confirm(
        translate(
          "Apagar publicação permanentemente? O arquivo será removido. Análises, relatórios e exportações serão preservados.",
        ) +
          "\n\n" +
          name,
      )
    )
      return;
    pending.current = true;
    setBusy(true);
    try {
      await api("files/" + encodeURIComponent(id), { method: "DELETE" });
      onDeleted(id);
      toast.success(translate("Publicação apagada."));
    } catch (error) {
      toast.error(
        message(error instanceof Error ? error.message : "UNKNOWN_ERROR"),
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      className="button compact danger"
      disabled={busy}
      onClick={remove}
    >
      {translate(busy ? "Apagando…" : "Apagar publicação")}
    </button>
  );
}
