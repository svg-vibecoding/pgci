import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

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
  publishAgreementPositions,
  type ClientCodeSearchResult,
} from "@/lib/agreements.functions";
import { Checkbox } from "@/components/ui/checkbox";
import {
  PositionTakenPanel,
  variantForPositionStatus,
  type PositionTakenSection,
} from "./PositionTakenPanel";

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
  // Estado actual de la posición existente. Solo se usa en edición para
  // decidir si mostrar el checkbox "Publicar en acuerdo al guardar".
  // Al crear, la posición nace 'draft' y el checkbox siempre aparece.
  status?: "active" | "requires_review" | "excluded" | "draft" | "archived";
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
  open,
  onReactivated,
  onRequestSwitchToPosition,
  onCreatingIncompleteChange,
  requiredForClientIds,
}: {
  clients: ClientCard[];
  values: Map<string, ClientCodeEntry>;
  onChange: (clientId: string, next: ClientCodeEntry) => void;
  agreementId: string;
  initialLineId: string | null;
  open: boolean;
  onReactivated: () => void;
  onRequestSwitchToPosition: (positionId: string) => void;
  onCreatingIncompleteChange: (clientId: string, incomplete: boolean) => void;
  requiredForClientIds?: Set<string>;
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
            open={open}
            required={requiredForClientIds?.has(c.id) ?? false}
            onChange={(next) => onChange(c.id, next)}
            onReactivated={onReactivated}
            onRequestSwitchToPosition={onRequestSwitchToPosition}
            onCreatingIncompleteChange={(incomplete) =>
              onCreatingIncompleteChange(c.id, incomplete)
            }
          />
        );
      })}
    </div>
  );
}


type TakenBlock = {
  position_id: string;
  client_code: string;
  client_description: string | null;
  sku: string | null;
  product_description: string | null;
  sale_price: number | null;
  position_status: "active" | "requires_review" | "draft" | "excluded";
  exclusion_reason: string | null;
  exclusion_date: string | null;
};


