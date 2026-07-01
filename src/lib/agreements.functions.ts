import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  agreementCreateSchema,
  agreementUpdateSchema,
  agreementStatusSchema,
  applyPriceSchema,
  companyAddSchema,
  companyRemoveSchema,
  importCommitSchema,
  importPreviewSchema,
  lineCreateSchema,
  lineExcludeSchema,
  linePatchSchema,
  lineReactivateSchema,
  memberAddSchema,
  memberRemoveSchema,
  memberUpdateSchema,
  nConflictDetectSchema,
  skuLinkSchema,
  skuLinkWithPriceSchema,
} from "./agreements.schemas";
import {
  assertCanAccess,
  assertCanAdmin,
  assertCanCreateForClient,
  detectSkuConflicts,
  ensureClientProduct,
  ensureMatch,
  getAgreementClientId,
  resolveProductBySku,
  type SkuConflict,
} from "./agreements.server";

// ---------------------------------------------------------------------------
// Listado / lectura
// ---------------------------------------------------------------------------

export const listAgreements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("agreements_with_counts")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(`No se pudieron cargar acuerdos: ${error.message}`);
    return data ?? [];
  });

export const getAgreement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    importPreviewSchema.pick({ agreement_id: true }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("agreements_with_counts")
      .select("*")
      .eq("id", data.agreement_id)
      .maybeSingle();
    if (error) throw new Error(`No se pudo cargar el acuerdo: ${error.message}`);
    if (!row) throw new Error("Acuerdo no encontrado");
    return row;
  });

export const getAgreementContext = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    importPreviewSchema.pick({ agreement_id: true }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const [admin, access] = await Promise.all([
      context.supabase.rpc("can_admin_agreement", {
        p_agreement_id: data.agreement_id,
      }),
      context.supabase.rpc("can_access_agreement", {
        p_agreement_id: data.agreement_id,
      }),
    ]);
    return {
      can_admin: !!admin.data,
      can_access: !!access.data,
    };
  });

export const listAssignableClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isSuper } = await context.supabase.rpc("is_super_admin");
    if (isSuper) {
      const { data, error } = await context.supabase
        .from("clients")
        .select("id, legal_name, commercial_name, status")
        .eq("status", "active")
        .order("legal_name");
      if (error) throw new Error(error.message);
      return data ?? [];
    }
    const { data, error } = await context.supabase
      .from("user_client_access")
      .select(
        "client_id, can_create_agreements, clients:client_id(id, legal_name, commercial_name, status)",
      )
      .eq("can_create_agreements", true);
    if (error) throw new Error(error.message);
    return (data ?? [])
      .map((r) => r.clients as {
        id: string;
        legal_name: string;
        commercial_name: string | null;
        status: string;
      } | null)
      .filter((c): c is NonNullable<typeof c> => !!c && c.status === "active");
  });

// ---------------------------------------------------------------------------
// Mutaciones de contenedor
// ---------------------------------------------------------------------------

export const createAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => agreementCreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanCreateForClient(context.supabase, data.client_id);
    const { data: row, error } = await context.supabase
      .from("agreements")
      .insert({
        client_id: data.client_id,
        name: data.name,
        scope: data.scope,
        unit_name: data.unit_name,
        start_date: data.start_date,
        end_date: data.end_date,
        observations: data.observations,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(`No se pudo crear el acuerdo: ${error.message}`);
    // creador como agreement_admin
    const { error: memErr } = await context.supabase
      .from("agreement_members")
      .insert({
        agreement_id: row.id,
        user_id: context.userId,
        role: "agreement_admin",
        assigned_by: context.userId,
      });
    if (memErr && !memErr.message.includes("duplicate")) {
      throw new Error(`Acuerdo creado pero no se pudo asignar admin: ${memErr.message}`);
    }
    return { agreement_id: row.id as string };
  });

