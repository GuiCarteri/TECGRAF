"use client";
import { useI18n } from "@/lib/i18n/provider";
import {
  Table,
  TableHeader,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Trash2 } from "lucide-react";
import { Pick } from "./controls";
export function PointsTable({
  points,
  onChange,
}: {
  points: any[];
  onChange: (points: any[]) => void;
}) {
  const { translate, message } = useI18n();
  const update = (id: string, key: string, value: string) =>
    onChange(points.map((p) => (p.id === id ? { ...p, [key]: value } : p)));
  return (
    <Table className="points-table technical-table">
      <TableHeader>
        <TableRow>
          {[
            translate("Prof. (m)"),
            translate("Curva / Canal"),
            translate("Valor bruto"),
            translate("Unidade"),
            translate("LF / Frame"),
            translate("Sample / Component"),
            translate("Tempo (µs)"),
            translate("Azimute (°)"),
            translate("Zona / Micro-debonding"),
            translate("Automática"),
            translate("Manual"),
            translate("Observação"),
            "",
          ].map((h) => (
            <TableHead key={h}>{h}</TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {points.map((p) => (
          <TableRow key={p.id}>
            <TableCell>{p.depth}</TableCell>
            <TableCell>
              {p.curve}
              <br />
              {p.channel}
            </TableCell>
            <TableCell>
              {p.rawValue ?? p.rawRepresentation ?? translate("Não disponível")}
            </TableCell>
            <TableCell>{p.unit}</TableCell>
            <TableCell>
              {p.logicalFileIndex} / {p.frame}
            </TableCell>
            <TableCell>
              {p.sampleIndex} / {p.componentIndex}
            </TableCell>
            <TableCell>{p.timeUs ?? "—"}</TableCell>
            <TableCell>{p.azimuth ?? "—"}</TableCell>
            <TableCell>
              {message(p.zone || "—")} / {message(p.microDebonding || "N/D")}
            </TableCell>
            <TableCell>
              {message(p.automaticClassification || "Não classificado")}
            </TableCell>
            <TableCell>
              <Pick
                label={translate("Classificação manual")}
                value={p.manualClassification || ""}
                onChange={(v) => update(p.id, "manualClassification", v)}
                options={[
                  { value: "", label: translate("Sem classificação") },
                  ...["Bom", "Moderado", "Ruim"].map((v) => ({
                    value: v,
                    label: message(v),
                  })),
                ]}
              />
            </TableCell>
            <TableCell>
              <input
                aria-label={translate("Observação do ponto")}
                value={p.observation || ""}
                onChange={(e) => update(p.id, "observation", e.target.value)}
              />
            </TableCell>
            <TableCell>
              <button
                aria-label={translate("Remover ponto")}
                onClick={() => onChange(points.filter((x) => x.id !== p.id))}
              >
                <Trash2 size={16} />
              </button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
