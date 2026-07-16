import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Archive,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  History,
  Layers,
  Package,
  Ban,
  User,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge as SumaBadge, StatusBadge, IdentityCell } from "@/components/sumatec";
import { getArchivedPositionDetail } from "@/lib/agreements.functions";
import { formatMoneyCOP } from "@/lib/format";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  archivedId: string | null;
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

const STATUS_LABEL: Record<string, string> = {
  active: "Activa",
  requires_review: "Requiere revisión",
  excluded: "Excluida",
  draft: "En gestión",
};

export function ArchivedPositionDialog({ open, onOpenChange, archivedId }: Props) {
  const detailFn = useServerFn(getArchivedPositionDetail);
  const { data, isLoading, error } = useQuery({
    queryKey: ["archived-positions", "detail", archivedId],
    queryFn: () => detailFn({ data: { archived_id: archivedId as string } }),
    enabled: !!archivedId && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto p-0">
        <DialogHeader className="border-b border-border bg-muted/30 px-6 py-4">
          <div className="flex items-center gap-2">
            <Archive className="h-4 w-4 text-text-tertiary" />
            <span className="suma-overline text-text-tertiary">
              Posición archivada · foto inmutable
            </span>
          </div>
          <DialogTitle className="suma-h3 text-text-primary mt-1">
            {data?.position.sku ?? "—"}
          </DialogTitle>
          <DialogDescription className="text-text-secondary">
            {data?.position.product_description ?? " "}
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="p-6 text-sm text-text-tertiary">Cargando foto…</div>
        )}
        {error && (
          <div className="p-6 text-sm text-destructive">
            {(error as Error).message}
          </div>
        )}

        {data && (
          <div className="space-y-6 p-6">
            {/* Acto de archivar — testimonio */}
            <section className="rounded-lg border border-border bg-surface-sunken/40 p-4">
              <div className="mb-2 flex items-center gap-2">
                <Archive className="h-4 w-4 text-text-tertiary" />
                <h3 className="suma-label text-text-primary">Se archivó</h3>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Field
                  icon={<Clock className="h-3.5 w-3.5" />}
                  label="Cuándo"
                  value={fmtDateTime(data.position.archived_at)}
                />
                <Field
                  icon={<User className="h-3.5 w-3.5" />}
                  label="Por"
                  value={data.position.archived_by_name ?? "—"}
                />
                <Field
                  icon={<History className="h-3.5 w-3.5" />}
                  label="Estado al archivar"
                  value={
                    <StatusBadge
                      status={
                        data.position.original_status === "active"
                          ? "active"
                          : data.position.original_status === "excluded"
                            ? "neutral"
                            : "danger"
                      }
                      label={
                        STATUS_LABEL[data.position.original_status] ??
                        data.position.original_status
                      }
                    />
                  }
                />
              </div>
              <div className="mt-3">
                <div className="suma-overline text-text-tertiary">Motivo</div>
                <p className="mt-1 whitespace-pre-wrap text-[14px] leading-relaxed text-text-primary">
                  {data.position.archive_reason}
                </p>
              </div>
            </section>

            {/* Producto congelado */}
            <section>
              <SectionHeader icon={<Package className="h-4 w-4" />}>
                Producto (congelado)
              </SectionHeader>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Field label="SKU Jaivaná" value={data.position.sku ?? "—"} mono />
                <Field label="Marca" value={data.position.product_brand ?? "—"} />
                <Field
                  className="md:col-span-2"
                  label="Descripción"
                  value={data.position.product_description ?? "—"}
                />
              </div>
            </section>

            {/* Estado comercial de la foto */}
            <section>
              <SectionHeader icon={<DollarSign className="h-4 w-4" />}>
                Precio y vigencia al archivar
              </SectionHeader>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <Field label="Precio" value={formatMoneyCOP(data.position.sale_price)} />
                <Field label="Par" value={formatMoneyCOP(data.position.par_price)} />
                <Field label="Desde" value={fmtDate(data.position.start_date)} />
                <Field label="Hasta" value={fmtDate(data.position.end_date)} />
              </div>
              {data.position.observations && (
                <div className="mt-3">
                  <div className="suma-overline text-text-tertiary">Observaciones</div>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] text-text-secondary">
                    {data.position.observations}
                  </p>
                </div>
              )}
            </section>

            {/* Códigos de cliente — la historia */}
            <section>
              <SectionHeader icon={<Layers className="h-4 w-4" />}>
                Códigos por cliente ({data.codes.length})
              </SectionHeader>
              {data.codes.length === 0 ? (
                <p className="text-sm text-text-tertiary">Sin códigos registrados.</p>
              ) : (
                <ul className="space-y-2">
                  {data.codes.map((c) => {
                    const closed = !!c.valid_until;
                    return (
                      <li
                        key={c.id}
                        className="rounded-md border border-border bg-card p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="suma-overline text-text-tertiary">
                              {c.client_name ?? "Cliente sin nombre"}
                            </div>
                            <IdentityCell
                              code={c.client_code ?? "—"}
                              description={c.code_description ?? undefined}
                            />
                          </div>
                          <SumaBadge
                            color={closed ? "neutral" : "success"}
                            variant="soft"
                          >
                            {closed ? "Cerrado" : "Vigente al archivar"}
                          </SumaBadge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-text-tertiary">
                          <span>
                            <Calendar className="mr-1 inline h-3 w-3" />
                            Desde {fmtDateTime(c.valid_from)}
                          </span>
                          <span>
                            <Calendar className="mr-1 inline h-3 w-3" />
                            Hasta {closed ? fmtDateTime(c.valid_until) : "—"}
                          </span>
                          {c.ended_reason && (
                            <span className="text-text-secondary">
                              · {c.ended_reason}
                            </span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Historial de precios */}
            <section>
              <SectionHeader icon={<History className="h-4 w-4" />}>
                Historial de precios ({data.price_history.length})
              </SectionHeader>
              {data.price_history.length === 0 ? (
                <p className="text-sm text-text-tertiary">Sin historial.</p>
              ) : (
                <ul className="space-y-1.5">
                  {data.price_history.map((h) => (
                    <li
                      key={h.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border bg-card px-3 py-2 text-[13px]"
                    >
                      <div className="flex items-baseline gap-3">
                        <span className="font-mono font-semibold text-text-primary">
                          {formatMoneyCOP(h.sale_price)}
                        </span>
                        <span className="text-text-tertiary">
                          {fmtDate(h.start_date)} → {fmtDate(h.end_date)}
                        </span>
                        {h.change_reason && (
                          <SumaBadge color="neutral" variant="soft">
                            {h.change_reason}
                          </SumaBadge>
                        )}
                      </div>
                      <span className="text-[11.5px] text-text-tertiary">
                        {fmtDateTime(h.recorded_at)}
                        {h.recorded_by_name ? ` · ${h.recorded_by_name}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Exclusiones */}
            {data.exclusions.length > 0 && (
              <section>
                <SectionHeader icon={<Ban className="h-4 w-4" />}>
                  Períodos de exclusión ({data.exclusions.length})
                </SectionHeader>
                <ul className="space-y-2">
                  {data.exclusions.map((ex) => (
                    <li
                      key={ex.id}
                      className="rounded-md border border-border bg-card p-3 text-[13px]"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-text-primary">
                          {ex.exclusion_reason ?? "—"}
                        </span>
                        <span className="text-text-tertiary text-[12px]">
                          {fmtDateTime(ex.valid_from)}
                          {" → "}
                          {ex.valid_until ? fmtDateTime(ex.valid_until) : "vigente"}
                        </span>
                      </div>
                      {(ex.started_by_name || ex.ended_by_name || ex.ended_reason) && (
                        <div className="mt-1 text-[12px] text-text-tertiary">
                          {ex.started_by_name && (
                            <span>Excluida por {ex.started_by_name}</span>
                          )}
                          {ex.ended_by_name && (
                            <span> · reactivada por {ex.ended_by_name}</span>
                          )}
                          {ex.ended_reason && <span> · {ex.ended_reason}</span>}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Alternativas */}
            {data.alternatives.length > 0 && (
              <section>
                <SectionHeader icon={<Package className="h-4 w-4" />}>
                  Alternativas ({data.alternatives.length})
                </SectionHeader>
                <ul className="space-y-2">
                  {data.alternatives.map((a) => (
                    <li
                      key={a.id}
                      className="rounded-md border border-border bg-card p-3"
                    >
                      <IdentityCell
                        code={a.sku ?? "—"}
                        description={a.product_description ?? "—"}
                      />
                      <div className="mt-1 text-[12px] text-text-tertiary">
                        {a.product_brand ?? "—"}
                        {a.notes ? ` · ${a.notes}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Metadatos de origen */}
            <section className="border-t border-border pt-4">
              <div className="grid grid-cols-1 gap-3 text-[12px] text-text-tertiary md:grid-cols-2">
                <div>
                  <FileText className="mr-1 inline h-3 w-3" />
                  Creada originalmente el {fmtDateTime(data.position.original_created_at)}
                </div>
                <div>
                  <FileText className="mr-1 inline h-3 w-3" />
                  Publicada originalmente el{" "}
                  {fmtDateTime(data.position.original_published_at)}
                </div>
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SectionHeader({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center gap-2 border-b border-border pb-1.5">
      <span className="text-text-tertiary">{icon}</span>
      <h3 className="suma-label text-text-primary">{children}</h3>
    </div>
  );
}

function Field({
  label,
  value,
  icon,
  mono,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="suma-overline text-text-tertiary flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div
        className={`mt-0.5 text-[14px] text-text-primary ${mono ? "font-mono" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}