export const updateAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => agreementUpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanAdmin(context.supabase, data.agreement_id);
    const datesChanged =
      Object.prototype.hasOwnProperty.call(data.patch, "start_date") ||
      Object.prototype.hasOwnProperty.call(data.patch, "end_date");

    const { error } = await context.supabase
      .from("agreements")
      .update(data.patch)
      .eq("id", data.agreement_id);
    if (error) throw new Error(`No se pudo actualizar el acuerdo: ${error.message}`);

    if (datesChanged) {
      // fuerza al trigger a recalcular líneas no excluidas
      await context.supabase
        .from("agreement_products")
        .update({ updated_at: new Date().toISOString() })
        .eq("agreement_id", data.agreement_id)
        .neq("status", "excluded");
    }
    return { ok: true };
  });

export const setAgreementStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => agreementStatusSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanAdmin(context.supabase, data.agreement_id);
    const { error } = await context.supabase
      .from("agreements")
      .update({ status: data.status })
      .eq("id", data.agreement_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Líneas
// ---------------------------------------------------------------------------

export const listAgreementLines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    importPreviewSchema.pick({ agreement_id: true }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanAccess(context.supabase, data.agreement_id);
    const { data: lines, error } = await context.supabase
      .from("agreement_products")
      .select(
        "id, agreement_id, product_id, client_product_match_id, sale_price, par_price, start_date, end_date, observations, status, pending_reason, excluded_at, excluded_by, excluded_reason, created_at, updated_at, products:product_id(sku, erp_description, commercial_brand, status)",
      )
      .eq("agreement_id", data.agreement_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = lines ?? [];
    const matchIds = rows
      .map((r) => r.client_product_match_id)
      .filter((v): v is string => !!v);
    const codeByMatch = new Map<string, { code: string; description: string | null }>();
    if (matchIds.length > 0) {
      const { data: matches } = await context.supabase
        .from("client_product_match")
        .select("id, client_product_id")
        .in("id", matchIds);
      const cpIds = (matches ?? [])
        .map((m) => m.client_product_id)
        .filter((v): v is string => !!v);
      const codeByCp = new Map<string, string>();
      const descByCp = new Map<string, string | null>();
      if (cpIds.length > 0) {
        const { data: cps } = await context.supabase
          .from("client_products")
          .select("id, client_code")
          .in("id", cpIds);
        for (const c of cps ?? []) codeByCp.set(c.id as string, c.client_code as string);
        const { data: hist } = await context.supabase
          .from("client_product_history")
          .select("client_product_id, description, valid_from")
          .in("client_product_id", cpIds)
          .order("valid_from", { ascending: false });
        for (const h of hist ?? []) {
          if (!descByCp.has(h.client_product_id as string)) {
            descByCp.set(h.client_product_id as string, (h.description as string) ?? null);
          }
        }
      }
      for (const m of matches ?? []) {
        const cp = m.client_product_id as string | null;
        if (cp && codeByCp.has(cp)) {
          codeByMatch.set(m.id as string, {
            code: codeByCp.get(cp)!,
            description: descByCp.get(cp) ?? null,
          });
        }
      }
    }

    return rows.map((r) => {
      const cp = r.client_product_match_id
        ? codeByMatch.get(r.client_product_match_id) ?? null
        : null;
      return { ...r, client_code: cp?.code ?? null, client_description: cp?.description ?? null };
    });
  });

export const createAgreementLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => lineCreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanAdmin(context.supabase, data.agreement_id);
    const clientId = await getAgreementClientId(context.supabase, data.agreement_id);

    const product = await resolveProductBySku(context.supabase, data.sku);
    let matchId: string | null = null;
    if (data.client_code) {
      const cpId = await ensureClientProduct(context.supabase, clientId, data.client_code);
      if (data.client_description) {
        await context.supabase.from("client_product_history").insert({
          client_product_id: cpId,
          description: data.client_description,
          valid_from: new Date().toISOString().slice(0, 10),
        });
      }
      if (product) matchId = await ensureMatch(context.supabase, cpId, product.id);
    }

    const { data: row, error } = await context.supabase
      .from("agreement_products")
      .insert({
        agreement_id: data.agreement_id,
        product_id: product?.id ?? null,
        client_product_match_id: matchId,
        sale_price: data.sale_price,
        par_price: data.par_price,
        start_date: data.start_date,
        end_date: data.end_date,
        observations: data.observations,
        created_by: context.userId,
        updated_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(`No se pudo crear la posición: ${error.message}`);
    return { line_id: row.id as string };
  });

export const updateAgreementLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => linePatchSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: line, error: lineErr } = await context.supabase
      .from("agreement_products")
      .select("agreement_id, product_id, sale_price, client_product_match_id")
      .eq("id", data.line_id)
      .single();
    if (lineErr || !line) throw new Error("Posición no encontrada");
    const agreementId = line.agreement_id as string;
    await assertCanAdmin(context.supabase, agreementId);

    const clientId = await getAgreementClientId(context.supabase, agreementId);

    // Resolver nuevo producto si cambió el SKU
    let newProductId: string | null | undefined = undefined;
    if (Object.prototype.hasOwnProperty.call(data.patch, "sku")) {
      const product = await resolveProductBySku(context.supabase, data.patch.sku ?? null);
      newProductId = product?.id ?? null;
    }

    // Resolver match si cambió el código del cliente
    let newMatchId: string | null | undefined = undefined;
    if (Object.prototype.hasOwnProperty.call(data.patch, "client_code")) {
      const code = data.patch.client_code ?? null;
      if (!code) {
        newMatchId = null;
      } else {
        const cpId = await ensureClientProduct(context.supabase, clientId, code);
        if (data.patch.client_description) {
          await context.supabase.from("client_product_history").insert({
            client_product_id: cpId,
            description: data.patch.client_description,
            valid_from: new Date().toISOString().slice(0, 10),
          });
        }
        const productId =
          newProductId !== undefined ? newProductId : (line.product_id as string | null);
        newMatchId = productId
          ? await ensureMatch(context.supabase, cpId, productId)
          : null;
      }
    }

    // product_id efectivo tras el patch
    const effectiveProductId =
      newProductId !== undefined ? newProductId : (line.product_id as string | null);

    // ¿SKU vinculado en este acuerdo?
    let linked = false;
    if (effectiveProductId) {
      const { data: linkRow } = await context.supabase
        .from("agreement_sku_links")
        .select("id")
        .eq("agreement_id", agreementId)
        .eq("product_id", effectiveProductId)
        .maybeSingle();
      linked = !!linkRow;
    }

    // Detección N:1 si cambia precio y NO está vinculado
    const priceChanged =
      Object.prototype.hasOwnProperty.call(data.patch, "sale_price") &&
      data.patch.sale_price !== (line.sale_price as number | null);
    if (priceChanged && !data.confirm_n_conflict && !linked) {
      const skuForConflict =
        newProductId !== undefined
          ? data.patch.sku ?? null
          : await skuFromProductId(context.supabase, line.product_id as string | null);
      if (skuForConflict) {
        const conflicts = await detectSkuConflicts(
          context.supabase,
          agreementId,
          skuForConflict,
          data.line_id,
        );
        if (conflicts.length > 0) {
          throw new NConflictError(conflicts);
        }
      }
    }

    const updatePayload: import("@/integrations/supabase/types").TablesUpdate<"agreement_products"> = {
      ...("sale_price" in data.patch ? { sale_price: data.patch.sale_price } : {}),
      ...("par_price" in data.patch ? { par_price: data.patch.par_price } : {}),
      ...("start_date" in data.patch ? { start_date: data.patch.start_date } : {}),
      ...("end_date" in data.patch ? { end_date: data.patch.end_date } : {}),
      ...("observations" in data.patch ? { observations: data.patch.observations } : {}),
      updated_by: context.userId,
    };
    if (newProductId !== undefined) updatePayload.product_id = newProductId;
    if (newMatchId !== undefined) updatePayload.client_product_match_id = newMatchId;

    const { error } = await context.supabase
      .from("agreement_products")
      .update(updatePayload)
      .eq("id", data.line_id);
    if (error) throw new Error(`No se pudo actualizar la posición: ${error.message}`);

    // Auto-propagación cuando el SKU está vinculado y el precio cambió
    let propagated = 0;
    if (linked && priceChanged && effectiveProductId && data.patch.sale_price != null) {
      const { error: propErr, count } = await context.supabase
        .from("agreement_products")
        .update(
          { sale_price: data.patch.sale_price, updated_by: context.userId },
          { count: "exact" },
        )
        .eq("agreement_id", agreementId)
        .eq("product_id", effectiveProductId)
        .neq("status", "excluded");
      if (propErr) throw new Error(`Precio guardado pero no se pudo propagar: ${propErr.message}`);
      propagated = count ?? 0;
    }
    return { ok: true, propagated };
  });

