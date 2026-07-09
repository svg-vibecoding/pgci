// server-only helpers for the agreements module.
// imported by agreements.functions.ts to keep handlers thin
// (avoids tss-serverfn-split ReferenceError pitfalls).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type SB = SupabaseClient<Database>;

export async function assertCanAdmin(supabase: SB, agreementId: string) {
  const { data, error } = await supabase.rpc("can_admin_agreement", {
    p_agreement_id: agreementId,
  });
  if (error) throw new Error("No se pudo verificar permisos del acuerdo");
  if (!data) throw new Error("No tienes permisos sobre este acuerdo");
}

export async function assertCanAccess(supabase: SB, agreementId: string) {
  const { data, error } = await supabase.rpc("can_access_agreement", {
    p_agreement_id: agreementId,
  });
  if (error) throw new Error("No se pudo verificar acceso al acuerdo");
  if (!data) throw new Error("Sin acceso a este acuerdo");
}

export async function assertCanCreateForClient(supabase: SB, clientId: string) {
  const { data, error } = await supabase.rpc("can_create_agreements_for_client", {
    p_client_id: clientId,
  });
  if (error) throw new Error("No se pudo verificar permisos sobre el cliente");
  if (!data) throw new Error("No tienes permiso para crear acuerdos en este cliente");
}

export async function resolveProductBySku(
  supabase: SB,
  sku: string | null,
): Promise<{ id: string; status: string } | null> {
  if (!sku) return null;
  const { data, error } = await supabase
    .from("products")
    .select("id, status")
    .eq("sku", sku)
    .maybeSingle();
  if (error) throw new Error("Error consultando catálogo de productos");
  return data ?? null;
}

export type SkuConflictCode = {
  client_id: string;
  client_name: string | null;
  client_code: string;
  description: string | null;
};

export type SkuConflict = {
  line_id: string;
  codes: SkuConflictCode[];
  current_price: number | null;
  updated_at: string | null;
};

// Devuelve las posiciones (no excluidas) del acuerdo que comparten SKU,
// con la lista de códigos abiertos por cliente en cada una.
// RLS filtra visibilidad; NO duplicar checks aquí.
export async function detectSkuConflicts(
  supabase: SB,
  agreementId: string,
  sku: string,
  excludeLineId?: string,
): Promise<SkuConflict[]> {
  const product = await resolveProductBySku(supabase, sku);
  if (!product) return [];
  const { data: lines, error } = await supabase
    .from("agreement_positions")
    .select("id, sale_price, updated_at")
    .eq("agreement_id", agreementId)
    .eq("product_id", product.id)
    .neq("status", "excluded");
  if (error) throw new Error("No se pudieron consultar posiciones con mismo SKU");
  const filtered = (lines ?? []).filter((r) => r.id !== excludeLineId);
  if (filtered.length === 0) return [];

  const posIds = filtered.map((r) => r.id as string);

  // Códigos abiertos por posición.
  const { data: apcc, error: apccErr } = await supabase
    .from("agreement_position_client_codes")
    .select(
      "agreement_position_id, client_id, client_product_id, clients!agreement_position_client_codes_client_id_fkey(commercial_name, legal_name), client_products!agreement_position_client_codes_client_product_id_fkey(client_code)",
    )
    .in("agreement_position_id", posIds)
    .is("valid_until", null);
  if (apccErr) throw new Error("No se pudieron consultar códigos del cliente");

  // Descripción más reciente por client_product_id (historial).
  const cpIds = Array.from(
    new Set(
      (apcc ?? [])
        .map((c) => c.client_product_id as string | null)
        .filter((v): v is string => !!v),
    ),
  );
  const descByCp = new Map<string, string | null>();
  if (cpIds.length > 0) {
    const { data: hist } = await supabase
      .from("client_product_history")
      .select("client_product_id, description, valid_from")
      .in("client_product_id", cpIds)
      .order("valid_from", { ascending: false });
    for (const h of hist ?? []) {
      const cpId = h.client_product_id as string;
      if (!descByCp.has(cpId)) {
        descByCp.set(cpId, (h.description as string | null) ?? null);
      }
    }
  }

  const codesByPos = new Map<string, SkuConflictCode[]>();
  for (const c of apcc ?? []) {
    const client = c.clients as { commercial_name: string | null; legal_name: string | null } | null;
    const cp = c.client_products as { client_code: string | null } | null;
    const code = cp?.client_code ?? null;
    if (!code) continue;
    const entry: SkuConflictCode = {
      client_id: c.client_id as string,
      client_name: client?.commercial_name ?? client?.legal_name ?? null,
      client_code: code,
      description: descByCp.get(c.client_product_id as string) ?? null,
    };
    const arr = codesByPos.get(c.agreement_position_id as string) ?? [];
    arr.push(entry);
    codesByPos.set(c.agreement_position_id as string, arr);
  }

  return filtered.map((r) => ({
    line_id: r.id as string,
    codes: codesByPos.get(r.id as string) ?? [],
    current_price: (r.sale_price as number | null) ?? null,
    updated_at: (r.updated_at as string | null) ?? null,
  }));
}
