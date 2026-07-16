import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Archive,
  Ban,
  Calendar,
  CircleDollarSign,
  History,
  Layers,
  Package,
  PlayCircle,
  StopCircle,
  Tag,
  Undo2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge as SumaBadge, StatusBadge } from "@/components/sumatec";
import { getArchivedPositionDetail } from "@/lib/agreements.functions";
import { formatMoneyCOP } from "@/lib/format";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  archivedId: string | null;
};

type Detail = Awaited<ReturnType<typeof getArchivedPositionDetail>>;

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

type TimelineEvent = {
  key: string;
  at: string | null;
  kind:
    | "price"
    | "code_open"
    | "code_close"
    | "exclusion_start"
    | "exclusion_end"
    | "archived";
  title: React.ReactNode;
  body?: React.ReactNode;
  meta?: React.ReactNode;
};

function buildTimeline(data: Detail): TimelineEvent[] {
  const evts: TimelineEvent[] = [];

  for (const h of data.price_history) {
    evts.push({
      key: `price:${h.id}`,
      at: h.recorded_at,
      kind: "price",
      title: (
        <>
          Precio{" "}
          <span className="font-mono font-semibold">
            {formatMoneyCOP(h.sale_price)}
          </span>
        </>
      ),
      body: (
        <span className="text-text-tertiary">
          Vigencia {fmtDate(h.start_date)} → {fmtDate(h.end_date)}
          {h.change_reason ? ` · ${h.change_reason}` : ""}
        </span>
      ),
      meta: h.recorded_by_name ?? null,
    });
  }

  for (const c of data.codes) {
    evts.push({
      key: `code_open:${c.id}`,
      at: c.valid_from,
      kind: "code_open",
      title: (
        <>
          Se abrió código{" "}
          <span className="font-mono font-semibold">{c.client_code ?? "—"}</span>
          {c.client_name ? (
            <span className="text-text-secondary"> · {c.client_name}</span>
          ) : null}
        </>
      ),
      body: c.code_description ? (
        <span className="text-text-tertiary">{c.code_description}</span>
      ) : null,
    });
    if (c.valid_until) {
      evts.push({
        key: `code_close:${c.id}`,
        at: c.valid_until,
        kind: "code_close",
        title: (
          <>
            Se cerró código{" "}
            <span className="font-mono font-semibold">
              {c.client_code ?? "—"}
            </span>
            {c.client_name ? (
              <span className="text-text-secondary"> · {c.client_name}</span>
            ) : null}
          </>
        ),
        body: c.ended_reason ? (
          <span className="text-text-tertiary">{c.ended_reason}</span>
        ) : null,
      });
    }
  }

  for (const ex of data.exclusions) {
    evts.push({
      key: `ex_start:${ex.id}`,
      at: ex.valid_from,
      kind: "exclusion_start",
      title: <>Se excluyó la posición</>,
      body: ex.exclusion_reason ? (
        <span className="text-text-tertiary">{ex.exclusion_reason}</span>
      ) : null,
      meta: ex.started_by_name ?? null,
    });
    if (ex.valid_until) {
      evts.push({
        key: `ex_end:${ex.id}`,
        at: ex.valid_until,
        kind: "exclusion_end",
        title: <>Se reactivó la posición</>,
        body: ex.ended_reason ? (
          <span className="text-text-tertiary">{ex.ended_reason}</span>
        ) : null,
        meta: ex.ended_by_name ?? null,
      });
    }
  }

  evts.push({
    key: "archived",
    at: data.position.archived_at,
    kind: "archived",
    title: <span className="font-semibold">Se archivó la posición</span>,
    body: (
      <span className="whitespace-pre-wrap text-text-primary">
        {data.position.archive_reason}
      </span>
    ),
    meta: data.position.archived_by_name ?? null,
  });

  evts.sort((a, b) => {
    const ta = a.at ? new Date(a.at).getTime() : 0;
    const tb = b.at ? new Date(b.at).getTime() : 0;
    if (ta !== tb) return ta - tb;
    if (a.kind === "archived") return 1;
    if (b.kind === "archived") return -1;
    return 0;
  });

  return evts;
}

