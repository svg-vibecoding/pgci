import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { toast } from "sonner";
import {
  AlertTriangle,
  Calendar,
  ChevronDown,
  Info,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Search,
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
import { RowActionsMenu } from "@/components/sumatec";

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
  // Tokens de pending_reason del backend (fuente única de verdad).
  // Solo se pasa en edición; en creación se deriva del formulario.
  pending_reason?: string | null;
  sku: string;
  // Lista COMPLETA declarativa de códigos por cliente. Lo ausente se cierra.
  client_codes: LineEditClientCode[];
  sale_price: string;
  par_price: string;
  start_date: string;
  end_date: string;
  observations: string;
  // Datos del producto ya conocidos por la lista. Se usan solo como semilla
  // en el modal de edición para evitar el parpadeo mientras `lookupProductBySku`
  // refresca en segundo plano. Nunca se envían al backend.
  erp_description?: string | null;
  commercial_brand?: string | null;
  product_status?: string | null;
  product_updated_at?: string | null;
  // Semilla del conteo de otras posiciones del acuerdo con el mismo SKU.
  // Se calcula en memoria desde la tabla al abrir el modal para decidir si
  // reservar hueco con skeleton. No se envía al backend.
  sibling_positions_hint?: number;
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
  updated_at: string | null;
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
  required,
  className,
}: {
  children: React.ReactNode;
  required?: boolean;
  className?: string;
}) {
  return (
    <Label className={className}>
      {children}
      {required ? <span className="text-primary"> *</span> : null}
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
  onRemove,
  agreementId,
  agreementStartDate,
  agreementEndDate,
  initialLineId,
  open,
  onReactivated,
  onRequestSwitchToPosition,
  onCreatingIncompleteChange,
  requiredForClientIds,
  canRemoveClientIds,
  isCreate = false,
}: {
  clients: ClientCard[];
  values: Map<string, ClientCodeEntry>;
  onChange: (clientId: string, next: ClientCodeEntry) => void;
  onRemove: (clientId: string) => void;
  agreementId: string;
  agreementStartDate?: string | null;
  agreementEndDate?: string | null;
  initialLineId: string | null;
  open: boolean;
  onReactivated: () => void;
  onRequestSwitchToPosition: (positionId: string) => void;
  onCreatingIncompleteChange: (clientId: string, incomplete: boolean) => void;
  requiredForClientIds?: Set<string>;
  canRemoveClientIds?: Set<string>;
  isCreate?: boolean;
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
            agreementStartDate={agreementStartDate}
            agreementEndDate={agreementEndDate}
            initialLineId={initialLineId}
            open={open}
            required={requiredForClientIds?.has(c.id) ?? false}
            canRemove={canRemoveClientIds?.has(c.id) ?? true}
            onChange={(next) => onChange(c.id, next)}
            onRemove={() => onRemove(c.id)}
            onReactivated={onReactivated}
            onRequestSwitchToPosition={onRequestSwitchToPosition}
            onCreatingIncompleteChange={(incomplete) =>
              onCreatingIncompleteChange(c.id, incomplete)
            }
            isCreate={isCreate}
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
  position_start_date: string | null;
  position_end_date: string | null;
  exclusion_reason: string | null;
  exclusion_date: string | null;
};


function ClientCodeCard({
  card,
  entry,
  agreementId,
  agreementStartDate,
  agreementEndDate,
  initialLineId,
  open,
  required = false,
  canRemove = true,
  onChange,
  onRemove,
  onReactivated,
  onRequestSwitchToPosition,
  onCreatingIncompleteChange,
  isCreate = false,
}: {
  card: ClientCard;
  entry: ClientCodeEntry;
  agreementId: string;
  agreementStartDate?: string | null;
  agreementEndDate?: string | null;
  initialLineId: string | null;
  open: boolean;
  required?: boolean;
  canRemove?: boolean;
  onChange: (next: ClientCodeEntry) => void;
  onRemove: () => void;
  onReactivated: () => void;
  onRequestSwitchToPosition: (positionId: string) => void;
  onCreatingIncompleteChange: (incomplete: boolean) => void;
  isCreate?: boolean;
}) {

  const disabled = !card.can_manage;
  const readonlyClass = "bg-muted/70 border-transparent shadow-none cursor-not-allowed focus-visible:ring-0 focus-visible:ring-offset-0";

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
  // En modo "edit" el buscador arranca oculto — cambiar el código es una
  // acción explícita disparada por "Cambiar código".
  const [showCodeSearch, setShowCodeSearch] = useState(false);
  // "Editar producto": revela el input de descripción bajo demanda desde el menú.
  const [showDescriptionEdit, setShowDescriptionEdit] = useState(false);
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
      setShowCodeSearch(false);
      setShowDescriptionEdit(false);
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
    setShowCodeSearch(false);
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
      position_start_date: r.status.position_start_date,
      position_end_date: r.status.position_end_date,
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
    const statusLabel =
      ps === "excluded"
        ? "Posición excluida"
        : ps === "requires_review"
          ? "Posición en revisión"
          : ps === "draft"
            ? "Posición en gestión"
            : "Posición activa";
    const statusBadgeStatus: "active" | "danger" | "neutral" =
      ps === "active"
        ? "active"
        : ps === "requires_review"
          ? "danger"
          : "neutral";
    const badgeIcon = ps === "draft" ? Pencil : undefined;
    const effStart =
      fmtDateLocal(takenBlock.position_start_date) ??
      fmtDateLocal(agreementStartDate);
    const effEnd =
      fmtDateLocal(takenBlock.position_end_date) ??
      fmtDateLocal(agreementEndDate);
    const vigencia =
      effStart || effEnd
        ? `${effStart ?? "—"} – ${effEnd ?? "—"}`
        : null;
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
            {vigencia && (
              <>
                {" "}· <span className="font-sans">{vigencia}</span>
              </>
            )}
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
    return (
      <PositionTakenPanel
        variant="info"
        title="Este código ya está asignado en el acuerdo"
        headerExtra={
          <StatusBadge
            status={statusBadgeStatus}
            label={statusLabel}
            icon={badgeIcon}
          />
        }
        sections={sections}
      />
    );
  })();

  const takenActions = takenBlock && !disabled && (() => {
    const ps = takenBlock.position_status;
    const isExcluded = ps === "excluded";
    return (
      <div className="flex justify-end gap-2">
        {!isExcluded && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onRequestSwitchToPosition(takenBlock.position_id)}
          >
            Ir a esa posición
          </Button>
        )}
        <Button
          type="button"
          size="sm"
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
      <div className="flex items-center justify-between gap-2">
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
        {mode === "edit" && !disabled && (
          <RowActionsMenu
            row={{}}
            ariaLabel={`Acciones del código de ${card.name}`}
            actions={[
              {
                label: "Cambiar código",
                onSelect: () => setShowCodeSearch(true),
              },
              {
                label: "Editar producto",
                onSelect: () => setShowDescriptionEdit(true),
              },
              {
                label: "Quitar relación",
                destructive: true,
                disabled: !canRemove,
                title: canRemove
                  ? undefined
                  : "Este código distingue esta posición de otra del mismo SKU. Puedes editarlo, pero no quitarlo.",
                onSelect: () => {
                  onRemove();
                  setMode("search");
                  setOriginalDescription(null);
                  setIsNew(false);
                  setQuery("");
                  setResults([]);
                  setExpandedId(null);
                  setPopoverOpen(false);
                  setTakenBlock(null);
                  setShowCodeSearch(false);
                  setShowDescriptionEdit(false);
                },
              },
            ]}
          />
        )}
      </div>

      {mode === "search" && (
        <>
          {searchBlock(searchPlaceholder)}
          {card.can_manage && !takenBlock && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCreateNew}
                className="inline-flex items-center gap-1 text-xs font-medium text-info hover:text-info-strong focus:outline-none focus:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Crear producto
              </button>
            </div>
          )}
          {takenAlert}
          {takenActions}
        </>
      )}

      {mode === "creating" && (
        <>
          {searchBlock(searchPlaceholder)}
          <div className="space-y-1.5">
            <FieldLabel required>Código</FieldLabel>
            <Input
              value={entry.code}
              disabled={disabled}
              className={cn("font-mono", disabled ? readonlyClass : "")}
              onChange={(e) => onChange({ ...entry, code: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <FieldLabel required>Descripción del producto</FieldLabel>
            <Input
              value={entry.description}
              disabled={disabled}
              className={disabled ? readonlyClass : ""}
              onChange={(e) => onChange({ ...entry, description: e.target.value })}
            />
          </div>
          {entry.code.trim() !== "" && entry.description.trim() !== "" && (
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
          {showCodeSearch && searchBlock(searchPlaceholder)}
          {showCodeSearch && card.can_manage && !takenBlock && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleCreateNew}
                className="inline-flex items-center gap-1 text-xs font-medium text-info hover:text-info-strong focus:outline-none focus:underline"
              >
                <Plus className="h-3.5 w-3.5" />
                Crear producto en el catálogo de {card.name}
              </button>
            </div>
          )}
          {takenAlert}
          {takenActions}
          {isCreate ? (
            <>
              <div className="space-y-1.5">
                <FieldLabel>Código</FieldLabel>
                <Input
                  value={entry.code}
                  disabled={disabled}
                  readOnly
                  tabIndex={-1}
                  className={cn("font-mono", readonlyClass)}
                />
              </div>
              <div className="space-y-1.5">
                <FieldLabel required>Descripción del producto</FieldLabel>
                <Input
                  value={entry.description}
                  disabled={disabled}
                  className={disabled ? readonlyClass : ""}
                  onChange={(e) => onChange({ ...entry, description: e.target.value })}
                />
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <div className="font-mono text-base font-semibold text-foreground">
                {entry.code || "—"}
              </div>
              {!showDescriptionEdit && (
                <div className="text-sm text-foreground">
                  {entry.description?.trim() ? entry.description : "—"}
                </div>
              )}
              {showDescriptionEdit && (
                <div className="space-y-1.5 pt-2">
                  <FieldLabel required>Descripción del producto</FieldLabel>
                  <Input
                    value={entry.description}
                    disabled={disabled}
                    className={disabled ? readonlyClass : ""}
                    onChange={(e) => onChange({ ...entry, description: e.target.value })}
                  />
                </div>
              )}
            </div>
          )}
          {descriptionChanged && !disabled && (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-[var(--status-warning-strong)]">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--status-warning-strong)]" />
              <span>
                La descripción se actualizará en el catálogo de {card.name}&nbsp;y
                se refleja en todos los acuerdos que usen este código.
              </span>
            </div>
          )}
          {!isCreate && showDescriptionEdit && !disabled && (
            <div className="flex justify-end">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  onChange({ ...entry, description: originalDescription ?? "" });
                  setShowDescriptionEdit(false);
                }}
              >
                Descartar
              </Button>
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
                <StatusBadge status="neutral" label="Asignado a esta posición" />
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

        const isDraft = posStatus === "draft";
        const badgeStatus: "info" | "neutral" = isDraft ? "neutral" : "info";
        const badgeLabel = isDraft ? "En gestión" : "En posición";
        const badgeIcon = isDraft ? Pencil : Info;

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
              <StatusBadge
                status={badgeStatus}
                label={badgeLabel}
                icon={badgeIcon}
              />
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
  const [productId, setProductId] = useState<string | null>(null);
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
    published_at: string | null;
    sale_price: number | null;
    start_date: string | null;
    end_date: string | null;
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
    updated_at: string | null;
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
  const [skuPositionsExpanded, setSkuPositionsExpanded] = useState(false);
  const [skuBlockCollapsed, setSkuBlockCollapsed] = useState(true);
  // Loading del bloque transversal mientras `prefillFromSku` resuelve las
  // dos llamadas en paralelo. Reserva altura con skeleton para evitar que
  // el modal empuje el contenido al aparecer el bloque.
  const [skuBlockLoading, setSkuBlockLoading] = useState(false);
  const conflictSeq = useRef(0);
  const searchSeq = useRef(0);
  const PAGE_SIZE = 20;

  const isCreatingLine = !initial?.line_id;

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
      return;
    }
    const cseq = ++conflictSeq.current;
    setNConflict({ kind: "loading", lines: [] });
    try {
      const res = await conflictFn({
        data: { agreement_id: agreementId, sku: trimmed },
      });
      if (cseq !== conflictSeq.current) return;
      if (pid) setProductId(pid);
      else setProductId(res.product_id ?? null);
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
    } catch (e) {
      if (cseq !== conflictSeq.current) return;
      setNConflict({ kind: "idle", lines: [] });
      console.error("detectNConflict failed", e);
    }
  };

  const prefillFromSku = async (sku: string) => {
    const trimmed = sku.trim();
    if (!trimmed) return;
    // En edición el producto ya existe: no hay razón para esperar a
    // `lookupProductBySku` antes de disparar `searchProducts`. Se lanzan en
    // paralelo y cada resultado se procesa de forma independiente.
    // El skeleton lo enciende el efecto de apertura solo si la semilla
    // (`sibling_positions_hint`) indica que hay hermanas; aquí no se toca.
    const [lookupR, searchR] = await Promise.allSettled([
      lookupFn({ data: { sku: trimmed } }),
      searchFn({
        data: {
          query: trimmed,
          offset: 0,
          limit: 5,
          agreement_id: agreementId,
        },
      }),
    ]);

    // Metadatos del producto (ficha SUMATEC).
    if (lookupR.status === "fulfilled") {
      const res = lookupR.value;
      if (!res.found) {
        setProductMeta(null);
        setLookup({ kind: "not_found", catalogUpdatedAt: res.catalog_updated_at });
      } else {
        setProductMeta({
          erp_description: res.erp_description,
          commercial_brand: res.commercial_brand,
          updated_at: res.product_updated_at ?? null,
        });
        setLookup({
          kind: res.status === "active" ? "active" : "inactive",
          catalogUpdatedAt: res.catalog_updated_at,
        });
      }
    } else {
      console.error("lookupProductBySku failed", lookupR.reason);
    }

    // Otras posiciones del mismo SKU en el acuerdo (bloque transversal).
    // Ver comentario en la versión previa: en edición PUBLICADA solo se
    // muestran las OTRAS publicadas; en DRAFT se muestran todas las demás.
    if (searchR.status === "fulfilled") {
      const s = searchR.value;
      const match = s.rows.find((r) => r.sku === trimmed);
      if (match) {
        setProductId(match.id);
        if (match.agreement_status.kind === "in_agreement") {
          const own = initial?.line_id ?? null;
          const editingPublished = !!initial?.status && initial.status !== "draft";
          const others = match.agreement_status.positions.filter((p) => {
            if (p.position_id === own) return false;
            if (editingPublished) return p.published_at != null;
            return true;
          });
          if (others.length > 0) {
            setSkuInAgreement({
              sku: match.sku,
              productDescription: match.erp_description,
              positions: others,
            });
          } else {
            setSkuInAgreement(null);
          }
        } else {
          setSkuInAgreement(null);
        }
      }
    } else {
      console.error("prefill searchProducts failed", searchR.reason);
    }
    setSkuBlockLoading(false);
    await runConflict(trimmed, null);
  };


  useLayoutEffect(() => {
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
    // Hidratar productMeta/lookup desde `initial` cuando la lista ya trae
    // los datos del producto (edición). Evita el parpadeo de inputs vacíos
    // mientras `prefillFromSku` refresca en segundo plano.
    const seededProduct =
      initial?.line_id &&
      (initial.erp_description !== undefined ||
        initial.commercial_brand !== undefined ||
        initial.product_status !== undefined);
    if (seededProduct) {
      setProductMeta({
        erp_description: initial!.erp_description ?? null,
        commercial_brand: initial!.commercial_brand ?? null,
        updated_at: initial!.product_updated_at ?? null,
      });
      setLookup({
        kind:
          initial!.product_status === "active"
            ? "active"
            : initial!.product_status
              ? "inactive"
              : "idle",
      });
    } else {
      setProductMeta(null);
      setLookup({ kind: next.sku.trim() ? "idle" : "empty" });
    }
    setNConflict({ kind: "idle", lines: [] });
    setProductId(null);
    setSaveError(null);
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchHasMore(false);
    setSkuInAgreement(null);
    setSkuPositionsExpanded(false);
    setSkuBlockCollapsed(true);
    const willPrefill = !!(initial?.line_id && next.sku.trim());
    // Encender el skeleton ya, en el mismo commit sincrónico, para que el
    // hueco esté reservado antes del primer paint del modal.
    setSkuBlockLoading(willPrefill && (initial?.sibling_positions_hint ?? 0) > 0);
    if (willPrefill) {
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
      updated_at: p.updated_at,
    });
    setProductId(p.id);
    setLookup({ kind: p.status === "active" ? "active" : "inactive" });
    setSaveError(null);
    setSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
    setSearchHasMore(false);
    // En edición, tras elegir el nuevo SKU cerramos el buscador — el producto
    // vigente se muestra en los campos readonly. El usuario puede reabrir con
    // "Cambiar SKU" si necesita otro cambio.
    if (initial?.line_id) setShowSkuSearch(false);
    // Estado del SKU respecto al acuerdo — solo aplica al crear.
    // En edición mantenemos el flujo previo (panel de vinculación de precios).
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
    setSkuPositionsExpanded(false);
    setNConflict({ kind: "idle", lines: [] });
    setSaveError(null);
  };

  // En edición, el producto existe desde la semilla (productMeta hidratado
  // en el useLayoutEffect de apertura). productId se llena después con
  // prefillFromSku para las operaciones de link/unlink, pero la tarjeta
  // debe mostrarse expandida desde el primer frame para evitar el salto.
  const hasProduct = !!productId || (!!initial?.line_id && !!productMeta);

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

  // Regla par a par (position_has_sku_conflict): estoy en conflicto si existe
  // AL MENOS UNA posición publicada del mismo SKU contra la cual NINGÚN cliente
  // me distingue. Un cliente distingue un par si tiene código en ambos lados
  // (RN-MATCH-01 garantiza que los códigos serán distintos entre posiciones).
  // Distinguir contra UNA no basta; hay que distinguir contra TODAS.
  const undistinguishedSiblings = useMemo(() => {
    if (!productId || !skuInAgreement) return [];
    const publishedSiblings = skuInAgreement.positions.filter(
      (p) => p.published_at != null,
    );
    const myClientsWithCode = new Set<string>();
    for (const [cid, e] of codeEntries) {
      if (e && e.code && e.code.trim() !== "") myClientsWithCode.add(cid);
    }
    return publishedSiblings.filter((p) => {
      for (const c of p.codes) {
        if (myClientsWithCode.has(c.client_id)) return false;
      }
      return true;
    });
  }, [productId, skuInAgreement, codeEntries]);

  const wouldConflictOnPublish = undistinguishedSiblings.length > 0;

  // requiredClientIds: unión de clientes que aparecen en las posiciones aún no
  // distinguidas. Un código para cualquiera de ellos resuelve al menos un par;
  // si ese cliente está en varias no distinguidas, las resuelve todas de una.
  const requiredClientIds = useMemo<Set<string>>(() => {
    const s = new Set<string>();
    for (const p of undistinguishedSiblings) {
      for (const c of p.codes) s.add(c.client_id);
    }
    return s;
  }, [undistinguishedSiblings]);

  // canRemoveClientIds: para cada cliente con código en esta posición, simular
  // la lista sin ese cliente y aplicar la regla par a par de
  // position_has_sku_conflict. Si tras quitarlo alguna hermana publicada queda
  // sin distinguirse contra mí, no se puede quitar (rompería el desempate).
  // "Editar" no pasa por acá — reemplazar sigue permitido.
  const canRemoveClientIds = useMemo<Set<string>>(() => {
    const out = new Set<string>();
    if (!productId || !skuInAgreement) {
      for (const [cid, e] of codeEntries) {
        if (e && e.code && e.code.trim() !== "") out.add(cid);
      }
      return out;
    }
    const publishedSiblings = skuInAgreement.positions.filter(
      (p) => p.published_at != null,
    );
    const myClientsWithCode = new Set<string>();
    for (const [cid, e] of codeEntries) {
      if (e && e.code && e.code.trim() !== "") myClientsWithCode.add(cid);
    }
    for (const cid of myClientsWithCode) {
      const simulated = new Set(myClientsWithCode);
      simulated.delete(cid);
      const stillDistinguished = publishedSiblings.every((p) => {
        for (const c of p.codes) {
          if (simulated.has(c.client_id)) return true;
        }
        return false;
      });
      if (stillDistinguished) out.add(cid);
    }
    return out;
  }, [productId, skuInAgreement, codeEntries]);


  // isPublishableDraft(values): completa (SKU, precio, fecha inicio) y vigente
  // (fecha efectiva de fin no vencida). Usa las fechas efectivas del acuerdo
  // cuando la posición no las trae, coincidiendo con publish_positions RPC.
  const canPublishNow = useMemo(() => {
    if (!canOfferPublish) return false;
    if (!productId) return false;
    if (wouldConflictOnPublish) return false;
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
    wouldConflictOnPublish,
    v.sale_price,
    v.start_date,
    v.end_date,
    agreementStartDate,
    agreementEndDate,
  ]);

  // Tokens de pending_reason en la posición editada, calculados desde el
  // formulario con el mismo orden y semántica del predicado del backend
  // (compute_position_pending_reason). En edición conservamos sku_conflict
  // del initial: solo el backend puede desempatarlo con las contrapartes.
  const pendingReasonTokens = useMemo<string[]>(() => {
    const tokens: string[] = [];
    if (!productId || v.sku.trim() === "") tokens.push("no_sku");
    if (productId && lookup.kind === "inactive") tokens.push("sku_inactive");
    // sku_conflict: calculado en cliente sobre agreement_status (publicadas
    // del acuerdo, excluyendo la propia). Se limpia dinámicamente cuando el
    // usuario agrega un código de un cliente que desempata.
    if (wouldConflictOnPublish) tokens.push("sku_conflict");
    const sale = parsePriceInput(v.sale_price);
    if (sale == null || sale <= 0) tokens.push("no_price");
    const effStart = v.start_date.trim() || agreementStartDate || "";
    const effEnd = v.end_date.trim() || agreementEndDate || "";
    if (!effStart || !effEnd) {
      tokens.push("no_dates");
    } else {
      const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(effEnd);
      if (m) {
        const end = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        if (end.getTime() < today.getTime()) tokens.push("expired");
      }
    }
    return tokens;
  }, [
    productId,
    v.sku,
    v.sale_price,
    v.start_date,
    v.end_date,
    lookup.kind,
    wouldConflictOnPublish,
    agreementStartDate,
    agreementEndDate,
  ]);

  const PENDING_LABELS: Record<string, string> = {
    no_sku: "Sin SKU",
    no_price: "Sin precio",
    no_dates: "Sin vigencia",
    expired: "Vigencia vencida",
    sku_inactive: "SKU inactivo",
    sku_conflict: "En conflicto",
  };

  const hasPendingTokens = pendingReasonTokens.length > 0;
  const effectiveCanPublishNow = canPublishNow && !hasPendingTokens;

  // Si la validación deja de cumplirse (p.ej. el usuario borra el precio),
  // desmarcar publishOnSave para que el label del botón vuelva a "Guardar".
  useEffect(() => {
    if (!effectiveCanPublishNow && publishOnSave) setPublishOnSave(false);
  }, [effectiveCanPublishNow, publishOnSave]);

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

  // R-09: si cambia el SKU en una posición publicada, exigimos que el usuario
  // declare la naturaleza del cambio (cambio real vs corrección) antes de
  // guardar. La etiqueta y la nota se propagan al patch de la RPC, que las
  // escribe en el cierre del tramo de precio y en los códigos que cierra.
  const isSkuChangeOnPublished = useMemo(() => {
    if (!isEdit) return false;
    if (!initial?.status || initial.status === "draft") return false;
    if (!productId) return false;
    const before = (initial?.sku ?? "").trim();
    const after = v.sku.trim();
    return before !== "" && after !== "" && before !== after;
  }, [isEdit, initial?.status, initial?.sku, v.sku, productId]);

  type SkuChangeChoice = { kind: "sku_changed" | "sku_corrected"; note?: string };
  const [skuChangePrompt, setSkuChangePrompt] = useState<{
    open: boolean;
    kind: "sku_changed" | "sku_corrected" | null;
    note: string;
  }>({ open: false, kind: null, note: "" });

  // Nuevo flujo R-09: la intención del cambio de SKU se declara ANTES de
  // elegir el nuevo, no al guardar. Cuando el usuario pulsa "Cambiar SKU" en
  // una posición publicada, se abre skuChangePrompt; al confirmar se guarda la
  // intención en skuChangeIntent y se despliega el buscador. Al guardar, si
  // hay intent se envía directo a la RPC sin volver a preguntar.
  const [skuChangeIntent, setSkuChangeIntent] = useState<SkuChangeChoice | null>(null);
  // Visibilidad del buscador de SKU en modo edición. En creación siempre se
  // ve; en edición solo cuando el usuario decide cambiar el SKU.
  const [showSkuSearch, setShowSkuSearch] = useState<boolean>(!initial?.line_id);

  useEffect(() => {
    // Reset del prompt al cerrar el diálogo o cambiar de posición editada.
    if (!open) {
      setSkuChangePrompt({ open: false, kind: null, note: "" });
      setSkuChangeIntent(null);
    }
    setShowSkuSearch(!initial?.line_id);
  }, [open, initial?.line_id]);

  const save = useMutation({
    mutationFn: async (choice: SkuChangeChoice | undefined = undefined) => {
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
              // R-09: la RPC valida obligatoriedad. Solo se envían si el
              // usuario declaró el motivo del cambio de SKU.
              sku_change_kind: choice?.kind,
              sku_change_note: choice?.note,
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
        // create_agreement_line devuelve { position_id }
        targetId = (saveRes as { position_id?: string } | null)?.position_id ?? null;
      }

      // Encadenado publicar-al-guardar. Se salta si el guardado quedó bloqueado
      // (RN-MATCH-01 / identity_no_codes): onSuccess muestra el toast de bloqueo.
      const saveBlocked =
        !!(saveRes as { blocked?: boolean } | null)?.blocked;
      let publishRes: Awaited<ReturnType<typeof publishFn>> | null = null;
      if (publishOnSave && effectiveCanPublishNow && targetId && !saveBlocked) {
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
        ? false
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



  const readonlyClass = "bg-muted/70 border-transparent shadow-none cursor-not-allowed focus-visible:ring-0 focus-visible:ring-offset-0";
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

        {skuBlockLoading && !skuInAgreement && (
          <div
            className="shrink-0 border-b border-border bg-muted/30 px-6 py-3"
            aria-busy="true"
            aria-live="polite"
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2 min-w-0">
                <Info className="h-4 w-4 text-accent shrink-0 opacity-40" aria-hidden="true" />
                <div className="h-4 w-64 rounded bg-muted animate-pulse" />
              </div>
              <div className="h-4 w-14 rounded bg-muted animate-pulse" />
            </div>
            <div className="grid gap-3 items-stretch grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-md border border-border bg-white p-3 flex flex-col gap-2 h-[116px]"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="h-5 w-20 rounded-full bg-muted animate-pulse" />
                    <div className="h-4 w-20 rounded bg-muted animate-pulse" />
                  </div>
                  <div className="h-3 w-40 rounded bg-muted animate-pulse" />
                  <div className="border-t border-border mt-1 pt-2 space-y-2">
                    <div className="h-3 w-52 rounded bg-muted animate-pulse" />
                    <div className="h-3 w-32 rounded bg-muted animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {skuInAgreement && skuInAgreement.positions.length > 0 && (() => {
          const positions = skuInAgreement.positions;
          const visible = skuPositionsExpanded ? positions : positions.slice(0, 3);
          const hidden = positions.length - visible.length;
          const statusMeta: Record<
            SkuAgreementPosition["position_status"],
            { label: string; status: "active" | "danger" | "neutral" }
          > = {
            active: { label: "Activa", status: "active" },
            requires_review: { label: "Revisar", status: "danger" },
            draft: { label: "En gestión", status: "neutral" },
            excluded: { label: "Excluida", status: "neutral" },
          };
          const effRangeParts = (pos: SkuAgreementPosition) => {
            const s = fmtDateLocal(pos.start_date) ?? fmtDateLocal(agreementStartDate);
            const e = fmtDateLocal(pos.end_date) ?? fmtDateLocal(agreementEndDate);
            if (!s && !e) return null;
            const endIso = pos.end_date ?? agreementEndDate ?? null;
            let expired = false;
            if (endIso) {
              const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(endIso);
              if (m) {
                const endDate = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                expired = endDate.getTime() < today.getTime();
              }
            }
            return { start: s ?? "—", end: e ?? "—", expired };
          };
          const fmtExclusionDate = (iso: string | null) => {
            if (!iso) return null;
            const d = new Date(iso);
            if (Number.isNaN(d.getTime())) return null;
            return d.toLocaleDateString("es-CO", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
          };
          const gridCols =
            positions.length === 1
              ? "grid-cols-1"
              : "grid-cols-1 md:grid-cols-2 xl:grid-cols-3";
          return (
            <div className="shrink-0 max-h-[40vh] overflow-y-auto border-b border-border bg-muted/30 px-6 py-3">
              <button
                type="button"
                onClick={() => setSkuBlockCollapsed((v) => !v)}
                className={cn(
                  "w-full flex items-center justify-between gap-3 cursor-pointer text-left",
                  !skuBlockCollapsed && "mb-3",
                )}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Info className="h-4 w-4 text-accent shrink-0" aria-hidden="true" />
                  <h3 className="text-sm font-semibold text-accent truncate">
                    Posiciones en el acuerdo con este SKU ({positions.length})
                  </h3>
                </div>
                <span className="text-sm font-medium text-accent hover:underline shrink-0">
                  {skuBlockCollapsed ? "Mostrar" : "Cerrar"}
                </span>
              </button>
              {!skuBlockCollapsed && (
              <div className={cn("grid gap-3 items-stretch", gridCols)}>
                {visible.map((pos) => {
                  const meta = statusMeta[pos.position_status];
                  const isExcluded = pos.position_status === "excluded";
                  const range = effRangeParts(pos);
                  const exclDate = fmtExclusionDate(pos.exclusion_date);
                  return (
                    <div
                      key={pos.position_id}
                      className="rounded-md border border-border bg-white p-3 text-sm flex flex-col h-full"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge status={meta.status} label={meta.label} />
                          {range && (
                            <span className="text-xs text-muted-foreground">
                              {range.start} →{" "}
                              <span className={range.expired ? "line-through text-error-strong" : ""}>
                                {range.end}
                              </span>
                            </span>
                          )}
                        </div>
                        <span className="font-bold text-foreground">
                          {pos.sale_price != null
                            ? formatMoneyCOP(pos.sale_price)
                            : "—"}
                        </span>
                      </div>
                      {pos.codes.length > 0 && (
                        <div className="mt-2 border-t border-border pt-2 space-y-2">
                          {pos.codes.map((c) => (
                            <div
                              key={`${c.client_id}|${c.client_code}`}
                              className="text-sm"
                            >
                              <div>
                                <span className="text-xs font-semibold uppercase tracking-wide text-accent">
                                  {c.client_name ?? "Cliente"}
                                </span>{" "}
                                ·{" "}
                                <span className="font-mono font-semibold text-foreground">{c.client_code}</span>
                              </div>
                              {c.description && (
                                <div className="text-muted-foreground">
                                  {c.description}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {isExcluded && (pos.exclusion_reason || exclDate) && (
                        <div className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
                          {pos.exclusion_reason ?? "Sin motivo registrado."}
                          {exclDate ? ` · ${exclDate}` : ""}
                        </div>
                      )}
                      {!isExcluded && (
                        <div className="mt-auto pt-2 flex justify-end">
                          <Button
                            type="button"
                            size="sm"
                            variant="link"
                            className="h-auto px-0 text-accent"
                            onClick={() =>
                              onSwitchToPosition?.(pos.position_id)
                            }
                          >
                            Ir a esta posición
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              )}
              {!skuBlockCollapsed && hidden > 0 && (
                <div className="mt-3 flex justify-center">
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
            </div>
          );
        })()}

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)]">

          {/* Columna izquierda — la posición */}
          <div className="min-h-0 overflow-y-auto bg-white border-r border-border">


            <div className="p-6 space-y-8">
              {/* Producto Jaivaná */}
              <section className="space-y-4">
                <SectionHeader title="INFORMACIÓN DE SUMATEC" number="01" />
                {!isEdit && (
                  <p className="text-xs text-muted-foreground leading-relaxed min-h-[3.75rem]">
                    Una posición es la identidad de lo acordado: un producto de
                    Sumatec, su precio y su vigencia en el acuerdo. Para
                    activarla necesita los tres, pero puedes crearla sin ellos —
                    quedará en gestión mientras los defines.
                  </p>
                )}
                <div className="rounded-lg border border-input bg-muted/40 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-foreground">SUMATEC</div>
                    {isEdit && (
                      <RowActionsMenu
                        row={{}}
                        ariaLabel="Acciones del SKU Sumatec"
                        actions={[
                          {
                            label: "Cambiar SKU",
                            onSelect: () => {
                              // Draft: sin diálogo, solo abre el buscador (no hay
                              // historia comercial que etiquetar).
                              // Publicada: pedimos la razón antes de abrir el buscador.
                              const isPublished =
                                !!initial?.status && initial.status !== "draft";
                              if (isPublished) {
                                setSkuChangePrompt({ open: true, kind: null, note: "" });
                              } else {
                                setShowSkuSearch(true);
                              }
                            },
                          },
                        ]}
                      />
                    )}
                  </div>


                  {(!isEdit || showSkuSearch) && (
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
                            const positionsCount =
                              p.agreement_status.kind === "in_agreement"
                                ? p.agreement_status.positions.length
                                : 0;
                            const isInactive = p.status !== "active";
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => onSelectProduct(p)}
                                className="flex w-full flex-col gap-0.5 px-3 py-2 text-left hover:bg-muted focus:bg-muted focus:outline-none"
                              >
                                <span className="flex items-center gap-2">
                                  <span className="font-mono text-sm font-medium text-foreground">
                                    {p.sku}
                                  </span>
                                  {isInactive && (
                                    <StatusBadge status="danger" label="Inactivo" />
                                  )}
                                </span>
                                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                  <span className="truncate">
                                    {p.erp_description ?? "—"}
                                  </span>
                                  <span aria-hidden>·</span>
                                  <span>{p.commercial_brand ?? "—"}</span>
                                </span>
                                {positionsCount > 0 && (
                                  <span className="mt-1">
                                    <StatusBadge
                                      status="info"
                                      label={`En acuerdo (${positionsCount} ${positionsCount === 1 ? "posición" : "posiciones"})`}
                                    />
                                  </span>
                                )}
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
                  )}

                  {isEdit && showSkuSearch && skuChangeIntent && (
                    <div className="flex justify-end">
                      <span className="text-xs text-muted-foreground/70">
                        {skuChangeIntent.kind === "sku_changed"
                          ? "Cambio real"
                          : "Corrección"}
                      </span>
                    </div>
                  )}

                  {!isEdit && !hasProduct && (
                    <div className="flex justify-end">
                      <span className="text-xs font-medium text-muted-foreground/60">
                        PIM Sumatec
                      </span>
                    </div>
                  )}


                  {hasProduct && isEdit && (
                    <div className="space-y-1">
                      <div className="flex items-baseline gap-3 flex-wrap">
                        <span className="font-mono text-base font-semibold text-foreground">
                          {v.sku || "—"}
                        </span>
                        {productMeta?.commercial_brand && (
                          <span className="text-xs text-muted-foreground uppercase tracking-wide">
                            {productMeta.commercial_brand}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-foreground">
                        {productMeta?.erp_description ?? "—"}
                      </div>
                    </div>
                  )}

                  {hasProduct && !isEdit && (
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

                  {!isEdit && hasProduct && (
                    <div className="flex justify-end">
                      <span className="text-xs font-medium text-muted-foreground/60">
                        PIM Sumatec
                        {fmtCatalogDate(productMeta?.updated_at)
                          ? `: ${fmtCatalogDate(productMeta?.updated_at)}`
                          : ""}
                      </span>
                    </div>
                  )}

                  {lookup.kind === "inactive" && (
                    <Alert variant="warning">
                      <AlertDescription>
                        Producto inactivo en el catálogo. La posición quedará en estado de gestión mientras se resuelve el estado del producto.
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

                  {skuInAgreement && (isEdit ? hasSkuConflict : true) && (
                    <Alert variant="info">
                      <Info className="h-4 w-4" />
                      <AlertDescription>
                        Este SKU ya está en otras posiciones del acuerdo. Puede estar en varias, si cada una tiene un código de cliente que la distinga.
                      </AlertDescription>
                    </Alert>
                  )}



                </div>
              </section>

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
                      <FieldLabel required>Precio de venta</FieldLabel>
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
                      <FieldLabel required>Fecha inicio</FieldLabel>
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


          {/* Columna derecha — códigos por cliente. Se oculta mientras el SKU
              esté en el acuerdo y el usuario no haya declarado intención. */}
          <div className="min-h-0 overflow-y-auto bg-muted/20">

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <SectionHeader title="PRODUCTOS DEL CLIENTE" number="03" />
                </div>
              </div>
              {!isEdit && (
                <p className="text-xs text-muted-foreground leading-relaxed min-h-[3.75rem]">
                  Relaciona la posición con el código que cada cliente usa para identificar este producto. Cada código puede estar en una sola posición del acuerdo. Búscalo en su catálogo o créalo si no existe.
                </p>
              )}
              <ClientCodeCards
                clients={clientCards}
                values={codeEntries}
                agreementId={agreementId}
                agreementStartDate={agreementStartDate}
                agreementEndDate={agreementEndDate}
                initialLineId={initial?.line_id ?? null}
                open={open}
                requiredForClientIds={requiredClientIds}
                canRemoveClientIds={canRemoveClientIds}
                isCreate={!isEdit}
                onChange={(clientId, next) => {
                  setCodeEntries((prev) => {
                    const m = new Map(prev);
                    m.set(clientId, next);
                    return m;
                  });
                }}
                onRemove={(clientId) => {
                  setCodeEntries((prev) => {
                    const m = new Map(prev);
                    m.set(clientId, { code: "", description: "" });
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
          {canOfferPublish && !saveError && (
            <label
              className={cn(
                "flex items-start gap-2 sm:mr-auto",
                effectiveCanPublishNow ? "" : "opacity-70",
              )}
            >
              <Checkbox
                id="publish-on-save"
                checked={publishOnSave}
                onCheckedChange={(c) => setPublishOnSave(c === true)}
                disabled={!effectiveCanPublishNow || save.isPending}
                className="mt-0.5"
              />
              <span className="flex flex-col leading-tight">
                <span className="suma-body text-text-primary font-medium">Publicar en acuerdo al guardar</span>
                <span className="suma-caption text-text-tertiary">
                  {wouldConflictOnPublish
                    ? "Esta posición quedará en conflicto y no podrá publicarse."
                    : hasPendingTokens
                      ? `Pendiente: ${pendingReasonTokens.map((t) => PENDING_LABELS[t] ?? t).join(" · ")}.`
                      : effectiveCanPublishNow
                        ? "La posición cumple con los datos requeridos para activarse en el acuerdo."
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
                setSaveError(null);
                if (isSkuChangeOnPublished && !skuChangeIntent) {
                  // Salvaguarda: en el flujo normal el intent se declara al
                  // pulsar "Cambiar SKU". Si por algún motivo llega hasta aquí
                  // sin intent, pedimos la razón antes de guardar.
                  setSkuChangePrompt({ open: true, kind: null, note: "" });
                  return;
                }
                save.mutate(skuChangeIntent ?? undefined);
              }}
              disabled={save.isPending || hasCreatingIncomplete}
            >
              {save.isPending
                ? "Guardando…"
                : publishOnSave && effectiveCanPublishNow
                  ? "Guardar y publicar"
                  : isEdit
                    ? "Guardar cambios"
                    : "Guardar"}
            </Button>
          </div>
        </div>


      </DialogContent>

      {/* R-09 · AlertDialog: motivo del cambio de SKU en posición publicada. */}
      <AlertDialog
        open={skuChangePrompt.open}
        onOpenChange={(o) =>
          setSkuChangePrompt((p) => ({ ...p, open: o }))
        }
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Por qué cambia el SKU?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta decisión define cómo se lee la historia comercial de la
              posición. No cambia lo que se guarda; cambia lo que significa.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 py-2">
            <label
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                skuChangePrompt.kind === "sku_changed"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/40",
              )}
            >
              <input
                type="radio"
                name="sku-change-kind"
                className="mt-1"
                checked={skuChangePrompt.kind === "sku_changed"}
                onChange={() =>
                  setSkuChangePrompt((p) => ({ ...p, kind: "sku_changed" }))
                }
              />
              <span className="flex flex-col gap-1">
                <span className="suma-body font-medium text-text-primary">
                  Cambio real
                </span>
                <span className="suma-caption text-text-tertiary">
                  El producto pactado cambió. El precio anterior fue un precio
                  real de {(initial?.sku ?? "").trim() || "el SKU anterior"}.
                </span>
              </span>
            </label>

            <label
              className={cn(
                "flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors",
                skuChangePrompt.kind === "sku_corrected"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/40",
              )}
            >
              <input
                type="radio"
                name="sku-change-kind"
                className="mt-1"
                checked={skuChangePrompt.kind === "sku_corrected"}
                onChange={() =>
                  setSkuChangePrompt((p) => ({ ...p, kind: "sku_corrected" }))
                }
              />
              <span className="flex flex-col gap-1 w-full">
                <span className="suma-body font-medium text-text-primary">
                  Corrección
                </span>
                <span className="suma-caption text-text-tertiary">
                  El SKU estaba mal escrito. El precio anterior no era de
                  {" "}
                  {(initial?.sku ?? "").trim() || "ese SKU"}.
                </span>
                {skuChangePrompt.kind === "sku_corrected" && (
                  <Textarea
                    className="mt-2"
                    rows={3}
                    maxLength={500}
                    placeholder="¿Por qué se corrigió? (obligatorio)"
                    value={skuChangePrompt.note}
                    onChange={(e) =>
                      setSkuChangePrompt((p) => ({ ...p, note: e.target.value }))
                    }
                  />
                )}
              </span>
            </label>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={
                !skuChangePrompt.kind ||
                (skuChangePrompt.kind === "sku_corrected" &&
                  skuChangePrompt.note.trim().length === 0)
              }
              onClick={(e) => {
                e.preventDefault();
                if (!skuChangePrompt.kind) return;
                if (
                  skuChangePrompt.kind === "sku_corrected" &&
                  skuChangePrompt.note.trim().length === 0
                )
                  return;
                const choice: SkuChangeChoice = {
                  kind: skuChangePrompt.kind,
                  note:
                    skuChangePrompt.kind === "sku_corrected"
                      ? skuChangePrompt.note.trim()
                      : undefined,
                };
                setSkuChangePrompt({ open: false, kind: null, note: "" });
                // Declaramos la intención y abrimos el buscador. El guardado
                // se ejecuta cuando el usuario elija el nuevo SKU y pulse
                // "Guardar" — sin volver a preguntar.
                setSkuChangeIntent(choice);
                setShowSkuSearch(true);
              }}
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>



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

