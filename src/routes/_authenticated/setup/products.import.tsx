import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Download, Upload } from "lucide-react";
import {
  buildUpsertPayload,
  diffAgainstExisting,
  downloadPimTemplate,
  parsePimFile,
  type DiffGroups,
  type ParsedRow,
  type PimField,
} from "@/lib/pim-import";

export const Route = createFileRoute("/_authenticated/setup/products/import")({
  head: () => ({ meta: [{ title: "Importar PIM · PGCI" }] }),
  component: ImportPim,
});

function ImportPim() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [presentColumns, setPresentColumns] = useState<PimField[]>([]);
  const [diff, setDiff] = useState<DiffGroups | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setFileError(null);
    setSuccess(null);
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
      if (err?.message === "FORMAT") setFileError("El archivo no tiene el formato esperado para PIM.");
      else setFileError("No fue posible importar el archivo. Revisa el formato e intenta nuevamente.");
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
      qc.invalidateQueries({ queryKey: ["products"] });
      setSuccess("Importación completada correctamente.");
      setParsed(null);
      setPresentColumns([]);
      setDiff(null);
    },
    onError: () =>
      setFileError("No fue posible importar el archivo. Revisa el formato e intenta nuevamente."),
  });

  const totals = diff && {
    procesados: parsed?.length ?? 0,
    crear: diff.toCreate.length,
    actualizar: diff.toUpdate.length,
    sinCambios: diff.unchanged.length,
    rechazados: diff.errors.length,
  };
  const blocked = !!(diff && diff.duplicateSkus.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <Button asChild size="sm" variant="ghost">
          <Link to="/setup/products"><ArrowLeft className="mr-1 h-4 w-4" /> Volver al PIM</Link>
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
        <CardHeader><CardTitle className="text-base">1. Sube el archivo</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input type="file" accept=".csv,.xlsx,.xls" onChange={onFile} />
          {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          {success && <p className="text-sm text-[var(--success-strong)]">{success}</p>}
        </CardContent>
      </Card>

      {diff && totals && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-base">2. Previsualización</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Stat label="Procesados" value={totals.procesados} />
                <Stat label="A crear" value={totals.crear} accent="success" />
                <Stat label="A actualizar" value={totals.actualizar} accent="info" />
                <Stat label="Sin cambios" value={totals.sinCambios} />
                <Stat label="Rechazados" value={totals.rechazados} accent="danger" />
              </div>

              {diff.duplicateSkus.length > 0 && (
                <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
                  <p className="text-sm font-medium text-destructive">
                    El archivo tiene códigos Jaivaná repetidos. Corrige el archivo antes de importar.
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

              {diff.errors.length > 0 && (
                <details className="rounded-lg border border-border p-3">
                  <summary className="cursor-pointer text-sm font-medium">
                    Filas con error ({diff.errors.length})
                  </summary>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {diff.errors.slice(0, 50).map((e) => (
                      <li key={e.rowNumber}>
                        Fila {e.rowNumber}: {e.errors.map((er) => er.error).join(" · ")}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-2">
            <Button
              onClick={() => apply.mutate()}
              disabled={blocked || apply.isPending || diff.toCreate.length + diff.toUpdate.length === 0}
            >
              <Upload className="mr-2 h-4 w-4" />
              {apply.isPending ? "Aplicando…" : "Confirmar importación"}
            </Button>
            <Button variant="outline" onClick={() => { setParsed(null); setDiff(null); }}>
              Descartar
            </Button>
          </div>
        </>
      )}

      {success && (
        <Button onClick={() => navigate({ to: "/setup/products" })}>Ir al PIM</Button>
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
