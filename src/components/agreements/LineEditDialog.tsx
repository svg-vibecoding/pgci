import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Info, Loader2 } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  createAgreementLine,
  updateAgreementLine,
  lookupProductBySku,
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

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <Separator />
    </div>
  );
}

export function LineEditDialog({
  open,
  onOpenChange,
  agreementId,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agreementId: string;
  initial?: Partial<LineEditValues> | null;
}) {
  const qc = useQueryClient();
  const createFn = useServerFn(createAgreementLine);
  const patchFn = useServerFn(updateAgreementLine);
  const lookupFn = useServerFn(lookupProductBySku);
  const [v, setV] = useState<LineEditValues>(empty);
  const [productMeta, setProductMeta] = useState<ProductMeta | null>(null);
  const [lookup, setLookup] = useState<{
    kind: LookupKind;
    catalogUpdatedAt?: string | null;
  }>({ kind: "idle" });
  const lookupSeq = useRef(0);

  const runLookup = async (sku: string) => {
    const trimmed = sku.trim();
    if (!trimmed) {
      setProductMeta(null);
      setLookup({ kind: "empty" });
      return;
    }
    const seq = ++lookupSeq.current;
    setLookup({ kind: "loading" });
    try {
      const res = await lookupFn({ data: { sku: trimmed } });
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
    } catch (e) {
      if (seq !== lookupSeq.current) return;
      setProductMeta(null);
      setLookup({ kind: "idle" });
      toast.error((e as Error).message);
    }
  };

  useEffect(() => {
    if (!open) return;
    const next = { ...empty, ...(initial ?? {}) };
    setV(next);
    setProductMeta(null);
    setLookup({ kind: next.sku.trim() ? "idle" : "empty" });
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

  const readonlyClass = "bg-muted/60 cursor-not-allowed";
  const catalogDateLabel = fmtCatalogDate(lookup.catalogUpdatedAt ?? null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar posición" : "Nueva posición"}</DialogTitle>
          <DialogDescription>
            El estado operativo se recalcula automáticamente al guardar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Información del cliente */}
          <section className="space-y-4">
            <SectionHeader title="Información del cliente" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Código del cliente</Label>
                <Input
                  value={v.client_code}
                  onChange={(e) => setV({ ...v, client_code: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Descripción del cliente</Label>
                <Input
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
            <SectionHeader title="Información Jaivaná" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>
                  Código Jaivaná
                  {lookup.kind === "loading" && (
                    <Loader2 className="ml-2 inline h-3 w-3 animate-spin text-muted-foreground" />
                  )}
                </Label>
                <Input
                  value={v.sku}
                  onChange={(e) => setV({ ...v, sku: e.target.value })}
                  onBlur={(e) => void runLookup(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Marca</Label>
                <Input
                  value={productMeta?.commercial_brand ?? ""}
                  readOnly
                  tabIndex={-1}
                  placeholder="—"
                  className={readonlyClass}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Descripción Jaivaná</Label>
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
                      Producto inactivo en el catálogo. Esta posición quedará en
                      "Requiere revisión".
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
            </div>
          </section>

          {/* Condiciones comerciales */}
          <section className="space-y-4">
            <SectionHeader title="Condiciones comerciales" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Precio de venta</Label>
                <Input
                  inputMode="decimal"
                  value={v.sale_price}
                  onChange={(e) => setV({ ...v, sale_price: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Precio par</Label>
                <Input
                  inputMode="decimal"
                  value={v.par_price}
                  onChange={(e) => setV({ ...v, par_price: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha inicio</Label>
                <Input
                  type="date"
                  value={v.start_date}
                  onChange={(e) => setV({ ...v, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Fecha fin</Label>
                <Input
                  type="date"
                  value={v.end_date}
                  onChange={(e) => setV({ ...v, end_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Observaciones</Label>
                <Textarea
                  rows={2}
                  value={v.observations}
                  onChange={(e) => setV({ ...v, observations: e.target.value })}
                />
              </div>
            </div>
          </section>
        </div>

        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Si las fechas quedan vacías se hereda la vigencia del acuerdo. Cambios de precio
          aplican solo a esta posición; usa "Aplicar a SKU" desde la importación para propagar
          a otras posiciones con el mismo SKU.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
