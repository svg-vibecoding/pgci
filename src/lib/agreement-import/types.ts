// Tipos públicos del parser de importación de acuerdos (Paso 1).
// El parser NO escribe, NO cruza, NO clasifica. Solo tipa y limpia.

export type PricingField =
  | "sku"
  | "client_code"
  | "client_description"
  | "sale_price"
  | "par_price"
  | "start_date"
  | "end_date"
  | "observations";

export type CellError = {
  field: PricingField;
  reason: string;
  /** Valor crudo tal cual llegó del archivo (para mostrarlo al usuario). */
  rawValue?: string;
};

export type ParsedRow = {
  /** Número de fila en el archivo original (1-based; 2 = primera fila de datos tras la cabecera). */
  sourceRow: number;
  sku: string | null;
  client_code: string | null;
  client_description: string | null;
  sale_price: number | null;
  par_price: number | null;
  /** ISO "YYYY-MM-DD". */
  start_date: string | null;
  /** ISO "YYYY-MM-DD". */
  end_date: string | null;
  observations: string | null;
  cellErrors: CellError[];
};

export type ParseResult = {
  /** Filas totalmente vacías se descartan en silencio. */
  rows: ParsedRow[];
  /** Columnas presentes en el archivo, en orden canónico. */
  presentColumns: PricingField[];
  /** Encabezados crudos del archivo que NO corresponden a ninguna columna canónica. */
  ignoredColumns: string[];
};

export type PricingFileFormatCode =
  | "FORMAT_UNSUPPORTED"
  | "MISSING_SKU_HEADER"
  | "DUPLICATE_HEADER"
  | "EMPTY_FILE";

export class PricingFileFormatError extends Error {
  code: PricingFileFormatCode;
  /** Encabezado(s) involucrados cuando aplica (DUPLICATE_HEADER). */
  header?: string;
  constructor(code: PricingFileFormatCode, message: string, header?: string) {
    super(message);
    this.name = "PricingFileFormatError";
    this.code = code;
    this.header = header;
  }
}
