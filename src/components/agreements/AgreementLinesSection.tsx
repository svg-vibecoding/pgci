import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Plus,
  Search,
  Pencil,
  Ban,
  RotateCcw,
  Download,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge, StatusBadge, type StatusBadgeStatus } from "@/components/sumatec";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listAgreementLines,
  excludeAgreementLine,
  reactivateAgreementLine,
} from "@/lib/agreements.functions";
import { exportAgreementLines } from "@/lib/agreement-export";
import { PENDING_REASON_LABELS, type ImportPendingReason } from "@/lib/agreement-import";
import { LineEditDialog, type LineEditValues } from "./LineEditDialog";

type LineStatus = "all" | "active" | "pending" | "requires_review" | "excluded";

const STATUS_META: Record<
  Exclude<LineStatus, "all">,
  { label: string; status: StatusBadgeStatus }
> = {
  active: { label: "Activa", status: "active" },
  pending: { label: "Pendiente", status: "warning" },
  requires_review: { label: "Requiere revisión", status: "danger" },
  excluded: { label: "Excluida", status: "neutral" },
};

const fmtDate = (v: string | null) => {
  if (!v) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
};

const fmtMoney = (v: number | null) =>
  v == null
    ? "—"
    : new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
      }).format(v);

export function AgreementLinesSection({
  agreementId,
  agreementName,
  canAdmin,
  onOpenImport,
}: {
  agreementId: string;
  agreementName: string;
  canAdmin: boolean;
  onOpenImport: () => void;
}) {
  const qc = useQueryClient();
  const linesFn = useServerFn(listAgreementLines);
  const excludeFn = useServerFn(excludeAgreementLine);
  const reactivateFn = useServerFn(reactivateAgreementLine);

  const { data: lines, isLoading } = useQuery({
    queryKey: ["agreements", "lines", agreementId],
    queryFn: () => linesFn({ data: { agreement_id: agreementId } }),
  });

  const [status, setStatus] = useState<LineStatus>("all");
  const [q, setQ] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [editInitial, setEditInitial] = useState<Partial<LineEditValues> | null>(null);
  const [excludeTarget, setExcludeTarget] = useState<{ id: string; sku: string | null } | null>(
    null,
  );
  const [reason, setReason] = useState("");

  const exclude = useMutation({
    mutationFn: (vars: { line_id: string; reason: string | null }) =>
      excludeFn({ data: vars }),
    onSuccess: () => {
      toast.success("Línea excluida");
      qc.invalidateQueries({ queryKey: ["agreements", "lines", agreementId] });
      qc.invalidateQueries({ queryKey: ["agreements", "detail", agreementId] });
      setExcludeTarget(null);
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reactivate = useMutation({
    mutationFn: (lineId: string) => reactivateFn({ data: { line_id: lineId } }),
    onSuccess: () => {
      toast.success("Línea reactivada");
      qc.invalidateQueries({ queryKey: ["agreements", "lines", agreementId] });
      qc.invalidateQueries({ queryKey: ["agreements", "detail", agreementId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  type Line = NonNullable<typeof lines>[number] & {
    products?: { sku?: string | null; erp_description?: string | null; commercial_brand?: string | null } | null;
  };

  const filtered = useMemo<Line[]>(() => {
    const rows = (lines ?? []) as Line[];
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (status !== "all" && r.status !== status) return false;
      if (!term) return true;
      const sku = r.products?.sku ?? "";
      const erp = r.products?.erp_description ?? "";
      const brand = r.products?.commercial_brand ?? "";
      const code = r.client_code ?? "";
      const desc = r.client_description ?? "";
      return [sku, erp, brand, code, desc].some((s) =>
        s.toLowerCase().includes(term),
      );
    });
  }, [lines, status, q]);

  const counts = useMemo(() => {
    const c = { all: 0, active: 0, pending: 0, requires_review: 0, excluded: 0 };
    for (const r of (lines ?? []) as Line[]) {
      c.all++;
      const k = r.status as keyof typeof c;
      if (k in c) c[k]++;
    }
    return c;
  }, [lines]);

  const handleExport = () => {
    if (!lines) return;
    const data = filtered.map((r) => ({
      client_code: r.client_code ?? null,
      client_description: r.client_description ?? null,
      sku: r.products?.sku ?? null,
      erp_description: r.products?.erp_description ?? null,
      commercial_brand: r.products?.commercial_brand ?? null,
      sale_price: r.sale_price ?? null,
      par_price: r.par_price ?? null,
      start_date: r.start_date ?? null,
      end_date: r.end_date ?? null,
      status: r.status ?? null,
      observations: r.observations ?? null,
    }));
    const preset =
      status === "all" && !q.trim()
        ? "all"
        : status === "active" && !q.trim()
          ? "active"
          : "filtered";
    exportAgreementLines(data, { preset, agreementName });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-base">Líneas del acuerdo</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {counts.all} líneas · {counts.active} activas · {counts.pending} pendientes ·{" "}
            {counts.requires_review} en revisión · {counts.excluded} excluidas
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!lines?.length}>
            <Download className="mr-1.5 h-4 w-4" /> Exportar
          </Button>
          {canAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={onOpenImport}>
                <Upload className="mr-1.5 h-4 w-4" /> Importar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditInitial(null);
                  setEditOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Nueva línea
              </Button>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar SKU, descripción, marca, código del cliente…"
              className="pl-9"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-muted"
                aria-label="Limpiar"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ["all", `Todas (${counts.all})`],
                ["active", `Activas (${counts.active})`],
                ["pending", `Pendientes (${counts.pending})`],
                ["requires_review", `Revisión (${counts.requires_review})`],
                ["excluded", `Excluidas (${counts.excluded})`],
              ] as [LineStatus, string][]
            ).map(([k, label]) => (
              <Button
                key={k}
                size="sm"
                variant={status === k ? "default" : "outline"}
                onClick={() => setStatus(k)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>SKU Jaivaná</TableHead>
                <TableHead className="text-right">Precio venta</TableHead>
                <TableHead className="text-right">Precio par</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead>Estado</TableHead>
                {canAdmin && <TableHead className="w-32 text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={canAdmin ? 7 : 6} className="py-6 text-center text-sm text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canAdmin ? 7 : 6} className="py-8 text-center text-sm text-muted-foreground">
                    No hay líneas con esos filtros.
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((r) => {
                const meta = STATUS_META[r.status as keyof typeof STATUS_META] ?? null;
                const reasons = (r.pending_reason ?? "").split(",").filter(Boolean) as ImportPendingReason[];
                const isExcluded = r.status === "excluded";
                return (
                  <TableRow key={r.id as string}>
                    <TableCell>
                      <div className="font-medium">{r.client_code ?? "—"}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {r.client_description ?? "—"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="font-mono text-sm">{r.products?.sku ?? "—"}</div>
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {r.products?.erp_description ?? "—"}
                        {r.products?.commercial_brand ? (
                          <span className="ml-1 text-muted-foreground/70">
                            · {r.products.commercial_brand}
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtMoney(r.sale_price ?? null)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {fmtMoney(r.par_price ?? null)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {fmtDate(r.start_date ?? null)} – {fmtDate(r.end_date ?? null)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {meta && <StatusBadge status={meta.status} label={meta.label} />}
                        {r.status === "pending" && reasons.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {reasons.map((rsn) => (
                              <Badge key={rsn} color="warning" variant="soft">
                                {PENDING_REASON_LABELS[rsn] ?? rsn}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {isExcluded && r.excluded_reason && (
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {r.excluded_reason}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    {canAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {isExcluded ? (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => reactivate.mutate(r.id as string)}
                              aria-label="Reactivar"
                              title="Reactivar"
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setEditInitial({
                                    line_id: r.id as string,
                                    sku: r.products?.sku ?? "",
                                    client_code: r.client_code ?? "",
                                    client_description: r.client_description ?? "",
                                    sale_price: r.sale_price?.toString() ?? "",
                                    par_price: r.par_price?.toString() ?? "",
                                    start_date: r.start_date ?? "",
                                    end_date: r.end_date ?? "",
                                    observations: r.observations ?? "",
                                  });
                                  setEditOpen(true);
                                }}
                                aria-label="Editar"
                                title="Editar"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  setExcludeTarget({
                                    id: r.id as string,
                                    sku: r.products?.sku ?? null,
                                  })
                                }
                                aria-label="Excluir"
                                title="Excluir"
                              >
                                <Ban className="h-4 w-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <LineEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        agreementId={agreementId}
        initial={editInitial}
      />

      <AlertDialog
        open={!!excludeTarget}
        onOpenChange={(o) => {
          if (!o) {
            setExcludeTarget(null);
            setReason("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir línea</AlertDialogTitle>
            <AlertDialogDescription>
              La línea queda fuera del acuerdo pero conserva su historial. Puedes reactivarla
              después si fue un error.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-1.5">
            <Label>Motivo (opcional)</Label>
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Producto descontinuado por el cliente"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={exclude.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (excludeTarget)
                  exclude.mutate({
                    line_id: excludeTarget.id,
                    reason: reason.trim() ? reason.trim() : null,
                  });
              }}
              disabled={exclude.isPending}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
