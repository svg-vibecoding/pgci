import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { ArrowLeft, Download, Upload } from "lucide-react";
import {
  buildUpsertPayload,
  diffAgainstExisting,
  downloadPimTemplate,
  FIELD_LABELS,
  formatFieldValue,
  getClearedFields,
  getInactivations,
  parsePimFile,
  type ClearedField,
  type DiffGroups,
  type Inactivation,
  type ParsedRow,
  type PimField,
} from "@/lib/pim-import";

export const Route = createFileRoute("/_authenticated/setup/products/import")({
  head: () => ({ meta: [{ title: "Importar PIM · PGCI" }] }),
  component: ImportPim,
});

type FinalSummary = {
  created: number;
  updated: number;
  unchanged: number;
  errors: number;
  inactivated: number;
  cleared: number;
};

function ImportPim() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [presentColumns, setPresentColumns] = useState<PimField[]>([]);
  const [diff, setDiff] = useState<DiffGroups | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [finalSummary, setFinalSummary] = useState<FinalSummary | null>(null);

  const inactivations: Inactivation[] = useMemo(
    () => (diff ? getInactivations(diff) : []),
    [diff],
  );
  const clearedFields: ClearedField[] = useMemo(
    () => (diff ? getClearedFields(diff) : []),
    [diff],
  );

  function resetAll() {
    setParsed(null);
    setPresentColumns([]);
    setDiff(null);
    setFileError(null);
    setFinalSummary(null);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    setFinalSummary(null);
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { rows, presentColumns: cols } = await parsePimFile(file);
      const skus = rows.filter((r) => r.data).map((r) => r.data!.sku);
      const existing: Array<Record<string, unknown>> = [];
      const CHUNK = 200;
      for (let i = 0; i < skus.length; i += CHUNK) {
        const slice = skus.slice(i, i + CHUNK);
        const { data, error } = await supabase
          .from("products")
          .select("*")
          .in("sku", slice);
        if (error) throw error;
        existing.push(...((data ?? []) as Array<Record<string, unknown>>));
      }
      setParsed(rows);
      setPresentColumns(cols);
      setDiff(diffAgainstExisting(rows, existing, cols));
    } catch (err: any) {
      if (err?.message === "FORMAT")
        setFileError("El archivo no tiene el formato esperado para PIM.");
      else
        setFileError(
          "No fue posible importar el archivo. Revisa el formato e intenta nuevamente.",
        );
    }
  }

  const apply = useMutation({
    mutationFn: async () => {
      if (!diff) return;
      const all = [...diff.toCreate, ...diff.toUpdate.map((u) => u.next)];
      const payloads = all.map((r) => buildUpsertPayload(r, presentColumns));
      const CHUNK = 200;
      for (let i = 0; i < payloads.length; i += CHUNK) {
        const { error } = await supabase
          .from("products")
          .upsert(payloads.slice(i, i + CHUNK) as never, { onConflict: "sku" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      if (!diff) return;
      qc.invalidateQueries({ queryKey: ["products"] });
      setFinalSummary({
        created: diff.toCreate.length,
        updated: diff.toUpdate.length,
        unchanged: diff.unchanged.length,
        errors: diff.errors.length,
        inactivated: inactivations.length,
        cleared: clearedFields.length,
      });
      setParsed(null);
      setPresentColumns([]);
      setDiff(null);
      setConfirmOpen(false);
    },
    onError: () => {
      setConfirmOpen(false);
      setFileError(
        "No fue posible importar el archivo. Revisa el formato e intenta nuevamente.",
      );
    },
  });

  const totals = diff && {
    procesados: parsed?.length ?? 0,
    crear: diff.toCreate.length,
    actualizar: diff.toUpdate.length,
    sinCambios: diff.unchanged.length,
    rechazados: diff.errors.length,
  };
  const blocked = !!(diff && diff.duplicateSkus.length > 0);
  const hasChanges = !!(diff && diff.toCreate.length + diff.toUpdate.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild size="sm" variant="ghost">
          <Link to="/setup/products">
            <ArrowLeft className="mr-1 h-4 w-4" /> Volver al PIM
          </Link>
        </Button>
      </div>
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Importar PIM</h1>
          <p className="text-sm text-muted-foreground">
            Carga un archivo CSV o XLSX. Se hará un upsert por Código Jaivaná.
          </p>
        </div>
        <Button variant="outline" onClick={downloadPimTemplate}>
          <Download className="mr-2 h-4 w-4" /> Descargar plantilla
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Sube el archivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input type="file" accept=".csv,.xlsx,.xls" onChange={onFile} />
          {fileError && <p className="text-sm text-destructive">{fileError}</p>}
        </CardContent>
      </Card>

      {diff && totals && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. Previsualización</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Stat label="Procesados" value={totals.procesados} />
                <Stat label="A crear" value={totals.crear} accent="success" />
                <Stat label="A actualizar" value={totals.actualizar} accent="info" />
                <Stat label="Sin cambios" value={totals.sinCambios} />
                <Stat label="Rechazados" value={totals.rechazados} accent="danger" />
              </div>

              {(inactivations.length > 0 || clearedFields.length > 0) && (
                <div className="flex flex-wrap gap-2 text-xs">
                  {inactivations.length > 0 && (
                    <span className="rounded-full border border-border bg-muted px-2 py-1">
                      Inactivados: <strong>{inactivations.length}</strong>
                    </span>
                  )}
                  {clearedFields.length > 0 && (
                    <span className="rounded-full border border-border bg-muted px-2 py-1">
                      Campos limpiados: <strong>{clearedFields.length}</strong>
                    </span>
                  )}
                </div>
              )}

              {diff.duplicateSkus.length > 0 && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                  <p className="text-sm font-medium text-destructive">
                    La importación está bloqueada hasta corregir los SKUs duplicados.
                  </p>
                  <ul className="mt-2 max-h-40 overflow-auto text-xs text-destructive">
                    {diff.duplicateSkus.map((d) => (
                      <li key={d.sku} className="font-mono">
                        {d.sku} — filas: {d.rows.join(", ")}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <Accordion type="multiple" className="w-full">
                {diff.toCreate.length > 0 && (
                  <AccordionItem value="new">
                    <AccordionTrigger>
                      Nuevos ({diff.toCreate.length})
                    </AccordionTrigger>
                    <AccordionContent>
                      <DataTable
                        columns={["Código Jaivaná", "Descripción Jaivaná", "Marca", "Estado"]}
                        rows={diff.toCreate.slice(0, 200).map((r) => [
                          r.sku,
                          r.erp_description,
                          r.commercial_brand,
                          formatFieldValue("status", r.status),
                        ])}
                        truncated={diff.toCreate.length - Math.min(200, diff.toCreate.length)}
                      />
                    </AccordionContent>
                  </AccordionItem>
                )}

                {diff.toUpdate.length > 0 && (
                  <AccordionItem value="updated">
                    <AccordionTrigger>
                      Actualizados ({diff.toUpdate.length})
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        {diff.toUpdate.slice(0, 100).map((u) => (
                          <div
                            key={u.next.sku}
                            className="rounded-lg border border-border p-3"
                          >
                            <p className="mb-2 text-sm font-medium">
                              <span className="font-mono">{u.next.sku}</span>{" "}
                              <span className="text-muted-foreground">
                                — {u.next.erp_description}
                              </span>
                            </p>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-left text-muted-foreground">
                                  <th className="py-1 pr-3">Campo</th>
                                  <th className="py-1 pr-3">Antes</th>
                                  <th className="py-1">Nuevo</th>
                                </tr>
                              </thead>
                              <tbody>
                                {u.changedFields.map((f) => (
                                  <tr key={f} className="border-t border-border/60">
                                    <td className="py-1 pr-3">{FIELD_LABELS[f]}</td>
                                    <td className="py-1 pr-3 text-muted-foreground">
                                      {formatFieldValue(
                                        f,
                                        (u.current as Record<string, unknown>)[f],
                                      )}
                                    </td>
                                    <td className="py-1 font-medium">
                                      {formatFieldValue(
                                        f,
                                        (u.next as Record<string, unknown>)[f],
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                        {diff.toUpdate.length > 100 && (
                          <p className="text-xs text-muted-foreground">
                            …y {diff.toUpdate.length - 100} más.
                          </p>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {diff.unchanged.length > 0 && (
                  <AccordionItem value="unchanged">
                    <AccordionTrigger>
                      Sin cambios ({diff.unchanged.length})
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="text-sm text-muted-foreground">
                        Estos productos están en el archivo pero no presentan diferencias.
                      </p>
                      <ul className="mt-2 max-h-48 overflow-auto text-xs font-mono">
                        {diff.unchanged.slice(0, 200).map((p) => (
                          <li key={p.sku}>{p.sku}</li>
                        ))}
                      </ul>
                      {diff.unchanged.length > 200 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          …y {diff.unchanged.length - 200} más.
                        </p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )}

                {inactivations.length > 0 && (
                  <AccordionItem value="inactivated">
                    <AccordionTrigger>
                      Inactivados ({inactivations.length})
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="mb-2 text-sm text-muted-foreground">
                        Estos productos pasarán a Inactivo. Si están asociados a productos
                        de acuerdo, deberán quedar en revisión en el flujo correspondiente.
                      </p>
                      <DataTable
                        columns={["Código Jaivaná", "Descripción Jaivaná", "Pasará a"]}
                        rows={inactivations.map((i) => [
                          i.sku,
                          i.erp_description,
                          "Inactivo",
                        ])}
                      />
                    </AccordionContent>
                  </AccordionItem>
                )}

                {clearedFields.length > 0 && (
                  <AccordionItem value="cleared">
                    <AccordionTrigger>
                      Campos limpiados ({clearedFields.length})
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="mb-2 text-sm text-muted-foreground">
                        Estos campos se limpiarán porque el archivo trae la columna vacía.
                      </p>
                      <DataTable
                        columns={["Código Jaivaná", "Campo", "Antes", "Nuevo"]}
                        rows={clearedFields.map((c) => [
                          c.sku,
                          FIELD_LABELS[c.field],
                          c.before,
                          "—",
                        ])}
                      />
                    </AccordionContent>
                  </AccordionItem>
                )}

                {diff.errors.length > 0 && (
                  <AccordionItem value="errors">
                    <AccordionTrigger>
                      Errores ({diff.errors.length})
                    </AccordionTrigger>
                    <AccordionContent>
                      <ul className="space-y-1 text-xs text-muted-foreground">
                        {diff.errors.slice(0, 200).map((e) =>
                          e.errors.map((er, idx) => (
                            <li key={`${e.rowNumber}-${idx}`}>
                              Fila {e.rowNumber} ·{" "}
                              {er.field === "file"
                                ? "Archivo"
                                : FIELD_LABELS[er.field as PimField]}
                              : {er.error}
                            </li>
                          )),
                        )}
                      </ul>
                      {diff.errors.length > 200 && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          …y {diff.errors.length - 200} filas más con error.
                        </p>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button
              onClick={() => setConfirmOpen(true)}
              disabled={blocked || apply.isPending || !hasChanges}
            >
              <Upload className="mr-2 h-4 w-4" />
              {apply.isPending ? "Aplicando…" : "Confirmar importación"}
            </Button>
            <Button variant="outline" onClick={resetAll}>
              Descartar
            </Button>
          </div>
        </>
      )}

      {diff && totals && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar importación PIM</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2 text-sm">
                  <p>Vas a actualizar el catálogo PIM por Código Jaivaná.</p>
                  <p className="text-muted-foreground">
                    Los productos ausentes del archivo no se modificarán ni se inactivarán.
                  </p>
                  <p>
                    <strong>{totals.crear}</strong> nuevos,{" "}
                    <strong>{totals.actualizar}</strong> actualizados,{" "}
                    <strong>{totals.sinCambios}</strong> sin cambios,{" "}
                    <strong>{totals.rechazados}</strong> omitidos por error.
                  </p>
                  {diff.errors.length > 0 && (
                    <p className="text-muted-foreground">
                      Se importarán las filas válidas y se omitirán las filas con error.
                    </p>
                  )}
                  {inactivations.length > 0 && (
                    <p className="text-muted-foreground">
                      {inactivations.length} producto(s) pasarán a Inactivo. Si están
                      asociados a acuerdos, deberán quedar en revisión en el flujo
                      correspondiente.
                    </p>
                  )}
                  {clearedFields.length > 0 && (
                    <p className="text-muted-foreground">
                      Algunos campos opcionales serán limpiados porque el archivo trae
                      valores vacíos ({clearedFields.length}).
                    </p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={apply.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                disabled={apply.isPending}
                onClick={(e) => {
                  e.preventDefault();
                  apply.mutate();
                }}
              >
                {apply.isPending ? "Aplicando…" : "Confirmar e importar"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {finalSummary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Importación completada</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-[var(--success-strong)]">
              Importación completada correctamente.
            </p>
            <ul className="text-sm text-muted-foreground">
              <li>Creados: <strong className="text-foreground">{finalSummary.created}</strong></li>
              <li>Actualizados: <strong className="text-foreground">{finalSummary.updated}</strong></li>
              <li>Sin cambios: <strong className="text-foreground">{finalSummary.unchanged}</strong></li>
              <li>Omitidos por error: <strong className="text-foreground">{finalSummary.errors}</strong></li>
              <li>Inactivados: <strong className="text-foreground">{finalSummary.inactivated}</strong></li>
              <li>Campos limpiados: <strong className="text-foreground">{finalSummary.cleared}</strong></li>
            </ul>
            <div className="flex gap-2">
              <Button onClick={() => navigate({ to: "/setup/products" })}>Ir al PIM</Button>
              <Button variant="outline" onClick={resetAll}>
                Importar otro archivo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "success" | "info" | "danger";
}) {
  const color =
    accent === "success"
      ? "text-[var(--success-strong)]"
      : accent === "info"
        ? "text-[var(--info-strong)]"
        : accent === "danger"
          ? "text-destructive"
          : "text-foreground";
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function DataTable({
  columns,
  rows,
  truncated,
}: {
  columns: string[];
  rows: (string | number)[][];
  truncated?: number;
}) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            {columns.map((c) => (
              <th key={c} className="py-1 pr-3 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border/60">
              {row.map((cell, j) => (
                <td key={j} className="py-1 pr-3">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {truncated && truncated > 0 ? (
        <p className="mt-1 text-xs text-muted-foreground">…y {truncated} más.</p>
      ) : null}
    </div>
  );
}
