import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  AlertTriangle,
  XCircle,
  Trash2,
  Info,
  Link2,
  Unlink,
  Eye,
  Layers,
} from "lucide-react";
import { AgreementBreadcrumb } from "@/components/agreements/AgreementBreadcrumb";
import { AgreementHeader } from "@/components/agreements/AgreementHeader";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge, Chip, StatusBadge, SummaryToggle, type StatusBadgeStatus } from "@/components/sumatec";
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
  deleteAgreementTransitLine,
  listAgreementSkuGroups,
  listAgreementCompanies,
  listClientCatalogPermissions,
  linkSkuPrice,
  unlinkSkuPrice,
  type LineCode,
} from "@/lib/agreements.functions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { exportAgreementLines } from "@/lib/agreement-export";
import { PENDING_REASON_LABELS, type ImportPendingReason } from "@/lib/agreement-import";
import { LineEditDialog, type LineEditValues } from "@/components/agreements/LineEditDialog";
import { LineViewDialog, type LineViewData } from "@/components/agreements/LineViewDialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { formatMoneyCOP } from "@/lib/format";


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
  const deleteTransitFn = useServerFn(deleteAgreementTransitLine);
  const skuGroupsFn = useServerFn(listAgreementSkuGroups);
  const linkFn = useServerFn(linkSkuPrice);
  const unlinkFn = useServerFn(unlinkSkuPrice);
  const companiesFn = useServerFn(listAgreementCompanies);
  const catalogPermsFn = useServerFn(listClientCatalogPermissions);

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
  const { data: skuGroups } = useQuery({
    queryKey: ["agreements", "sku-groups", agreementId],
    queryFn: () => skuGroupsFn({ data: { agreement_id: agreementId } }),
  });
  const { data: companies } = useQuery({
    queryKey: ["agreements", "companies", agreementId],
    queryFn: () => companiesFn({ data: { agreement_id: agreementId } }),
  });
  const { data: catalogPerms } = useQuery({
    queryKey: ["agreements", "catalog-perms", agreementId],
    queryFn: () => catalogPermsFn({ data: { agreement_id: agreementId } }),
  });
  const agreementClients = useMemo(
    () =>
      (companies ?? []).map((c) => ({
        id: c.client_id as string,
        name: (c.client_display_name as string | null) ?? null,
      })),
    [companies],
  );
  const visibleClients = useMemo(
    () =>
      [...agreementClients].sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "", "es", { sensitivity: "base" }),
      ),
    [agreementClients],
  );


  const [activeCard, setActiveCard] = useState<LineCardKey>("all");
  const [skuModalOpen, setSkuModalOpen] = useState(false);
  const [linkingProductId, setLinkingProductId] = useState<string | null>(null);
  const [skuConflictOnly, setSkuConflictOnly] = useState(false);
  const [q, setQ] = useState("");
  const [projectionClientId, setProjectionClientId] = useState<string | null>(null);
  useEffect(() => {
    if (!projectionClientId && visibleClients[0]) {
      setProjectionClientId(visibleClients[0].id);
    }
  }, [visibleClients, projectionClientId]);

  const [editOpen, setEditOpen] = useState(false);
  const [editInitial, setEditInitial] = useState<Partial<LineEditValues> | null>(null);
  const [excludeTarget, setExcludeTarget] = useState<{
    id: string;
    sku: string | null;
    description: string | null;
    codes: LineCode[];
  } | null>(null);
  const [deleteTransitTarget, setDeleteTransitTarget] = useState<{ id: string; sku: string | null } | null>(
    null,
  );
  const [reason, setReason] = useState("");

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["agreements", "lines", agreementId] });
    qc.invalidateQueries({ queryKey: ["agreements", "detail", agreementId] });
    qc.invalidateQueries({ queryKey: ["agreements", "sku-groups", agreementId] });
  };

  const exclude = useMutation({
    mutationFn: (vars: { line_id: string; reason: string | null }) =>
      excludeFn({ data: vars }),
    onSuccess: () => {
      toast.success("Posición excluida");
      invalidateAll();
      setExcludeTarget(null);
      setReason("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reactivate = useMutation({
    mutationFn: (lineId: string) => reactivateFn({ data: { line_id: lineId } }),
    onSuccess: () => {
      toast.success("Posición reactivada");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteTransit = useMutation({
    mutationFn: (transitId: string) => deleteTransitFn({ data: { transit_id: transitId } }),
    onSuccess: () => {
      toast.success("Línea eliminada");
      invalidateAll();
      setDeleteTransitTarget(null);
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
      if (r.kind === "transit") {
        c.transit++;
      } else {
        const k = r.status as keyof typeof c;
        if (k in c) c[k]++;
      }
    }
    c.all = c.active + c.requires_review + c.excluded;
    return c;
  }, [lines]);

  // Mapa por posición → grupo SKU (para chips) y set de ids en conflicto (para filtrar).
  const groupByPositionId = useMemo(() => {
    const m = new Map<string, NonNullable<typeof skuGroups>[number]>();
    for (const g of skuGroups ?? []) {
      for (const pid of g.position_ids) m.set(pid, g);
    }
    return m;
  }, [skuGroups]);

  const repeatedPositionIds = useMemo(() => {
    const s = new Set<string>();
    for (const g of skuGroups ?? []) {
      for (const pid of g.position_ids) s.add(pid);
    }
    return s;
  }, [skuGroups]);

  const conflictGroups = useMemo(
    () => (skuGroups ?? []).filter((g) => g.state === "conflict"),
    [skuGroups],
  );
  const repeatedGroups = useMemo(
    () => (skuGroups ?? []).filter((g) => g.state === "repeated"),
    [skuGroups],
  );
  const unifiedGroups = useMemo(
    () => (skuGroups ?? []).filter((g) => g.state === "unified"),
    [skuGroups],
  );
  // "Sin vincular" = conflict + repeated. Conflictos primero.
  const unlinkedGroups = useMemo(
    () => [...conflictGroups, ...repeatedGroups],
    [conflictGroups, repeatedGroups],
  );
  const conflictGroupsCount = conflictGroups.length;
  const repeatedTotalCount =
    conflictGroups.length + repeatedGroups.length + unifiedGroups.length;

  const conflictPositionCount = useMemo(
    () => conflictGroups.reduce((sum, g) => sum + (g.position_ids.length ?? 0), 0),
    [conflictGroups],
  );
  const unlinkedPositionCount = useMemo(
    () => unlinkedGroups.reduce((sum, g) => sum + (g.position_ids.length ?? 0), 0),
    [unlinkedGroups],
  );
  const unifiedPositionCount = useMemo(
    () => unifiedGroups.reduce((sum, g) => sum + (g.position_ids.length ?? 0), 0),
    [unifiedGroups],
  );
  const repeatedPositionCount = useMemo(
    () => repeatedGroups.reduce((sum, g) => sum + (g.position_ids.length ?? 0), 0),
    [repeatedGroups],
  );




  const linkMut = useMutation({
    mutationFn: async (v: { product_id: string; price: number }) => {
      setLinkingProductId(v.product_id);
      return linkFn({
        data: { agreement_id: agreementId, product_id: v.product_id, price: v.price },
      });
    },
    onSuccess: (res) => {
      toast.success(
        `SKU vinculado. Precio aplicado a ${res.updated} ${res.updated === 1 ? "posición" : "posiciones"}.`,
      );
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setLinkingProductId(null),
  });

  const unlinkMut = useMutation({
    mutationFn: async (v: { product_id: string }) => {
      setLinkingProductId(v.product_id);
      return unlinkFn({
        data: { agreement_id: agreementId, product_id: v.product_id },
      });
    },
    onSuccess: () => {
      toast.success("SKU desvinculado. Las posiciones vuelven a tener precios independientes.");
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
    onSettled: () => setLinkingProductId(null),
  });

  const openEditForLine = (lineId: string) => {
    const r = (lines ?? []).find((x) => x.id === lineId) as Line | undefined;
    if (!r) return;
    setEditInitial({
      line_id: r.id as string,
      kind: r.kind,
      sku: r.products?.sku ?? "",
      // Estado completo declarativo: preserva todos los códigos de otros clientes.
      client_codes: (r.codes ?? []).map((c) => ({
        client_id: c.client_id,
        client_code: c.client_code,
        description: c.description ?? "",
      })),

      sale_price: r.sale_price?.toString() ?? "",
      par_price: r.par_price?.toString() ?? "",
      start_date: r.start_date ?? "",
      end_date: r.end_date ?? "",
      observations: r.observations ?? "",
    });
    setSkuModalOpen(false);
    setEditOpen(true);
  };

  const filtered = useMemo<Line[]>(() => {
    const rows = (lines ?? []) as Line[];
    const term = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (activeCard === "all") {
        if (r.kind === "transit") return false;
      } else if (activeCard === "transit") {
        if (r.kind !== "transit") return false;
      } else {
        if (r.kind === "transit" || r.status !== activeCard) return false;
      }
      if (skuConflictOnly) {
        if (r.kind === "transit" || !repeatedPositionIds.has(r.id as string)) return false;
      }
      if (!term) return true;
      const sku = r.products?.sku ?? "";
      const erp = r.products?.erp_description ?? "";
      const brand = r.products?.commercial_brand ?? "";
      const codesFlat = (r.codes ?? [])
        .flatMap((c) => [c.client_code, c.description ?? ""])
        .join(" ");
      return [sku, erp, brand, codesFlat].some((s) => s.toLowerCase().includes(term));
    });
  }, [lines, activeCard, q, skuConflictOnly, repeatedPositionIds]);


  const handleExport = () => {
    if (!lines) return;
    const data = filtered.map((r) => {
      const first = r.codes?.[0] ?? null;
      return {
        client_code: first?.client_code ?? null,
        client_description: first?.description ?? null,
        sku: r.products?.sku ?? null,
        erp_description: r.products?.erp_description ?? null,
        commercial_brand: r.products?.commercial_brand ?? null,
        sale_price: r.sale_price ?? null,
        par_price: r.par_price ?? null,
        start_date: r.start_date ?? null,
        end_date: r.end_date ?? null,
        status: r.status ?? null,
        observations: r.observations ?? null,
      };
    });
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
  const summaryCards: { key: LineCardKey; label: string; value: number }[] = [
    { key: "all", label: "Posiciones", value: counts.all },
    { key: "active", label: "Activas", value: counts.active },
    { key: "requires_review", label: "Requieren revisión", value: counts.requires_review },
    { key: "excluded", label: "Excluidas", value: counts.excluded },
    { key: "transit", label: "En tránsito", value: counts.transit },
  ];

  return (
    <div className="space-y-6">
      <AgreementBreadcrumb agreementId={agreementId} current="lines" />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <AgreementHeader agreementId={agreementId} />
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!lines?.length}>
            <Download className="mr-1.5 h-4 w-4" /> Exportar
          </Button>
          {canAdmin && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span>
                      <Button variant="outline" size="sm" disabled>
                        <Upload className="mr-1.5 h-4 w-4" /> Importar
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    Importación en mantenimiento — disponible en la próxima versión
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
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
        {visibleClients.length > 1 && (
          <Select
            value={projectionClientId ?? undefined}
            onValueChange={(v) => setProjectionClientId(v)}
          >
            <SelectTrigger className="w-[240px] shrink-0">
              <SelectValue placeholder="Cliente…" />
            </SelectTrigger>
            <SelectContent>
              {visibleClients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name?.trim() || "Sin nombre"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
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
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setSkuModalOpen(true)}
                aria-label="Códigos en múltiples posiciones"
                className="relative shrink-0"
                disabled={repeatedTotalCount === 0}
              >
                <Layers className="h-4 w-4" />
                {repeatedTotalCount > 0 && (
                  <span
                    className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold"
                    style={{
                      background: "var(--gray-800)",
                      color: "var(--text-on-brand)",
                    }}
                  >
                    {repeatedTotalCount}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {repeatedTotalCount === 0
                ? "No hay SKUs en múltiples posiciones en este acuerdo"
                : `${repeatedTotalCount} ${repeatedTotalCount === 1 ? "SKU en múltiples posiciones" : "SKUs en múltiples posiciones"} en este acuerdo`}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {skuConflictOnly && repeatedTotalCount > 0 && (
        <Alert variant="info" className="py-2">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 shrink-0" />
            <AlertTitle className="m-0">Estado de códigos en múltiples posiciones</AlertTitle>
          </div>
          <AlertDescription className="mt-1 pl-0">
                <div className="space-y-0.5 text-sm">
                  <p>
                    {conflictGroups.length} códigos en <span className="font-semibold">{conflictPositionCount}</span> posiciones no vinculadas con precios distintos
                  </p>
                  <p>
                    {repeatedGroups.length} códigos en <span className="font-semibold">{repeatedPositionCount}</span> posiciones no vinculadas / {unifiedGroups.length} códigos en <span className="font-semibold">{unifiedPositionCount}</span> posiciones vinculadas
                  </p>
                </div>
                <p className="mt-1 text-xs opacity-90">
                  Las posiciones pueden vincularse para compartir un mismo precio; las no vinculadas se gestionan de forma independiente.
                </p>
              </AlertDescription>
        </Alert>
      )}



      {(activeCard !== "all" || q.trim() || skuConflictOnly) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="text-sm text-muted-foreground">
            {activeCard === "transit"
              ? `${filtered.length} ${filtered.length === 1 ? "línea en tránsito" : "líneas en tránsito"}`
              : `${filtered.length} de ${counts.all} ${counts.all === 1 ? "posición" : "posiciones"}`}
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
            {skuConflictOnly && (
              <Chip
                size="small"
                variant="soft"
                color="neutral"
                onRemove={() => setSkuConflictOnly(false)}
              >
                SKUs en múltiples posiciones
              </Chip>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveCard("all");
              setQ("");
              setSkuConflictOnly(false);
            }}
            className="text-sm font-medium text-primary hover:underline"
          >
            Limpiar filtros
          </button>

        </div>
      )}

      {!loadingLines && activeCard === "transit" && !q.trim() && filtered.length === 0 ? (
        <Alert variant="info">
          <Info className="h-4 w-4" />
          <AlertTitle>No hay información en tránsito</AlertTitle>
          <AlertDescription>
            Aquí aparecen las filas cargadas al acuerdo que aún no son posiciones porque
            les falta SKU, precio o vigencia. Cuando se completan, pasan automáticamente
            a Posiciones.
          </AlertDescription>
        </Alert>
      ) : (
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
                    {(() => {
                      const codes = r.codes ?? [];
                      // Proyección por cliente seleccionado. Nunca oculta filas.
                      const open = codes;
                      const projected =
                        projectionClientId
                          ? open.find((c) => c.client_id === projectionClientId)
                          : open[0];
                      if (projected) {
                        return (
                          <div>
                            <div className="font-mono text-sm">{projected.client_code}</div>
                            <div className="text-xs text-muted-foreground line-clamp-2">
                              {projected.description ?? "—"}
                            </div>
                          </div>
                        );
                      }
                      return <div className="font-mono text-sm">—</div>;
                    })()}

                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-sm">{r.products?.sku ?? "—"}</span>
                      {r.kind === "position" && (() => {
                        const g = groupByPositionId.get(r.id as string);
                        if (!g) return null;
                        if (g.state === "conflict") {
                          const conflictPrices = g.prices.slice().sort((a, b) => a - b);
                          const minPrice = conflictPrices[0] ?? null;
                          const maxPrice = conflictPrices[conflictPrices.length - 1] ?? null;
                          return (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    <Badge color="neutral" variant="soft">
                                      <Info className="h-3 w-3" />
                                      Precios ({new Set(g.prices).size})
                                    </Badge>
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <div className="space-y-1">
                                    <div className="font-medium">
                                      SKU en {g.position_ids.length} posiciones
                                    </div>
                                    <div>
                                      Precios no vinculados ({fmtMoney(minPrice)} – {fmtMoney(maxPrice)})
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        }
                        if (g.state === "repeated") {
                          return (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Unlink
                                    className="h-3.5 w-3.5 text-muted-foreground"
                                    aria-label="SKU repetido"
                                  />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <div className="space-y-1">
                                    <div className="font-medium">
                                      SKU en {g.position_ids.length} posiciones
                                    </div>
                                    <div>
                                      Precios no vinculados ({fmtMoney(g.prices[0] ?? null)})
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        }
                        if (g.state === "unified") {
                          return (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Link2
                                    className="h-3.5 w-3.5 text-muted-foreground"
                                    aria-label="SKU vinculado"
                                  />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-xs">
                                  <div className="space-y-1">
                                    <div className="font-medium">
                                      SKU en {g.position_ids.length} posiciones
                                    </div>
                                    <div>
                                      Precios vinculados ({fmtMoney(g.prices[0] ?? null)})
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        }
                        return null;
                      })()}
                    </div>
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
                                openEditForLine(r.id as string);
                              }}
                              aria-label="Editar"
                              title="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            {r.kind === "transit" ? (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  setDeleteTransitTarget({
                                    id: r.id as string,
                                    sku: r.products?.sku ?? null,
                                  })
                                }
                                aria-label="Eliminar"
                                title="Eliminar"
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            ) : (
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() =>
                                  setExcludeTarget({
                                    id: r.id as string,
                                    sku: r.products?.sku ?? null,
                                    description: r.products?.erp_description ?? null,
                                    codes: r.codes ?? [],
                                  })
                                }
                                aria-label="Excluir"
                                title="Excluir"
                              >
                                <Ban className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
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
      )}



      <LineEditDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        agreementId={agreementId}
        agreementName={agreement?.name as string | undefined}
        agreementStartDate={agreement.start_date as string | null | undefined}
        agreementEndDate={agreement.end_date as string | null | undefined}
        initial={editInitial}
        agreementClients={agreementClients}
        clientCatalogPermissions={catalogPerms}
        onSwitchToPosition={(positionId) => openEditForLine(positionId)}
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
            <AlertDialogTitle>Excluir posición del acuerdo</AlertDialogTitle>
            <AlertDialogDescription>
              Sale del acuerdo y conserva su información comercial y sus códigos de cliente. Puedes reactivarla si vuelve a ser necesaria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {excludeTarget ? (
            <div className="space-y-3 rounded-md border bg-muted/40 p-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  SUMATEC
                </Label>
                <div className="text-sm">
                  <span className="font-mono">{excludeTarget.sku ?? "—"}</span>
                  {excludeTarget.description ? (
                    <>
                      <span className="text-muted-foreground"> · </span>
                      <span>{excludeTarget.description}</span>
                    </>
                  ) : null}
                </div>
              </div>

              {excludeTarget.codes.length > 0 && (
                <>
                  <hr className="border-border" />
                  <div className="space-y-3">
                    {excludeTarget.codes.map((c) => (
                      <div key={c.client_id} className="space-y-1">
                        <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          {c.client_name?.trim() || "Cliente sin nombre"}
                        </Label>
                        <div className="text-sm">
                          <span className="font-mono">{c.client_code}</span>
                          {c.description ? (
                            <>
                              <span className="text-muted-foreground"> · </span>
                              <span>{c.description}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              MOTIVO DE EXCLUSIÓN
            </Label>
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Producto descontinuado por el cliente"
            />
            <p className="text-xs text-muted-foreground">
              Quedará registrado en la posición excluida.
            </p>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={exclude.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (excludeTarget)
                  exclude.mutate({
                    line_id: excludeTarget.id,
                    reason: reason.trim(),
                  });
              }}
              disabled={exclude.isPending || !reason.trim()}
            >
              Excluir posición
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteTransitTarget}
        onOpenChange={(o) => {
          if (!o) setDeleteTransitTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar línea en tránsito</AlertDialogTitle>
            <AlertDialogDescription>
              La línea en tránsito se eliminará permanentemente. Esta acción no se
              puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTransit.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (deleteTransitTarget) deleteTransit.mutate(deleteTransitTarget.id);
              }}
              disabled={deleteTransit.isPending}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={skuModalOpen} onOpenChange={setSkuModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Códigos en múltiples posiciones</DialogTitle>
            <DialogDescription>
              Códigos Jaivaná que participan en más de una posición en el acuerdo. Las posiciones pueden vincularse para compartir un mismo precio; las no vinculadas se gestionan de forma independiente.
            </DialogDescription>
          </DialogHeader>

          {repeatedTotalCount === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No hay SKUs repetidos en este acuerdo.
            </div>
          ) : (
            <div className="max-h-[60vh] space-y-6 overflow-y-auto pr-1">
              {unlinkedGroups.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">
                      Posiciones no vinculadas ({unlinkedGroups.length})
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Códigos Jaivaná presentes en más de una posición. Al no estar vinculados, el precio de cada posición se gestiona de forma independiente.
                  </p>
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <ul className="space-y-2">
                      {unlinkedGroups.map((g) => {
                        const busy = linkingProductId === g.product_id;
                        const price = g.prices[0];
                        const canLink = g.state === "repeated" && price != null;
                        return (
                          <SkuGroupCard
                            key={g.product_id}
                            group={g}
                            variant={g.state === "conflict" ? "conflict" : "repeated"}
                            defaultOpen={false}
                            canAdmin={canAdmin}
                            onAction={() => {
                              if (g.state === "conflict") {
                                openEditForLine(g.position_ids[0]);
                              } else if (canLink) {
                                linkMut.mutate({ product_id: g.product_id, price });
                              }
                            }}
                            actionLabel={
                              g.state === "conflict"
                                ? "Revisar"
                                : busy
                                  ? "Vinculando…"
                                  : "Vincular"
                            }
                            actionType={g.state === "conflict" ? "review" : "link"}
                            actionDisabled={g.state === "repeated" && (busy || !canLink)}
                            fmtMoney={fmtMoney}
                          />
                        );
                      })}
                    </ul>
                  </div>
                </section>
              )}

              {unifiedGroups.length > 0 && (
                <section className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold">
                      Posiciones vinculadas ({unifiedGroups.length})
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Códigos Jaivaná presentes en más de una posición. Al estar vinculados, cualquier cambio de precio se aplicará automáticamente a todas las posiciones.
                  </p>
                  <div className="rounded-lg border border-border bg-muted/20 p-3">
                    <ul className="space-y-2">
                      {unifiedGroups.map((g) => {
                        const busy = linkingProductId === g.product_id;
                        return (
                          <SkuGroupCard
                            key={g.product_id}
                            group={g}
                            variant="unified"
                            defaultOpen={false}
                            canAdmin={canAdmin}
                            onAction={() =>
                              unlinkMut.mutate({ product_id: g.product_id })
                            }
                            actionLabel={busy ? "Desvinculando…" : "Desvincular"}
                            actionType="unlink"
                            actionDisabled={busy}
                            fmtMoney={fmtMoney}
                          />
                        );
                      })}
                    </ul>
                  </div>
                </section>
              )}
            </div>
          )}

          <DialogFooter className="sm:justify-between">
            {conflictGroupsCount > 0 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSkuModalOpen(false);
                  setSkuConflictOnly(true);
                }}
              >
                Ver en la tabla
              </Button>
            ) : (
              <span />
            )}
            <Button type="button" variant="outline" onClick={() => setSkuModalOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SkuGroupCard({
  group,
  variant,
  defaultOpen,
  canAdmin,
  onAction,
  actionLabel,
  actionType,
  actionDisabled,
  fmtMoney,
}: {
  group: {
    product_id: string;
    sku: string | null;
    product_description: string | null;
    positions: {
      id: string;
      client_code: string | null;
      client_description: string | null;
      sale_price: number | null;
    }[];
    prices: number[];
  };
  variant: "conflict" | "repeated" | "unified";
  defaultOpen: boolean;
  canAdmin: boolean;
  onAction: () => void;
  actionLabel: string;
  actionType?: "link" | "unlink" | "review";
  actionDisabled?: boolean;
  fmtMoney: (v: number | null) => string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const count = group.positions.length;
  const distinctPrices = new Set(group.prices).size;
  const hasDistinctPrices = distinctPrices > 1;
  const summary =
    variant === "conflict"
      ? `${count} posiciones · precios: ${group.prices
          .slice()
          .sort((a, b) => a - b)
          .map((p) => fmtMoney(p))
          .join(" · ")}`
      : variant === "unified"
        ? `${count} posiciones · precio vinculado: ${fmtMoney(group.prices[0] ?? null)}`
        : `${count} posiciones · precio común: ${fmtMoney(group.prices[0] ?? null)}`;

  return (
    <li className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium">
              {group.sku ?? "—"}
            </span>
            {hasDistinctPrices && (
              <Badge color="neutral" variant="soft">
                <Info className="h-3 w-3" />
                Precios ({distinctPrices})
              </Badge>
            )}
          </div>
          {group.product_description && (
            <div className="text-sm text-text-secondary">
              {group.product_description}
            </div>
          )}
          <div className="text-xs text-muted-foreground">{summary}</div>
        </div>
        {canAdmin && (
          <Button
            size="sm"
            variant="outline"
            onClick={onAction}
            disabled={actionDisabled}
          >
            {actionType === "link" && <Link2 />}
            {actionType === "unlink" && <Unlink />}
            {actionType === "review" && <Eye />}
            {actionLabel}
          </Button>
        )}
      </div>

      <div className="mt-2">
        <SummaryToggle
          summary=""
          open={open}
          onToggle={() => setOpen((v) => !v)}
          openLabel="Ocultar posiciones"
          closedLabel="Ver posiciones"
        />
      </div>

      {open && (
        <div className="mt-2 overflow-x-auto rounded-md border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32 py-1.5 px-2 text-[11px] font-normal text-muted-foreground">
                  Código cliente
                </TableHead>
                <TableHead className="py-1.5 px-2 text-[11px] font-normal text-muted-foreground">
                  Descripción cliente
                </TableHead>
                <TableHead className="w-32 whitespace-nowrap py-1.5 px-2 text-right text-[11px] font-normal text-muted-foreground">
                  Precio actual
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.positions.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="py-1.5 px-2 font-mono text-xs text-muted-foreground">
                    {p.client_code ?? "—"}
                  </TableCell>
                  <TableCell className="py-1.5 px-2 text-xs text-muted-foreground">
                    {p.client_description ?? "—"}
                  </TableCell>
                  <TableCell className="py-1.5 px-2 text-right text-xs tabular-nums text-muted-foreground">
                    {fmtMoney(p.sale_price ?? null)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </li>
  );
}
