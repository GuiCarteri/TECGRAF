"use client";
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
      toast.success("Permissão atualizada.");
    } catch (e: any) {
      toast.error(e.message);
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
      toast.success("Revisão registrada.");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="standard-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">GOVERNANÇA DOS DADOS</div>
          <h1>
            Administração<span className="title-period">.</span>
          </h1>
          <p>Revise as publicações e gerencie as permissões da equipe.</p>
        </div>
        <ShieldCheck size={33} color="#557f8d" />
      </div>
      {error ? (
        <div className="notice error">{error}</div>
      ) : loading ? (
        <div className="notice">Carregando…</div>
      ) : (
        <Tabs defaultValue="files">
          <TabsList>
            <TabsTrigger value="files">Arquivos · {files.length}</TabsTrigger>
            <TabsTrigger value="users">Usuários · {users.length}</TabsTrigger>
          </TabsList>
          <TabsContent value="files">
            <div className="panel">
              {!files.length ? (
                <p className="status-label">
                  Nenhuma publicação aguardando revisão.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      {[
                        "Arquivo / Poço",
                        "Coleção",
                        "Empresa confirmada",
                        "Status",
                        "Publicador",
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
                          {f.well || "Não informado"}
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
                                  pending: "Pendente",
                                  review: "Revisão necessária",
                                  validated: "Validado",
                                  archived: "Arquivado",
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
                            Revisar
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
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead>Papel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell>{u.name}</TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Pick
                          label={"Permissão de " + u.name}
                          value={u.role}
                          onChange={(v) => role(u.id, v)}
                          options={[
                            { value: "user", label: "Usuário" },
                            { value: "publisher", label: "Publicador" },
                            { value: "admin", label: "Administrador" },
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
            <DialogTitle>Revisar publicação</DialogTitle>
            <DialogDescription>{review?.original_name}</DialogDescription>
          </DialogHeader>
          {review && (
            <>
              <dl className="meta-grid">
                <div>
                  <dt>Empresa declarada</dt>
                  <dd>{review.company}</dd>
                </div>
                <div>
                  <dt>Empresas nos metadados</dt>
                  <dd>
                    {review.metadata.logicalFiles
                      .map((lf: any) => lf.origin?.company || "Não informada")
                      .join(" / ")}
                  </dd>
                </div>
                <div>
                  <dt>Autorização do publicador</dt>
                  <dd>
                    {review.authorization ? "Confirmada" : "Não confirmada"}
                  </dd>
                </div>
                <div>
                  <dt>Visibilidade</dt>
                  <dd>{review.visibility}</dd>
                </div>
                <div>
                  <dt>SHA-256 verificado no servidor</dt>
                  <dd className="hash">{review.hash}</dd>
                </div>
              </dl>
              <a
                className="button"
                target="_blank"
                rel="noopener"
                href={"/viewer?file=" + review.id}
              >
                Abrir arquivo real no visualizador <ArrowUpRight size={16} />
              </a>
              <label className="form-field">
                Coleção / fonte
                <input
                  value={collection}
                  onChange={(e) => setCollection(e.target.value)}
                />
              </label>
              <label className="form-field">
                Parecer da revisão *
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Justifique a organização e a aprovação ou solicite correções."
                />
              </label>
              <label className="check-row">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => setChecked(v === true)}
                />{" "}
                Conferi o arquivo real, os metadados, a empresa, a fonte e a
                autorização de publicação.
              </label>
              <div className="row">
                <button
                  disabled={saving || !note.trim()}
                  className="button"
                  onClick={() => decide("review")}
                >
                  Solicitar revisão
                </button>
                <button
                  disabled={saving}
                  className="button danger"
                  onClick={() => decide("archived")}
                >
                  Arquivar
                </button>
                <button
                  disabled={
                    saving || !checked || !note.trim() || !collection.trim()
                  }
                  className="button primary"
                  onClick={() => decide("validated")}
                >
                  Aprovar publicação
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
