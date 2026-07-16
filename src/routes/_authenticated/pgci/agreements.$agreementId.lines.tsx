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
  Trash2,
  RotateCcw,
  Download,
  Upload,
  X,
  XCircle,
  Info,
  Link2,
  Unlink,
  Eye,
  Layers,
  Send,
  AlertTriangle,
  AlertCircle,
  Archive,
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
  DataTable,
  IdentityCell,
  type DataTableColumn,
  type RowAction,
} from "@/components/sumatec";
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
  deleteAgreementLine,
  reactivateAgreementLine,
  listAgreementSkuGroups,
  listAgreementCompanies,
  listClientCatalogPermissions,
  linkSkuPrice,
  unlinkSkuPrice,
  publishAgreementPositions,
  type LineCode,
} from "@/lib/agreements.functions";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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

type LineCardKey =
  | "all"
  | "active"
  | "requires_review"
  | "draft"
  | "expired"
  | "excluded";

const STATUS_META: Record<
  Exclude<LineCardKey, "all">,
  { label: string; status: StatusBadgeStatus }
> = {
  active: { label: "Activa", status: "active" },
  requires_review: { label: "Revisar", status: "danger" },
  draft: { label: "En gestión", status: "neutral" },
  expired: { label: "Vencida", status: "danger" },
  excluded: { label: "Excluida", status: "neutral" },
};

function parseLocalDate(iso: string | null): Date | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function coversTodayOf(
  lineEnd: string | null,
  agreementEnd: string | null,
): boolean {
  const end = parseLocalDate(lineEnd ?? agreementEnd ?? null);
  if (!end) return true;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return end.getTime() >= today.getTime();
}
const fmtMoney = (v: number | null) => formatMoneyCOP(v);


type VigenciaBadge = {
  color: "info" | "warning" | "error" | "neutral";
  label: string;
};

function vigenciaBadge(
  lineEnd: string | null,
  agreementEnd: string | null,
): VigenciaBadge {
  const end = parseLocalDate(lineEnd ?? agreementEnd ?? null);
  if (!end) return { color: "neutral", label: "Sin vigencia" };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((end.getTime() - today.getTime()) / 86_400_000);
  const dd = String(end.getDate()).padStart(2, "0");
  const mm = String(end.getMonth() + 1).padStart(2, "0");
  const label = `${dd}/${mm}/${end.getFullYear()}`;
  if (diffDays < 0) return { color: "error", label };
  if (diffDays <= 30) return { color: "warning", label };
  return { color: "info", label };
}

