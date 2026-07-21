import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download, Paperclip, Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Chip } from "@/components/sumatec";
import {
  getAgreementImportSnapshot,
  getCatalogProductsBySku,
} from "@/lib/agreements.functions";
import {
  CANONICAL_HEADERS,
  classifyImport,
  downloadPricingTemplate,
  parsePricingFile,
  PricingFileFormatError,
  type CatalogProduct,
  type ClassifiedRow,
  type DiffGroup,
  type DiffResult,
  type ParsedRow,
  type PricingField,
} from "@/lib/agreement-import";

export const Route = createFileRoute(
  "/_authenticated/pgci/agreements/$agreementId/import",
)({
  head: () => ({ meta: [{ title: "Importar acuerdo · PGCI" }] }),
  component: ImportAgreementView,
});

// ---------------------------------------------------------------------------
// Constantes de presentación
// ---------------------------------------------------------------------------

const FIELD_LABELS: Record<PricingField, string> = {
  sku: "SKU",
  client_code: "Código cliente",
  client_description: "Descripción cliente",
  sale_price: "Precio venta",
  par_price: "Precio par",
  start_date: "Fecha inicio",
  end_date: "Fecha fin",
  observations: "Observaciones",
};

const GROUP_ORDER: Array<{
  key: DiffGroup;
  title: string;
  hint: string;
}> = [
  {
    key: "requires_decision",
    title: "Requieren decisión",
    hint: "Filas donde la persona debe intervenir para elegir qué hacer.",
  },
  {
    key: "modifies_published",
    title: "Modifican posiciones publicadas",
    hint: "Filas que cambian datos de posiciones activas, en revisión o excluidas.",
  },
  {
    key: "modifies_draft_or_adds_code",
    title: "Modifican gestión / agregan códigos",
    hint: "Filas sobre posiciones en borrador o que solo agregan un código nuevo a un cliente.",
  },
  {
    key: "not_in_agreement",
    title: "No están en el acuerdo",
    hint: "SKUs del catálogo que aún no tienen posición en este acuerdo.",
  },
  {
    key: "unchanged",
    title: "Sin cambios",
    hint: "Filas que coinciden con el estado actual de la posición.",
  },
  {
    key: "not_processable",
    title: "No procesables",
    hint: "Filas con errores de celda o SKUs desconocidos por el catálogo.",
  },
];

const FILE_ERROR_MESSAGES: Record<string, string> = {
  FORMAT_UNSUPPORTED:
    "El archivo no tiene un formato soportado. Usa .xlsx o .csv.",
  MISSING_SKU_HEADER:
    "Falta la columna SKU. Descarga la plantilla y vuelve a intentarlo.",
  DUPLICATE_HEADER:
    "El archivo tiene columnas duplicadas. Deja solo una por concepto.",
  EMPTY_FILE: "El archivo está vacío o no tiene filas de datos.",
};

// ---------------------------------------------------------------------------
// Componente
// ---------------------------------------------------------------------------

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
      const catalog =
        skus.length > 0
          ? ((await catalogFn({ data: { skus } })) as CatalogProduct[])
          : [];
      console.log("SKUs enviados:", skus.length, skus.slice(0, 3));
      console.log("catálogo recibido:", catalog.length, catalog.slice(0, 3));
      const catalogBySku = new Map<string, CatalogProduct>();
      for (const p of catalog) catalogBySku.set(p.sku, p);

      const firstSku = parseResult.rows[0]?.sku ?? null;
      console.log("→ al motor:", {
        filas: parseResult.rows.length,
        positions: snap.positions.length,
        clientIds: snap.clientIds.length,
        catalogSize: catalogBySku.size,
        primerSkuFila: firstSku,
        catalogTienePrimerSku: firstSku ? catalogBySku.has(firstSku) : false,
      });
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
      console.log("← del motor:", result.totals);
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
  const sumTotals = classified
    ? GROUP_ORDER.reduce(
        (acc, g) => acc + (classified.totals[g.key] ?? 0),
        0,
      )
    : 0;
  const totalsMismatch = classified !== null && sumTotals !== totalRows;
  const hasClientCode =
    parsed?.presentColumns.includes("client_code") ?? false;

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

      {/* Card 2: qué se reconoció */}
      {parsed && (
        <Card>
          <CardHeader>
            <CardTitle className="suma-h4">2. Qué se reconoció</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Chip>{parsed.presentColumns.length} columnas</Chip>
              <span className="suma-body text-text-secondary">
                {parsed.presentColumns
                  .map((c) => FIELD_LABELS[c])
                  .join(" · ")}
              </span>
            </div>
            <p className="suma-body text-text-primary">
              <strong>{totalRows}</strong>{" "}
              {totalRows === 1 ? "fila de datos leída" : "filas de datos leídas"}
              .
            </p>
            {!hasClientCode && (
              <p className="suma-caption text-text-tertiary">
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
          <CardContent className="space-y-4">
            <p className="suma-body text-text-primary">
              <strong>{sumTotals}</strong>{" "}
              {sumTotals === 1
                ? "fila clasificada"
                : "filas clasificadas"}
              .
            </p>
            {totalsMismatch && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3">
                <p className="suma-body font-medium text-destructive">
                  Inconsistencia interna: la suma de los grupos ({sumTotals})
                  no coincide con las filas leídas ({totalRows}). Contacta
                  soporte.
                </p>
              </div>
            )}
            <Accordion type="multiple" className="w-full">
              {GROUP_ORDER.map((g) => {
                const rows = classified.rows.filter((r) => r.group === g.key);
                return (
                  <AccordionItem key={g.key} value={g.key}>
                    <AccordionTrigger>
                      <span className="flex flex-1 items-center justify-between pr-2">
                        <span className="suma-body font-medium text-text-primary">
                          {g.title}
                        </span>
                        <span className="suma-body text-text-tertiary">
                          ({classified.totals[g.key] ?? 0})
                        </span>
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="mb-2 suma-caption text-text-tertiary">
                        {g.hint}
                      </p>
                      <GroupRowsList rows={rows} group={g.key} />
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Lista mínima por grupo (sourceRow + SKU + código si aplica)
// ---------------------------------------------------------------------------

function GroupRowsList({ rows }: { rows: ClassifiedRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="suma-caption text-text-tertiary">Sin filas en este grupo.</p>
    );
  }
  const visible = rows.slice(0, 100);
  const rest = rows.length - visible.length;
  return (
    <div>
      <table className="w-full suma-caption">
        <thead>
          <tr className="text-left text-text-tertiary">
            <th className="py-1 pr-3">Fila</th>
            <th className="py-1 pr-3">SKU</th>
            <th className="py-1">Código cliente</th>
          </tr>
        </thead>
        <tbody>
          {visible.map((r) => (
            <tr
              key={`${r.sourceRow}-${r.group}`}
              className="border-t border-border/60"
            >
              <td className="py-1 pr-3 text-text-secondary">{r.sourceRow}</td>
              <td className="py-1 pr-3 font-mono text-text-primary">
                {r.row.sku ?? "—"}
              </td>
              <td className="py-1 font-mono text-text-secondary">
                {r.row.client_code ?? "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rest > 0 && (
        <p className="mt-2 suma-caption text-text-tertiary">
          …y {rest} más.
        </p>
      )}
    </div>
  );
}