function EventIcon({ kind }: { kind: TimelineEvent["kind"] }) {
  const base =
    "flex h-7 w-7 items-center justify-center rounded-full border bg-card";
  switch (kind) {
    case "price":
      return (
        <span className={`${base} border-border text-text-secondary`}>
          <CircleDollarSign className="h-3.5 w-3.5" />
        </span>
      );
    case "code_open":
      return (
        <span
          className={`${base} border-emerald-200 text-emerald-700 bg-emerald-50`}
        >
          <PlayCircle className="h-3.5 w-3.5" />
        </span>
      );
    case "code_close":
      return (
        <span className={`${base} border-border text-text-tertiary`}>
          <StopCircle className="h-3.5 w-3.5" />
        </span>
      );
    case "exclusion_start":
      return (
        <span className={`${base} border-amber-200 text-amber-700 bg-amber-50`}>
          <Ban className="h-3.5 w-3.5" />
        </span>
      );
    case "exclusion_end":
      return (
        <span
          className={`${base} border-emerald-200 text-emerald-700 bg-emerald-50`}
        >
          <Undo2 className="h-3.5 w-3.5" />
        </span>
      );
    case "archived":
      return (
        <span className={`${base} border-border text-text-primary bg-muted`}>
          <Archive className="h-3.5 w-3.5" />
        </span>
      );
  }
}

