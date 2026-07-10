import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/sumatec/Badge";
import { StatusBadge } from "@/components/sumatec/StatusBadge";
import {
  Ban,
  Calendar,
  Info,
  Pencil,
  Truck,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMoneyCOP } from "@/lib/format";

export type LineViewData = {
  id: string;
  kind: "position" | "transit";
  status: "active" | "requires_review" | "excluded" | "pending";
  sku: string | null;
  erp_description: string | null;
  commercial_brand: string | null;
  product_status: string | null;
  sale_price: number | null;
  par_price: number | null;
  start_date: string | null;
  end_date: string | null;
  observations: string | null;
  exclusion_reason: string | null;
  codes: {
    client_id: string;
    client_name: string | null;
    client_code: string;
    description: string | null;
  }[];
  created_at?: string | null;
  updated_at?: string | null;
};

function fmtDateLocal(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} · ${hh}:${mi}`;
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

function ReadValue({
  children,
  mono,
  muted,
  className,
}: {
  children: React.ReactNode;
  mono?: boolean;
  muted?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "text-sm text-foreground",
        mono && "font-mono",
        muted && "text-muted-foreground",
        className,
      )}
    >
      {children}
    </div>
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

type VigInfo = {
  color: "info" | "warning" | "error" | "neutral";
  label: string;
  daysLeft: number | null;
};

function vigInfo(
  end: string | null,
  agreementEnd: string | null | undefined,
): VigInfo {
  const eff = end ?? agreementEnd ?? null;
  if (!eff) return { color: "neutral", label: "Sin vigencia", daysLeft: null };
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(eff);
  if (!m) return { color: "neutral", label: "Sin vigencia", daysLeft: null };
  const endDate = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diff = Math.round((endDate.getTime() - today.getTime()) / 86_400_000);
  const label = `${m[3]}/${m[2]}/${m[1]}`;
  if (diff < 0) return { color: "error", label, daysLeft: diff };
  if (diff <= 30) return { color: "warning", label, daysLeft: diff };
  return { color: "info", label, daysLeft: diff };
}

const STATUS_LABEL: Record<
  LineViewData["status"],
  { label: string; status: "active" | "danger" | "neutral" | "warning" }
> = {
  active: { label: "Activa", status: "active" },
  requires_review: { label: "Requiere revisión", status: "danger" },
  excluded: { label: "Excluida", status: "neutral" },
  pending: { label: "Pendiente", status: "warning" },
};

export function LineViewDialog({
  open,
  onOpenChange,
  line,
  agreementName,
  agreementEndDate,
  canEdit,
  onEdit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  line: LineViewData | null;
  agreementName?: string | null;
  agreementEndDate?: string | null;
  canEdit: boolean;
  onEdit?: (lineId: string) => void;
}) {
  const vig = useMemo(
    () => (line ? vigInfo(line.end_date, agreementEndDate ?? null) : null),
    [line, agreementEndDate],
  );

  if (!line) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-6xl h-[92vh] flex flex-col overflow-hidden p-0 gap-0" />
      </Dialog>
    );
  }

  const isTransit = line.kind === "transit";
  const isExcluded = line.status === "excluded";
  const statusMeta = STATUS_LABEL[line.status];
  const showEditCta = canEdit && !isExcluded;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl max-h-[88vh] flex flex-col overflow-hidden p-0 gap-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="px-6 py-3 border-b border-border shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <DialogTitle className="text-xl font-bold tracking-tight">
                {isTransit ? "Línea en tránsito" : "Posición del acuerdo"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {agreementName || "Acuerdo comercial"}
              </DialogDescription>
            </div>
            {isTransit && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground shrink-0">
                <Truck className="h-3 w-3" />
                En tránsito
              </span>
            )}
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)]">
          {/* Columna izquierda — Sumatec + condiciones + vigencia + notas */}
          <div className="min-h-0 overflow-y-auto bg-white border-r border-border">
            <div className="p-5 space-y-5">
              {isExcluded && (
                <Alert variant="warning">
                  <Ban className="h-4 w-4" />
                  <AlertDescription>
                    <div className="text-sm font-semibold text-foreground">
                      Posición excluida
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {line.exclusion_reason ?? "Sin motivo registrado."}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Card unificada: SUMATEC + condiciones comerciales */}
              <section className="rounded-lg border border-input bg-muted/40 p-4 space-y-4 relative">
                <div className="absolute top-3 right-3">
                  <StatusBadge status={statusMeta.status} label={statusMeta.label} size="sm" />
                </div>

                <SectionHeader title="Sumatec" number="01" />

                {line.product_status && line.product_status !== "active" && (
                  <Badge color="error" variant="soft">
                    Inactivo
                  </Badge>
                )}

                {line.sku ? (
                  <div className="space-y-1.5">
                    <div className="flex items-baseline gap-3 flex-wrap">
                      <span className="font-mono text-lg font-semibold text-foreground">
                        {line.sku}
                      </span>
                      {line.commercial_brand && (
                        <span className="text-xs text-muted-foreground uppercase tracking-wide">
                          {line.commercial_brand}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-foreground">
                      {line.erp_description ?? "—"}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground italic">
                    Sin producto Sumatec vinculado.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-3 border-t border-border/60">
                  <div>
                    <FieldLabel>Precio de venta</FieldLabel>
                    <div className="text-base font-semibold text-foreground mt-0.5">
                      {line.sale_price != null ? formatMoneyCOP(line.sale_price) : "—"}
                    </div>
                  </div>
                  <div>
                    <FieldLabel>Precio par</FieldLabel>
                    <div className="text-base font-semibold text-foreground mt-0.5">
                      {line.par_price != null ? formatMoneyCOP(line.par_price) : "—"}
                    </div>
                  </div>
                </div>
              </section>

              {/* Vigencia */}
              <section className="rounded-lg border border-input p-4 space-y-3">
                <SectionHeader title="Vigencia" number="02" />
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-foreground">{fmtDateLocal(line.start_date)}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-foreground">
                      {line.end_date
                        ? fmtDateLocal(line.end_date)
                        : agreementEndDate
                          ? `${fmtDateLocal(agreementEndDate)} (del acuerdo)`
                          : "—"}
                    </span>
                  </div>
                  {vig && vig.daysLeft != null && (
                    <Badge color={vig.color} variant="soft">
                      {vig.daysLeft < 0
                        ? `Vencida hace ${Math.abs(vig.daysLeft)} días`
                        : vig.daysLeft === 0
                          ? "Vence hoy"
                          : `Faltan ${vig.daysLeft} días`}
                    </Badge>
                  )}
                </div>
              </section>

              {/* Observaciones */}
              {line.observations?.trim() && (
                <section>
                  <FieldLabel className="mb-1.5 block">Observaciones</FieldLabel>
                  <div className="rounded-lg border border-input p-3 text-sm whitespace-pre-wrap text-foreground">
                    {line.observations.trim()}
                  </div>
                </section>
              )}
            </div>
          </div>

          {/* Columna derecha — códigos de cliente condensados */}
          <div className="min-h-0 overflow-y-auto bg-muted/20">
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Códigos de cliente
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {line.codes.length}
                </span>
              </div>

              {line.codes.length === 0 ? (
                <Alert variant="info">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    Sin códigos de cliente asociados.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  {line.codes.map((c) => (
                    <div
                      key={c.client_id + c.client_code}
                      className="rounded-lg border border-input bg-white p-3 space-y-1"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wide text-accent truncate">
                          {c.client_name ?? "Cliente sin nombre"}
                        </span>
                        <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
                      </div>
                      <div className="font-mono text-sm font-semibold text-foreground">
                        {c.client_code}
                      </div>
                      <div className={cn("text-sm", c.description ? "text-foreground" : "text-muted-foreground italic")}>
                        {c.description || "Sin descripción"}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(line.created_at || line.updated_at) && (
                <div className="pt-2 text-[11px] text-muted-foreground space-y-0.5">
                  <div className="flex justify-between">
                    <span>Creada</span>
                    <span>{fmtDateTime(line.created_at)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Modificada</span>
                    <span>{fmtDateTime(line.updated_at)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>



        {/* Barra inferior */}
        <div className="px-6 py-3 border-t border-border shrink-0 flex items-center justify-between gap-3 bg-white">
          <div className="text-xs text-muted-foreground">
            Vista de solo lectura.
            {isExcluded && " Reactívala para volver a editarla."}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            {showEditCta && onEdit && (
              <Button
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(line.id);
                }}
              >
                <Pencil className="mr-1.5 h-4 w-4" />
                Editar posición
              </Button>
            )}
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}
