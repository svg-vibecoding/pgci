import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Search,
  Pencil,
  Ban,
  RotateCcw,
  Download,
  Upload,
  X,
  AlertTriangle,
  XCircle,
  Trash2,
  Info,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge, Chip, StatusBadge, type StatusBadgeStatus } from "@/components/sumatec";
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
  getAgreement,
  getAgreementContext,
  listAgreementLines,
  excludeAgreementLine,
  reactivateAgreementLine,
} from "@/lib/agreements.functions";
import { exportAgreementLines } from "@/lib/agreement-export";
import { PENDING_REASON_LABELS, type ImportPendingReason } from "@/lib/agreement-import";
import { LineEditDialog, type LineEditValues } from "@/components/agreements/LineEditDialog";
import { AgreementImportWizard } from "@/components/agreements/AgreementImportWizard";

export const Route = createFileRoute(
  "/_authenticated/pgci/agreements/$agreementId/lines",
)({
  head: () => ({ meta: [{ title: "Posiciones del acuerdo · PGCI" }] }),
  component: AgreementLinesPage,
});

type LineCardKey = "all" | "active" | "requires_review" | "excluded" | "transit";

const STATUS_META: Record<
  Exclude<LineCardKey, "all" | "transit">,
  { label: string; status: StatusBadgeStatus }
> = {
  active: { label: "Activa", status: "active" },
  requires_review: { label: "Revisar", status: "danger" },
  excluded: { label: "Excluida", status: "neutral" },
};


import { formatMoneyCOP } from "@/lib/format";
const fmtMoney = (v: number | null) => formatMoneyCOP(v);

type VigenciaBadge = {
  color: "info" | "warning" | "error" | "neutral";
  label: string;
};

function vigenciaBadge(
  lineEnd: string | null,
  agreementEnd: string | null,
): VigenciaBadge {
  const eff = lineEnd ?? agreementEnd ?? null;
  if (!eff) return { color: "neutral", label: "Sin vigencia" };
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(eff);
  if (!m) return { color: "neutral", label: "Sin vigencia" };
  const end = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((end.getTime() - today.getTime()) / 86_400_000);
  const label = `${m[3]}/${m[2]}/${m[1]}`;
  if (diffDays < 0) return { color: "error", label };
  if (diffDays <= 30) return { color: "warning", label };
  return { color: "info", label };
}

