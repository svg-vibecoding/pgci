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

export async function getAgreementClientId(supabase: SB, agreementId: string) {
  const { data, error } = await supabase
    .from("agreement_companies")
    .select("client_id")
    .eq("agreement_id", agreementId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error("No se pudo resolver el cliente del acuerdo");
  if (!data?.client_id) throw new Error("Acuerdo sin clientes vinculados");
  return data.client_id as string;
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

export async function ensureClientProduct(
  supabase: SB,
  clientId: string,
  clientCode: string,
): Promise<string> {
  const { data: existing } = await supabase
    .from("client_products")
    .select("id")
    .eq("client_id", clientId)
    .eq("client_code", clientCode)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const { data, error } = await supabase
    .from("client_products")
    .insert({ client_id: clientId, client_code: clientCode })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo crear el código del cliente: ${error.message}`);
  return data.id;
}

export async function ensureMatch(
  supabase: SB,
  clientProductId: string,
  productId: string,
): Promise<string> {
  // TODO 03.22: cerrar match anterior antes de crear uno nuevo.
  // Decisión V1 (acordada): ensureMatch NO cierra matches anteriores del mismo
  // client_product_id. Si el código del cliente cambia de producto, pueden
  // coexistir dos matches abiertos. El cierre (valid_to del match previo) se
  // implementa en el módulo 03.22 (Códigos del cliente / mapeo).
  const { data: existing } = await supabase
    .from("client_product_match")
    .select("id")
    .eq("client_product_id", clientProductId)
    .eq("product_id", productId)
    .maybeSingle();
  if (existing?.id) return existing.id;
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("client_product_match")
    .insert({
      client_product_id: clientProductId,
      product_id: productId,
      valid_from: today,
      source: "manual",
    })
    .select("id")
    .single();
  if (error) throw new Error(`No se pudo crear el match: ${error.message}`);
  return data.id;
}

export type SkuConflict = {
  line_id: string;
  client_code: string | null;
  client_description: string | null;
  current_price: number | null;
  updated_at: string | null;
};

export async function detectSkuConflicts(
  supabase: SB,
  agreementId: string,
  sku: string,
  excludeLineId?: string,
): Promise<SkuConflict[]> {
  const product = await resolveProductBySku(supabase, sku);
  if (!product) return [];
  const { data: lines, error } = await supabase
    .from("agreement_products")
    .select("id, sale_price, client_product_match_id, updated_at")
    .eq("agreement_id", agreementId)
    .eq("product_id", product.id)
    .neq("status", "excluded");
  if (error) throw new Error("No se pudieron consultar posiciones con mismo SKU");
  const filtered = (lines ?? []).filter((r) => r.id !== excludeLineId);
  if (filtered.length === 0) return [];

  const matchIds = filtered
    .map((r) => r.client_product_match_id)
    .filter((v): v is string => !!v);
  const codeByMatch = new Map<string, string>();
  const descByMatch = new Map<string, string>();
  if (matchIds.length > 0) {
    const { data: matches } = await supabase
      .from("client_product_match")
      .select("id, client_product_id")
      .in("id", matchIds);
    const cpIds = (matches ?? [])
      .map((m) => m.client_product_id)
      .filter((v): v is string => !!v);
    const descByCp = new Map<string, string>();
    if (cpIds.length > 0) {
      const { data: cps } = await supabase
        .from("client_products")
        .select("id, client_code")
        .in("id", cpIds);
      const codeByCp = new Map<string, string>(
        (cps ?? []).map((c) => [c.id as string, c.client_code as string]),
      );
      const { data: hist } = await supabase
        .from("client_product_history")
        .select("client_product_id, description, valid_from")
        .in("client_product_id", cpIds)
        .order("valid_from", { ascending: false });
      for (const h of hist ?? []) {
        const cpId = h.client_product_id as string;
        if (!descByCp.has(cpId) && h.description) {
          descByCp.set(cpId, h.description as string);
        }
      }
      for (const m of matches ?? []) {
        const cpId = m.client_product_id as string | null;
        if (!cpId) continue;
        const code = codeByCp.get(cpId);
        if (code) codeByMatch.set(m.id as string, code);
        const desc = descByCp.get(cpId);
        if (desc) descByMatch.set(m.id as string, desc);
      }
    }
  }

  return filtered.map((r) => ({
    line_id: r.id as string,
    client_code: r.client_product_match_id
      ? codeByMatch.get(r.client_product_match_id) ?? null
      : null,
    client_description: r.client_product_match_id
      ? descByMatch.get(r.client_product_match_id) ?? null
      : null,
    current_price: (r.sale_price as number | null) ?? null,
    updated_at: (r.updated_at as string | null) ?? null,
  }));
}