class NConflictError extends Error {
  conflicts: SkuConflict[];
  constructor(conflicts: SkuConflict[]) {
    super("N_CONFLICT");
    this.name = "NConflictError";
    this.conflicts = conflicts;
  }
}

async function skuFromProductId(
  supabase: import("@supabase/supabase-js").SupabaseClient<
    import("@/integrations/supabase/types").Database
  >,
  productId: string | null,
) {
  if (!productId) return null;
  const { data } = await supabase
    .from("products")
    .select("sku")
    .eq("id", productId)
    .maybeSingle();
  return (data?.sku as string | null) ?? null;
}

export const excludeAgreementLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => lineExcludeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: line, error: lineErr } = await context.supabase
      .from("agreement_products")
      .select("agreement_id")
      .eq("id", data.line_id)
      .single();
    if (lineErr || !line) throw new Error("Posición no encontrada");
    await assertCanAdmin(context.supabase, line.agreement_id as string);
    const { error } = await context.supabase
      .from("agreement_products")
      .update({
        status: "excluded",
        excluded_at: new Date().toISOString(),
        excluded_by: context.userId,
        excluded_reason: data.reason,
        updated_by: context.userId,
      })
      .eq("id", data.line_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reactivateAgreementLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => lineReactivateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: line, error: lineErr } = await context.supabase
      .from("agreement_products")
      .select("agreement_id")
      .eq("id", data.line_id)
      .single();
    if (lineErr || !line) throw new Error("Posición no encontrada");
    await assertCanAdmin(context.supabase, line.agreement_id as string);
    // limpiar campos de exclusión y dejar que el trigger recalcule
    const { error } = await context.supabase
      .from("agreement_products")
      .update({
        status: "pending",
        excluded_at: null,
        excluded_by: null,
        excluded_reason: null,
        updated_by: context.userId,
      })
      .eq("id", data.line_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const lookupProductBySku = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const obj = (d ?? {}) as { sku?: unknown };
    const sku = typeof obj.sku === "string" ? obj.sku.trim() : "";
    if (!sku) throw new Error("SKU requerido");
    return { sku };
  })
  .handler(async ({ data, context }) => {
    const [productRes, latestRes] = await Promise.all([
      context.supabase
        .from("products")
        .select("id, sku, erp_description, commercial_brand, status")
        .eq("sku", data.sku)
        .maybeSingle(),
      context.supabase
        .from("products")
        .select("updated_at")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const catalog_updated_at =
      (latestRes.data?.updated_at as string | null | undefined) ?? null;
    if (productRes.error) {
      throw new Error(`No se pudo consultar el catálogo: ${productRes.error.message}`);
    }
    const p = productRes.data;
    if (!p) {
      return { found: false as const, catalog_updated_at };
    }
    return {
      found: true as const,
      status: (p.status as string) === "active" ? ("active" as const) : ("inactive" as const),
      erp_description: (p.erp_description as string | null) ?? null,
      commercial_brand: (p.commercial_brand as string | null) ?? null,
      catalog_updated_at,
    };
  });

// ---------------------------------------------------------------------------
// Conflicto N:1
// ---------------------------------------------------------------------------

export const detectNConflict = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => nConflictDetectSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanAccess(context.supabase, data.agreement_id);
    const conflicts = await detectSkuConflicts(
      context.supabase,
      data.agreement_id,
      data.sku,
    );
    return { conflicts };
  });