function AgreementLinesPage() {
  const { agreementId } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getAgreement);
  const ctxFn = useServerFn(getAgreementContext);
  const linesFn = useServerFn(listAgreementLines);
  const excludeFn = useServerFn(excludeAgreementLine);
  const reactivateFn = useServerFn(reactivateAgreementLine);

  const { data: agreement, isLoading: loadingAgreement } = useQuery({
    queryKey: ["agreements", "detail", agreementId],
    queryFn: () => getFn({ data: { agreement_id: agreementId } }),
  });
  const { data: ctx } = useQuery({
    queryKey: ["agreements", "ctx", agreementId],
    queryFn: () => ctxFn({ data: { agreement_id: agreementId } }),
  });
  const { data: lines, isLoading: loadingLines } = useQuery({
    queryKey: ["agreements", "lines", agreementId],
    queryFn: () => linesFn({ data: { agreement_id: agreementId } }),
  });

  const [activeCard, setActiveCard] = useState<LineCardKey>("all");
  const [q, setQ] = useState("");
  const [importOpen, setImportOpen] = useState(false);
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
      toast.success("Posición excluida");
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
      toast.success("Posición reactivada");
      qc.invalidateQueries({ queryKey: ["agreements", "lines", agreementId] });
      qc.invalidateQueries({ queryKey: ["agreements", "detail", agreementId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  type Line = NonNullable<typeof lines>[number] & {
    kind: "position" | "transit";
    products?: {
      sku?: string | null;
      erp_description?: string | null;
      commercial_brand?: string | null;
      status?: string | null;
    } | null;
  };

  const counts = useMemo(() => {
    const c = { all: 0, active: 0, requires_review: 0, excluded: 0, transit: 0 };
    for (const r of (lines ?? []) as Line[]) {
      c.all++;
      if (r.kind === "transit") {
        c.transit++;
      } else {
        const k = r.status as keyof typeof c;
        if (k in c) c[k]++;
      }
    }
    return c;
  }, [lines]);

  const filtered = useMemo<Line[]>(() => {
    const rows = (lines ?? []) as Line[];
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (activeCard !== "all") {
        if (activeCard === "transit") return r.kind === "transit";
        return r.status === activeCard;
      }
      if (!term) return true;
      const sku = r.products?.sku ?? "";
      const erp = r.products?.erp_description ?? "";
      const brand = r.products?.commercial_brand ?? "";
      const code = r.client_code ?? "";
      const desc = r.client_description ?? "";
      return [sku, erp, brand, code, desc].some((s) => s.toLowerCase().includes(term));
    });
  }, [lines, activeCard, q]);

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
      activeCard === "all" && !q.trim()
        ? "all"
        : activeCard === "active" && !q.trim()
          ? "active"
          : "filtered";
    exportAgreementLines(data, {
      preset,
      agreementName: (agreement?.name as string) ?? "acuerdo",
    });
  };

  if (loadingAgreement || !agreement) {
    return <div className="text-sm text-muted-foreground">Cargando…</div>;
  }

  const canAdmin = !!ctx?.can_admin;
  const isActive = agreement.status === "active";
  const clientName =
    agreement.group_client_commercial_name?.trim() ||
    agreement.group_client_legal_name ||
    agreement.group_name ||
    "—";

  const summaryCards: { key: LineCardKey; label: string; value: number }[] = [
    { key: "all", label: "Posiciones", value: counts.all },
    { key: "active", label: "Activas", value: counts.active },
    { key: "requires_review", label: "Requieren revisión", value: counts.requires_review },
    { key: "excluded", label: "Excluidas", value: counts.excluded },
    { key: "transit", label: "En tránsito", value: counts.transit },
  ];

  return (
    <div className="space-y-6">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 h-8 px-2 text-muted-foreground"
      >
        <Link to="/pgci/agreements/$agreementId" params={{ agreementId }}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Volver al acuerdo
        </Link>
      </Button>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{agreement.name}</h1>
            <StatusBadge
              status={isActive ? "active" : "neutral"}
              label={isActive ? "Activo" : "Inactivo"}
            />
            {agreement.scope === "unit" && <Badge color="info">Con alcance</Badge>}
          </div>
          <p className="mt-1 text-sm text-foreground">Posiciones en el acuerdo</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!lines?.length}>
            <Download className="mr-1.5 h-4 w-4" /> Exportar
          </Button>
          {canAdmin && (
            <>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
                <Upload className="mr-1.5 h-4 w-4" /> Importar
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditInitial(null);
                  setEditOpen(true);
                }}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Nueva posición
              </Button>
            </>
          )}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {summaryCards.map((c) => {
          const selected = activeCard === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setActiveCard(c.key)}
              aria-pressed={selected}
              className="rounded-lg text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card
                className={
                  selected
                    ? "border-l-[3px] border-l-primary shadow-sm transition-colors"
                    : "transition-colors hover:border-muted-foreground/20 hover:bg-muted/30"
                }
              >
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight">
                    {loadingLines ? "—" : c.value}
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 md:flex-nowrap">
        <div className="relative w-full flex-1 min-w-[16rem]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar SKU, descripción, marca, código del cliente…"
            className="w-full pl-9"
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
      </div>

      {(activeCard !== "all" || q.trim()) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-sm text-muted-foreground">
            {filtered.length} de {counts.all} {counts.all === 1 ? "posición" : "posiciones"}
          </p>
          <div className="flex flex-wrap gap-2">
            {activeCard !== "all" && (
              <Chip
                size="small"
                variant="soft"
                color="neutral"
                onRemove={() => setActiveCard("all")}
              >
                {summaryCards.find((c) => c.key === activeCard)?.label ?? activeCard}
              </Chip>
            )}
            {q.trim() && (
              <Chip
                size="small"
                variant="soft"
                color="neutral"
                onRemove={() => setQ("")}
              >
                Búsqueda: {q.trim()}
              </Chip>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveCard("all");
              setQ("");
            }}
            className="text-sm font-medium text-primary hover:underline"
          >
            Limpiar filtros
          </button>
        </div>
      )}


      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Jaivaná</TableHead>
              <TableHead className="w-32 whitespace-nowrap">Marca</TableHead>
              <TableHead className="w-32 whitespace-nowrap text-right">Precio</TableHead>
              <TableHead className="w-32 whitespace-nowrap">Vigencia</TableHead>
              <TableHead className="w-40 whitespace-nowrap">Estado</TableHead>
              {canAdmin && <TableHead className="w-24 whitespace-nowrap text-right">Acciones</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingLines && (
              <TableRow>
                <TableCell
                  colSpan={canAdmin ? 7 : 6}
                  className="py-6 text-center text-sm text-muted-foreground"
                >
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!loadingLines && filtered.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={canAdmin ? 7 : 6}
                  className="py-8 text-center text-sm text-muted-foreground"
                >
                  No hay posiciones con esos filtros.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((r) => {
              const meta = STATUS_META[r.status as keyof typeof STATUS_META] ?? null;
              const reasons = (r.pending_reason ?? "")
                .split(",")
                .filter(Boolean) as ImportPendingReason[];
              const isExcluded = r.status === "excluded";
              const vig = vigenciaBadge(
                r.end_date ?? null,
                (agreement.end_date as string | null) ?? null,
              );
              return (
                <TableRow key={r.id as string}>
                  <TableCell>
                    <div className="font-mono text-sm">{r.client_code ?? "—"}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {r.client_description ?? "—"}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono text-sm">{r.products?.sku ?? "—"}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">
                      {r.products?.erp_description ?? "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.products?.commercial_brand ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <div>{fmtMoney(r.sale_price ?? null)}</div>
                    {r.par_price != null && r.par_price > 0 && (
                      <div className="text-xs text-muted-foreground">
                        par&nbsp;&nbsp;{fmtMoney(r.par_price)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge color={vig.color}>{vig.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      {(r.status === "active" || r.status === "excluded") && meta && (
                        <StatusBadge status={meta.status} label={meta.label} />
                      )}
                      {r.status === "pending" && (
                        <div className="flex flex-wrap gap-1">
                          {reasons.map((rsn) => (
                            <Badge key={rsn} color="warning" variant="soft">
                              <AlertTriangle className="h-3 w-3" />
                              {PENDING_REASON_LABELS[rsn] ?? rsn}
                            </Badge>
                          ))}
                          {vig.label === "Sin vigencia" && !reasons.includes("no_dates") && (
                            <Badge color="warning" variant="soft">
                              <AlertTriangle className="h-3 w-3" />
                              Sin vigencia
                            </Badge>
                          )}
                        </div>
                      )}
                      {r.status === "requires_review" && (
                        <div className="flex flex-wrap gap-1">
                          {r.product_id && r.products?.status !== "active" && (
                            <Badge color="error" variant="soft">
                              <XCircle className="h-3 w-3" />
                              SKU inactivo
                            </Badge>
                          )}
                          {vig.color === "error" && (
                            <Badge color="error" variant="soft">
                              <XCircle className="h-3 w-3" />
                              Vigencia vencida
                            </Badge>
                          )}
                        </div>
                      )}
                      {isExcluded && r.exclusion_reason && (
                        <div className="text-xs text-muted-foreground line-clamp-2">
                          {r.exclusion_reason}
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

      <LineEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        agreementId={agreementId}
        agreementName={agreement?.name as string | undefined}
        clientName={clientName}
        agreementStartDate={agreement.start_date as string | null | undefined}
        agreementEndDate={agreement.end_date as string | null | undefined}
        initial={editInitial}
      />

      <AgreementImportWizard
        open={importOpen}
        onOpenChange={setImportOpen}
        agreementId={agreementId}
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
            <AlertDialogTitle>Excluir posición</AlertDialogTitle>
            <AlertDialogDescription>
              La posición queda fuera del acuerdo pero conserva su historial. Puedes
              reactivarla después si fue un error.
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
    </div>
  );
}
