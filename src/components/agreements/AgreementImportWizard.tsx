import { useState, useRef, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Upload,
  FileWarning,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Ban,
  Download,
  ArrowLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/sumatec";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  parseAgreementFile,
  downloadAgreementImportTemplate,
  PENDING_REASON_LABELS,
  type ImportPendingReason,
  type ParsedImportRow,
} from "@/lib/agreement-import";
import {
  importAgreementLinesPreview,
  commitAgreementImport,
  listAgreementCompanies,
  type ClassifiedRow,
  type NConflictGroupServer,
} from "@/lib/agreements.functions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Step = "upload" | "preview" | "result";

import { formatMoneyCOP } from "@/lib/format";
const fmtMoney = (v: number | null | undefined) => formatMoneyCOP(v);

export function AgreementImportWizard({
  open,
  onOpenChange,
  agreementId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agreementId: string;
}) {
  const qc = useQueryClient();
  const previewFn = useServerFn(importAgreementLinesPreview);
  const commitFn = useServerFn(commitAgreementImport);
  const listCompaniesFn = useServerFn(listAgreementCompanies);
  const fileRef = useRef<HTMLInputElement>(null);

  const companiesQ = useQuery({
    queryKey: ["agreements", "companies", agreementId],
    queryFn: () => listCompaniesFn({ data: { agreement_id: agreementId } }),
    enabled: open,
  });
  const companies = companiesQ.data ?? [];
  const needsCompanyPick = companies.length > 1;

  const [targetClientId, setTargetClientId] = useState<string>("");
  const [step, setStep] = useState<Step>("upload");
  const [fileName, setFileName] = useState<string>("");
  const [formatErrors, setFormatErrors] = useState<ParsedImportRow[]>([]);
  const [rows, setRows] = useState<ParsedImportRow[]>([]);
  const [buckets, setBuckets] = useState<{
    active: ClassifiedRow[];
    pending: ClassifiedRow[];
    review: ClassifiedRow[];
    conflicts: ClassifiedRow[];
    format: ClassifiedRow[];
  } | null>(null);
  const [nConflicts, setNConflicts] = useState<NConflictGroupServer[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, "applyAll" | "keepDistinct">>({});
  const [commitResult, setCommitResult] = useState<{
    inserted: number;
    updated: number;
    propagated_n1: number;
    by_status: Record<string, number>;
  } | null>(null);

  const reset = () => {
    setStep("upload");
    setFileName("");
    setFormatErrors([]);
    setRows([]);
    setBuckets(null);
    setNConflicts([]);
    setResolutions({});
    setCommitResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const close = () => {
    reset();
    onOpenChange(false);
  };

  const preview = useMutation({
    mutationFn: (payload: { rows: ParsedImportRow[] }) =>
      previewFn({
        data: {
          agreement_id: agreementId,
          rows: payload.rows.map((r) => ({
            row_number: r.row_number,
            sku: r.sku,
            client_code: r.client_code,
            description: r.description,
            sale_price: r.sale_price,
            par_price: r.par_price,
            start_date: r.start_date,
            end_date: r.end_date,
            observations: r.observations,
          })),
        },
      }),
    onSuccess: (res) => {
      setBuckets(res.buckets);
      setNConflicts(res.n_conflicts ?? []);
      const init: Record<string, "applyAll" | "keepDistinct"> = {};
      for (const g of res.n_conflicts ?? []) init[g.sku] = "keepDistinct";
      setResolutions(init);
      setStep("preview");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const commit = useMutation({
    mutationFn: () =>
      commitFn({
        data: {
          agreement_id: agreementId,
          rows: rows.map((r) => ({
            row_number: r.row_number,
            sku: r.sku,
            client_code: r.client_code,
            description: r.description,
            sale_price: r.sale_price,
            par_price: r.par_price,
            start_date: r.start_date,
            end_date: r.end_date,
            observations: r.observations,
          })),
          price_resolutions: resolutions,
        },
      }),
    onSuccess: (res) => {
      setCommitResult(res);
      qc.invalidateQueries({ queryKey: ["agreements", "lines", agreementId] });
      qc.invalidateQueries({ queryKey: ["agreements", "detail", agreementId] });
      setStep("result");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleFile = async (file: File) => {
    setFileName(file.name);
    try {
      const res = await parseAgreementFile(file);
      setRows(res.rows);
      setFormatErrors(res.format_errors);
      if (res.rows.length === 0 && res.format_errors.length === 0) {
        toast.error("El archivo no tiene filas con datos.");
        return;
      }
      preview.mutate({ rows: res.rows });
    } catch (e) {
      const msg = (e as Error).message;
      toast.error(
        msg === "FORMAT"
          ? "Formato no reconocido. Descarga la plantilla y verifica los encabezados."
          : msg,
      );
    }
  };

  const summary = useMemo(() => {
    if (!buckets) return null;
    return {
      active: buckets.active.length,
      pending: buckets.pending.length,
      review: buckets.review.length,
      conflicts: buckets.conflicts.length + nConflicts.length,
      format: formatErrors.length,
      total:
        buckets.active.length +
        buckets.pending.length +
        buckets.review.length +
        buckets.conflicts.length,
    };
  }, [buckets, nConflicts, formatErrors]);

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-hidden p-0">
        <DialogHeader className="border-b border-border px-6 py-4">
          <DialogTitle>Importar información comercial</DialogTitle>
          <DialogDescription>
            Carga un archivo Excel o CSV con la información comercial del acuerdo. Antes de
            confirmar verás cómo queda clasificada cada fila.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[calc(90vh-9rem)] overflow-y-auto px-6 py-4">
          {step === "upload" && (
            <div className="space-y-4">
              <Card>
                <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
                  <Upload className="h-10 w-10 text-muted-foreground" />
                  <div>
                    <div className="text-sm font-medium">Selecciona un archivo</div>
                    <div className="text-xs text-muted-foreground">
                      Formatos aceptados: .xlsx, .xls, .csv
                    </div>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleFile(f);
                    }}
                  />
                  <div className="flex gap-2">
                    <Button onClick={() => fileRef.current?.click()} disabled={preview.isPending}>
                      <Upload className="mr-1.5 h-4 w-4" />
                      {preview.isPending ? "Analizando…" : "Seleccionar archivo"}
                    </Button>
                    <Button variant="outline" onClick={downloadAgreementImportTemplate}>
                      <Download className="mr-1.5 h-4 w-4" /> Descargar plantilla
                    </Button>
                  </div>
                  {fileName && (
                    <div className="text-xs text-muted-foreground">{fileName}</div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {step === "preview" && buckets && summary && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <BucketCard
                  icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  label="Activas"
                  value={summary.active}
                />
                <BucketCard
                  icon={<Clock className="h-4 w-4 text-amber-600" />}
                  label="Pendientes"
                  value={summary.pending}
                />
                <BucketCard
                  icon={<AlertTriangle className="h-4 w-4 text-orange-600" />}
                  label="Requieren revisión"
                  value={summary.review}
                />
                <BucketCard
                  icon={<Ban className="h-4 w-4 text-rose-600" />}
                  label="Conflictos"
                  value={summary.conflicts}
                />
                <BucketCard
                  icon={<FileWarning className="h-4 w-4 text-muted-foreground" />}
                  label="Error de formato"
                  value={summary.format}
                />
              </div>

              {nConflicts.length > 0 && (
                <Card>
                  <CardContent className="space-y-3 py-4">
                    <div>
                      <div className="text-sm font-semibold">
                        Conflicto N:1 — un SKU con precios distintos
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Decide qué hacer con cada SKU antes de confirmar.
                      </p>
                    </div>
                    {nConflicts.map((g) => (
                      <div
                        key={g.sku}
                        className="rounded-md border border-border bg-muted/30 p-3"
                      >
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="font-mono text-sm font-medium">{g.sku}</div>
                          <div className="text-xs text-muted-foreground">
                            En archivo:{" "}
                            {g.in_file_prices.map((p) => fmtMoney(p)).join(" · ")}
                            {g.existing.length > 0 && (
                              <>
                                {" · Existente: "}
                                {g.existing.map((e) => fmtMoney(e.current_price)).join(" · ")}
                              </>
                            )}
                          </div>
                        </div>
                        <RadioGroup
                          value={resolutions[g.sku] ?? "keepDistinct"}
                          onValueChange={(v) =>
                            setResolutions((prev) => ({
                              ...prev,
                              [g.sku]: v as "applyAll" | "keepDistinct",
                            }))
                          }
                          className="flex flex-col gap-1.5 text-sm"
                        >
                          <div className="flex items-start gap-2">
                            <RadioGroupItem value="keepDistinct" id={`${g.sku}-keep`} />
                            <Label htmlFor={`${g.sku}-keep`} className="font-normal leading-snug">
                              Mantener precios por posición
                            </Label>
                          </div>
                          <div className="flex items-start gap-2">
                            <RadioGroupItem value="applyAll" id={`${g.sku}-all`} />
                            <Label htmlFor={`${g.sku}-all`} className="font-normal leading-snug">
                              Aplicar precio máximo a todas las posiciones del SKU
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Tabs defaultValue="active">
                <TabsList>
                  <TabsTrigger value="active">Activas ({buckets.active.length})</TabsTrigger>
                  <TabsTrigger value="pending">Pendientes ({buckets.pending.length})</TabsTrigger>
                  <TabsTrigger value="review">Revisión ({buckets.review.length})</TabsTrigger>
                  <TabsTrigger value="conflicts">Conflictos ({buckets.conflicts.length})</TabsTrigger>
                  <TabsTrigger value="format">Formato ({formatErrors.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="active">
                  <BucketTable rows={buckets.active} />
                </TabsContent>
                <TabsContent value="pending">
                  <BucketTable rows={buckets.pending} showReasons />
                </TabsContent>
                <TabsContent value="review">
                  <BucketTable rows={buckets.review} />
                </TabsContent>
                <TabsContent value="conflicts">
                  <BucketTable rows={buckets.conflicts} />
                </TabsContent>
                <TabsContent value="format">
                  <FormatErrorsTable rows={formatErrors} />
                </TabsContent>
              </Tabs>
            </div>
          )}

          {step === "result" && commitResult && (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-emerald-900">
                  <CheckCircle2 className="h-4 w-4" /> Importación aplicada
                </div>
                <div className="mt-2 text-sm text-emerald-900">
                  {commitResult.inserted} posiciones insertadas · {commitResult.updated} actualizadas
                  {commitResult.propagated_n1 > 0 && (
                    <> · {commitResult.propagated_n1} propagaciones N:1</>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
                {Object.entries(commitResult.by_status).map(([k, v]) => (
                  <Card key={k}>
                    <CardContent className="py-3">
                      <div className="text-xs text-muted-foreground">{statusLabel(k)}</div>
                      <div className="text-xl font-semibold">{v}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border px-6 py-3">
          {step === "upload" && (
            <Button variant="outline" onClick={close}>
              Cancelar
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={reset} disabled={commit.isPending}>
                <ArrowLeft className="mr-1.5 h-4 w-4" /> Cambiar archivo
              </Button>
              <Button onClick={() => commit.mutate()} disabled={commit.isPending}>
                {commit.isPending ? "Aplicando…" : "Confirmar importación"}
              </Button>
            </>
          )}
          {step === "result" && (
            <>
              <Button variant="outline" onClick={reset}>
                Importar otro
              </Button>
              <Button onClick={close}>Cerrar</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function statusLabel(k: string) {
  switch (k) {
    case "active":
      return "Activas";
    case "pending":
      return "Pendientes";
    case "requires_review":
      return "Requieren revisión";
    case "excluded":
      return "Excluidas";
    default:
      return k;
  }
}

function BucketCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="py-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {icon}
          {label}
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

function BucketTable({
  rows,
  showReasons,
}: {
  rows: ClassifiedRow[];
  showReasons?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
        Sin filas en esta categoría.
      </div>
    );
  }
  return (
    <div className="max-h-[40vh] overflow-y-auto rounded-md border border-border">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted/50 text-left">
          <tr>
            <th className="px-2 py-1.5">Fila</th>
            <th className="px-2 py-1.5">SKU</th>
            <th className="px-2 py-1.5">Cód. cliente</th>
            <th className="px-2 py-1.5 text-right">Precio venta</th>
            <th className="px-2 py-1.5">Vigencia</th>
            {showReasons && <th className="px-2 py-1.5">Motivos</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.row.row_number}-${i}`} className="border-t border-border">
              <td className="px-2 py-1.5">{r.row.row_number}</td>
              <td className="px-2 py-1.5 font-mono">{r.row.sku ?? "—"}</td>
              <td className="px-2 py-1.5">{r.row.client_code ?? "—"}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">
                {fmtMoney(r.row.sale_price ?? null)}
              </td>
              <td className="px-2 py-1.5">
                {(r.row.start_date ?? "—") + " – " + (r.row.end_date ?? "—")}
              </td>
              {showReasons && (
                <td className="px-2 py-1.5">
                  <div className="flex flex-wrap gap-1">
                    {(r.reasons ?? []).map((rsn) => (
                      <Badge key={rsn} color="warning" variant="soft">
                        {PENDING_REASON_LABELS[rsn as ImportPendingReason] ?? rsn}
                      </Badge>
                    ))}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FormatErrorsTable({ rows }: { rows: ParsedImportRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
        Sin errores de formato.
      </div>
    );
  }
  return (
    <div className="max-h-[40vh] overflow-y-auto rounded-md border border-border">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-muted/50 text-left">
          <tr>
            <th className="px-2 py-1.5">Fila</th>
            <th className="px-2 py-1.5">Errores</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.row_number} className="border-t border-border">
              <td className="px-2 py-1.5">{r.row_number}</td>
              <td className="px-2 py-1.5">{r.format_errors.join(" · ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
