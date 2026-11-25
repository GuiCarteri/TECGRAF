"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { api } from "@/lib/api";
import { readCatalogFiles, type CatalogFile } from "@/lib/catalog";
import {
  languageNames,
  locales,
  themeLabels,
  themes,
  type MessageKey,
} from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/provider";

const pages: [MessageKey, string][] = [
  ["Biblioteca", "/"],
  ["Visualizador", "/viewer"],
  ["Publicar DLIS", "/publish"],
  ["Guia técnico", "/help"],
  ["Minha conta", "/account"],
];
const normalize = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

export function CommandPalette({
  admin,
  signedIn,
}: {
  admin: boolean;
  signedIn: boolean;
}) {
  const { translate, setLocale, setTheme } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(0);
  const [files, setFiles] = useState<CatalogFile[]>([]);
  const [failed, setFailed] = useState(false);
  const list = useId();
  const show = useCallback(() => {
    trigger.current = document.activeElement as HTMLElement;
    setSearch("");
    setSelected(0);
    setOpen(true);
    dialog.current?.showModal();
    input.current?.focus();
  }, []);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (dialog.current?.open) dialog.current.close();
        else show();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [show]);
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    api("files", { signal: controller.signal })
      .then(readCatalogFiles)
      .then((rows) => {
        if (!controller.signal.aborted) {
          setFiles(rows);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFiles([]);
          setFailed(true);
        }
      });
    return () => controller.abort();
  }, [open]);
  const links = [...pages];
  if (admin) links.push(["Administração", "/admin"]);
  if (!signedIn) links.push(["Entrar", "/login"], ["Criar conta", "/register"]);
  const commands = [
    ...links.map(([key, path]) => ({
      label: translate(key),
      detail: "",
      run: () => location.assign(path),
    })),
    ...themes.map((theme) => ({
      label: translate(themeLabels[theme]),
      detail: translate("Aparência"),
      run: () => setTheme(theme),
    })),
    ...locales.map((locale) => ({
      label: languageNames[locale],
      detail: translate("language"),
      run: () => setLocale(locale),
    })),
    ...files.flatMap((file) => {
      const wells = new Set(
        [file.well, ...(file.summary?.wells || [])].filter(
          (name): name is string => !!name,
        ),
      );
      if (!wells.size) wells.add(file.original_name || file.id);
      return [...wells].map((well) => ({
        label: well,
        detail: [file.field, file.original_name].filter(Boolean).join(" · "),
        run: () =>
          location.assign(
            new URL(
              "/viewer?file=" + encodeURIComponent(file.id),
              location.origin,
            ),
          ),
      }));
    }),
  ].filter((command) =>
    normalize(command.label + " " + command.detail).includes(
      normalize(search.trim()),
    ),
  );
  const index = Math.max(0, Math.min(selected, commands.length - 1));
  const execute = (i: number) => {
    const command = commands[i];
    if (command) {
      dialog.current?.close();
      command.run();
    }
  };
  useEffect(() => {
    if (open)
      document
        .getElementById(list + "-" + index)
        ?.scrollIntoView({ block: "nearest" });
  }, [index, list, open]);
  return (
    <>
      <button
        type="button"
        className="command-trigger"
        onClick={show}
        aria-label={translate("Paleta de comandos")}
        title={translate("Paleta de comandos")}
        aria-haspopup="dialog"
        aria-keyshortcuts="Control+K Meta+K"
      >
        <Search size={17} />
        <kbd>⌘/Ctrl K</kbd>
      </button>
      <dialog
        ref={dialog}
        className="command-dialog"
        aria-label={translate("Paleta de comandos")}
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === dialog.current) {
            const bounds = dialog.current.getBoundingClientRect();
            if (
              event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom
            )
              dialog.current.close();
          }
        }}
      >
        <div className="command-input">
          <Search size={19} aria-hidden="true" />
          <input
            ref={input}
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={list}
            aria-activedescendant={
              commands.length ? list + "-" + index : undefined
            }
            aria-label={translate("Buscar poço, página ou preferência")}
            placeholder={translate("Buscar poço, página ou preferência")}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setSelected(0);
            }}
            onKeyDown={(event) => {
              if (!commands.length || event.nativeEvent.isComposing) return;
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                setSelected(
                  (index +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    commands.length) %
                    commands.length,
                );
              } else if (event.key === "Enter") {
                event.preventDefault();
                execute(index);
              }
            }}
          />
          <button
            type="button"
            aria-label={translate("Close")}
            onClick={() => dialog.current?.close()}
          >
            <X size={18} />
          </button>
        </div>
        <div
          className="command-results"
          id={list}
          role="listbox"
          aria-label={translate("Comandos")}
        >
          {commands.map((command, i) => (
            <div
              key={i}
              id={list + "-" + i}
              role="option"
              aria-selected={i === index}
              onClick={() => execute(i)}
            >
              <span>{command.label}</span>
              <small>{command.detail}</small>
            </div>
          ))}
        </div>
        {!commands.length && (
          <p role="status">{translate("Nenhum comando encontrado")}</p>
        )}
        {failed && (
          <p role="status">{translate("Busca de poços indisponível")}</p>
        )}
      </dialog>
    </>
  );
}