export const applyPriceToSku = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => applyPriceSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanAdmin(context.supabase, data.agreement_id);
    const product = await resolveProductBySku(context.supabase, data.sku);
    if (!product) throw new Error("SKU no encontrado en el catálogo");
    const { error, count } = await context.supabase
      .from("agreement_products")
      .update({ sale_price: data.new_price, updated_by: context.userId }, { count: "exact" })
      .eq("agreement_id", data.agreement_id)
      .eq("product_id", product.id)
      .neq("status", "excluded");
    if (error) throw new Error(error.message);
    return { updated: count ?? 0 };
  });

// ---------------------------------------------------------------------------
// Importación
// ---------------------------------------------------------------------------

export const importAgreementLinesPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => importPreviewSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanAdmin(context.supabase, data.agreement_id);
    const clientId = await getAgreementClientId(context.supabase, data.agreement_id);

    // Fechas del acuerdo (fallback cuando la fila no trae start/end), igual
    // que en el trigger recalc_agreement_product_status.
    const { data: agreement } = await context.supabase
      .from("agreements")
      .select("start_date, end_date")
      .eq("id", data.agreement_id)
      .single();
    const agrStart = (agreement?.start_date as string | null) ?? null;
    const agrEnd = (agreement?.end_date as string | null) ?? null;
    const today = new Date().toISOString().slice(0, 10);

    const skus = Array.from(
      new Set(
        data.rows
          .map((r) => (r.sku ?? "").trim())
          .filter((s) => s.length > 0),
      ),
    );
    const codes = Array.from(
      new Set(
        data.rows
          .map((r) => (r.client_code ?? "").trim())
          .filter((s) => s.length > 0),
      ),
    );

    const productsMap = new Map<string, { id: string; status: string }>();
    if (skus.length > 0) {
      const { data: products } = await context.supabase
        .from("products")
        .select("id, sku, status")
        .in("sku", skus);
      for (const p of products ?? []) {
        productsMap.set(p.sku as string, { id: p.id as string, status: p.status as string });
      }
    }

    const cpMap = new Map<string, string>();
    if (codes.length > 0) {
      const { data: cps } = await context.supabase
        .from("client_products")
        .select("id, client_code")
        .eq("client_id", clientId)
        .in("client_code", codes);
      for (const c of cps ?? []) cpMap.set(c.client_code as string, c.id as string);
    }

    // Conteo de duplicados internos: misma combinación (sku|client_code)
    const dupKey = (sku: string, code: string) => `${sku}|${code}`;
    const dupCount = new Map<string, number>();
    for (const r of data.rows) {
      const k = dupKey((r.sku ?? "").trim(), (r.client_code ?? "").trim());
      if (!k.includes("|") || k === "|") continue;
      dupCount.set(k, (dupCount.get(k) ?? 0) + 1);
    }

    const buckets = {
      active: [] as ClassifiedRow[],
      pending: [] as ClassifiedRow[],
      review: [] as ClassifiedRow[],
      conflicts: [] as ClassifiedRow[],
      format: [] as ClassifiedRow[],
    };
    const nConflictBySku = new Map<string, number[]>();

    for (const r of data.rows) {
      const sku = (r.sku ?? "").trim();
      const code = (r.client_code ?? "").trim();
      const price = r.sale_price ?? null;
      const product = sku ? productsMap.get(sku) ?? null : null;

      const isDup =
        sku && code && (dupCount.get(dupKey(sku, code)) ?? 0) > 1;

      if (isDup) {
        buckets.conflicts.push({ row: r, status: "duplicate_internal" });
        continue;
      }

      // Mismo orden de evaluación que el trigger recalc_agreement_product_status:
      // 1) SKU existe pero está inactivo  -> requires_review
      // 2) Vigencia vencida (end < today) -> requires_review
      // 3) Faltantes (no_sku/no_price/no_dates) -> pending
      // 4) Resto -> active
      const effStart = (r.start_date ?? null) || agrStart;
      const effEnd = (r.end_date ?? null) || agrEnd;

      if (product && product.status !== "active") {
        buckets.review.push({ row: r, status: "requires_review" });
      } else if (effEnd && effEnd < today) {
        buckets.review.push({ row: r, status: "requires_review" });
      } else {
        const reasons: string[] = [];
        if (!sku || !product) reasons.push("no_sku");
        if (price === null || price === 0) reasons.push("no_price");
        if (!effStart || !effEnd) reasons.push("no_dates");
        if (reasons.length === 0) {
          buckets.active.push({ row: r, status: "active" });
        } else {
          buckets.pending.push({ row: r, status: "pending", reasons });
        }
      }

      if (sku && product) {
        const arr = nConflictBySku.get(sku) ?? [];
        if (price !== null && price > 0) arr.push(price);
        nConflictBySku.set(sku, arr);
      }
    }

    // Grupos N:1 candidatos: mismo SKU con precios distintos dentro del archivo o
    // contra líneas existentes del acuerdo.
    const skuGroups: NConflictGroupServer[] = [];
    for (const [sku, prices] of nConflictBySku) {
      const distinct = Array.from(new Set(prices));
      const product = productsMap.get(sku);
      if (!product) continue;
      const existing = await detectSkuConflicts(
        context.supabase,
        data.agreement_id,
        sku,
      );
      const existingPrices = existing.map((e) => e.current_price).filter((p): p is number => p !== null);
      const all = Array.from(new Set([...distinct, ...existingPrices]));
      if (all.length > 1) {
        skuGroups.push({ sku, in_file_prices: distinct, existing });
      }
    }

    const summary = {
      total: data.rows.length,
      active: buckets.active.length,
      pending: buckets.pending.length,
      review: buckets.review.length,
      conflicts: buckets.conflicts.length,
      format: buckets.format.length,
    };

    return { buckets, n_conflicts: skuGroups, summary };
  });

