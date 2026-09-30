"use client";
import { useI18n } from "@/lib/i18n/provider";
import { useState, useEffect } from "react";
import { ShieldCheck, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { api, post } from "@/lib/api";
import { Pick } from "./controls";
export function Admin() {
  const { translate, message } = useI18n();
  const [files, setFiles] = useState<any[]>([]),
    [users, setUsers] = useState<any[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [review, setReview] = useState<any>(null),
    [note, setNote] = useState(""),
    [collection, setCollection] = useState(""),
    [checked, setChecked] = useState(false),
    [saving, setSaving] = useState(false);
  const load = () =>
    Promise.all([api("admin/files"), api("admin/users")])
      .then(([f, u]) => {
        setFiles(f.files);
        setUsers(u.users);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  useEffect(() => {
    load();
  }, []);
  async function role(id: string, role: string) {
    try {
      await post("admin/users", { id, role });
      await load();
      toast.success(translate("Permissão atualizada."));
    } catch (e: any) {
      toast.error(message(e.message));
    }
  }
  async function decide(status: string) {
    setSaving(true);
    try {
      await post("admin/files", {
        id: review.id,
        status,
        note,
        collection,
        reviewed: checked,
      });
      await load();
      setReview(null);
      toast.success(translate("Revisão registrada."));
    } catch (e: any) {
      toast.error(message(e.message));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="standard-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">{translate("GOVERNANÇA DOS DADOS")}</div>
          <h1>
            {translate("Administração")}
            <span className="title-period">.</span>
          </h1>
          <p>
            {translate(
              "Revise as publicações e gerencie as permissões da equipe.",
            )}
          </p>
        </div>
        <ShieldCheck size={33} color="#557f8d" />
      </div>
      {error ? (
        <div className="notice error">{message(error)}</div>
      ) : loading ? (
        <div className="notice">{translate("Carregando…")}</div>
      ) : (
        <Tabs defaultValue="files">
          <TabsList>
            <TabsTrigger value="files">
              {translate("Arquivos ·")}
              {files.length}
            </TabsTrigger>
            <TabsTrigger value="users">
              {translate("Usuários ·")}
              {users.length}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="files">
            <div className="panel">
              {!files.length ? (
                <p className="status-label">
                  {translate("Nenhuma publicação aguardando revisão.")}
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {[
                        translate("Arquivo / Poço"),
                        translate("Coleção"),
                        translate("Empresa confirmada"),
                        translate("Status"),
                        translate("Publicador"),
                        "",
                      ].map((h) => (
                        <TableHead key={h}>{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {files.map((f) => (
                      <TableRow key={f.id}>
                        <TableCell>
                          {f.well || translate("Não informado")}
                          <br />
                          <small>{f.original_name}</small>
                        </TableCell>
                        <TableCell>{f.collection}</TableCell>
                        <TableCell>{f.company}</TableCell>
                        <TableCell>
                          <span className="badge">
                            {
                              (
                                {
                                  pending: translate("Pendente"),
                                  review: translate("Revisão necessária"),
                                  validated: translate("Validado"),
                                  archived: translate("Arquivado"),
                                } as any
                              )[f.status]
                            }
                          </span>
                        </TableCell>
                        <TableCell>{f.publisher}</TableCell>
                        <TableCell>
                          <button
                            className="button compact"
                            onClick={() => {
                              setReview(f);
                              setCollection(f.collection);
                              setNote(f.review_note || "");
                              setChecked(false);
                            }}
                          >
                            {translate("Revisar")}
                          </button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </TabsContent>
          <TabsContent value="users">
            <div className="panel">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{translate("Nome")}</TableHead>
                    <TableHead>{translate("E-mail")}</TableHead>
                    <TableHead>{translate("Papel")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Pick
                          label={translate("Permissão de ") + u.name}
                          value={u.role}
                          onChange={(v) => role(u.id, v)}
                          options={[
                            { value: "user", label: translate("Usuário") },
                            {
                              value: "publisher",
                              label: translate("Publicador"),
                            },
                            {
                              value: "admin",
                              label: translate("Administrador"),
                            },
                          ]}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      )}
      <Dialog
        open={!!review}
        onOpenChange={(o) => {
          if (!o) setReview(null);
        }}
      >
        <DialogContent className="large-dialog">
          <DialogHeader>
            <DialogTitle>{translate("Revisar publicação")}</DialogTitle>
            <DialogDescription>{review?.original_name}</DialogDescription>
          </DialogHeader>
          {review && (
            <>
              <dl className="meta-grid">
                <div>
                  <dt>{translate("Empresa declarada")}</dt>
                  <dd>{review.company}</dd>
                </div>
                <div>
                  <dt>{translate("Empresas nos metadados")}</dt>
                  <dd>
                    {review.metadata.logicalFiles
                      .map(
                        (lf: any) =>
                          lf.origin?.company || translate("Não informada"),
                      )
                      .join(" / ")}
                  </dd>
                </div>
                <div>
                  <dt>{translate("Autorização do publicador")}</dt>
                  <dd>
                    {review.authorization
                      ? translate("Confirmada")
                      : translate("Não confirmada")}
                  </dd>
                </div>
                <div>
                  <dt>{translate("Visibilidade")}</dt>
                  <dd>{message(review.visibility)}</dd>
                </div>
                <div>
                  <dt>{translate("SHA-256 verificado no servidor")}</dt>
                  <dd className="hash">{review.hash}</dd>
                </div>
              </dl>
              <a
                className="button"
                target="_blank"
                rel="noopener"
                href={"/viewer?file=" + review.id}
              >
                {translate("Abrir arquivo real no visualizador")}
                <ArrowUpRight size={16} />
              </a>
              <label className="form-field">
                {translate("Coleção / fonte")}
                <input
                  value={collection}
                  onChange={(e) => setCollection(e.target.value)}
                />
              </label>
              <label className="form-field">
                {translate("Parecer da revisão *")}
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={translate(
                    "Justifique a organização e a aprovação ou solicite correções.",
                  )}
                />
              </label>
              <label className="check-row">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => setChecked(v === true)}
                />{" "}
                {translate(
                  "Conferi o arquivo real, os metadados, a empresa, a fonte e a autorização de publicação.",
                )}
              </label>
              <div className="row">
                <button
                  disabled={saving || !note.trim()}
                  className="button"
                  onClick={() => decide("review")}
                >
                  {translate("Solicitar revisão")}
                </button>
                <button
                  disabled={saving}
                  className="button danger"
                  onClick={() => decide("archived")}
                >
                  {translate("Arquivar")}
                </button>
                <button
                  disabled={
                    saving || !checked || !note.trim() || !collection.trim()
                  }
                  className="button primary"
                  onClick={() => decide("validated")}
                >
                  {translate("Aprovar publicação")}
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
