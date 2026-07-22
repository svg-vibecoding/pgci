import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download, Paperclip, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  getAgreementImportSnapshot,
  getCatalogProductsBySku,
} from "@/lib/agreements.functions";
import {
  classifyImport,
  downloadPricingTemplate,
  parsePricingFile,
  PricingFileFormatError,
  type CatalogProduct,
  type DiffResult,
  type ParsedRow,
  type PricingField,
} from "@/lib/agreement-import";
import { ImportReport } from "@/components/agreements/import-report/ImportReport";
import { ImportFileReading } from "@/components/agreements/import-report/ImportFileReading";

export const Route = createFileRoute(
  "/_authenticated/pgci/agreements/$agreementId/import",
)({
  head: () => ({ meta: [{ title: "Importar acuerdo · PGCI" }] }),
  component: ImportAgreementView,
});

const FILE_ERROR_MESSAGES: Record<string, string> = {
  FORMAT_UNSUPPORTED:
    "El archivo no tiene un formato soportado. Usa .xlsx o .csv.",
  MISSING_SKU_HEADER:
    "Falta la columna SKU. Descarga la plantilla y vuelve a intentarlo.",
  DUPLICATE_HEADER:
    "El archivo tiene columnas duplicadas. Deja solo una por concepto.",
  EMPTY_FILE: "El archivo está vacío o no tiene filas de datos.",
};

function ImportAgreementView() {
  const { agreementId } = Route.useParams();
  const snapshotFn = useServerFn(getAgreementImportSnapshot);
  const catalogFn = useServerFn(getCatalogProductsBySku);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<{
    rows: ParsedRow[];
    presentColumns: PricingField[];
  } | null>(null);
  const [classified, setClassified] = useState<DiffResult | null>(null);
  const [catalog, setCatalog] = useState<Map<string, CatalogProduct>>(
    new Map(),
  );
  const [fileError, setFileError] = useState<string | null>(null);
  const [loadingClassify, setLoadingClassify] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const snapshotQuery = useQuery({
    queryKey: ["agreement-import-snapshot", agreementId],
    queryFn: () => snapshotFn({ data: { agreement_id: agreementId } }),
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  function resetAll() {
    setFileName(null);
    setParsed(null);
    setClassified(null);
    setCatalog(new Map());
    setFileError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    resetAll();
    setFileName(file.name);

    let parseResult: { rows: ParsedRow[]; presentColumns: PricingField[] };
    try {
      parseResult = await parsePricingFile(file);
    } catch (err) {
      if (err instanceof PricingFileFormatError) {
        setFileError(
          FILE_ERROR_MESSAGES[err.code] ??
            `Formato no válido: ${err.message}`,
        );
      } else {
        setFileError(
          "No fue posible leer el archivo. Revisa el formato e intenta nuevamente.",
        );
      }
      return;
    }
    setParsed(parseResult);

    const snap = snapshotQuery.data;
    if (!snap) {
      setFileError(
        "Aún se está cargando el estado del acuerdo. Vuelve a subir el archivo en unos segundos.",
      );
      return;
    }

    setLoadingClassify(true);
    try {
      const skus = Array.from(
        new Set(
          parseResult.rows
            .map((r) => r.sku)
            .filter((s): s is string => !!s && s.length > 0),
        ),
      );
      const catalogList =
        skus.length > 0
          ? ((await catalogFn({ data: { skus } })) as CatalogProduct[])
          : [];
      const catalogBySku = new Map<string, CatalogProduct>();
      for (const p of catalogList) catalogBySku.set(p.sku, p);
      setCatalog(catalogBySku);

      const result = classifyImport({
        rows: parseResult.rows,
        presentColumns: parseResult.presentColumns,
        snapshot: {
          positions: snap.positions,
          activeClientCodes: snap.activeClientCodes,
          catalogBySku,
          clientIds: new Set(snap.clientIds),
        },
        mappedClientId: null,
      });

      setClassified(result);
    } catch {
      setFileError(
        "No fue posible clasificar el archivo. Intenta nuevamente en unos segundos.",
      );
    } finally {
      setLoadingClassify(false);
    }
  }

  const totalRows = parsed?.rows.length ?? 0;
  const hasClientCode =
    parsed?.presentColumns.includes("client_code") ?? false;
  const snapPositions = useMemo(
    () => snapshotQuery.data?.positions ?? [],
    [snapshotQuery.data],
  );

  return (
    <div className="space-y-6">
      <div>
        <Button asChild size="sm" variant="ghost">
          <Link
            to="/pgci/agreements/$agreementId/lines"
            params={{ agreementId }}
          >
            <ArrowLeft className="mr-1 h-4 w-4" /> Volver al acuerdo
          </Link>
        </Button>
      </div>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="suma-h1 text-text-primary">Importar posiciones</h1>
          <p className="mt-1 suma-body text-text-secondary">
            Carga un archivo para ver cómo se clasificará cada fila frente al
            acuerdo. Esta vista solo previsualiza: nada se guarda todavía.
          </p>
        </div>
        <Button variant="outline" onClick={() => downloadPricingTemplate()}>
          <Download className="mr-2 h-4 w-4" /> Descargar plantilla
        </Button>
      </header>

      {/* Card 1: subir archivo */}
      <Card>
        <CardHeader>
          <CardTitle className="suma-h4">1. Sube el archivo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={onFile}
            className="sr-only"
          />
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={snapshotQuery.isLoading}
            >
              <Paperclip className="mr-2 h-4 w-4" />
              {fileName ? "Cambiar archivo" : "Seleccionar archivo"}
            </Button>
            {fileName ? (
              <div className="flex items-center gap-2 suma-body text-text-primary">
                <span className="break-all">{fileName}</span>
                <button
                  type="button"
                  onClick={resetAll}
                  aria-label="Quitar archivo"
                  className="rounded-full p-1 text-text-tertiary hover:bg-muted hover:text-text-primary"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <span className="suma-body text-text-tertiary">
                Sin archivo seleccionado
              </span>
            )}
            {loadingClassify && (
              <span className="suma-caption text-text-tertiary">
                Clasificando…
              </span>
            )}
          </div>
          {snapshotQuery.isError && (
            <p className="suma-caption text-destructive">
              No se pudo cargar el estado del acuerdo. Recarga la página.
            </p>
          )}
          {fileError && (
            <p className="suma-caption text-destructive">{fileError}</p>
          )}
        </CardContent>
      </Card>

      {/* Card 2: lectura del archivo */}
      {parsed && (
        <Card>
          <CardHeader>
            <CardTitle className="suma-h4">2. Lectura del archivo</CardTitle>
          </CardHeader>
          <CardContent>
            <ImportFileReading
              totalRows={totalRows}
              rows={parsed.rows}
              presentColumns={parsed.presentColumns}
              ignoredColumns={parsed.ignoredColumns}
              classifiedRows={classified?.rows ?? []}
              activeClientCodes={snapshotQuery.data?.activeClientCodes ?? []}
            />
            {!hasClientCode && (
              <p className="mt-4 suma-caption text-text-tertiary">
                Sin columna de código cliente: el cruce se hace solo por SKU.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Card 3: cómo se clasifica */}
      {classified && (
        <Card>
          <CardHeader>
            <CardTitle className="suma-h4">3. Cómo se clasifica</CardTitle>
          </CardHeader>
          <CardContent>
            <ImportReport
              result={classified}
              positions={snapPositions}
              catalogBySku={catalog}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
