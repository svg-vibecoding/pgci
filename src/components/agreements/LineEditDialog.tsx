import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, ChevronDown, Info, Link2, Link2Off, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
} from "@/lib/agreements.functions";

export type LineEditValues = {
  line_id?: string | null;
  sku: string;
  client_code: string;
  client_description: string;
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
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agreementId: string;
  agreementName?: string | null;
  clientName?: string | null;
  initial?: Partial<LineEditValues> | null;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createAgreementLine);
  const patchFn = useServerFn(updateAgreementLine);
  const lookupFn = useServerFn(lookupProductBySku);
  const conflictFn = useServerFn(detectNConflict);
  const linkFn = useServerFn(linkSkuPrice);
  const unlinkFn = useServerFn(unlinkSkuPrice);
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
      client_code: string | null;
      client_description: string | null;
      current_price: number | null;
      updated_at: string | null;
    }>;
  }>({ kind: "idle", lines: [] });
  const [nExpanded, setNExpanded] = useState(true);
  const [isLinked, setIsLinked] = useState(false);
  const [productId, setProductId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const lookupSeq = useRef(0);
  const conflictSeq = useRef(0);


  const runLookup = async (sku: string) => {
    const trimmed = sku.trim();
    if (!trimmed) {
      setProductMeta(null);
      setLookup({ kind: "empty" });
      setNConflict({ kind: "idle", lines: [] });
      setIsLinked(false);
      setProductId(null);
      setLinkError(null);
      return;
    }
    const seq = ++lookupSeq.current;
    const cseq = ++conflictSeq.current;
    setLookup({ kind: "loading" });
    setNConflict({ kind: "loading", lines: [] });
    setLinkError(null);

    const lookupPromise = lookupFn({ data: { sku: trimmed } })
      .then((res) => {
        if (seq !== lookupSeq.current) return;
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
      })
      .catch((e: Error) => {
        if (seq !== lookupSeq.current) return;
        setProductMeta(null);
        setLookup({ kind: "idle" });
        toast.error(e.message);
      });

    const conflictPromise = conflictFn({
      data: { agreement_id: agreementId, sku: trimmed },
    })
      .then((res) => {
        if (cseq !== conflictSeq.current) return;
        setProductId(res.product_id ?? null);
        setIsLinked(!!res.isLinked);
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
      })
      .catch((e: Error) => {
        if (cseq !== conflictSeq.current) return;
        setNConflict({ kind: "idle", lines: [] });
        setIsLinked(false);
        setProductId(null);
        console.error("detectNConflict failed", e);
      });

    await Promise.all([lookupPromise, conflictPromise]);
  };

  useEffect(() => {
    if (!open) return;
    const next = { ...empty, ...(initial ?? {}) };
    setV(next);
    setProductMeta(null);
    setLookup({ kind: next.sku.trim() ? "idle" : "empty" });
    setNConflict({ kind: "idle", lines: [] });
    setIsLinked(false);
    setProductId(null);
    setLinkError(null);
    if (next.sku.trim()) {
      void runLookup(next.sku);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initial]);


  const isEdit = !!initial?.line_id;

  const save = useMutation({
    mutationFn: async () => {
      const num = (s: string) => {
        const t = s.trim();
        if (t === "") return undefined;
        const n = Number(t.replace(",", "."));
        return Number.isFinite(n) ? n : undefined;
      };
      const txt = (s: string) => (s.trim() === "" ? undefined : s.trim());
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
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const invalidateLines = () => {
    qc.invalidateQueries({ queryKey: ["agreements", "lines", agreementId] });
    qc.invalidateQueries({ queryKey: ["agreements", "detail", agreementId] });
  };

  const linkMut = useMutation({
    mutationFn: async () => {
      if (!productId) throw new Error("SKU no válido para vincular");
      const priceStr = v.sale_price.trim();
      if (!priceStr) throw new Error("Ingresa un precio antes de vincular");
      const price = Number(priceStr.replace(",", "."));
      if (!Number.isFinite(price) || price < 0) {
        throw new Error("Precio inválido");
      }
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
      if (v.sku.trim()) void runLookup(v.sku);
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
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-0 gap-0">
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
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <FieldLabel>
                      Código Jaivaná
                      {lookup.kind === "loading" && (
                        <Loader2 className="ml-2 inline h-3 w-3 animate-spin text-muted-foreground" />
                      )}
                    </FieldLabel>
                    <div className="relative">
                      <Input
                        className={cn(inputClass, "pr-9")}
                        value={v.sku}
                        onChange={(e) => setV({ ...v, sku: e.target.value })}
                        onBlur={(e) => void runLookup(e.target.value)}
                      />
                      {lookup.kind !== "loading" && (
                        <Search className="absolute right-3 top-2.5 h-4 w-4 text-text-tertiary pointer-events-none" />
                      )}
                    </div>
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
                      placeholder="Se completa al validar el código"
                      className={readonlyClass}
                    />
                  </div>
                  {lookup.kind === "inactive" && (
                    <div className="md:col-span-2">
                      <Alert variant="warning">
                        <AlertDescription>
                          Producto inactivo en el catálogo. Esta posición quedará
                          en "Requiere revisión".
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
                              <AlertTriangle className="h-4 w-4 shrink-0" />
                              <span className="flex-1 text-sm font-medium">
                                Este SKU ya tiene {nConflict.lines.length}{" "}
                                {nConflict.lines.length === 1 ? "posición" : "posiciones"} en el acuerdo
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
                                      {(() => {
                                        const distinctPrices = new Set(
                                          nConflict.lines
                                            .map((l) => l.current_price)
                                            .filter((p): p is number => p != null),
                                        );
                                        const showPick =
                                          priceChoice === "same" && distinctPrices.size > 1;
                                        return (
                                          <>
                                            {showPick && <TableHead className="w-8" />}
                                            <TableHead>Código cliente</TableHead>
                                            <TableHead>Descripción cliente</TableHead>
                                            <TableHead className="text-right">Precio actual</TableHead>
                                          </>
                                        );
                                      })()}
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {nConflict.lines.map((l) => {
                                      const distinctPrices = new Set(
                                        nConflict.lines
                                          .map((x) => x.current_price)
                                          .filter((p): p is number => p != null),
                                      );
                                      const showPick =
                                        priceChoice === "same" && distinctPrices.size > 1;
                                      return (
                                        <TableRow key={l.line_id}>
                                          {showPick && (
                                            <TableCell>
                                              <RadioGroupItem
                                                value={l.line_id}
                                                checked={chosenPriceLineId === l.line_id}
                                                onClick={() => {
                                                  setChosenPriceLineId(l.line_id);
                                                  if (l.current_price != null) {
                                                    setV((cur) => ({
                                                      ...cur,
                                                      sale_price: String(l.current_price),
                                                    }));
                                                  }
                                                }}
                                              />
                                            </TableCell>
                                          )}
                                          <TableCell className="font-mono text-xs text-foreground">
                                            {l.client_code ?? "—"}
                                          </TableCell>
                                          <TableCell className="text-xs text-foreground">
                                            {l.client_description ?? "—"}
                                          </TableCell>
                                          <TableCell className="text-right text-xs tabular-nums text-foreground">
                                            {l.current_price != null
                                              ? l.current_price.toLocaleString("es-CO", {
                                                  style: "currency",
                                                  currency: "COP",
                                                  minimumFractionDigits: 2,
                                                  maximumFractionDigits: 2,
                                                })
                                              : "—"}
                                          </TableCell>
                                        </TableRow>
                                      );
                                    })}
                                  </TableBody>
                                </Table>
                              </div>

                              <div className="rounded-md border border-border bg-surface-card p-4 space-y-3">
                                <p className="text-sm font-medium text-foreground">
                                  ¿Esta nueva posición debe usar el mismo precio?
                                </p>
                                <RadioGroup
                                  value={priceChoice ?? ""}
                                  onValueChange={(val) => {
                                    const choice = val as "same" | "distinct";
                                    setPriceChoice(choice);
                                    setChoiceError(false);
                                    if (choice === "same") {
                                      const distinctPrices = Array.from(
                                        new Set(
                                          nConflict.lines
                                            .map((l) => l.current_price)
                                            .filter((p): p is number => p != null),
                                        ),
                                      );
                                      let price: number | null = null;
                                      if (distinctPrices.length === 1) {
                                        price = distinctPrices[0];
                                      } else {
                                        const chosen = nConflict.lines.find(
                                          (l) => l.line_id === chosenPriceLineId,
                                        );
                                        price = chosen?.current_price ?? null;
                                      }
                                      if (price != null) {
                                        setV((cur) => ({ ...cur, sale_price: String(price) }));
                                      }
                                    } else {
                                      setV((cur) => ({ ...cur, sale_price: "" }));
                                    }
                                  }}
                                  className="gap-2"
                                >
                                  {(() => {
                                    const distinctPrices = Array.from(
                                      new Set(
                                        nConflict.lines
                                          .map((l) => l.current_price)
                                          .filter((p): p is number => p != null),
                                      ),
                                    );
                                    const singlePrice = distinctPrices[0] ?? null;
                                    const singlePriceFmt =
                                      singlePrice != null
                                        ? singlePrice.toLocaleString("es-CO", {
                                            style: "currency",
                                            currency: "COP",
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                          })
                                        : null;
                                    return (
                                      <>
                                        <label className="flex items-start gap-2 text-sm font-normal text-muted-foreground">
                                          <RadioGroupItem value="same" className="mt-0.5" />
                                          <span>
                                            Sí, usar el mismo precio{" "}
                                            {distinctPrices.length === 1 && singlePriceFmt ? (
                                              <span className="font-semibold">{singlePriceFmt}</span>
                                            ) : (
                                              <span className="text-muted-foreground">
                                                (selecciona cuál abajo)
                                              </span>
                                            )}
                                          </span>
                                        </label>
                                        <label className="flex items-start gap-2 text-sm font-normal text-muted-foreground">
                                          <RadioGroupItem value="distinct" className="mt-0.5" />
                                          <span>No, definiré un precio distinto</span>
                                        </label>
                                      </>
                                    );
                                  })()}
                                </RadioGroup>
                                {choiceError && (
                                  <p className="text-xs font-medium text-destructive">
                                    Debes indicar cómo manejar el precio para esta posición antes de continuar.
                                  </p>
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <FieldLabel>Precio de venta</FieldLabel>
                  <Input
                    className={inputClass}
                    inputMode="decimal"
                    value={v.sale_price}
                    onChange={(e) => setV({ ...v, sale_price: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Precio par</FieldLabel>
                  <Input
                    className={inputClass}
                    inputMode="decimal"
                    value={v.par_price}
                    onChange={(e) => setV({ ...v, par_price: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Fecha inicio</FieldLabel>
                  <Input
                    className={inputClass}
                    type="date"
                    value={v.start_date}
                    onChange={(e) => setV({ ...v, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabel>Fecha fin</FieldLabel>
                  <Input
                    className={inputClass}
                    type="date"
                    value={v.end_date}
                    onChange={(e) => setV({ ...v, end_date: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5 md:col-span-2">
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

            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Si las fechas quedan vacías se hereda la vigencia del acuerdo.
              Cambios de precio aplican solo a esta posición; usa "Aplicar a
              SKU" desde la importación para propagar a otras posiciones con el
              mismo SKU.
            </p>
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border bg-muted/30 shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={save.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => {
              if (nConflict.kind === "found" && priceChoice === null) {
                setChoiceError(true);
                setNExpanded(true);
                return;
              }
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
