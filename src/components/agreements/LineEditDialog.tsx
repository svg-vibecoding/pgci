import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  Info,
  Link,
  Link2,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Search,
  Unlink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoneyCOP } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusBadge } from "@/components/sumatec/StatusBadge";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  createAgreementLine,
  updateAgreementLine,
  lookupProductBySku,
  detectNConflict,
  linkSkuPrice,
  unlinkSkuPrice,
  searchProducts,
  searchClientCodes,
  reactivateAgreementLine,
  type ClientCodeSearchResult,
} from "@/lib/agreements.functions";

export type LineEditClientCode = {
  client_id: string;
  client_code: string;
  description: string;
};

export type LineEditValues = {
  line_id?: string | null;
  // Discriminador de la fila: 'position' para posiciones normales,
  // 'transit' para líneas en tránsito. Se debe propagar tal cual a
  // update_agreement_line — de lo contrario la RPC busca la fila en la
  // tabla equivocada y responde "Posición no encontrada".
  kind?: "position" | "transit";
  sku: string;
  // Lista COMPLETA declarativa de códigos por cliente. Lo ausente se cierra.
  client_codes: LineEditClientCode[];
  sale_price: string;
  par_price: string;
  start_date: string;
  end_date: string;
  observations: string;
};

const empty: LineEditValues = {
  line_id: null,
  kind: "position",
  sku: "",
  client_codes: [],
  sale_price: "",
  par_price: "",
  start_date: "",
  end_date: "",
  observations: "",
};

type LookupKind =
  | "idle"
  | "loading"
  | "active"
  | "inactive"
  | "not_found"
  | "empty";

type ProductMeta = {
  erp_description: string | null;
  commercial_brand: string | null;
};

function fmtCatalogDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function fmtDateLocal(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

// Acepta `.` o `,` como separador decimal y opcionales separadores de miles.
function parsePriceInput(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/[^\d.,-]/g, "");
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  let decSep = "";
  if (lastComma > -1 && lastDot > -1) {
    decSep = lastComma > lastDot ? "," : ".";
  } else if (lastComma > -1) {
    decSep = ",";
  } else if (lastDot > -1) {
    decSep = ".";
  }
  if (decSep) {
    const thousandSep = decSep === "," ? "." : ",";
    s = s.split(thousandSep).join("").replace(decSep, ".");
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function formatPriceDisplay(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  const neg = n < 0;
  const [intP, decP = "00"] = Math.abs(n).toFixed(2).split(".");
  const withThousands = intP.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}${withThousands},${decP}`;
}

function normalizePriceOnBlur(raw: string): string {
  const n = parsePriceInput(raw);
  return n == null ? "" : formatPriceDisplay(n);
}

function FieldLabel({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Label
      className={cn(
        "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
        className,
      )}
    >
      {children}
    </Label>
  );
}


function SectionHeader({
  title,
  number,
}: {
  title: string;
  number: string;
}) {
  return (
    <div className="flex items-center gap-2 pb-1 border-b border-border">
      <span className="text-xs font-medium tracking-wide text-accent">
        {number}
      </span>
      <span className="text-xs font-medium uppercase tracking-wide text-text-disabled">
        {title}
      </span>
    </div>
  );
}

type ClientCard = {
  id: string;
  name: string;
  can_manage: boolean;
};

type ClientCodeEntry = { code: string; description: string };

function ClientCodeCards({
  clients,
  values,
  onChange,
  agreementId,
  initialLineId,
  onReactivated,
  onNavigateAway,
}: {
  clients: ClientCard[];
  values: Map<string, ClientCodeEntry>;
  onChange: (clientId: string, next: ClientCodeEntry) => void;
  agreementId: string;
  initialLineId: string | null;
  onReactivated: () => void;
  onNavigateAway: (positionId: string) => void;
}) {
  if (clients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Este acuerdo no tiene clientes vinculados.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {clients.map((c) => {
        const entry = values.get(c.id) ?? { code: "", description: "" };
        return (
          <ClientCodeCard
            key={c.id}
            card={c}
            entry={entry}
            agreementId={agreementId}
            initialLineId={initialLineId}
            onChange={(next) => onChange(c.id, next)}
            onReactivated={onReactivated}
            onNavigateAway={onNavigateAway}
          />
        );
      })}
    </div>
  );
}

function ClientCodeCard({
  card,
  entry,
  agreementId,
  initialLineId,
  onChange,
  onReactivated,
  onNavigateAway,
}: {
  card: ClientCard;
  entry: ClientCodeEntry;
  agreementId: string;
  initialLineId: string | null;
  onChange: (next: ClientCodeEntry) => void;
  onReactivated: () => void;
  onNavigateAway: (positionId: string) => void;
}) {
  const disabled = !card.can_manage;
  const readonlyClass = "bg-muted/50 cursor-not-allowed";

  const searchFn = useServerFn(searchClientCodes);
  const reactivateFn = useServerFn(reactivateAgreementLine);

  // Modo del card: search cuando no hay código; edit cuando sí.
  const initialHasCode = entry.code.trim() !== "";
  const [mode, setMode] = useState<"search" | "edit">(
    initialHasCode ? "edit" : "search",
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<ClientCodeSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [originalDescription, setOriginalDescription] = useState<string | null>(
    initialHasCode ? entry.description : null,
  );
  const [reactivateTarget, setReactivateTarget] = useState<
    { position_id: string; sku: string | null } | null
  >(null);
  const [viewTarget, setViewTarget] = useState<string | null>(null);
  const [reactivatePending, setReactivatePending] = useState(false);
  const seq = useRef(0);

  // Resincronizar cuando el diálogo cambia de posición (nuevo initial).
  useEffect(() => {
    const has = entry.code.trim() !== "";
    setMode(has ? "edit" : "search");
    setOriginalDescription(has ? entry.description : null);
    setIsNew(false);
    setQuery("");
    setResults([]);
    setExpandedId(null);
    setOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLineId]);

  useEffect(() => {
    if (!open || disabled) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    const s = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchFn({
          data: { agreement_id: agreementId, client_id: card.id, query: q },
        });
        if (s !== seq.current) return;
        setResults(res);
      } catch (e) {
        if (s !== seq.current) return;
        console.error("searchClientCodes failed", e);
        setResults([]);
      } finally {
        if (s === seq.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, open, disabled, agreementId, card.id, searchFn]);

  const handleSelectFree = (r: ClientCodeSearchResult) => {
    onChange({ code: r.client_code, description: r.description ?? "" });
    setOriginalDescription(r.description ?? "");
    setIsNew(false);
    setMode("edit");
    setOpen(false);
    setQuery("");
    setResults([]);
    setExpandedId(null);
  };

  const handleCreateNew = () => {
    const q = query.trim();
    if (!q) return;
    onChange({ code: q, description: "" });
    setOriginalDescription("");
    setIsNew(true);
    setMode("edit");
    setOpen(false);
    setQuery("");
    setResults([]);
    setExpandedId(null);
  };

  const handleChangeCode = () => {
    onChange({ code: "", description: "" });
    setOriginalDescription(null);
    setIsNew(false);
    setMode("search");
    setExpandedId(null);
    setOpen(true);
  };

  const doReactivate = async () => {
    if (!reactivateTarget) return;
    setReactivatePending(true);
    try {
      await reactivateFn({ data: { line_id: reactivateTarget.position_id } });
      toast.success("Posición reactivada");
      onReactivated();
      // Refrescar resultados con la nueva realidad.
      const q = query.trim();
      if (q.length >= 2) {
        const res = await searchFn({
          data: { agreement_id: agreementId, client_id: card.id, query: q },
        });
        setResults(res);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo reactivar la posición");
    } finally {
      setReactivatePending(false);
      setReactivateTarget(null);
    }
  };

  const descriptionChanged =
    mode === "edit" &&
    !isNew &&
    originalDescription !== null &&
    entry.description.trim() !== (originalDescription ?? "").trim();

  return (
    <div
      className={cn(
        "rounded-lg border border-border p-4 space-y-3",
        disabled ? "bg-muted/50" : "bg-surface-card",
      )}
    >
      <div className="flex items-center gap-2">
        {disabled && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
        <div className="text-sm font-semibold text-foreground">{card.name}</div>
      </div>

      {mode === "search" ? (
        <div className="space-y-1.5">
          <FieldLabel>Código</FieldLabel>
          <Popover open={open && !disabled} onOpenChange={(o) => !disabled && setOpen(o)}>
            <PopoverTrigger asChild>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className={cn("pl-9", disabled ? readonlyClass : "bg-white")}
                  value={query}
                  disabled={disabled}
                  placeholder="Busca por código o descripción…"
                  onFocus={() => !disabled && setOpen(true)}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                  }}
                />
                {loading && (
                  <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              sideOffset={4}
              onOpenAutoFocus={(e) => e.preventDefault()}
              className="w-[var(--radix-popover-trigger-width)] p-0"
            >
              <ClientCodeSearchList
                query={query}
                loading={loading}
                results={results}
                initialLineId={initialLineId}
                expandedId={expandedId}
                onExpand={(id) => setExpandedId((prev) => (prev === id ? null : id))}
                onSelectFree={handleSelectFree}
                onCreateNew={handleCreateNew}
                onRequestReactivate={(r) => {
                  if (r.status.kind !== "taken") return;
                  setReactivateTarget({
                    position_id: r.status.position_id,
                    sku: r.status.sku,
                  });
                  setOpen(false);
                }}
                onRequestView={(positionId) => {
                  setViewTarget(positionId);
                  setOpen(false);
                }}
                clientName={card.name}
                canManage={card.can_manage}
              />
            </PopoverContent>
          </Popover>
        </div>
      ) : (
        <>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <FieldLabel>Código</FieldLabel>
              {!disabled && (
                <button
                  type="button"
                  onClick={handleChangeCode}
                  className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                >
                  <Pencil className="h-3 w-3" />
                  Cambiar código
                </button>
              )}
            </div>
            <Input
              value={entry.code}
              disabled={disabled}
              readOnly
              tabIndex={-1}
              className={cn("font-mono", readonlyClass)}
            />
            {isNew && !disabled && (
              <p className="text-[11px] text-muted-foreground">
                Se creará en el catálogo de {card.name}.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <FieldLabel>Descripción</FieldLabel>
            <Input
              value={entry.description}
              disabled={disabled}
              className={disabled ? readonlyClass : ""}
              onChange={(e) => onChange({ ...entry, description: e.target.value })}
            />
            {descriptionChanged && !disabled && (
              <p className="text-[11px] text-muted-foreground">
                Se actualiza en el catálogo del cliente y afecta a otros acuerdos
                que usen este código.
              </p>
            )}
          </div>
        </>
      )}

      {disabled && (
        <p className="text-xs text-muted-foreground">
          Sin permiso para gestionar el catálogo de este cliente. Su código,
          si existe, se conserva sin cambios al guardar.
        </p>
      )}

      {/* AlertDialog: reactivar posición excluida */}
      <AlertDialog
        open={!!reactivateTarget}
        onOpenChange={(o) => !o && !reactivatePending && setReactivateTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reactivar posición</AlertDialogTitle>
            <AlertDialogDescription>
              La posición {reactivateTarget?.sku ? `del SKU ${reactivateTarget.sku} ` : ""}
              volverá al acuerdo tal como estaba antes de excluirse. Después
              podrás editarla normalmente. El código seguirá asignado a esa
              posición.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={reactivatePending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={reactivatePending}
              onClick={(e) => {
                e.preventDefault();
                void doReactivate();
              }}
            >
              {reactivatePending ? "Reactivando…" : "Reactivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog: ver posición (perderás cambios sin guardar) */}
      <AlertDialog
        open={!!viewTarget}
        onOpenChange={(o) => !o && setViewTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ir a la otra posición</AlertDialogTitle>
            <AlertDialogDescription>
              Se cerrará este diálogo y perderás los cambios sin guardar. ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (viewTarget) onNavigateAway(viewTarget);
                setViewTarget(null);
              }}
            >
              Ver posición
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ClientCodeSearchList({
  query,
  loading,
  results,
  initialLineId,
  expandedId,
  onExpand,
  onSelectFree,
  onCreateNew,
  onRequestReactivate,
  onRequestView,
  clientName,
  canManage,
}: {
  query: string;
  loading: boolean;
  results: ClientCodeSearchResult[];
  initialLineId: string | null;
  expandedId: string | null;
  onExpand: (id: string) => void;
  onSelectFree: (r: ClientCodeSearchResult) => void;
  onCreateNew: () => void;
  onRequestReactivate: (r: ClientCodeSearchResult) => void;
  onRequestView: (positionId: string) => void;
  clientName: string;
  canManage: boolean;
}) {
  const q = query.trim();
  const showCreate = canManage && q.length >= 2;

  if (q.length < 2) {
    return (
      <p className="px-3 py-4 text-center text-sm text-muted-foreground">
        Escribe al menos 2 caracteres para buscar.
      </p>
    );
  }

  return (
    <div className="max-h-80 overflow-y-auto py-1">
      {loading && results.length === 0 && (
        <p className="px-3 py-3 text-center text-sm text-muted-foreground">
          Buscando…
        </p>
      )}
      {!loading && results.length === 0 && (
        <p className="px-3 py-3 text-center text-sm text-muted-foreground">
          Sin coincidencias en el catálogo de {clientName}.
        </p>
      )}
      {results.map((r) => {
        const isTaken = r.status.kind === "taken";
        const isSelf =
          isTaken && r.status.kind === "taken" && r.status.position_id === initialLineId;
        const posStatus = r.status.kind === "taken" ? r.status.position_status : null;
        const expanded = expandedId === r.client_product_id;

        // Caso "esta misma posición": tratar como libre (permite volver a
        // seleccionarlo sin marcarlo como conflicto).
        if (isSelf) {
          return (
            <button
              key={r.client_product_id}
              type="button"
              onClick={() => onSelectFree(r)}
              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-muted focus:bg-muted focus:outline-none"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium text-foreground">
                  {r.client_code}
                </span>
                <StatusBadge size="sm" status="neutral" label="Asignado a esta posición" />
              </div>
              {r.description && (
                <span className="text-xs text-muted-foreground">{r.description}</span>
              )}
            </button>
          );
        }

        if (!isTaken || r.status.kind !== "taken") {
          return (
            <button
              key={r.client_product_id}
              type="button"
              onClick={() => onSelectFree(r)}
              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-muted focus:bg-muted focus:outline-none"
            >
              <span className="font-mono text-sm font-medium text-foreground">
                {r.client_code}
              </span>
              {r.description && (
                <span className="text-xs text-muted-foreground">{r.description}</span>
              )}
            </button>
          );
        }

        const takenStatus = r.status;
        const isExcluded = posStatus === "excluded";
        return (
          <div key={r.client_product_id} className="border-b border-border last:border-b-0">
            <button
              type="button"
              onClick={() => onExpand(r.client_product_id)}
              className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-muted focus:bg-muted focus:outline-none"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-medium text-muted-foreground">
                  {r.client_code}
                </span>
                <StatusBadge
                  size="sm"
                  status={isExcluded ? "neutral" : "warning"}
                  label={isExcluded ? "En posición excluida" : "En posición activa"}
                />
                <ChevronDown
                  className={cn(
                    "ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform",
                    expanded && "rotate-180",
                  )}
                />
              </div>
              {r.description && (
                <span className="text-xs text-muted-foreground">{r.description}</span>
              )}
            </button>
            {expanded && (
              <div className="mx-2 mb-2 rounded-md border border-border bg-muted/40 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium text-foreground">
                    {takenStatus.sku ?? "—"}
                  </span>
                  {takenStatus.sale_price != null && (
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatMoneyCOP(takenStatus.sale_price)}
                    </span>
                  )}
                </div>
                {takenStatus.product_description && (
                  <p className="text-xs text-muted-foreground">
                    {takenStatus.product_description}
                  </p>
                )}
                <p className="text-xs text-foreground">
                  {isExcluded
                    ? "Este código está asignado a una posición excluida del acuerdo."
                    : "Este código ya está asignado a otra posición activa del acuerdo."}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onRequestView(takenStatus.position_id)}
                  >
                    Ver posición
                  </Button>
                  {isExcluded && canManage && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => onRequestReactivate(r)}
                    >
                      Reactivar posición
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
      {showCreate && (
        <div className="border-t border-border">
          <button
            type="button"
            onClick={onCreateNew}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-primary hover:bg-muted focus:bg-muted focus:outline-none"
          >
            <Plus className="h-3.5 w-3.5" />
            Crear <span className="font-mono">"{q}"</span> en el catálogo de {clientName}
          </button>
        </div>
      )}
    </div>
  );
}

export function LineEditDialog({
  open,
  onOpenChange,
  agreementId,
  agreementName,
  clientName,
  initial,
  agreementStartDate,
  agreementEndDate,
  agreementClients,
  clientCatalogPermissions,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agreementId: string;
  agreementName?: string | null;
  clientName?: string | null;
  initial?: Partial<LineEditValues> | null;
  agreementStartDate?: string | null;
  agreementEndDate?: string | null;
  // Clientes activos del acuerdo. Una tarjeta por cliente.
  agreementClients?: Array<{ id: string; name: string | null }>;
  // Permisos can_manage_client_catalog por cliente (RPC). Sin dato = false.
  clientCatalogPermissions?: Array<{ client_id: string; can_manage: boolean }>;
}) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const createFn = useServerFn(createAgreementLine);
  const patchFn = useServerFn(updateAgreementLine);
  const lookupFn = useServerFn(lookupProductBySku);
  const conflictFn = useServerFn(detectNConflict);
  const linkFn = useServerFn(linkSkuPrice);
  const unlinkFn = useServerFn(unlinkSkuPrice);
  const searchFn = useServerFn(searchProducts);

  const [v, setV] = useState<LineEditValues>(empty);
  const [productMeta, setProductMeta] = useState<ProductMeta | null>(null);
  const [lookup, setLookup] = useState<{
    kind: LookupKind;
    catalogUpdatedAt?: string | null;
  }>({ kind: "idle" });
  const [nConflict, setNConflict] = useState<{
    kind: "idle" | "loading" | "none" | "found";
    lines: Array<{
      line_id: string;
      codes: Array<{
        client_id: string;
        client_name: string | null;
        client_code: string;
        description: string | null;
      }>;
      current_price: number | null;
      updated_at: string | null;
    }>;
  }>({ kind: "idle", lines: [] });
  const [nExpanded, setNExpanded] = useState(true);
  const [isLinked, setIsLinked] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Estado por cliente (tarjetas).
  const [codeEntries, setCodeEntries] = useState<Map<string, ClientCodeEntry>>(
    new Map(),
  );

  // Buscador de productos (combobox)
  type ProductResult = {
    id: string;
    sku: string;
    erp_description: string | null;
    commercial_brand: string | null;
    status: "active" | "inactive";
  };
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const conflictSeq = useRef(0);
  const searchSeq = useRef(0);
  const PAGE_SIZE = 20;

  // Mapa de permisos + tarjetas ordenadas.
  const permMap = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const p of clientCatalogPermissions ?? []) m.set(p.client_id, p.can_manage);
    return m;
  }, [clientCatalogPermissions]);

  const clientCards: ClientCard[] = useMemo(() => {
    const rows = (agreementClients ?? []).map((c) => ({
      id: c.id,
      name: c.name?.trim() || "Sin nombre",
      can_manage: permMap.get(c.id) ?? false,
    }));
    return rows.sort((a, b) =>
      a.name.localeCompare(b.name, "es", { sensitivity: "base" }),
    );
  }, [agreementClients, permMap]);

  // Diccionario client_id → nombre para toasts.
  const clientById = useMemo(() => {
    const m = new Map<string, { name: string }>();
    for (const c of clientCards) m.set(c.id, { name: c.name });
    return m;
  }, [clientCards]);

  const runConflict = async (sku: string, pid: string | null) => {
    const trimmed = sku.trim();
    if (!trimmed) {
      setNConflict({ kind: "idle", lines: [] });
      setIsLinked(false);
      return;
    }
    const cseq = ++conflictSeq.current;
    setNConflict({ kind: "loading", lines: [] });
    setLinkError(null);
    try {
      const res = await conflictFn({
        data: { agreement_id: agreementId, sku: trimmed },
      });
      if (cseq !== conflictSeq.current) return;
      if (pid) setProductId(pid);
      else setProductId(res.product_id ?? null);
      const linked = !!res.isLinked;
      setIsLinked(linked);
      const excludeId = initial?.line_id ?? null;
      const lines = (res.conflicts ?? []).filter((l) => l.line_id !== excludeId);
      if (lines.length === 0) {
        setNConflict({ kind: "none", lines: [] });
        return;
      }
      const sorted = [...lines].sort((a, b) => {
        const ta = a.updated_at ? Date.parse(a.updated_at) : 0;
        const tb = b.updated_at ? Date.parse(b.updated_at) : 0;
        return tb - ta;
      });
      setNConflict({ kind: "found", lines: sorted });
      setNExpanded(true);
      if (linked && !initial?.line_id) {
        const linkedPrice = sorted.find((l) => l.current_price != null)?.current_price;
        if (linkedPrice != null) {
          setV((prev) =>
            prev.sale_price.trim() === ""
              ? { ...prev, sale_price: formatPriceDisplay(linkedPrice) }
              : prev,
          );
        }
      }
    } catch (e) {
      if (cseq !== conflictSeq.current) return;
      setNConflict({ kind: "idle", lines: [] });
      setIsLinked(false);
      console.error("detectNConflict failed", e);
    }
  };

  const prefillFromSku = async (sku: string) => {
    const trimmed = sku.trim();
    if (!trimmed) return;
    try {
      const res = await lookupFn({ data: { sku: trimmed } });
      if (!res.found) {
        setProductMeta(null);
        setLookup({ kind: "not_found", catalogUpdatedAt: res.catalog_updated_at });
        return;
      }
      setProductMeta({
        erp_description: res.erp_description,
        commercial_brand: res.commercial_brand,
      });
      setLookup({
        kind: res.status === "active" ? "active" : "inactive",
        catalogUpdatedAt: res.catalog_updated_at,
      });
    } catch (e) {
      console.error("lookupProductBySku failed", e);
    }
    await runConflict(trimmed, null);
  };

  useEffect(() => {
    if (!open) return;
    const merged = { ...empty, ...(initial ?? {}) };
    const next: LineEditValues = {
      ...merged,
      client_codes: initial?.client_codes ?? [],
      sale_price: normalizePriceOnBlur(merged.sale_price),
      par_price: normalizePriceOnBlur(merged.par_price),
    };
    setV(next);
    // Hidratar tarjetas: partir de initial.client_codes y añadir placeholders
    // vacíos para los clientes del acuerdo que aún no tengan entrada.
    const m = new Map<string, ClientCodeEntry>();
    for (const c of next.client_codes) {
      m.set(c.client_id, { code: c.client_code, description: c.description });
    }
    setCodeEntries(m);
    setProductMeta(null);
    setLookup({ kind: next.sku.trim() ? "idle" : "empty" });
    setNConflict({ kind: "idle", lines: [] });
    setIsLinked(false);
    setProductId(null);
    setLinkError(null);
    setSaveError(null);
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchHasMore(false);
    if (initial?.line_id && next.sku.trim()) {
      void prefillFromSku(next.sku);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);

  // Debounce del buscador
  useEffect(() => {
    if (!searchOpen) return;
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearchHasMore(false);
      setSearchLoading(false);
      return;
    }
    const seq = ++searchSeq.current;
    setSearchLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await searchFn({ data: { query: q, offset: 0, limit: PAGE_SIZE } });
        if (seq !== searchSeq.current) return;
        setSearchResults(res.rows);
        setSearchHasMore(res.hasMore);
      } catch (e) {
        if (seq !== searchSeq.current) return;
        console.error("searchProducts failed", e);
        setSearchResults([]);
        setSearchHasMore(false);
      } finally {
        if (seq === searchSeq.current) setSearchLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery, searchOpen, searchFn]);

  const loadMoreResults = async () => {
    const q = searchQuery.trim();
    if (q.length < 2 || searchLoadingMore) return;
    const seq = searchSeq.current;
    setSearchLoadingMore(true);
    try {
      const res = await searchFn({
        data: { query: q, offset: searchResults.length, limit: PAGE_SIZE },
      });
      if (seq !== searchSeq.current) return;
      setSearchResults((prev) => [...prev, ...res.rows]);
      setSearchHasMore(res.hasMore);
    } catch (e) {
      console.error("searchProducts load more failed", e);
    } finally {
      setSearchLoadingMore(false);
    }
  };

  const onSelectProduct = (p: ProductResult) => {
    setV((prev) => ({ ...prev, sku: p.sku }));
    setProductMeta({
      erp_description: p.erp_description,
      commercial_brand: p.commercial_brand,
    });
    setProductId(p.id);
    setLookup({ kind: p.status === "active" ? "active" : "inactive" });
    setSaveError(null);
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchHasMore(false);
    void runConflict(p.sku, p.id);
  };

  const hasProduct = !!productId;

  const agreementDatesLabel = useMemo(() => {
    if (v.start_date.trim() !== "" || v.end_date.trim() !== "") return null;
    const start = fmtDateLocal(agreementStartDate);
    const end = fmtDateLocal(agreementEndDate);
    if (start && end) {
      return `Las fechas de vigencia son opcionales. Si no se indican, se heredan del acuerdo (${start} — ${end}).`;
    }
    return null;
  }, [agreementStartDate, agreementEndDate, v.start_date, v.end_date]);

  const searchPlaceholder = hasProduct
    ? "Escribe para cambiar el producto..."
    : "Busca por código, descripción o marca...";

  // Construye la lista DECLARATIVA de códigos que se envía al servidor.
  // Regla H-3: los clientes SIN can_manage cuyo código exista en `initial`
  // se reenvían tal cual — excluirlos cerraría su período por la RN declarativa
  // (pérdida silenciosa). Consecuencia aceptada: si el usuario no tiene permiso
  // sobre alguno, la RPC responde 42501 y se muestra el mensaje tal cual.
  const buildClientCodes = (): LineEditClientCode[] => {
    const originalMap = new Map<string, LineEditClientCode>();
    for (const c of v.client_codes) originalMap.set(c.client_id, c);
    const codes: LineEditClientCode[] = [];
    for (const c of clientCards) {
      if (!c.can_manage) {
        const orig = originalMap.get(c.id);
        if (orig && orig.client_code.trim()) codes.push(orig);
        continue;
      }
      const entry = codeEntries.get(c.id);
      const code = (entry?.code ?? "").trim();
      if (!code) continue;
      codes.push({
        client_id: c.id,
        client_code: code,
        description: (entry?.description ?? "").trim(),
      });
    }
    return codes;
  };

  const isEdit = !!initial?.line_id;

  const computePendingLabels = (): string[] => {
    const missing: string[] = [];
    if (!productId || v.sku.trim() === "") missing.push("SKU");
    const sale = parsePriceInput(v.sale_price);
    if (sale == null || sale <= 0) missing.push("precio");
    const hasStart = v.start_date.trim() !== "" || !!agreementStartDate;
    const hasEnd = v.end_date.trim() !== "" || !!agreementEndDate;
    if (!hasStart || !hasEnd) missing.push("vigencia");
    return missing;
  };

  const save = useMutation({
    mutationFn: async () => {
      const num = (s: string) => {
        const n = parsePriceInput(s);
        return n == null ? undefined : n;
      };
      const txt = (s: string) => (s.trim() === "" ? undefined : s.trim());
      const sale = num(v.sale_price);
      if (sale !== undefined && sale <= 0) {
        throw new Error("El precio de venta debe ser mayor a 0");
      }
      const par = num(v.par_price);
      if (par !== undefined && par <= 0) {
        throw new Error("El precio par debe ser mayor a 0");
      }
      const codes = buildClientCodes();
      if (isEdit) {
        return patchFn({
          data: {
            line_id: initial!.line_id!,
            kind: initial!.kind ?? "position",
            patch: {
              sku: txt(v.sku),
              client_codes: codes,
              sale_price: num(v.sale_price),
              par_price: num(v.par_price) || undefined,
              start_date: txt(v.start_date) ?? undefined,
              end_date: txt(v.end_date) ?? undefined,
              observations: txt(v.observations) ?? undefined,
            },
            confirm_n_conflict: true,
          },
        });
      }
      return createFn({
        data: {
          agreement_id: agreementId,
          sku: txt(v.sku) ?? undefined,
          client_codes: codes,
          sale_price: num(v.sale_price),
          par_price: num(v.par_price) || undefined,
          start_date: txt(v.start_date) ?? undefined,
          end_date: txt(v.end_date) ?? undefined,
          observations: txt(v.observations) ?? undefined,
        },
      });
    },
    onSuccess: (res) => {
      // (1) UPDATE bloqueado (RN-MATCH-01 o identity_no_codes)
      const r = res as {
        blocked?: boolean;
        block_reason?: {
          code?: string;
          conflicting_sku?: string;
          conflicting_position_id?: string;
          client_id?: string;
        } | null;
        promoted?: boolean;
        position_id?: string;
        transit_id?: string;
        line_id?: string;
        kind?: "position" | "transit";
      } | null;
      if (r && r.blocked) {
        const br = r.block_reason ?? {};
        const who = br.client_id
          ? clientById.get(br.client_id)?.name ?? "otro cliente"
          : "otro cliente";
        const sku = br.conflicting_sku ?? "<sin SKU>";
        toast.error(
          br.code === "identity_no_codes"
            ? "No se puede promover: ya existe otra posición vigente de este SKU sin códigos de cliente."
            : `No se puede guardar: el código de ${who} ya está fijado al SKU ${sku} en otra posición del acuerdo.`,
        );
        return;
      }
      // (2) Éxito — distinguir por forma de retorno
      const isCreate = !isEdit;
      const isPromotion = r?.promoted === true;
      const isPending = isCreate
        ? r?.kind === "transit"
        : !!r?.transit_id && !isPromotion;
      if (isPending) {
        const missing = computePendingLabels();
        toast.info(
          missing.length
            ? `Guardado como pendiente — falta ${missing.join(", ")}`
            : "Guardado como pendiente",
        );
      } else if (isPromotion || isCreate) {
        toast.success("Posición creada");
      } else {
        toast.success("Posición actualizada");
      }
      qc.invalidateQueries({ queryKey: ["agreements", "lines", agreementId] });
      qc.invalidateQueries({ queryKey: ["agreements", "detail", agreementId] });
      qc.invalidateQueries({ queryKey: ["agreements", "sku-groups", agreementId] });
      onOpenChange(false);
    },
    onError: (e: Error) => {
      // Sustituye UUIDs de cliente por nombre legible cuando haya match.
      const uuidRe = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
      const msg = e.message.replace(uuidRe, (m) => clientById.get(m)?.name ?? m);
      toast.error(msg);
    },
  });

  const invalidateLines = () => {
    qc.invalidateQueries({ queryKey: ["agreements", "lines", agreementId] });
    qc.invalidateQueries({ queryKey: ["agreements", "detail", agreementId] });
    qc.invalidateQueries({ queryKey: ["agreements", "sku-groups", agreementId] });
  };


  const linkMut = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error("SKU no válido para vincular");
      const price = parsePriceInput(v.sale_price);
      if (price == null) throw new Error("Ingresa un precio antes de vincular");
      if (price < 0) throw new Error("Precio inválido");
      return linkFn({
        data: { agreement_id: agreementId, product_id: productId, price },
      });
    },
    onSuccess: (res) => {
      setIsLinked(true);
      setLinkError(null);
      toast.success(
        `SKU vinculado. Precio aplicado a ${res.updated} ${res.updated === 1 ? "posición" : "posiciones"}.`,
      );
      invalidateLines();
      if (v.sku.trim()) void runConflict(v.sku, productId);
    },
    onError: (e: Error) => {
      setLinkError(e.message);
      toast.error(e.message);
    },
  });

  const unlinkMut = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error("SKU no válido para desvincular");
      return unlinkFn({
        data: { agreement_id: agreementId, product_id: productId },
      });
    },
    onSuccess: () => {
      setIsLinked(false);
      setLinkError(null);
      toast.success("SKU desvinculado.");
      invalidateLines();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const readonlyClass = "bg-muted/50 cursor-not-allowed";
  const inputClass = "";
  const catalogDateLabel = fmtCatalogDate(lookup.catalogUpdatedAt ?? null);
  const titleKind = isEdit
    ? initial?.kind === "transit"
      ? "Editar línea en tránsito"
      : "Editar posición"
    : "Nueva posición";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-6xl h-[92vh] flex flex-col overflow-hidden p-0 gap-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle className="text-2xl font-bold tracking-tight">
            {titleKind}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {agreementName && clientName
              ? `${agreementName} · ${clientName}`
              : agreementName || clientName || "Acuerdo comercial"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)]">
          {/* Columna izquierda — la posición */}
          <div className="min-h-0 overflow-y-auto bg-white border-r border-border">
            <div className="p-6 space-y-8">
              {/* Producto Jaivaná */}
              <section className="space-y-4">
                <SectionHeader title="Producto Jaivaná" number="01" />
                <div className="rounded-lg border border-input bg-muted/40 p-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5 md:col-span-2">
                    <FieldLabel>Producto Jaivaná</FieldLabel>
                    <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                      <PopoverTrigger asChild>
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            className={cn(inputClass, "pl-9 bg-white")}
                            value={searchQuery}
                            placeholder={searchPlaceholder}
                            onFocus={() => setSearchOpen(true)}
                            onChange={(e) => {
                              setSearchQuery(e.target.value);
                              setSearchOpen(true);
                              setSaveError(null);
                            }}
                          />
                          {searchLoading && (
                            <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                          )}
                        </div>
                      </PopoverTrigger>
                      <PopoverContent
                        align="start"
                        sideOffset={4}
                        onOpenAutoFocus={(e) => e.preventDefault()}
                        className="w-[var(--radix-popover-trigger-width)] p-0"
                      >
                        {searchQuery.trim().length < 2 ? (
                          <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                            Escribe al menos 2 caracteres para buscar.
                          </p>
                        ) : searchLoading && searchResults.length === 0 ? (
                          <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                            Buscando…
                          </p>
                        ) : searchResults.length === 0 ? (
                          <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                            Sin resultados en el catálogo.
                          </p>
                        ) : (
                          <div className="max-h-72 overflow-y-auto py-1">
                            {searchResults.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => onSelectProduct(p)}
                                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-muted focus:bg-muted focus:outline-none"
                              >
                                <span className="font-mono text-sm font-medium text-foreground">
                                  {p.sku}
                                </span>
                                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                  <span className="truncate">
                                    {p.erp_description ?? "—"}
                                  </span>
                                  <span aria-hidden>·</span>
                                  <span>{p.commercial_brand ?? "—"}</span>
                                  <span aria-hidden>·</span>
                                  <StatusBadge
                                    size="sm"
                                    status={p.status === "active" ? "active" : "neutral"}
                                    label={p.status === "active" ? "Activo" : "Inactivo"}
                                  />
                                </span>
                              </button>
                            ))}
                            {searchHasMore && (
                              <div className="border-t border-border p-2">
                                <button
                                  type="button"
                                  onClick={() => void loadMoreResults()}
                                  disabled={searchLoadingMore}
                                  className="flex w-full items-center justify-center gap-2 rounded-sm py-2 text-sm font-medium text-primary hover:bg-accent disabled:opacity-50"
                                >
                                  {searchLoadingMore && (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  )}
                                  Cargar más
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </PopoverContent>
                    </Popover>
                  </div>

                  {hasProduct && (
                    <>
                      <div className="space-y-1.5">
                        <FieldLabel>Código Jaivaná</FieldLabel>
                        <Input
                          value={v.sku}
                          readOnly
                          tabIndex={-1}
                          placeholder="—"
                          className={readonlyClass}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <FieldLabel>Marca</FieldLabel>
                        <Input
                          value={productMeta?.commercial_brand ?? ""}
                          readOnly
                          tabIndex={-1}
                          placeholder="—"
                          className={readonlyClass}
                        />
                      </div>
                      <div className="space-y-1.5 md:col-span-2">
                        <FieldLabel>Descripción Jaivaná</FieldLabel>
                        <Input
                          value={productMeta?.erp_description ?? ""}
                          readOnly
                          tabIndex={-1}
                          placeholder="—"
                          className={readonlyClass}
                        />
                      </div>
                    </>
                  )}

                  {lookup.kind === "inactive" && (
                    <div className="md:col-span-2">
                      <Alert variant="warning">
                        <AlertDescription>
                          Producto inactivo en el catálogo. Esta posición quedará
                          en "Revisar".
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                  {lookup.kind === "not_found" && (
                    <div className="md:col-span-2">
                      <Alert variant="error">
                        <AlertDescription>
                          Código no encontrado en el catálogo Jaivaná
                          {catalogDateLabel
                            ? ` (última actualización: ${catalogDateLabel}).`
                            : "."}
                        </AlertDescription>
                      </Alert>
                    </div>
                  )}
                  {nConflict.kind === "found" && (
                    <div className="md:col-span-2">
                      <Alert variant="warning" className="p-0 overflow-hidden">
                        <Collapsible open={nExpanded} onOpenChange={setNExpanded}>
                          <CollapsibleTrigger asChild>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-4 py-3 text-left bg-warning/10 hover:bg-warning/15 transition-colors"
                            >
                              {isLinked ? (
                                <Link2 className="h-4 w-4 shrink-0" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 shrink-0" />
                              )}
                              <span className="flex-1 text-sm font-medium">
                                {isLinked
                                  ? `Este SKU está vinculado en ${nConflict.lines.length} ${nConflict.lines.length === 1 ? "posición" : "posiciones"} del acuerdo.`
                                  : `Este SKU está asignado en ${nConflict.lines.length} ${nConflict.lines.length === 1 ? "posición" : "posiciones"} más del acuerdo.`}
                              </span>
                              <ChevronDown
                                className={cn(
                                  "h-4 w-4 shrink-0 text-[var(--status-warning-strong)] transition-transform",
                                  nExpanded && "rotate-180",
                                )}
                              />
                            </button>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                              <div className="border-t border-border px-4 py-4 space-y-3">
                                <div className="rounded-md border border-border bg-surface-card overflow-hidden">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Código cliente</TableHead>
                                        <TableHead>Descripción cliente</TableHead>
                                        <TableHead className="text-right">Precio actual</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {nConflict.lines.map((l) => {
                                        const first = l.codes[0] ?? null;
                                        return (
                                          <TableRow key={l.line_id}>
                                            <TableCell className="text-sm text-foreground">
                                              {first?.client_code ?? "—"}
                                            </TableCell>
                                            <TableCell className="text-sm text-foreground">
                                              {first?.description ?? "—"}
                                            </TableCell>
                                            <TableCell className="text-right text-sm tabular-nums text-foreground">
                                              {formatMoneyCOP(l.current_price)}
                                            </TableCell>
                                          </TableRow>
                                        );
                                      })}
                                    </TableBody>
                                  </Table>
                                </div>

                                <div className="rounded-md border border-border bg-surface-card p-4 space-y-3">
                                  {isLinked ? (
                                    <>
                                      <h4 className="text-sm font-semibold text-foreground">
                                        Posiciones vinculadas
                                      </h4>
                                      <p className="text-sm text-foreground">
                                        {`Este SKU está vinculado en ${nConflict.lines.length} ${nConflict.lines.length === 1 ? "posición" : "posiciones"} del acuerdo. Cualquier cambio de precio se aplicará automáticamente a todas.`}
                                      </p>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                                        disabled={unlinkMut.isPending || !productId}
                                        onClick={() => unlinkMut.mutate()}
                                      >
                                        {unlinkMut.isPending ? (
                                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Unlink className="mr-2 h-3.5 w-3.5" />
                                        )}
                                        Desvincular
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <h4 className="text-sm font-semibold text-foreground">
                                        Posiciones no vinculadas
                                      </h4>
                                      <p className="text-sm text-foreground">
                                        {`Este SKU está asignado en ${nConflict.lines.length} ${nConflict.lines.length === 1 ? "posición" : "posiciones"} más del acuerdo. Si las vinculas, compartirán el mismo precio y se actualizarán juntas automáticamente en cada cambio de precio.`}
                                      </p>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                                        disabled={linkMut.isPending || !productId}
                                        onClick={() => linkMut.mutate()}
                                      >
                                        {linkMut.isPending ? (
                                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                        ) : (
                                          <Link className="mr-2 h-3.5 w-3.5" />
                                        )}
                                        Vincular
                                      </Button>
                                      {linkError && (
                                        <p className="text-xs font-medium text-destructive">
                                          {linkError}
                                        </p>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                            </CollapsibleContent>
                          </Collapsible>
                        </Alert>
                    </div>
                  )}
                  </div>
                </div>
              </section>

              {/* Condiciones comerciales — SIN gating por hasProduct */}
              <section className="space-y-4">
                <SectionHeader title="Condiciones comerciales" number="02" />
                {agreementDatesLabel && (
                  <Alert variant="info">
                    <AlertDescription>{agreementDatesLabel}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <FieldLabel>Precio de venta</FieldLabel>
                      <Input
                        className={inputClass}
                        inputMode="decimal"
                        value={v.sale_price}
                        onChange={(e) => setV({ ...v, sale_price: e.target.value })}
                        onBlur={(e) =>
                          setV((prev) => ({
                            ...prev,
                            sale_price: normalizePriceOnBlur(e.target.value),
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Precio par</FieldLabel>
                      <Input
                        className={inputClass}
                        inputMode="decimal"
                        value={v.par_price}
                        onChange={(e) => setV({ ...v, par_price: e.target.value })}
                        onBlur={(e) =>
                          setV((prev) => ({
                            ...prev,
                            par_price: normalizePriceOnBlur(e.target.value),
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <FieldLabel>Fecha inicio</FieldLabel>
                      <div className="relative">
                        <Input
                          className={cn(
                            inputClass,
                            "pr-10",
                            "[&::-webkit-calendar-picker-indicator]:opacity-0",
                            "[&::-webkit-calendar-picker-indicator]:absolute",
                            "[&::-webkit-calendar-picker-indicator]:inset-y-0",
                            "[&::-webkit-calendar-picker-indicator]:right-0",
                            "[&::-webkit-calendar-picker-indicator]:w-10",
                            "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
                          )}
                          type="date"
                          value={v.start_date}
                          onChange={(e) => setV({ ...v, start_date: e.target.value })}
                        />
                        <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Fecha fin</FieldLabel>
                      <div className="relative">
                        <Input
                          className={cn(
                            inputClass,
                            "pr-10",
                            "[&::-webkit-calendar-picker-indicator]:opacity-0",
                            "[&::-webkit-calendar-picker-indicator]:absolute",
                            "[&::-webkit-calendar-picker-indicator]:inset-y-0",
                            "[&::-webkit-calendar-picker-indicator]:right-0",
                            "[&::-webkit-calendar-picker-indicator]:w-10",
                            "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
                          )}
                          type="date"
                          value={v.end_date}
                          onChange={(e) => setV({ ...v, end_date: e.target.value })}
                        />
                        <Calendar className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <FieldLabel>Observaciones</FieldLabel>
                    <Textarea
                      className={inputClass}
                      rows={2}
                      value={v.observations}
                      onChange={(e) =>
                        setV({ ...v, observations: e.target.value })
                      }
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* Columna derecha — códigos por cliente */}
          <div className="min-h-0 overflow-y-auto bg-muted/20">
            <div className="p-6 space-y-4">
              <SectionHeader title="Códigos por cliente" number="03" />
              <ClientCodeCards
                clients={clientCards}
                values={codeEntries}
                onChange={(clientId, next) => {
                  setCodeEntries((prev) => {
                    const m = new Map(prev);
                    m.set(clientId, next);
                    return m;
                  });
                }}
              />
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/30 shrink-0 flex flex-col sm:flex-row sm:items-center gap-2">
          {saveError && (
            <p className="text-xs text-destructive sm:mr-auto">{saveError}</p>
          )}
          <div className="sm:ml-auto flex gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={save.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (searchQuery.trim() !== "" && !productId) {
                  setSaveError("Selecciona un producto o deja el buscador vacío.");
                  return;
                }
                setSaveError(null);
                save.mutate();
              }}
              disabled={save.isPending}
            >
              {save.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