function fmtDMY(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

type VigenciaTone = "ok" | "warning" | "expired" | "none";

function vigenciaTone(
  lineEnd: string | null,
  agreementEnd: string | null,
): { tone: VigenciaTone; diffDays: number | null } {
  const end = parseLocalDate(lineEnd ?? agreementEnd ?? null);
  if (!end) return { tone: "none", diffDays: null };
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((end.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return { tone: "expired", diffDays };
  if (diffDays <= 30) return { tone: "warning", diffDays };
  return { tone: "ok", diffDays };
}

function VigenciaCell({
  lineStart,
  lineEnd,
  agreementStart,
  agreementEnd,
}: {
  lineStart: string | null;
  lineEnd: string | null;
  agreementStart: string | null;
  agreementEnd: string | null;
}) {
  const startDate = parseLocalDate(lineStart ?? agreementStart ?? null);
  const endDate = parseLocalDate(lineEnd ?? agreementEnd ?? null);
  const { tone, diffDays } = vigenciaTone(lineEnd, agreementEnd);

  if (!startDate && !endDate) {
    return (
      <span
        className="text-text-tertiary"
        style={{ fontSize: 13 }}
        title="Sin vigencia"
      >
        —
      </span>
    );
  }

  const color =
    tone === "expired"
      ? "var(--error-strong)"
      : tone === "warning"
        ? "var(--warning-strong)"
        : "var(--text-primary)";

  const Icon =
    tone === "expired" ? AlertCircle : tone === "warning" ? AlertTriangle : null;

  const iconTitle =
    tone === "expired" && diffDays !== null
      ? `Vencida hace ${Math.abs(diffDays)} día${Math.abs(diffDays) === 1 ? "" : "s"}`
      : tone === "warning" && diffDays !== null
        ? diffDays === 0
          ? "Vence hoy"
          : `Vence en ${diffDays} día${diffDays === 1 ? "" : "s"}`
        : undefined;

  return (
    <div
      className="flex flex-col items-start"
      style={{ color, lineHeight: 1.25, gap: Icon ? 3 : 1 }}
    >
      {Icon && (
        <Icon
          size={14}
          strokeWidth={2.25}
          aria-hidden="true"
          style={{ flexShrink: 0 }}
        >
          {iconTitle ? <title>{iconTitle}</title> : null}
        </Icon>
      )}
      <div className="flex flex-col" style={{ gap: 1 }}>
        <div style={{ fontSize: 11 }}>
          <span className="text-text-tertiary">Desde: </span>
          <span className="tabular-nums" style={{ fontSize: 12 }}>
            {startDate ? fmtDMY(startDate) : "—"}
          </span>
        </div>
        <div style={{ fontSize: 11 }}>
          <span className="text-text-tertiary">Hasta: </span>
          <span
            className="tabular-nums"
            style={{
              fontSize: 12,
              textDecoration: tone === "expired" ? "line-through" : undefined,
            }}
          >
            {endDate ? fmtDMY(endDate) : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

function AgreementLinesPage() {
  const { agreementId } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getAgreement);
  const ctxFn = useServerFn(getAgreementContext);
  const linesFn = useServerFn(listAgreementLines);
  const excludeFn = useServerFn(excludeAgreementLine);
  const deleteFn = useServerFn(deleteAgreementLine);
  const reactivateFn = useServerFn(reactivateAgreementLine);
  
  const skuGroupsFn = useServerFn(listAgreementSkuGroups);
  const linkFn = useServerFn(linkSkuPrice);
  const unlinkFn = useServerFn(unlinkSkuPrice);
  const publishFn = useServerFn(publishAgreementPositions);
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
  const [viewOpen, setViewOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<LineViewData | null>(null);
  const [excludeTarget, setExcludeTarget] = useState<{
    id: string;
    sku: string | null;
    description: string | null;
    codes: LineCode[];
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    sku: string | null;
    description: string | null;
  } | null>(null);
  const [reason, setReason] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);
  const [showClientCol, setShowClientCol] = useState(false);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem("pgci.lines.showClientCol");
      if (v === "1") setShowClientCol(true);
      else if (v === "0") setShowClientCol(false);
    } catch {}
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(
        "pgci.lines.showClientCol",
        showClientCol ? "1" : "0",
      );
    } catch {}
  }, [showClientCol]);

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

  const deletePosition = useMutation({
    mutationFn: (lineId: string) => deleteFn({ data: { line_id: lineId } }),
    onSuccess: () => {
      toast.success("Posición eliminada");
      invalidateAll();
      setDeleteTarget(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });


  type Line = NonNullable<typeof lines>[number] & {
    products?: {
      sku?: string | null;
      erp_description?: string | null;
      commercial_brand?: string | null;
      status?: string | null;
    } | null;
  };


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

  const REASON_LABELS: Record<string, string> = {
    no_sku: "sin SKU",
    no_price: "sin precio",
    no_dates: "sin fechas",
    expired: "vencida",
    estado_no_publicable: "estado no publicable",
    sin_permiso: "sin permiso",
    no_encontrada: "no encontrada",
  };
  const humanReason = (raw: string | null): string => {
    if (!raw) return "no cumplía";
    return raw
      .split(",")
      .map((p) => REASON_LABELS[p.trim()] ?? p.trim())
      .join(" · ");
  };

  const publishMut = useMutation({
    mutationFn: (ids: string[]) => publishFn({ data: { ids } }),
    onSuccess: (res) => {
      const published = res.published ?? 0;
      const notPub = res.not_publishable ?? 0;
      const skipped = res.skipped ?? 0;
      if (published > 0) {
        toast.success(
          `${published} ${published === 1 ? "posición publicada" : "posiciones publicadas"}`,
        );
      }
      if (notPub + skipped > 0) {
        const notList = (res.details ?? [])
          .filter((d) => d.result !== "publicada")
          .map((d) => humanReason(d.reason));
        const counts = new Map<string, number>();
        for (const r of notList) counts.set(r, (counts.get(r) ?? 0) + 1);
        const detail = Array.from(counts.entries())
          .map(([k, v]) => `${v} ${k}`)
          .join(", ");
        toast.info(
          `${notPub + skipped} ${notPub + skipped === 1 ? "no se publicó" : "no se publicaron"}: ${detail}`,
        );
      }
      setSelectedIds(new Set());
      setConfirmPublishOpen(false);
      invalidateAll();
    },
    onError: (e: Error) => toast.error(e.message),
  });



  const openEditForLine = (lineId: string) => {
    const r = (lines ?? []).find((x) => x.id === lineId) as Line | undefined;
    if (!r) return;
    setEditInitial({
      line_id: r.id as string,
      kind: "position",
      status: r.status as LineEditValues["status"],
      pending_reason: r.pending_reason ?? null,
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

  const openViewForLine = (lineId: string) => {
    const r = (lines ?? []).find((x) => x.id === lineId) as Line | undefined;
    if (!r) return;
    setViewTarget({
      id: r.id as string,
      kind: "position",
      status: r.status as LineViewData["status"],
      sku: r.products?.sku ?? null,
      erp_description: r.products?.erp_description ?? null,
      commercial_brand: r.products?.commercial_brand ?? null,
      product_status: r.products?.status ?? null,
      sale_price: (r.sale_price as number | null) ?? null,
      par_price: (r.par_price as number | null) ?? null,
      start_date: (r.start_date as string | null) ?? null,
      end_date: (r.end_date as string | null) ?? null,
      observations: (r.observations as string | null) ?? null,
      exclusion_reason: (r.exclusion_reason as string | null) ?? null,
      codes: (r.codes ?? []).map((c) => ({
        client_id: c.client_id,
        client_name: c.client_name ?? null,
        client_code: c.client_code,
        description: c.description ?? null,
      })),
      created_at: (r.created_at as string | null) ?? null,
      updated_at: (r.updated_at as string | null) ?? null,
    });
    setViewOpen(true);
  };

  const filtered = useMemo<Line[]>(() => {
    const rows = (lines ?? []) as Line[];
    const term = q.trim().toLowerCase();
    const agreementEnd = (agreement?.end_date as string | null) ?? null;
    return rows.filter((r) => {
      const rowEnd = (r.end_date as string | null) ?? null;
      const covers = coversTodayOf(rowEnd, agreementEnd);
      switch (activeCard) {
        case "all":
          if (r.status === "archived") return false;
          break;
        case "active":
          if (r.status !== "active" || !covers) return false;
          break;
        case "requires_review":
          if (r.status !== "requires_review") return false;
          break;
        case "draft":
          if (r.status !== "draft") return false;
          break;
        case "excluded":
          if (r.status !== "excluded") return false;
          break;
      }
      if (skuConflictOnly) {
        if (!repeatedPositionIds.has(r.id as string)) return false;
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
  }, [lines, activeCard, q, skuConflictOnly, repeatedPositionIds, agreement?.end_date]);

  // Publicables en la vista filtrada actual. Un checkbox por fila se habilita
  // solo si isPublishable(row) — todos los ids en publishableInView pasan el gate.
  const hasReasonToken = (r: Line, token: string): boolean => {
    const raw = (r.pending_reason ?? "").trim();
    if (!raw) return false;
    return raw.split(",").map((t) => t.trim()).includes(token);
  };
  const isPublishable = (r: Line): boolean => {
    if (r.status !== "draft" && r.status !== "requires_review") return false;
    if (!r.product_id) return false;
    if ((r.products?.status ?? null) !== "active") return false;
    if (hasReasonToken(r, "sku_conflict")) return false;
    const sale = typeof r.sale_price === "number" ? r.sale_price : null;
    if (sale == null || sale <= 0) return false;
    if (!r.start_date) return false;
    return coversTodayOf(
      (r.end_date as string | null) ?? null,
      (agreement?.end_date as string | null) ?? null,
    );
  };


  const publishableInView = useMemo<string[]>(
    () =>
      filtered
        .filter((r) => isPublishable(r))
        .map((r) => r.id as string),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, agreement?.end_date],
  );

  // Reconciliar selectedIds ∩ publishableInView cuando cambia filtro/búsqueda.
  // Preserva selección entre draft↔requires_review mientras sigan publicables.
  useEffect(() => {
    const allowed = new Set(publishableInView);
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (allowed.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [publishableInView]);




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
      agreementEndDate: (agreement?.end_date as string | null) ?? null,
    });
  };

  if (loadingAgreement || !agreement) {
    return <div className="text-sm text-muted-foreground">Cargando…</div>;
  }

  const canAdmin = !!ctx?.can_admin;
  const num = (v: unknown): number => (typeof v === "number" ? v : 0);
  const summaryCards: { key: Exclude<LineCardKey, "all">; label: string; value: number }[] = [
    { key: "active", label: "Posiciones activas", value: num(agreement.lines_active) },
    { key: "requires_review", label: "Requieren revisión", value: num(agreement.lines_review) },
    { key: "draft", label: "En gestión", value: num(agreement.lines_draft) },
    { key: "excluded", label: "Excluidas", value: num(agreement.lines_excluded) },
  ];
  const totalCount = summaryCards.reduce((s, c) => s + c.value, 0);

  // Selección masiva SOLO cuando el filtro está en "En gestión" o "Revisar".
  // Fuera de esos filtros, la tabla se ve igual que hoy: sin columna ni franja.
  const selectionMode =
    canAdmin && (activeCard === "draft" || activeCard === "requires_review");
  const selectedPublishable = publishableInView.filter((id) =>
    selectedIds.has(id),
  );
  const masterState: "empty" | "indeterminate" | "checked" =
    publishableInView.length === 0
      ? "empty"
      : selectedPublishable.length === 0
        ? "empty"
        : selectedPublishable.length === publishableInView.length
          ? "checked"
          : "indeterminate";
  const toggleMaster = () => {
    setSelectedIds((prev) => {
      if (masterState === "checked") {
        // Deseleccionar solo las de la vista actual; preserva otras si hubiera.
        const next = new Set(prev);
        for (const id of publishableInView) next.delete(id);
        return next;
      }
      // empty o indeterminate → seleccionar todas las publicables de la vista.
      const next = new Set(prev);
      for (const id of publishableInView) next.add(id);
      return next;
    });
  };
  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const rowDisabledReason = (r: Line): string => {
    if (r.status === "excluded") return "Excluida";
    if (r.status === "archived") return "Archivada";
    if (r.status === "active") {
      const covers = coversTodayOf(
        (r.end_date as string | null) ?? null,
        (agreement.end_date as string | null) ?? null,
      );
      return covers ? "Ya activa" : "Vencida";
    }
    // draft o requires_review pero incompleta
    if (!r.product_id) return "Incompleta: sin SKU";
    if ((r.sale_price ?? 0) <= 0) return "Incompleta: sin precio";
    if (!r.start_date) return "Incompleta: sin fecha de inicio";
    const covers = coversTodayOf(
      (r.end_date as string | null) ?? null,
      (agreement.end_date as string | null) ?? null,
    );
    if (!covers) return "Vencida";
    return "No publicable";
  };


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
                  <div className="suma-body text-text-tertiary">{c.label}</div>
                  <div className="mt-1 suma-metric">
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
        <div className="flex shrink-0 items-center gap-2">
          <Switch
            id="toggle-client-col"
            checked={showClientCol}
            onCheckedChange={setShowClientCol}
            aria-label="Mostrar columna de cliente"
          />
          <Label
            htmlFor="toggle-client-col"
            className="suma-body cursor-pointer text-text-tertiary"
          >
            Ver cliente
          </Label>
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
          <p className="suma-body text-text-secondary">
            {`${filtered.length} de ${totalCount} ${totalCount === 1 ? "posición" : "posiciones"}`}
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

      {selectionMode && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2">
            <Checkbox
              id="publish-master"
              aria-label="Seleccionar todas las publicables"
              className="data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground"
              checked={
                masterState === "checked"
                  ? true
                  : masterState === "indeterminate"
                    ? "indeterminate"
                    : false
              }
              disabled={publishableInView.length === 0 || publishMut.isPending}
              onCheckedChange={() => toggleMaster()}
            />
            <label htmlFor="publish-master" className="suma-body text-text-secondary">
              <span className="text-text-primary font-medium">{publishableInView.length}</span>{" "}
              {publishableInView.length === 1
                ? "lista para publicar"
                : "listas para publicar"}
              {selectedPublishable.length > 0 && (
                <span className="ml-1 text-text-tertiary">
                  · {selectedPublishable.length}{" "}
                  {selectedPublishable.length === 1
                    ? "seleccionada"
                    : "seleccionadas"}
                </span>
              )}
            </label>

          </div>
          <div className="ml-auto">
            <Button
              size="sm"
              onClick={() => setConfirmPublishOpen(true)}
              disabled={selectedPublishable.length === 0 || publishMut.isPending}
            >
              <Send className="mr-1.5 h-4 w-4" />
              Publicar en acuerdo
            </Button>
          </div>
        </div>
      )}

      {(() => {
        const skuGroupBadge = (r: Line) => {
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
        };

        const clientColumn: DataTableColumn<Line> = {
            id: "client",
            header: (() => {
              if (visibleClients.length <= 1) {
                const only = visibleClients[0];
                return (
                  <span className="text-text-primary font-medium">
                    {only?.name?.trim() || "Cliente"}
                  </span>
                );
              }
              const current = visibleClients.find((c) => c.id === projectionClientId);
              return (
                <Select
                  value={projectionClientId ?? undefined}
                  onValueChange={(v) => setProjectionClientId(v)}
                >
                  <SelectTrigger
                    aria-label="Cambiar cliente"
                    className="h-auto w-auto gap-1.5 border-0 bg-transparent p-0 text-text-primary font-medium shadow-none hover:text-text-primary focus:ring-0 focus-visible:ring-0 [&>svg:last-child]:h-3.5 [&>svg:last-child]:w-3.5 [&>svg:last-child]:text-text-tertiary [&>svg:last-child]:opacity-100"
                  >
                    <span className="truncate">
                      {current?.name?.trim() || "Cliente…"}
                    </span>
                  </SelectTrigger>
                  <SelectContent align="start">
                    {visibleClients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name?.trim() || "Sin nombre"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            })(),
            cell: (r) => {
              const codes = r.codes ?? [];
              const projected = projectionClientId
                ? codes.find((c) => c.client_id === projectionClientId)
                : codes[0];
              if (!projected) {
                return <span className="font-mono text-text-tertiary">—</span>;
              }
              return (
                <IdentityCell
                  code={projected.client_code}
                  description={projected.description ?? "—"}
                />
              );
            },
          };

        const columns: DataTableColumn<Line>[] = [
          ...(showClientCol ? [clientColumn] : []),
          {
            id: "jaivana",
            header: "Jaivaná",
            cell: (r) => (
              <IdentityCell
                code={r.products?.sku ?? "—"}
                description={r.products?.erp_description ?? "—"}
                trailing={skuGroupBadge(r)}
              />
            ),
          },
          {
            id: "brand",
            header: "Marca",
            width: 140,
            cell: (r) => r.products?.commercial_brand ?? "—",
          },
          {
            id: "price",
            header: "Precio",
            width: 110,
            numeric: true,
            wrap: false,
            cell: (r) => (
              <div>
                <div className="text-text-primary">{fmtMoney(r.sale_price ?? null)}</div>
                {r.par_price != null && r.par_price > 0 && (
                  <div className="text-[11.5px] text-text-tertiary">
                    par {fmtMoney(r.par_price)}
                  </div>
                )}
              </div>
            ),
          },
          {
            id: "vigencia",
            header: "Vigencia",
            width: 140,
            wrap: false,
            cell: (r) => (
              <VigenciaCell
                lineStart={(r.start_date as string | null) ?? null}
                lineEnd={(r.end_date as string | null) ?? null}
                agreementStart={(agreement.start_date as string | null) ?? null}
                agreementEnd={(agreement.end_date as string | null) ?? null}
              />
            ),
          },
          {
            id: "status",
            header: "Estado",
            width: 170,
            wrap: true,
            cell: (r) => {
              const covers = coversTodayOf(
                (r.end_date as string | null) ?? null,
                (agreement.end_date as string | null) ?? null,
              );
              const badgeKey: Exclude<LineCardKey, "all"> | null =
                r.status === "active"
                  ? covers ? "active" : "expired"
                  : r.status === "draft"
                    ? "draft"
                    : r.status === "excluded"
                      ? "excluded"
                      : r.status === "requires_review"
                        ? "requires_review"
                        : null;
              const meta = badgeKey ? STATUS_META[badgeKey] : null;
              const reasonTokens = (r.pending_reason ?? "")
                .split(",")
                .map((t) => t.trim())
                .filter((t) => t.length > 0);
              const REASON_LABEL: Record<string, string> = {
                no_sku: "Sin SKU",
                no_price: "Sin precio",
                no_dates: "Sin vigencia",
                expired: "Vigencia vencida",
                sku_inactive: "SKU inactivo",
                sku_conflict: "En conflicto",
              };
              const readyToPublish =
                reasonTokens.length === 0 &&
                (r.status === "draft" || r.status === "requires_review");
              const showStatusBadge =
                meta && !(readyToPublish && r.status === "requires_review");
              return (
                <div className="flex flex-col items-start gap-1">
                  {showStatusBadge && (
                    <StatusBadge
                      status={meta!.status}
                      label={meta!.label}
                      icon={badgeKey === "draft" ? Pencil : undefined}
                    />
                  )}
                  {readyToPublish && (
                    <StatusBadge status="active" label="OK para publicar" />
                  )}
                  {reasonTokens.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {reasonTokens.map((tok) => (
                        <Badge key={tok} color="error" variant="soft">
                          <XCircle className="h-3 w-3" />
                          {REASON_LABEL[tok] ?? tok}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              );

            },
          },
        ];



        const rowActions = (r: Line): RowAction<Line>[] => {
          const isExcluded = r.status === "excluded";
          const actions: RowAction<Line>[] = [
            {
              label: "Ver detalle",
              icon: <Eye className="h-4 w-4" />,
              onSelect: () => openViewForLine(r.id as string),
            },
          ];
          if (canAdmin) {
            if (isExcluded) {
              actions.push({
                label: "Reactivar",
                icon: <RotateCcw className="h-4 w-4" />,
                onSelect: () => reactivate.mutate(r.id as string),
              });
            } else {
              const isDraft = r.status === "draft";
              actions.push({
                label: "Editar",
                icon: <Pencil className="h-4 w-4" />,
                onSelect: () => openEditForLine(r.id as string),
              });
              if (isDraft) {
                actions.push({
                  label: "Eliminar",
                  icon: <Trash2 className="h-4 w-4" />,
                  destructive: true,
                  onSelect: () =>
                    setDeleteTarget({
                      id: r.id as string,
                      sku: r.products?.sku ?? null,
                      description: r.products?.erp_description ?? null,
                    }),
                });
              } else {
                actions.push({
                  label: "Excluir",
                  icon: <Ban className="h-4 w-4" />,
                  destructive: true,
                  onSelect: () =>
                    setExcludeTarget({
                      id: r.id as string,
                      sku: r.products?.sku ?? null,
                      description: r.products?.erp_description ?? null,
                      codes: r.codes ?? [],
                    }),
                });
              }
            }
          }
          return actions;
        };

        return (
          <DataTable<Line>
            data={filtered}
            columns={columns}
            getRowId={(r) => r.id as string}
            loading={loadingLines}
            onRowClick={(r) => openViewForLine(r.id as string)}
            rowActions={rowActions}
            empty={{
              icon: <Search className="h-5 w-5" />,
              title: "Sin posiciones",
              description: "No hay posiciones con esos filtros.",
            }}
            selection={
              selectionMode
                ? {
                    getRowId: (r) => r.id as string,
                    selectedIds,
                    onToggleRow: (r) => toggleRow(r.id as string),
                    onToggleAll: toggleMaster,
                    masterState,
                    masterDisabled:
                      publishableInView.length === 0 || publishMut.isPending,
                    isRowSelectable: (r) => isPublishable(r),
                    rowDisabledReason: (r) => rowDisabledReason(r),
                    ariaLabel: "Seleccionar posición",
                  }
                : undefined
            }
          />
        );
      })()}




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

      <LineViewDialog
        open={viewOpen}
        onOpenChange={setViewOpen}
        line={viewTarget}
        agreementName={agreement?.name as string | undefined}
        agreementEndDate={agreement.end_date as string | null | undefined}
        canEdit={canAdmin}
        onEdit={(lineId) => openEditForLine(lineId)}
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
            <AlertDialogTitle className="suma-h4 text-text-primary">
              Excluir posición del acuerdo
            </AlertDialogTitle>
            <AlertDialogDescription className="suma-body text-text-secondary">
              Sale del acuerdo conservando su información comercial y sus relaciones con códigos de cliente. Puedes reactivarla si vuelve a ser necesaria.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {excludeTarget ? (
            <div className="space-y-3 rounded-md border bg-muted/40 p-3">
              <div className="space-y-1">
                <Label className="suma-overline">SUMATEC</Label>
                <IdentityCell
                  code={excludeTarget.sku ?? "—"}
                  description={excludeTarget.description ?? undefined}
                />
              </div>

              {excludeTarget.codes.length > 0 && (
                <>
                  <hr className="border-border" />
                  <div className="space-y-3">
                    {excludeTarget.codes.map((c) => (
                      <div key={c.client_id} className="space-y-1">
                        <Label className="suma-overline">
                          {c.client_name?.trim() || "Cliente sin nombre"}
                        </Label>
                        <IdentityCell
                          code={c.client_code}
                          description={c.description ?? undefined}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : null}
          <div className="space-y-1.5">
            <Label className="suma-label">Motivo de exclusión</Label>
            <Textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej. Producto descontinuado por el cliente"
            />
            <p className="suma-caption">
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
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o && !deletePosition.isPending) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar posición en gestión</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará este registro en gestión. Los códigos de cliente que
              hayas creado se conservan en el catálogo.
              {deleteTarget?.sku ? (
                <span className="mt-2 block text-text-primary">
                  SKU: <strong>{deleteTarget.sku}</strong>
                  {deleteTarget.description ? ` — ${deleteTarget.description}` : ""}
                </span>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePosition.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deletePosition.mutate(deleteTarget.id);
              }}
              disabled={deletePosition.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>



      <AlertDialog
        open={confirmPublishOpen}
        onOpenChange={(o) => {
          if (!publishMut.isPending) setConfirmPublishOpen(o);
        }}
      >
        <AlertDialogContent className="max-w-lg p-0 gap-0 overflow-hidden">
          <AlertDialogHeader className="px-6 py-4 border-b border-border text-left space-y-1">
            <AlertDialogTitle className="text-2xl font-bold tracking-tight">
              Publicar {selectedPublishable.length}{" "}
              {selectedPublishable.length === 1 ? "posición" : "posiciones"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground">
              {agreement.name as string}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 py-5 text-sm leading-relaxed text-foreground">
            {selectedPublishable.length === 1 ? "Esta" : "Estas"}{" "}
            <span className="font-semibold">{selectedPublishable.length}</span>{" "}
            {selectedPublishable.length === 1 ? "posición pasará" : "posiciones pasarán"}{" "}
            a estado <span className="font-semibold">Activa</span>. La acción es
            inmediata y visible para los clientes asignados al acuerdo.
          </div>
          <AlertDialogFooter className="px-6 py-4 border-t border-border bg-muted/20">
            <AlertDialogCancel disabled={publishMut.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                publishMut.mutate(selectedPublishable);
              }}
              disabled={publishMut.isPending || selectedPublishable.length === 0}
            >
              {publishMut.isPending
                ? "Publicando…"
                : `Publicar ${selectedPublishable.length} ${selectedPublishable.length === 1 ? "posición" : "posiciones"}`}
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
                              }
                              // Vinculación deshabilitada — no-op para 'repeated'.
                            }}
                            actionLabel={
                              g.state === "conflict"
                                ? "Revisar"
                                : "Vincular"
                            }
                            actionType={g.state === "conflict" ? "review" : "link"}
                            actionDisabled={g.state === "repeated" || (g.state !== "conflict" && (busy || !canLink))}
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