export type ClassifiedRow = {
  row: import("./agreements.schemas").ImportRowInput;
  status: "active" | "pending" | "requires_review" | "duplicate_internal";
  reasons?: string[];
};

export type NConflictGroupServer = {
  sku: string;
  in_file_prices: number[];
  existing: SkuConflict[];
};

export const commitAgreementImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => importCommitSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: result, error } = await context.supabase.rpc(
      "commit_agreement_import",
      {
        p_agreement_id: data.agreement_id,
        p_payload: {
          rows: data.rows,
          price_resolutions: data.price_resolutions ?? {},
        },
      },
    );
    if (error) {
      if (error.code === "42501") throw new Error("No tienes permisos sobre este acuerdo");
      throw new Error(`No se pudo guardar la importación: ${error.message}`);
    }
    return result as {
      inserted: number;
      updated: number;
      skipped: number;
      propagated_n1: number;
      by_status: Record<string, number>;
    };
  });

// ---------------------------------------------------------------------------
// Miembros
// ---------------------------------------------------------------------------

export const listAgreementMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    importPreviewSchema.pick({ agreement_id: true }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanAccess(context.supabase, data.agreement_id);
    const { data: members, error } = await context.supabase
      .from("agreement_members")
      .select("id, agreement_id, user_id, role, can_view_costs, assigned_by, created_at")
      .eq("agreement_id", data.agreement_id)
      .order("created_at");
    if (error) throw new Error(error.message);
    const userIds = (members ?? []).map((m) => m.user_id as string);
    let profilesById = new Map<string, { full_name: string; email: string; status: string }>();
    if (userIds.length > 0) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("user_id, full_name, email, status")
        .in("user_id", userIds);
      profilesById = new Map(
        (profs ?? []).map((p) => [
          p.user_id as string,
          {
            full_name: p.full_name as string,
            email: p.email as string,
            status: p.status as string,
          },
        ]),
      );
    }
    return (members ?? []).map((m) => ({
      ...m,
      profile: profilesById.get(m.user_id as string) ?? null,
    }));
  });

