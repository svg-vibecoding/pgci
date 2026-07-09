import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, Calendar, ChevronDown, Link, Link2, Loader2, Search, Unlink } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoneyCOP } from "@/lib/format";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
} from "@/lib/agreements.functions";

export type LineEditClientCode = {
  client_id: string;
  client_code: string;
  description: string;
};

export type LineEditValues = {
  line_id?: string | null;
  sku: string;
  // Campos visibles del formulario transitorio (editan el primer cliente).
  client_code: string;
  client_description: string;
  // Estado completo de códigos por cliente. La UI transitoria solo edita el
  // primero, pero el patch enviado incluye la lista COMPLETA para no cerrar
  // silenciosamente los períodos de otros clientes (RN declarativa).
  client_codes: LineEditClientCode[];
  sale_price: string;
  par_price: string;
  start_date: string;
  end_date: string;
  observations: string;
};

const empty: LineEditValues = {
  line_id: null,
  sku: "",
  client_code: "",
  client_description: "",
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
// Devuelve el número completo sin redondear o null si no aplica.
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

// Muestra siempre 2 decimales con coma decimal y punto de miles (estándar CO).
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
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agreementId: string;
  agreementName?: string | null;
  clientName?: string | null;
  initial?: Partial<LineEditValues> | null;
  agreementStartDate?: string | null;
  agreementEndDate?: string | null;
  // Clientes activos del acuerdo. Requerido para decidir el modo del formulario
  // transitorio: 1 cliente = precarga; ≥2 = inputs deshabilitados.
  agreementClients?: Array<{ id: string; name: string | null }>;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createAgreementLine);
  const patchFn = useServerFn(updateAgreementLine);
  const lookupFn = useServerFn(lookupProductBySku);
  const conflictFn = useServerFn(detectNConflict);
  const linkFn = useServerFn(linkSkuPrice);
  const unlinkFn = useServerFn(unlinkSkuPrice);
  const searchFn = useServerFn(searchProducts);
  const isMultiClient = (agreementClients?.length ?? 0) > 1;
  const singleClientId =
    (agreementClients?.length ?? 0) === 1 ? agreementClients![0].id : null;
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
      // Prefer product_id returned from the search selection; fallback to server resolution.
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

  // Solo se usa en modo edición para prepoblar los campos RO del SKU inicial.
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
      sale_price: normalizePriceOnBlur(merged.sale_price),
      par_price: normalizePriceOnBlur(merged.par_price),
    };
    setV(next);
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
    if (!hasProduct) {
      return "Las condiciones comerciales se habilitan cuando haya un producto Jaivaná seleccionado.";
    }
    // Solo mostrar herencia cuando ambos campos de vigencia están vacíos.
    if (v.start_date.trim() !== "" || v.end_date.trim() !== "") return null;
    const start = fmtDateLocal(agreementStartDate);
    const end = fmtDateLocal(agreementEndDate);
    if (start && end) {
      return `Las fechas de vigencia son opcionales. Si no se indican, se heredan del acuerdo (${start} — ${end}).`;
    }
    return null;
  }, [hasProduct, agreementStartDate, agreementEndDate, v.start_date, v.end_date]);

  const searchPlaceholder = hasProduct
    ? "Escribe para cambiar el producto..."
    : "Busca por código, descripción o marca...";



  const isEdit = !!initial?.line_id;

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
      if (isEdit) {
        return patchFn({
          data: {
            line_id: initial!.line_id!,
            patch: {
              sku: txt(v.sku),
              client_code: txt(v.client_code),
              client_description: txt(v.client_description),
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
          client_code: txt(v.client_code) ?? undefined,
          client_description: txt(v.client_description) ?? undefined,
          sale_price: num(v.sale_price),
          par_price: num(v.par_price) || undefined,
          start_date: txt(v.start_date) ?? undefined,
          end_date: txt(v.end_date) ?? undefined,
          observations: txt(v.observations) ?? undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success(isEdit ? "Posición actualizada" : "Posición creada");
      qc.invalidateQueries({ queryKey: ["agreements", "lines", agreementId] });
      qc.invalidateQueries({ queryKey: ["agreements", "detail", agreementId] });
      qc.invalidateQueries({ queryKey: ["agreements", "sku-groups", agreementId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
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


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-0 gap-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
          <DialogTitle className="text-2xl font-bold tracking-tight">
            {isEdit ? "Editar posición" : "Nueva posición"}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {agreementName && clientName
              ? `${agreementName} · ${clientName}`
              : agreementName || clientName || "Acuerdo comercial"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto bg-white">
          <div className="p-6 space-y-8">

            {/* Información del cliente */}
            <section className="space-y-4">
              <SectionHeader title="Información del cliente" number="01" />
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel>Código del cliente</FieldLabel>
                  <Input
                    className={inputClass}
                    value={v.client_code}
                    onChange={(e) => setV({ ...v, client_code: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <FieldLabel>Descripción del cliente</FieldLabel>
                  <Input
                    className={inputClass}
                    value={v.client_description}
                    onChange={(e) =>
                      setV({ ...v, client_description: e.target.value })
                    }
                  />
                </div>
              </div>
            </section>

            {/* Información Jaivaná */}
            <section className="space-y-4">
              <SectionHeader title="Información Jaivaná" number="02" />
              <div className="rounded-lg border border-input bg-muted/40 p-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Buscador — ancho completo */}
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

                {/* Campos solo lectura — visibles solo cuando hay producto seleccionado */}
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

            {/* Condiciones comerciales */}
            <section className="space-y-4">
              <SectionHeader title="Condiciones comerciales" number="03" />
              {agreementDatesLabel && (
                <Alert variant="info">
                  <AlertDescription>{agreementDatesLabel}</AlertDescription>
                </Alert>
              )}
              {hasProduct && (
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
              )}
            </section>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-muted/30 shrink-0 flex-col sm:flex-row sm:items-center gap-2">
          {saveError && (
            <p className="text-xs text-destructive sm:mr-auto">{saveError}</p>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={save.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => {
              // Bloquear solo cuando el usuario escribió en el buscador pero no
              // seleccionó ningún resultado. Sin producto y buscador vacío es válido
              // (posición queda en pending / Sin SKU).
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
        </DialogFooter>

      </DialogContent>
    </Dialog>
  );
}
