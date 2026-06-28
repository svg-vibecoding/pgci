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
    .from("agreements")
    .select("client_id")
    .eq("id", agreementId)
    .single();
  if (error) throw new Error("Acuerdo no encontrado");
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
  current_price: number | null;
};

export async function detectSkuConflicts(
  supabase: SB,
  agreementId: string,
  sku: string,
  excludeLineId?: string,
): Promise<SkuConflict[]> {
  const product = await resolveProductBySku(supabase, sku);
  if (!product) return [];
  const { data, error } = await supabase
    .from("agreement_products")
    .select(
      "id, sale_price, client_product_match_id, client_product_match:client_product_match_id(client_product_id, client_products:client_product_id(client_code))",
    )
    .eq("agreement_id", agreementId)
    .eq("product_id", product.id)
    .neq("status", "excluded");
  if (error) throw new Error("No se pudieron consultar líneas con mismo SKU");
  return (data ?? [])
    .filter((r) => r.id !== excludeLineId)
    .map((r) => {
      const cp = r.client_product_match as
        | { client_products: { client_code: string } | null }
        | null;
      return {
        line_id: r.id as string,
        client_code: cp?.client_products?.client_code ?? null,
        current_price: (r.sale_price as number | null) ?? null,
      };
    });
}