export const addAgreementMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => memberAddSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanAdmin(context.supabase, data.agreement_id);
    const clientId = await getAgreementClientId(context.supabase, data.agreement_id);

    // Garantizar fila en user_client_access (RN-AGR-08).
    const { data: existingAccess } = await context.supabase
      .from("user_client_access")
      .select("id")
      .eq("user_id", data.user_id)
      .eq("client_id", clientId)
      .maybeSingle();
    if (!existingAccess) {
      const { error: accErr } = await context.supabase
        .from("user_client_access")
        .insert({
          user_id: data.user_id,
          client_id: clientId,
          can_create_agreements: false,
          assigned_by: context.userId,
        });
      if (accErr) throw new Error(`No se pudo asignar el cliente: ${accErr.message}`);
    }

    const { data: row, error } = await context.supabase
      .from("agreement_members")
      .insert({
        agreement_id: data.agreement_id,
        user_id: data.user_id,
        role: data.role,
        can_view_costs: data.can_view_costs ?? false,
        assigned_by: context.userId,
      })
      .select("id")
      .single();
    if (error) {
      if (error.message.includes("duplicate"))
        throw new Error("Este usuario ya es miembro del acuerdo");
      throw new Error(error.message);
    }
    return { member_id: row.id as string };
  });

export const updateAgreementMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => memberUpdateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: m, error: mErr } = await context.supabase
      .from("agreement_members")
      .select("agreement_id")
      .eq("id", data.member_id)
      .single();
    if (mErr || !m) throw new Error("Miembro no encontrado");
    await assertCanAdmin(context.supabase, m.agreement_id as string);
    const patch: import("@/integrations/supabase/types").TablesUpdate<"agreement_members"> = {};
    if (data.role !== undefined) patch.role = data.role;
    if (data.can_view_costs !== undefined) patch.can_view_costs = data.can_view_costs;
    const { error } = await context.supabase
      .from("agreement_members")
      .update(patch)
      .eq("id", data.member_id);
    if (error) {
      if (error.message.includes("at least one agreement_admin"))
        throw new Error("Un acuerdo no puede quedar sin agreement_admin");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const removeAgreementMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => memberRemoveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: m, error: mErr } = await context.supabase
      .from("agreement_members")
      .select("agreement_id")
      .eq("id", data.member_id)
      .single();
    if (mErr || !m) throw new Error("Miembro no encontrado");
    await assertCanAdmin(context.supabase, m.agreement_id as string);
    const { error } = await context.supabase
      .from("agreement_members")
      .delete()
      .eq("id", data.member_id);
    if (error) {
      if (error.message.includes("at least one agreement_admin"))
        throw new Error("Un acuerdo no puede quedar sin agreement_admin");
      throw new Error(error.message);
    }
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Empresas
// ---------------------------------------------------------------------------

export const listAgreementCompanies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    importPreviewSchema.pick({ agreement_id: true }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertCanAccess(context.supabase, data.agreement_id);
    const { data: rows, error } = await context.supabase
      .from("agreement_companies")
      .select("id, agreement_id, tax_id, tax_id_type, legal_name, notes, created_at")
      .eq("agreement_id", data.agreement_id)
      .order("legal_name");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addAgreementCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companyAddSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanAdmin(context.supabase, data.agreement_id);
    const { data: row, error } = await context.supabase
      .from("agreement_companies")
      .insert({
        agreement_id: data.agreement_id,
        tax_id: data.tax_id,
        tax_id_type: data.tax_id_type,
        legal_name: data.legal_name,
        notes: data.notes,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { company_id: row.id as string };
  });

export const removeAgreementCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companyRemoveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: c, error: cErr } = await context.supabase
      .from("agreement_companies")
      .select("agreement_id")
      .eq("id", data.company_id)
      .single();
    if (cErr || !c) throw new Error("Empresa no encontrada");
    await assertCanAdmin(context.supabase, c.agreement_id as string);
    const { error } = await context.supabase
      .from("agreement_companies")
      .delete()
      .eq("id", data.company_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