function ClientCodeCard({
  card,
  entry,
  agreementId,
  initialLineId,
  open,
  required = false,
  onChange,
  onReactivated,
  onRequestSwitchToPosition,
  onCreatingIncompleteChange,
}: {
  card: ClientCard;
  entry: ClientCodeEntry;
  agreementId: string;
  initialLineId: string | null;
  open: boolean;
  required?: boolean;
  onChange: (next: ClientCodeEntry) => void;
  onReactivated: () => void;
  onRequestSwitchToPosition: (positionId: string) => void;
  onCreatingIncompleteChange: (incomplete: boolean) => void;
}) {
  const disabled = !card.can_manage;
  const readonlyClass = "bg-muted/50 cursor-not-allowed";

  const searchFn = useServerFn(searchClientCodes);
  const reactivateFn = useServerFn(reactivateAgreementLine);

  // Modo del card: search (sin código) | creating (creando nuevo) | edit (código seleccionado)
  const initialHasCode = entry.code.trim() !== "";
  const [mode, setMode] = useState<"search" | "creating" | "edit">(
    initialHasCode ? "edit" : "search",
  );
  const [query, setQuery] = useState("");
  const [popoverOpen, setPopoverOpen] = useState(false);
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
  const [reactivatePending, setReactivatePending] = useState(false);
  const [takenBlock, setTakenBlock] = useState<TakenBlock | null>(null);
  const seq = useRef(0);

  // Resync por cambio de posición (o al abrir/cerrar). Se hace durante render
  // con un ref para leer el `entry` ya poblado por el padre en este mismo
  // ciclo — un useEffect corre bottom-up y vería el entry viejo.
  const prevKeyRef = useRef<string | null | undefined>(undefined);
  {
    const key = open ? (initialLineId ?? "__new__") : null;
    if (prevKeyRef.current !== key) {
      prevKeyRef.current = key;
      const has = entry.code.trim() !== "";
      setMode(has ? "edit" : "search");
      setOriginalDescription(has ? entry.description : null);
      setIsNew(false);
      setQuery("");
      setResults([]);
      setExpandedId(null);
      setPopoverOpen(false);
      setTakenBlock(null);
    }
  }

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
  }, [query, popoverOpen, disabled, agreementId, card.id, searchFn, open]);

  // Reportar si esta tarjeta bloquea el guardado (creando con campos vacíos).
  const creatingIncomplete =
    mode === "creating" &&
    (entry.code.trim() === "" || entry.description.trim() === "");
  useEffect(() => {
    onCreatingIncompleteChange(creatingIncomplete);
    return () => onCreatingIncompleteChange(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatingIncomplete]);

  const handleSelectFree = (r: ClientCodeSearchResult) => {
    onChange({ code: r.client_code, description: r.description ?? "" });
    setOriginalDescription(r.description ?? "");
    setIsNew(false);
    setMode("edit");
    setPopoverOpen(false);
    setQuery("");
    setResults([]);
    setExpandedId(null);
    setTakenBlock(null);
  };

  const handleSelectTaken = (r: ClientCodeSearchResult) => {
    if (r.status.kind !== "taken") return;
    const excluded = r.status.position_status === "excluded";
    setTakenBlock({
      position_id: r.status.position_id,
      client_code: r.client_code,
      client_description: r.description,
      sku: r.status.sku,
      product_description: r.status.product_description,
      sale_price: r.status.sale_price,
      position_status: r.status.position_status,
      exclusion_reason: excluded ? r.status.exclusion_reason : null,
      exclusion_date: excluded ? r.status.exclusion_date : null,
    });
    setPopoverOpen(false);
    setQuery("");
    setResults([]);
    setExpandedId(null);
  };


  const handleCreateNew = () => {
    // No auto-poblar: código y descripción quedan vacíos; el usuario los escribe.
    onChange({ code: "", description: "" });
    setOriginalDescription("");
    setIsNew(true);
    setMode("creating");
    setPopoverOpen(false);
    setQuery("");
    setResults([]);
    setExpandedId(null);
    setTakenBlock(null);
  };

  const handleDiscardCreate = () => {
    onChange({ code: "", description: "" });
    setOriginalDescription(null);
    setIsNew(false);
    setMode("search");
    setQuery("");
    setResults([]);
    setExpandedId(null);
    setPopoverOpen(false);
  };

  const doReactivate = async () => {
    if (!reactivateTarget) return;
    setReactivatePending(true);
    try {
      await reactivateFn({ data: { line_id: reactivateTarget.position_id } });
      toast.success("Posición reactivada");
      onReactivated();
      onRequestSwitchToPosition(reactivateTarget.position_id);
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

  const searchPlaceholder =
    mode === "edit"
      ? "Escribe para cambiar el producto…"
      : "Busca por código o descripción…";

  const searchBlock = (placeholder: string) => (
    <Popover open={popoverOpen && !disabled} onOpenChange={(o) => !disabled && setPopoverOpen(o)}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className={cn("pl-9", disabled ? readonlyClass : "bg-white")}
            value={query}
            disabled={disabled}
            placeholder={placeholder}
            onFocus={() => !disabled && setPopoverOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setPopoverOpen(true);
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
          onSelectFree={handleSelectFree}
          onSelectTaken={handleSelectTaken}
          onCreateNew={handleCreateNew}
          clientName={card.name}
          canManage={card.can_manage}
        />

      </PopoverContent>
    </Popover>
  );

  const takenAlert = takenBlock && (() => {
    const ps = takenBlock.position_status;
    const variant = variantForPositionStatus(ps);
    const title =
      ps === "excluded"
        ? "Este código está vinculado a una posición excluida del acuerdo"
        : ps === "requires_review"
          ? "Este código está en una posición en revisión del acuerdo"
          : ps === "draft"
            ? "Este código está reservado por un registro en gestión del acuerdo"
            : "Este código ya está vinculado a una posición del acuerdo";
    const exclusionDateLabel = (() => {
      if (ps !== "excluded" || !takenBlock.exclusion_date) return "EXCLUIDA";
      const d = new Date(takenBlock.exclusion_date);
      if (Number.isNaN(d.getTime())) return "EXCLUIDA";
      const s = d.toLocaleDateString("es-CO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      return `EXCLUIDA EL ${s}`;
    })();
    const sections: PositionTakenSection[] = [
      {
        label: card.name,
        body: (
          <>
            <span className="font-mono">{takenBlock.client_code}</span>
            {" "}· {takenBlock.client_description ?? "—"}
          </>
        ),
      },
      {
        label: "SUMATEC",
        body: (
          <>
            <span className="font-mono">{takenBlock.sku ?? "—"}</span>
            {" "}· {takenBlock.product_description ?? "—"}
            {takenBlock.sale_price != null && (
              <span className="font-sans font-medium">
                {" "}· {formatMoneyCOP(takenBlock.sale_price)}
              </span>
            )}
          </>
        ),
      },
    ];
    if (ps === "excluded") {
      sections.push({
        label: "MOTIVO DE EXCLUSIÓN",
        body: (
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground">
              {takenBlock.exclusion_reason ?? "—"}
            </p>
            <span className="text-[11px] font-medium text-text-tertiary">
              {exclusionDateLabel}
            </span>
          </div>
        ),
      });
    }
    return <PositionTakenPanel variant={variant} title={title} sections={sections} />;
  })();

  const takenActions = takenBlock && !disabled && (() => {
    const ps = takenBlock.position_status;
    const primary = !initialLineId
      ? ps === "excluded"
        ? {
            label: "Reactivar esta posición",
            onClick: () =>
              setReactivateTarget({
                position_id: takenBlock.position_id,
                sku: takenBlock.sku,
              }),
          }
        : ps === "requires_review"
          ? {
              label: "Ir a esa posición",
              onClick: () => onRequestSwitchToPosition(takenBlock.position_id),
            }
          : ps === "draft"
            ? {
                label: "Ir a ese registro en gestión",
                onClick: () => onRequestSwitchToPosition(takenBlock.position_id),
              }
            : {
                label: "Editar esta posición",
                onClick: () => onRequestSwitchToPosition(takenBlock.position_id),
              }
      : null;
    return (
      <div className="flex justify-end gap-2">
        {primary && (
          <Button type="button" size="sm" onClick={primary.onClick}>
            {primary.label}
          </Button>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setTakenBlock(null)}
        >
          Elegir otro código
        </Button>
      </div>
    );
  })();



  return (
    <div
      className={cn(
        "rounded-lg border border-border p-4 space-y-3",
        disabled ? "bg-muted/50" : "bg-surface-card",
      )}
    >
      <div className="flex items-center gap-2">
        {disabled && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
        <div className="text-sm font-semibold text-foreground">
          {card.name}
          {required && <span className="ml-1 text-primary">*</span>}
        </div>
        {required && (
          <span className="text-[11px] font-medium text-primary">Requerido</span>
        )}
      </div>

      {mode === "search" && (
        <>
          {searchBlock(searchPlaceholder)}
          {takenAlert}
          {takenActions}
        </>
      )}

      {mode === "creating" && (
        <>
          {searchBlock(searchPlaceholder)}
          <div className="space-y-1.5">
            <FieldLabel>CÓDIGO</FieldLabel>
            <Input
              value={entry.code}
              disabled={disabled}
              className={cn("font-mono", disabled ? readonlyClass : "")}
              onChange={(e) => onChange({ ...entry, code: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>DESCRIPCIÓN DEL PRODUCTO</FieldLabel>
            <Input
              value={entry.description}
              disabled={disabled}
              className={disabled ? readonlyClass : ""}
              onChange={(e) => onChange({ ...entry, description: e.target.value })}
            />
          </div>
          {entry.code.trim() === "" || entry.description.trim() === "" ? (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-[var(--status-warning-strong)]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--status-warning-strong)]" />
              <span>
                {entry.code.trim() === ""
                  ? `Para crear un producto en ${card.name}. Registra el código o descarta la creación.`
                  : `Para crear un producto en ${card.name}. Registra la descripción o descarta la creación.`}
              </span>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-md border border-[var(--status-info-base)]/40 bg-[var(--status-info-soft)] px-3 py-2 text-xs text-[var(--status-info-strong)]">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--status-info-strong)]" />
              <span>
                {`El producto se creará en el catálogo de ${card.name} al guardar la posición.`}
              </span>
            </div>
          )}

          {!disabled && (
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleDiscardCreate}
              >
                Descartar
              </Button>
            </div>
          )}
        </>
      )}

      {mode === "edit" && (
        <>
          {searchBlock(searchPlaceholder)}
          {takenAlert}
          {takenActions}
          <div className="space-y-1.5">
            <FieldLabel>CÓDIGO</FieldLabel>
            <Input
              value={entry.code}
              disabled={disabled}
              readOnly
              tabIndex={-1}
              className={cn("font-mono", readonlyClass)}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel>DESCRIPCIÓN DEL PRODUCTO</FieldLabel>
            <Input
              value={entry.description}
              disabled={disabled}
              className={disabled ? readonlyClass : ""}
              onChange={(e) => onChange({ ...entry, description: e.target.value })}
            />
          </div>
          {descriptionChanged && !disabled && (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-[var(--status-warning-strong)]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--status-warning-strong)]" />
              <span>
                La descripción se actualizará en el catálogo de {card.name} al
                guardar la posición. Los cambios se reflejan en todos los
                acuerdos que usen este código.
              </span>
            </div>
          )}
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
              volverá al acuerdo tal como estaba antes de excluirse, y se abrirá para que la edites.
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
    </div>
  );
}



function ClientCodeSearchList({
  query,
  loading,
  results,
  initialLineId,
  onSelectFree,
  onSelectTaken,
  onCreateNew,
  clientName,
  canManage,
}: {
  query: string;
  loading: boolean;
  results: ClientCodeSearchResult[];
  initialLineId: string | null;
  onSelectFree: (r: ClientCodeSearchResult) => void;
  onSelectTaken: (r: ClientCodeSearchResult) => void;
  onCreateNew: () => void;
  clientName: string;
  canManage: boolean;
}) {
  const q = query.trim();
  const showCreate = canManage && q.length >= 2 && !loading;

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

        // Caso "esta misma posición": tratar como libre.
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

        const badgeStatus: "neutral" | "warning" | "info" =
          posStatus === "excluded"
            ? "neutral"
            : posStatus === "requires_review" || posStatus === "draft"
              ? "info"
              : "warning";
        const badgeLabel =
          posStatus === "excluded"
            ? "Posición excluida"
            : posStatus === "requires_review"
              ? "Posición en revisión"
              : posStatus === "draft"
                ? "Registro en gestión"
                : "Posición activa";

        return (
          <button
            key={r.client_product_id}
            type="button"
            onClick={() => onSelectTaken(r)}
            className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-muted focus:bg-muted focus:outline-none"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-medium text-muted-foreground">
                {r.client_code}
              </span>
              <StatusBadge size="sm" status={badgeStatus} label={badgeLabel} />
            </div>
            {r.description && (
              <span className="text-xs text-muted-foreground">{r.description}</span>
            )}
          </button>
        );
      })}
      {showCreate && (
        <div className="border-t border-border">
          <button
            type="button"
            onClick={onCreateNew}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-info hover:text-info-strong hover:bg-muted focus:bg-muted focus:outline-none"
          >
            <Plus className="h-3.5 w-3.5 text-info" />
            Crear producto en el catálogo de {clientName}
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
  initial,
  agreementStartDate,
  agreementEndDate,
  agreementClients,
  clientCatalogPermissions,
  onSwitchToPosition,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agreementId: string;
  agreementName?: string | null;
  initial?: Partial<LineEditValues> | null;
  agreementStartDate?: string | null;
  agreementEndDate?: string | null;
  // Clientes activos del acuerdo. Una tarjeta por cliente.
  agreementClients?: Array<{ id: string; name: string | null }>;
  // Permisos can_manage_client_catalog por cliente (RPC). Sin dato = false.
  clientCatalogPermissions?: Array<{ client_id: string; can_manage: boolean }>;
  // Reabrir el modal como edición de otra posición (sin cerrar/navegar).
  onSwitchToPosition?: (positionId: string) => void;
}) {
  const qc = useQueryClient();
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
  // Hidratación síncrona de codeEntries por cambio de posición: evita la
  // carrera con ClientCodeCard cuando initial cambia sin cerrar el modal.
  // Ver: React docs "Storing information from previous renders".
  const hydratedForRef = useRef<string | null | undefined>(undefined);
  {
    const key = open ? (initial?.line_id ?? null) : undefined;
    if (hydratedForRef.current !== key) {
      hydratedForRef.current = key;
      if (open) {
        const m = new Map<string, ClientCodeEntry>();
        for (const c of initial?.client_codes ?? []) {
          m.set(c.client_id, { code: c.client_code, description: c.description });
        }
        setCodeEntries(m);
      }
    }
  }
  const [creatingIncomplete, setCreatingIncomplete] = useState<Map<string, boolean>>(
    new Map(),
  );
  const hasCreatingIncomplete = Array.from(creatingIncomplete.values()).some(Boolean);

  // Cambio a otra posición desde la alerta "código ya asignado".
  const [pendingSwitchTarget, setPendingSwitchTarget] = useState<string | null>(null);



  // Buscador de productos (combobox)
  type SkuAgreementPosition = {
    position_id: string;
    position_status: "active" | "requires_review" | "draft" | "excluded";
    sale_price: number | null;
    codes: Array<{
      client_id: string;
      client_name: string | null;
      client_code: string;
      description: string | null;
    }>;
    exclusion_reason: string | null;
    exclusion_date: string | null;
  };
  type SkuAgreementStatus =
    | { kind: "free" }
    | { kind: "in_agreement"; positions: SkuAgreementPosition[] };
  type ProductResult = {
    id: string;
    sku: string;
    erp_description: string | null;
    commercial_brand: string | null;
    status: "active" | "inactive";
    agreement_status: SkuAgreementStatus;
  };
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ProductResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const [searchHasMore, setSearchHasMore] = useState(false);
  // Panel "este SKU ya está en el acuerdo" al seleccionar del buscador.
  const [skuInAgreement, setSkuInAgreement] = useState<{
    sku: string;
    productDescription: string | null;
    positions: SkuAgreementPosition[];
  } | null>(null);
  // El usuario acepta que registrará un código nuevo → sale del bloqueo cuando
  // todas las posiciones existentes YA tienen código. Reset al cambiar SKU.
  const [skuAckRequireNewCode, setSkuAckRequireNewCode] = useState(false);
  const [skuPositionsExpanded, setSkuPositionsExpanded] = useState(false);
  const conflictSeq = useRef(0);
  const searchSeq = useRef(0);
  const PAGE_SIZE = 20;

  const isCreatingLine = !initial?.line_id;
  // Alguna posición existente sin códigos ocupa el SKU sola: bloqueo duro.
  const skuHasCodelessPosition = !!skuInAgreement?.positions.some(
    (p) => p.codes.length === 0,
  );
  // El SKU está en el acuerdo (nueva posición). Solo bloquea el formulario
  // hasta que:
  //  - todas las existentes tienen código → user pulsa "Registraré nuevo código"
  //  - o hay una codeless → siempre bloqueado (salida: elegir otro SKU / ir).
  const skuBlocksForm =
    isCreatingLine &&
    !!skuInAgreement &&
    (skuHasCodelessPosition || !skuAckRequireNewCode);
  // Cuando el usuario aceptó "Registraré nuevo código", la sección de
  // productos del cliente pasa a ser REQUERIDA para poder guardar.
  const requiresNewClientCode =
    isCreatingLine && !!skuInAgreement && skuAckRequireNewCode;

  // Clientes que ya tienen código vigente en OTRA posición del SKU en el
  // acuerdo. Solo ellos pueden "desempatar" con un código nuevo — un cliente
  // distinto no distingue posiciones (spec §4.5).
  const requiredCodeClientIds = useMemo(() => {
    const s = new Set<string>();
    if (!isCreatingLine || !skuInAgreement) return s;
    for (const pos of skuInAgreement.positions) {
      for (const c of pos.codes) s.add(c.client_id);
    }
    return s;
  }, [isCreatingLine, skuInAgreement]);
  const requiredClientNames = useMemo(() => {
    if (requiredCodeClientIds.size === 0) return "";
    const names: string[] = [];
    for (const c of agreementClients ?? []) {
      if (requiredCodeClientIds.has(c.id)) names.push(c.name?.trim() || "Sin nombre");
    }
    return names.sort((a, b) => a.localeCompare(b, "es", { sensitivity: "base" })).join(", ");
  }, [requiredCodeClientIds, agreementClients]);

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
      // Auto-prefill de precio vinculado: solo aplica en edición.
      // En creación, la vinculación de precios no se ofrece (el panel se
      // oculta cuando !initial?.line_id) y prefill'ear un precio de otra
      // posición prometía un vínculo que aún no existía.
      if (linked && initial?.line_id) {
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
    // codeEntries se hidrata sincrónicamente durante render (arriba) para
    // evitar la carrera con ClientCodeCard al cambiar de posición.
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
    setSkuInAgreement(null);
    setSkuAckRequireNewCode(false);
    setSkuPositionsExpanded(false);
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
        const res = await searchFn({
          data: { query: q, offset: 0, limit: PAGE_SIZE, agreement_id: agreementId },
        });
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
  }, [searchQuery, searchOpen, searchFn, agreementId]);

  const loadMoreResults = async () => {
    const q = searchQuery.trim();
    if (q.length < 2 || searchLoadingMore) return;
    const seq = searchSeq.current;
    setSearchLoadingMore(true);
    try {
      const res = await searchFn({
        data: {
          query: q,
          offset: searchResults.length,
          limit: PAGE_SIZE,
          agreement_id: agreementId,
        },
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
    // Estado del SKU respecto al acuerdo — solo aplica al crear.
    // En edición mantenemos el flujo previo (panel de vinculación de precios).
    setSkuAckRequireNewCode(false);
    setSkuPositionsExpanded(false);
    if (
      isCreatingLine &&
      p.agreement_status.kind === "in_agreement" &&
      p.agreement_status.positions.length > 0
    ) {
      setSkuInAgreement({
        sku: p.sku,
        productDescription: p.erp_description,
        positions: p.agreement_status.positions,
      });
    } else {
      setSkuInAgreement(null);
    }
    void runConflict(p.sku, p.id);
  };

  const clearSkuSelection = () => {
    setV((prev) => ({ ...prev, sku: "" }));
    setProductMeta(null);
    setProductId(null);
    setLookup({ kind: "empty" });
    setSkuInAgreement(null);
    setSkuAckRequireNewCode(false);
    setSkuPositionsExpanded(false);
    setNConflict({ kind: "idle", lines: [] });
    setIsLinked(false);
    setSaveError(null);
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
  const publishFn = useServerFn(publishAgreementPositions);

  // El checkbox "Publicar en acuerdo al guardar" aparece:
  //  - al CREAR (la posición nace 'draft' y podrá publicarse si está completa)
  //  - al EDITAR solo si la posición está en 'draft' o 'requires_review'
  const canOfferPublish =
    !isEdit ||
    initial?.status === "draft" ||
    initial?.status === "requires_review";

  const [publishOnSave, setPublishOnSave] = useState(false);

  // isPublishableDraft(values): completa (SKU, precio, fecha inicio) y vigente
  // (fecha efectiva de fin no vencida). Usa las fechas efectivas del acuerdo
  // cuando la posición no las trae, coincidiendo con publish_positions RPC.
  const canPublishNow = useMemo(() => {
    if (!canOfferPublish) return false;
    if (!productId) return false;
    const sale = parsePriceInput(v.sale_price);
    if (sale == null || sale <= 0) return false;
    const effStart = v.start_date.trim() || agreementStartDate || "";
    const effEnd = v.end_date.trim() || agreementEndDate || "";
    if (!effStart || !effEnd) return false;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(effEnd);
    if (m) {
      const end = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if (end.getTime() < today.getTime()) return false;
    }
    return true;
  }, [
    canOfferPublish,
    productId,
    v.sale_price,
    v.start_date,
    v.end_date,
    agreementStartDate,
    agreementEndDate,
  ]);

  // Si la validación deja de cumplirse (p.ej. el usuario borra el precio),
  // desmarcar publishOnSave para que el label del botón vuelva a "Guardar".
  useEffect(() => {
    if (!canPublishNow && publishOnSave) setPublishOnSave(false);
  }, [canPublishNow, publishOnSave]);

  // Resetear publishOnSave al abrir/cerrar el modal o al cambiar de posición.
  useEffect(() => {
    if (!open) setPublishOnSave(false);
  }, [open, initial?.line_id]);

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
      let saveRes: unknown;
      let targetId: string | null = null;
      if (isEdit) {
        saveRes = await patchFn({
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
        targetId = initial!.line_id!;
      } else {
        saveRes = await createFn({
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
        // create_agreement_line devuelve { line_id, kind }
        targetId = (saveRes as { line_id?: string } | null)?.line_id ?? null;
      }

      // Encadenado publicar-al-guardar. Se salta si el guardado quedó bloqueado
      // (RN-MATCH-01 / identity_no_codes): onSuccess muestra el toast de bloqueo.
      const saveBlocked =
        !!(saveRes as { blocked?: boolean } | null)?.blocked;
      let publishRes: Awaited<ReturnType<typeof publishFn>> | null = null;
      if (publishOnSave && canPublishNow && targetId && !saveBlocked) {
        publishRes = await publishFn({ data: { ids: [targetId] } });
      }
      return { saveRes, publishRes };
    },
    onSuccess: ({ saveRes, publishRes }) => {
      // (1) UPDATE bloqueado (RN-MATCH-01 o identity_no_codes)
      const r = saveRes as {
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
      // Con publicación exitosa el toast principal es "publicada".
      const publishedOk =
        !!publishRes && (publishRes.published ?? 0) > 0;
      const publishFailed =
        !!publishRes &&
        (publishRes.not_publishable ?? 0) + (publishRes.skipped ?? 0) > 0 &&
        (publishRes.published ?? 0) === 0;

      if (isPending) {
        const missing = computePendingLabels();
        toast.info(
          missing.length
            ? `Guardado como pendiente — falta ${missing.join(", ")}`
            : "Guardado como pendiente",
        );
      } else if (publishedOk) {
        toast.success(
          isCreate ? "Posición creada y publicada" : "Posición actualizada y publicada",
        );
      } else if (isPromotion) {
        toast.success("Posición creada");
      } else if (isCreate) {
        toast.success("Registro creado en gestión");
      } else {
        toast.success("Posición actualizada");
      }

      if (publishFailed) {
        // Caso borde: guardado ok, publish rechazó (p.ej. venció entre save y publish).
        const raw = publishRes?.details?.[0]?.reason ?? null;
        toast.info(`No se pudo publicar: ${raw ?? "condiciones no cumplidas"}`);
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
            {agreementName || "Acuerdo comercial"}
          </DialogDescription>
        </DialogHeader>

        <div
          className={cn(
            "flex-1 min-h-0 grid grid-cols-1",
            !skuBlocksForm && "lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)]",
          )}
        >
          {/* Columna izquierda — la posición */}
          <div
            className={cn(
              "min-h-0 overflow-y-auto bg-white",
              !skuBlocksForm && "border-r border-border",
            )}
          >

            <div className="p-6 space-y-8">
              {/* Producto Jaivaná */}
              <section className="space-y-4">
                <SectionHeader title="INFORMACIÓN DE SUMATEC" number="01" />
                <div className="rounded-lg border border-input bg-muted/40 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-foreground">SUMATEC</div>
                  </div>

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
                          {searchResults.map((p) => {
                            const firstPos =
                              p.agreement_status.kind === "in_agreement"
                                ? p.agreement_status.positions[0]
                                : null;
                            const agLabel = !firstPos
                              ? null
                              : firstPos.position_status === "active"
                                ? "En acuerdo · Activa"
                                : firstPos.position_status === "requires_review"
                                  ? "En acuerdo · En revisión"
                                  : firstPos.position_status === "draft"
                                    ? "En acuerdo · En gestión"
                                    : "En acuerdo · Excluida";
                            const agStatus:
                              | "active"
                              | "warning"
                              | "info"
                              | "neutral" = !firstPos
                              ? "neutral"
                              : firstPos.position_status === "active"
                                ? "warning"
                                : firstPos.position_status === "excluded"
                                  ? "neutral"
                                  : "info";
                            return (
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
                                  {agLabel && (
                                    <>
                                      <span aria-hidden>·</span>
                                      <StatusBadge
                                        size="sm"
                                        status={agStatus}
                                        label={agLabel}
                                      />
                                    </>
                                  )}
                                </span>
                              </button>
                            );
                          })}
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

                  {hasProduct && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
                    </div>
                  )}

                  {lookup.kind === "inactive" && (
                    <Alert variant="warning">
                      <AlertDescription>
                        Producto inactivo en el catálogo. Puedes asignarlo al acuerdo, la posición quedará en estado de gestión y no podrá activarse en el acuerdo.
                      </AlertDescription>
                    </Alert>
                  )}
                  {lookup.kind === "not_found" && (
                    <Alert variant="error">
                      <AlertDescription>
                        Código no encontrado en el catálogo Jaivaná
                        {catalogDateLabel
                          ? ` (última actualización: ${catalogDateLabel}).`
                          : "."}
                      </AlertDescription>
                    </Alert>
                  )}

                  {skuInAgreement && (() => {
                    const positions = skuInAgreement.positions;
                    const visible = skuPositionsExpanded ? positions : positions.slice(0, 3);
                    const hidden = positions.length - visible.length;
                    return (
                      <div className="space-y-3">
                        <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-[var(--status-warning-strong)]">
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          <div className="space-y-0.5">
                            <p className="font-medium">
                              Este SKU ya está en el acuerdo
                            </p>
                            <p className="text-xs">
                              Puedes asignar un SKU a diferentes posiciones del acuerdo,
                              pero cada posición debe tener un código de cliente que la
                              distinga.
                            </p>
                          </div>
                        </div>

                        {visible.map((pos) => {
                          const variant = variantForPositionStatus(pos.position_status);
                          const title =
                            pos.position_status === "excluded"
                              ? "Posición excluida"
                              : pos.position_status === "requires_review"
                                ? "Posición en revisión"
                                : pos.position_status === "draft"
                                  ? "Registro en gestión"
                                  : "Posición activa";
                          const sections: PositionTakenSection[] = [
                            {
                              label: "SUMATEC",
                              body: (
                                <>
                                  <span className="font-mono">
                                    {skuInAgreement.sku}
                                  </span>
                                  {" "}· {skuInAgreement.productDescription ?? "—"}
                                  {pos.sale_price != null && (
                                    <span className="font-sans font-medium">
                                      {" "}· {formatMoneyCOP(pos.sale_price)}
                                    </span>
                                  )}
                                </>
                              ),
                            },
                          ];
                          if (pos.codes.length === 0) {
                            sections.push({
                              label: "SIN CÓDIGO DE CLIENTE",
                              body: (
                                <span className="text-muted-foreground">
                                  Esta posición ocupa el SKU sin código que la distinga.
                                </span>
                              ),
                            });
                          } else {
                            for (const c of pos.codes) {
                              sections.push({
                                label: c.client_name ?? "CLIENTE",
                                body: (
                                  <>
                                    <span className="font-mono">{c.client_code}</span>
                                    {" "}· {c.description ?? "—"}
                                  </>
                                ),
                              });
                            }
                          }
                          if (pos.position_status === "excluded") {
                            const dateLabel = (() => {
                              if (!pos.exclusion_date) return "EXCLUIDA";
                              const d = new Date(pos.exclusion_date);
                              if (Number.isNaN(d.getTime())) return "EXCLUIDA";
                              const s = d.toLocaleDateString("es-CO", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              });
                              return `EXCLUIDA EL ${s}`;
                            })();
                            sections.push({
                              label: "MOTIVO DE EXCLUSIÓN",
                              body: (
                                <div className="space-y-1.5">
                                  <p className="text-sm text-muted-foreground">
                                    {pos.exclusion_reason ?? "—"}
                                  </p>
                                  <span className="text-[11px] font-medium text-text-tertiary">
                                    {dateLabel}
                                  </span>
                                </div>
                              ),
                            });
                          }
                          const hasCode = pos.codes.length > 0;
                          const isExcluded = pos.position_status === "excluded";
                          const codedClientIds = new Set(
                            pos.codes.map((c) => c.client_id),
                          );
                          const missingClients = isCreatingLine && hasCode && !isExcluded
                            ? clientCards.filter((c) => !codedClientIds.has(c.id))
                            : [];
                          return (
                            <div key={pos.position_id} className="space-y-2">
                              <PositionTakenPanel
                                variant={variant}
                                title={title}
                                sections={sections}
                              />
                              {isCreatingLine && !skuAckRequireNewCode && (
                                <div className="flex flex-wrap justify-end gap-2">
                                  {isExcluded && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() =>
                                        onSwitchToPosition?.(pos.position_id)
                                      }
                                    >
                                      Reactivar esa posición
                                    </Button>
                                  )}
                                  {!hasCode && !isExcluded && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      onClick={() =>
                                        onSwitchToPosition?.(pos.position_id)
                                      }
                                    >
                                      Ir a esa posición
                                    </Button>
                                  )}
                                  {missingClients.map((c) => (
                                    <Button
                                      key={c.id}
                                      type="button"
                                      size="sm"
                                      onClick={() =>
                                        onSwitchToPosition?.(pos.position_id)
                                      }
                                    >
                                      Agregar el código de {c.name} a esa posición
                                    </Button>
                                  ))}
                                </div>
                              )}
                              {!isCreatingLine && (
                                <div className="flex flex-wrap justify-end gap-2">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() =>
                                      onSwitchToPosition?.(pos.position_id)
                                    }
                                  >
                                    {isExcluded ? "Reactivar esa posición" : "Ir a esa posición"}
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {hidden > 0 && (
                          <div className="flex justify-center">
                            <Button
                              type="button"
                              size="sm"
                              variant="link"
                              onClick={() => setSkuPositionsExpanded(true)}
                            >
                              Ver {hidden} {hidden === 1 ? "posición más" : "posiciones más"}
                            </Button>
                          </div>
                        )}

                        {isCreatingLine && !skuAckRequireNewCode && (
                          <div className="rounded-md border border-border bg-surface-card p-4 space-y-3">
                            <p className="text-sm font-semibold text-foreground">
                              ¿Qué quieres hacer?
                            </p>
                            <div className="flex flex-col gap-2">
                              {!skuHasCodelessPosition && (
                                <div className="space-y-1">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="w-full justify-start"
                                    onClick={() => setSkuAckRequireNewCode(true)}
                                  >
                                    Crear otra posición de este SKU
                                  </Button>
                                  {requiredClientNames && (
                                    <p className="text-xs text-muted-foreground pl-1">
                                      {requiredClientNames} debe nombrarla con un código distinto.
                                    </p>
                                  )}
                                </div>
                              )}
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="w-full justify-start"
                                onClick={clearSkuSelection}
                              >
                                Elegir otro SKU
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {nConflict.kind === "found" && !isCreatingLine && (
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
                  )}
                </div>
              </section>

              {/* Condiciones comerciales — se oculta mientras el usuario no declare intención (skuBlocksForm) */}
              {!skuBlocksForm && (
              <section className="space-y-4">
                <SectionHeader title="Condiciones comerciales" number="02" />
                {agreementDatesLabel && (
                  <Alert variant="info">
                    <AlertDescription>{agreementDatesLabel}</AlertDescription>
                  </Alert>
                )}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <FieldLabel>Precio de venta</FieldLabel>
                      <Input
                        className={inputClass}
                        inputMode="decimal"
                        disabled={skuBlocksForm}
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
                        disabled={skuBlocksForm}
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
                          disabled={skuBlocksForm}
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
                          disabled={skuBlocksForm}
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
                      disabled={skuBlocksForm}
                      value={v.observations}
                      onChange={(e) =>
                        setV({ ...v, observations: e.target.value })
                      }
                    />
                  </div>
                </div>
              </section>
              )}
            </div>
          </div>

          {/* Columna derecha — códigos por cliente */}
          <div className="min-h-0 overflow-y-auto bg-muted/20">
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <SectionHeader title="PRODUCTOS DEL CLIENTE" number="03" />
                </div>
              </div>
              {requiresNewClientCode && requiredClientNames && (
                <p className="text-xs text-muted-foreground">
                  Este SKU ya está en el acuerdo con código de{" "}
                  <span className="font-medium text-foreground">
                    {requiredClientNames}
                  </span>
                  . Para crear otra posición, {requiredClientNames} debe nombrarla
                  con un código distinto.
                </p>
              )}
              <ClientCodeCards
                clients={clientCards}
                values={codeEntries}
                agreementId={agreementId}
                initialLineId={initial?.line_id ?? null}
                open={open}
                requiredForClientIds={requiredCodeClientIds}
                onChange={(clientId, next) => {
                  setCodeEntries((prev) => {
                    const m = new Map(prev);
                    m.set(clientId, next);
                    return m;
                  });
                }}
                onReactivated={() => {
                  qc.invalidateQueries({ queryKey: ["agreements", "lines", agreementId] });
                  qc.invalidateQueries({ queryKey: ["agreements", "detail", agreementId] });
                  qc.invalidateQueries({ queryKey: ["agreements", "sku-groups", agreementId] });
                }}
                onRequestSwitchToPosition={(positionId: string) => {
                  if (!onSwitchToPosition) return;
                  // Sin cambios en curso → saltar directo.
                  const dirty =
                    v.sku.trim() !== "" ||
                    v.sale_price.trim() !== "" ||
                    v.par_price.trim() !== "" ||
                    v.observations.trim() !== "" ||
                    Array.from(codeEntries.values()).some(
                      (e) => e.code.trim() !== "" || e.description.trim() !== "",
                    );
                  if (!dirty) {
                    onSwitchToPosition(positionId);
                    return;
                  }
                  setPendingSwitchTarget(positionId);
                }}
                onCreatingIncompleteChange={(clientId, incomplete) => {
                  setCreatingIncomplete((prev) => {
                    const cur = prev.get(clientId) ?? false;
                    if (cur === incomplete) return prev;
                    const m = new Map(prev);
                    m.set(clientId, incomplete);
                    return m;
                  });
                }}
              />


            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/30 shrink-0 flex flex-col sm:flex-row sm:items-center gap-3">
          {saveError && (
            <p className="text-xs text-destructive sm:mr-auto">{saveError}</p>
          )}
          {canOfferPublish && !saveError && !skuBlocksForm && (
            <label
              className={cn(
                "flex items-start gap-2 sm:mr-auto",
                canPublishNow ? "" : "opacity-70",
              )}
            >
              <Checkbox
                id="publish-on-save"
                checked={publishOnSave}
                onCheckedChange={(c) => setPublishOnSave(c === true)}
                disabled={!canPublishNow || save.isPending || skuBlocksForm}
                className="mt-0.5"
              />
              <span className="flex flex-col leading-tight">
                <span className="suma-body text-text-primary font-medium">Publicar en acuerdo al guardar</span>
                <span className="suma-caption text-text-tertiary">
                  {canPublishNow
                    ? isEdit
                      ? "Pasará a Activa al guardar."
                      : "Nacerá como Activa."
                    : "Completa producto, precio y fechas vigentes para habilitar."}
                </span>
              </span>
            </label>

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
                if (skuBlocksForm) {
                  setSaveError(
                    "Este SKU ya está en el acuerdo. Elige otro SKU o ve a la posición existente.",
                  );
                  return;
                }
                if (requiresNewClientCode) {
                  // Debe haber al menos un código no vacío de UNO de los clientes
                  // que ya tienen código en otra posición del SKU.
                  const hasDesempate = Array.from(codeEntries.entries()).some(
                    ([clientId, e]) =>
                      requiredCodeClientIds.has(clientId) && e.code.trim() !== "",
                  );
                  if (!hasDesempate) {
                    setSaveError(
                      `Falta el código de ${requiredClientNames}. Este SKU ya está en el acuerdo con un código de ${requiredClientNames}; para crear otra posición, ${requiredClientNames} debe nombrarla de otra forma.`,
                    );
                    return;
                  }
                }
                setSaveError(null);
                save.mutate();
              }}
              disabled={save.isPending || hasCreatingIncomplete || skuBlocksForm}
            >
              {save.isPending
                ? "Guardando…"
                : publishOnSave && canPublishNow
                  ? "Guardar y publicar"
                  : isEdit
                    ? "Guardar cambios"
                    : "Guardar"}
            </Button>
          </div>
        </div>


      </DialogContent>

      {/* AlertDialog: perderás cambios sin guardar al editar otra posición */}
      <AlertDialog
        open={!!pendingSwitchTarget}
        onOpenChange={(o) => !o && setPendingSwitchTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Editar la otra posición</AlertDialogTitle>
            <AlertDialogDescription>
              Perderás los cambios sin guardar de esta posición nueva.
              ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                const t = pendingSwitchTarget;
                setPendingSwitchTarget(null);
                if (t && onSwitchToPosition) onSwitchToPosition(t);
              }}
            >
              Editar posición
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

