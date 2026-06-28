import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Info } from "lucide-react";
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
import {
  createAgreementLine,
  updateAgreementLine,
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
  const [v, setV] = useState<LineEditValues>(empty);

  useEffect(() => {
    if (open) setV({ ...empty, ...(initial ?? {}) });
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
              par_price: num(v.par_price),
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
          par_price: num(v.par_price),
          start_date: txt(v.start_date) ?? undefined,
          end_date: txt(v.end_date) ?? undefined,
          observations: txt(v.observations) ?? undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success(isEdit ? "Línea actualizada" : "Línea creada");
      qc.invalidateQueries({ queryKey: ["agreements", "lines", agreementId] });
      qc.invalidateQueries({ queryKey: ["agreements", "detail", agreementId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar línea" : "Nueva línea"}</DialogTitle>
          <DialogDescription>
            El estado operativo se recalcula automáticamente al guardar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>SKU Jaivaná</Label>
            <Input value={v.sku} onChange={(e) => setV({ ...v, sku: e.target.value })} />
          </div>
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
              onChange={(e) => setV({ ...v, client_description: e.target.value })}
            />
          </div>
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
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Si las fechas quedan vacías se hereda la vigencia del acuerdo. Cambios de precio
          aplican solo a esta línea; usa "Aplicar a SKU" desde la importación para propagar
          a otras líneas con el mismo SKU.
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
