// Réplica cliente de position_has_sku_conflict (Postgres). Las dos
// implementaciones deben decir lo mismo. Si cambia una, cambia la otra.
// Ver supabase/migrations/20260716142957_9f7ac5c7-5ab4-4191-a58d-fd083a664796.sql

// Regla par a par (position_has_sku_conflict): estoy en conflicto si existe
// AL MENOS UNA posición publicada del mismo SKU contra la cual NINGÚN cliente
// me distingue. Un cliente distingue un par si en AMBAS posiciones existe una
// fila en agreement_position_client_codes con client_product_id — es decir,
// un código resoluble. En la UI eso se traduce en:
//   - card en modo 'edit' con código no vacío (producto de cliente ya
//     seleccionado o hidratado desde initial), o
//   - card en modo 'creating' con código Y descripción llenos (forma_ que
//     al guardar se convertirá en un client_product real).
// Además el código debe ser distinto al de la hermana (defensivo: RN-MATCH-01
// ya impide colisiones, pero el predicado lo comenta así).

export type ClientCodeEntry = { code: string; description: string };
export type ClientCodeMode = "search" | "creating" | "edit";

export type SiblingCode = {
  client_id: string;
  client_code: string;
};

export type SiblingPosition = {
  published_at: string | null;
  codes: SiblingCode[];
};

export type SkuConflictInput = {
  productId: string | null;
  siblings: SiblingPosition[] | null;
  codeEntries: Map<string, ClientCodeEntry>;
  codeModes: Map<string, ClientCodeMode>;
};

export function clientDistinguishes(
  cid: string,
  siblingCode: string | null,
  codeEntries: Map<string, ClientCodeEntry>,
  codeModes: Map<string, ClientCodeMode>,
): boolean {
  if (!siblingCode) return false;
  const entry = codeEntries.get(cid);
  if (!entry) return false;
  const mine = entry.code.trim();
  if (!mine) return false;
  const mode = codeModes.get(cid) ?? "search";
  if (mode === "search") return false;
  if (mode === "creating" && entry.description.trim() === "") return false;
  return mine.toLowerCase() !== siblingCode.trim().toLowerCase();
}

export function undistinguishedSiblings<T extends SiblingPosition>(
  input: {
    productId: string | null;
    siblings: T[] | null;
    codeEntries: Map<string, ClientCodeEntry>;
    codeModes: Map<string, ClientCodeMode>;
  },
): T[] {
  const { productId, siblings, codeEntries, codeModes } = input;
  if (!productId || !siblings) return [];
  const publishedSiblings = siblings.filter((p) => p.published_at != null);
  return publishedSiblings.filter((p) => {
    for (const c of p.codes) {
      if (clientDistinguishes(c.client_id, c.client_code, codeEntries, codeModes)) {
        return false;
      }
    }
    return true;
  });
}
