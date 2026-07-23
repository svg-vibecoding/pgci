import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Download, Info, Paperclip, X } from "lucide-react";

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
import { ClientCodeMapping } from "@/components/agreements/import-report/ClientCodeMapping";

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
    ignoredColumns: string[];
  } | null>(null);
  const [classified, setClassified] = useState<DiffResult | null>(null);
  const [catalog, setCatalog] = useState<Map<string, CatalogProduct>>(
    new Map(),
  );
  const [fileError, setFileError] = useState<string | null>(null);
  const [loadingClassify, setLoadingClassify] = useState(false);
  const [mappedClientId, setMappedClientId] = useState<string | null>(null);
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
    setMappedClientId(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const runClassify = useCallback(
    (
      parseResult: {
        rows: ParsedRow[];
        presentColumns: PricingField[];
      },
      catalogBySku: Map<string, CatalogProduct>,
      clientIdForRun: string | null,
    ) => {
      const snap = snapshotQuery.data;
      if (!snap) return;
      const result = classifyImport({
        rows: parseResult.rows,
        presentColumns: parseResult.presentColumns,
        snapshot: {
          positions: snap.positions,
          activeClientCodes: snap.activeClientCodes,
          catalogBySku,
          clientIds: new Set(snap.clientIds),
        },
        mappedClientId: clientIdForRun,
      });
      setClassified(result);
    },
    [snapshotQuery.data],
  );

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    resetAll();
    setFileName(file.name);

    let parseResult: { rows: ParsedRow[]; presentColumns: PricingField[]; ignoredColumns: string[] };
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

      // Decidir mappedClientId automático (sin selector) según reglas de negocio.
      const manageableClients = (snap.clients ?? []).filter((c) => c.can_manage);
      const hasClientCodeColumn = parseResult.presentColumns.includes("client_code");
      const hasClientCodeValues =
        hasClientCodeColumn &&
        parseResult.rows.some(
          (r) => r.client_code && r.client_code.trim().length > 0,
        );
      let initialClientId: string | null = null;
      if (hasClientCodeValues && manageableClients.length === 1) {
        initialClientId = manageableClients[0].id;
      }
      setMappedClientId(initialClientId);
      runClassify(parseResult, catalogBySku, initialClientId);
    } catch {
      setFileError(
        "No fue posible clasificar el archivo. Intenta nuevamente en unos segundos.",
      );
    } finally {
      setLoadingClassify(false);
    }
  }

  const totalRows = parsed?.rows.length ?? 0;
  const hasClientCodeColumn =
    parsed?.presentColumns.includes("client_code") ?? false;
  const hasClientCodeValues = useMemo(
    () =>
      hasClientCodeColumn &&
      (parsed?.rows.some(
        (r) => r.client_code && r.client_code.trim().length > 0,
      ) ??
        false),
    [hasClientCodeColumn, parsed],
  );
  const snapPositions = useMemo(
    () => snapshotQuery.data?.positions ?? [],
    [snapshotQuery.data],
  );
  const allClients = snapshotQuery.data?.clients ?? [];
  const manageableClients = useMemo(
    () => allClients.filter((c) => c.can_manage),
    [allClients],
  );

  // Estado de la Card 3 (mapeo de cliente)
  type MappingState =
    | { kind: "hidden_no_codes" }
    | { kind: "hidden_auto"; clientName: string }
    | { kind: "hidden_no_permission" }
    | { kind: "visible"; mustChoose: boolean };

  const mappingState: MappingState = useMemo(() => {
    if (!parsed) return { kind: "hidden_no_codes" };
    if (!hasClientCodeValues) return { kind: "hidden_no_codes" };
    if (manageableClients.length === 0) return { kind: "hidden_no_permission" };
    if (manageableClients.length === 1) {
      return { kind: "hidden_auto", clientName: manageableClients[0].name };
    }
    return { kind: "visible", mustChoose: mappedClientId === null };
  }, [parsed, hasClientCodeValues, manageableClients, mappedClientId]);

  function onClientSelect(id: string) {
    if (id === mappedClientId) return;
    setMappedClientId(id);
    if (parsed) {
      runClassify(parsed, catalog, id);
    }
  }

  // Si el snapshot llega tarde y ya había parsed, correr clasificación una vez.
  useEffect(() => {
    if (parsed && snapshotQuery.data && !classified && !loadingClassify) {
      runClassify(parsed, catalog, mappedClientId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotQuery.data]);

  const canShowReport =
    !!classified &&
    !!parsed &&
    (mappingState.kind !== "visible" || !mappingState.mustChoose);

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
          </CardContent>
        </Card>
      )}

      {/* Nota informativa cuando el paso de mapeo no aplica */}
      {parsed && mappingState.kind === "hidden_no_codes" && hasClientCodeColumn === false && (
        <MappingNote>
          El archivo no trae la columna <strong>Código del cliente</strong>. El
          cruce se hace solo por SKU.
        </MappingNote>
      )}
      {parsed && mappingState.kind === "hidden_no_codes" && hasClientCodeColumn && (
        <MappingNote>
          La columna <strong>Código del cliente</strong> no trae valores. El
          cruce se hace solo por SKU.
        </MappingNote>
      )}
      {parsed && mappingState.kind === "hidden_auto" && (
        <MappingNote>
          Los códigos del archivo se asignan automáticamente a{" "}
          <strong>{mappingState.clientName}</strong>.
        </MappingNote>
      )}
      {parsed && mappingState.kind === "hidden_no_permission" && (
        <MappingNote tone="warning">
          No tienes permiso de catálogo sobre ninguno de los clientes de este
          acuerdo, así que la columna <strong>Código del cliente</strong> no se
          puede mapear. El cruce se hace solo por SKU.
        </MappingNote>
      )}

      {/* Card 3: cliente de los códigos (solo cuando hay que elegir) */}
      {parsed && mappingState.kind === "visible" && (
        <Card>
          <CardHeader>
            <CardTitle className="suma-h4">3. Selección del catálogo de cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <ClientCodeMapping
              clients={allClients}
              selectedId={mappedClientId}
              onSelect={onClientSelect}
            />
          </CardContent>
        </Card>
      )}

      {/* Card 4: cómo se clasifica */}
      {canShowReport && classified && (
        <Card>
          <CardHeader>
            <CardTitle className="suma-h4">
              {mappingState.kind === "visible" ? "4." : "3."}&nbsp;Decisiones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ImportReport
              result={classified}
              positions={snapPositions}
              catalogBySku={catalog}
              clients={allClients}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MappingNote({
  children,
  tone = "info",
}: {
  children: React.ReactNode;
  tone?: "info" | "warning";
}) {
  return (
    <div
      className={
        "flex items-start gap-2 rounded-lg border px-4 py-3 " +
        (tone === "warning"
          ? "border-warning/40 bg-warning-soft text-text-primary"
          : "border-accent/30 bg-accent-soft text-text-primary")
      }
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
      <p className="suma-body">{children}</p>
    </div>
  );
}