export function ArchivedPositionDialog({ open, onOpenChange, archivedId }: Props) {
  const detailFn = useServerFn(getArchivedPositionDetail);
  const { data, isLoading, error } = useQuery({
    queryKey: ["archived-positions", "detail", archivedId],
    queryFn: () => detailFn({ data: { archived_id: archivedId as string } }),
    enabled: !!archivedId && open,
  });

  const timeline = useMemo(() => (data ? buildTimeline(data) : []), [data]);
  const openCodes = useMemo(
    () => (data ? data.codes.filter((c) => !c.valid_until) : []),
    [data],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[calc(100vw-2rem)] h-[92vh] p-0 gap-0 overflow-hidden flex flex-col">
        {/* Header del modal */}
        <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-6 py-4 pr-14">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-text-primary">
            <Archive className="h-5 w-5" strokeWidth={2} />
          </span>
          <span className="suma-h4 text-text-primary tracking-tight">
            Historial de la posición archivada
          </span>
        </div>


        {isLoading && (
          <div className="p-6 text-sm text-text-tertiary">Cargando foto…</div>
        )}
        {error && (
          <div className="p-6 text-sm text-destructive">
            {(error as Error).message}
          </div>
        )}

        {data && (
          <div className="flex-1 overflow-y-auto">
            {/* Sticky: estado de la posición al archivarse */}
            <div className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
              <div className="px-6 pt-4 pb-4 space-y-3">
                <div className="suma-overline text-text-tertiary">
                  Estado de la posición al archivarse
                </div>

                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <DialogTitle className="suma-h3 text-text-primary font-mono">
                      {data.position.sku ?? "—"}
                    </DialogTitle>
                    <DialogDescription className="text-text-secondary mt-0.5">
                      {data.position.product_description ?? " "}
                    </DialogDescription>
                    {data.position.product_brand && (
                      <div className="mt-1 suma-overline text-text-tertiary">
                        {data.position.product_brand}
                      </div>
                    )}
                  </div>
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
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-4">
                  <Stat label="Precio" value={formatMoneyCOP(data.position.sale_price)} />
                  <Stat label="Par" value={formatMoneyCOP(data.position.par_price)} />
                  <Stat label="Desde" value={fmtDate(data.position.start_date)} />
                  <Stat label="Hasta" value={fmtDate(data.position.end_date)} />
                </div>

                <div>
                  <div className="suma-overline text-text-tertiary mb-1 flex items-center gap-1">
                    <Layers className="h-3 w-3" />
                    Códigos vigentes al archivar ({openCodes.length})
                  </div>
                  {openCodes.length === 0 ? (
                    <span className="text-[13px] text-text-tertiary">
                      Ninguno.
                    </span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {openCodes.map((c) => (
                        <span
                          key={c.id}
                          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-sunken/60 px-2 py-0.5 text-[12px]"
                        >
                          <Tag className="h-3 w-3 text-text-tertiary" />
                          <span className="text-text-tertiary">
                            {c.client_name ?? "—"}
                          </span>
                          <span className="font-mono font-medium text-text-primary">
                            {c.client_code ?? "—"}
                          </span>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Línea de tiempo — la historia */}
            <div className="px-6 py-5">
              <div className="mb-4 flex items-center gap-2">
                <History className="h-5 w-5 text-text-primary" />
                <h3 className="suma-h4 text-text-primary tracking-tight">
                  Línea de tiempo
                </h3>
                <span className="text-[12px] text-text-tertiary">
                  ({timeline.length} eventos)
                </span>
              </div>


              <ol className="relative ml-3 border-l border-border">
                {timeline.map((e) => (
                  <li key={e.key} className="relative pl-6 pb-5 last:pb-1">
                    <span className="absolute -left-[15px] top-0">
                      <EventIcon kind={e.kind} />
                    </span>
                    <div className="text-[12px] text-text-tertiary">
                      {fmtDateTime(e.at)}
                      {e.meta ? ` · ${e.meta}` : ""}
                    </div>
                    <div className="mt-0.5 text-[14px] text-text-primary">
                      {e.title}
                    </div>
                    {e.body && (
                      <div className="mt-0.5 text-[13px]">{e.body}</div>
                    )}
                  </li>
                ))}
              </ol>

              {data.position.observations && (
                <section className="mt-4 rounded-md border border-border bg-surface-sunken/40 p-3">
                  <div className="suma-overline text-text-tertiary mb-1">
                    Observaciones al archivar
                  </div>
                  <p className="whitespace-pre-wrap text-[13px] text-text-secondary">
                    {data.position.observations}
                  </p>
                </section>
              )}

              {data.alternatives.length > 0 && (
                <section className="mt-5">
                  <div className="mb-2 flex items-center gap-2">
                    <Package className="h-4 w-4 text-text-tertiary" />
                    <h3 className="suma-label text-text-primary">
                      Alternativas ({data.alternatives.length})
                    </h3>
                  </div>
                  <ul className="space-y-1.5">
                    {data.alternatives.map((a) => (
                      <li
                        key={a.id}
                        className="rounded-md border border-border bg-card p-2.5 text-[13px]"
                      >
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono font-semibold">
                            {a.sku ?? "—"}
                          </span>
                          <span className="text-text-secondary">
                            {a.product_description ?? "—"}
                          </span>
                        </div>
                        <div className="text-[12px] text-text-tertiary">
                          {a.product_brand ?? "—"}
                          {a.notes ? ` · ${a.notes}` : ""}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <div className="mt-6 flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-[11.5px] text-text-tertiary">
                <span>
                  <Calendar className="mr-1 inline h-3 w-3" />
                  Creada el {fmtDateTime(data.position.original_created_at)}
                </span>
                <span>
                  <Calendar className="mr-1 inline h-3 w-3" />
                  Publicada el {fmtDateTime(data.position.original_published_at)}
                </span>
                {data.position.par_price != null && (
                  <SumaBadge color="neutral" variant="soft">
                    Con precio par
                  </SumaBadge>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="suma-overline text-text-tertiary">{label}</div>
      <div className="mt-0.5 text-[14px] text-text-primary tabular-nums">
        {value}
      </div>
    </div>
  );
}
