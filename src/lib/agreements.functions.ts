import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
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
  groupIdSchema,
  groupMemberAddSchema,
  groupMemberRemoveSchema,
  groupMemberUpdateSchema,
  assignAgreementGroupSchema,
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
    const rows = data ?? [];
    const ids = rows.map((r) => r.id as string).filter(Boolean);
    if (ids.length === 0)
      return rows.map((r) => ({ ...r, companies: [] as string[] }));
    const { data: comps, error: cErr } = await context.supabase
      .from("agreement_companies")
      .select("agreement_id, clients:client_id(commercial_name, legal_name)")
      .in("agreement_id", ids)
      .is("valid_until", null);
    if (cErr) throw new Error(`No se pudieron cargar clientes: ${cErr.message}`);
    const byAgreement = new Map<string, string[]>();
    for (const c of comps ?? []) {
      const client = (c as { clients: { commercial_name: string | null; legal_name: string | null } | null }).clients;
      const name = client?.commercial_name || client?.legal_name || "—";
      const aid = (c as { agreement_id: string }).agreement_id;
      const arr = byAgreement.get(aid) ?? [];
      arr.push(name);
      byAgreement.set(aid, arr);
    }
    return rows.map((r) => ({
      ...r,
      companies: (byAgreement.get(r.id as string) ?? []).sort((a, b) =>
        a.localeCompare(b, "es", { sensitivity: "base" }),
      ),
    }));
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
    let created_by_name: string | null = null;
    if (row.created_by) {
      const { data: prof } = await context.supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", row.created_by)
        .maybeSingle();
      created_by_name = (prof?.full_name as string | null) ?? null;
    }
    return { ...row, created_by_name };
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
    const displayName = (c: { commercial_name: string | null; legal_name: string }) =>
      c.commercial_name?.trim() || c.legal_name;
    const byName = <T extends { commercial_name: string | null; legal_name: string }>(
      list: T[],
    ) =>
      [...list].sort((a, b) =>
        displayName(a).localeCompare(displayName(b), "es", { sensitivity: "base" }),
      );
    const { data: isSuper } = await context.supabase.rpc("is_super_admin");
    if (isSuper) {
      const { data, error } = await context.supabase
        .from("clients")
        .select("id, legal_name, commercial_name, status")
        .eq("status", "active");
      if (error) throw new Error(error.message);
      return byName(data ?? []);
    }
    const { data, error } = await context.supabase
      .from("user_client_access")
      .select(
        "client_id, can_create_agreements, clients:client_id(id, legal_name, commercial_name, status)",
      )
      .eq("can_create_agreements", true);
    if (error) throw new Error(error.message);
    const mapped = (data ?? [])
      .map((r) => r.clients as {
        id: string;
        legal_name: string;
        commercial_name: string | null;
        status: string;
      } | null)
      .filter((c): c is NonNullable<typeof c> => !!c && c.status === "active");
    return byName(mapped);
  });

// ---------------------------------------------------------------------------
// Mutaciones de contenedor
// ---------------------------------------------------------------------------

export const createAgreement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => agreementCreateSchema.parse(d))
  .handler(async ({ data, context }) => {
    // 1) Autorización global: crear acuerdos.
    const { data: canCreate } = await context.supabase.rpc("can_create_agreements");
    if (!canCreate) throw new Error("No tienes permiso para crear acuerdos.");

    // 2) Resolver / crear el agrupador si aplica.
    let groupId: string | null = null;

    if (data.group_id) {
      const { data: g, error } = await context.supabase
        .from("agreement_groups")
        .select("id")
        .eq("id", data.group_id)
        .maybeSingle();
      if (error) throw new Error(`No se pudo leer el agrupador: ${error.message}`);
      if (!g) throw new Error("Agrupador no encontrado o sin acceso.");
      groupId = g.id as string;
    } else if (data.group_name) {
      const { data: canGroup } = await context.supabase.rpc(
        "can_create_agreement_groups",
      );
      if (!canGroup)
        throw new Error("No tienes permiso para crear agrupadores.");
      const groupClient =
        data.client_id && (data.company_ids?.length ?? 0) === 0
          ? data.client_id
          : null;
      const { data: newGroup, error: gErr } = await context.supabase
        .from("agreement_groups")
        .insert({
          group_name: data.group_name,
          client_id: groupClient,
          notes: data.group_observations ?? null,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (gErr) throw new Error(`No se pudo crear el agrupador: ${gErr.message}`);
      groupId = newGroup.id as string;
    }

    // 3) Crear el acuerdo (group_id puede ser null).
    const { data: row, error } = await context.supabase
      .from("agreements")
      .insert({
        group_id: groupId,
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

    // 4) Vincular empresas iniciales.
    const companyIds = data.client_id
      ? [data.client_id]
      : data.company_ids ?? [];
    for (const clientId of companyIds) {
      await assertCanCreateForClient(context.supabase, clientId);
      const { error: acErr } = await context.supabase
        .from("agreement_companies")
        .insert({ agreement_id: row.id, client_id: clientId, started_by: context.userId });
      if (acErr && !acErr.message.toLowerCase().includes("duplicate")) {
        throw new Error(
          `Acuerdo creado pero no se pudo vincular el cliente: ${acErr.message}`,
        );
      }
    }

    // 5) Registrar al creador como agreement_admin (idempotente).
    const { error: memErr } = await context.supabase
      .from("agreement_members")
      .insert({
        agreement_id: row.id,
        user_id: context.userId,
        role: "agreement_admin",
        assigned_by: context.userId,
      });
    if (memErr && !memErr.message.toLowerCase().includes("duplicate")) {
      throw new Error(
        `Acuerdo creado pero no se pudo asignar admin: ${memErr.message}`,
      );
    }
    return { agreement_id: row.id as string };
  });

// Lista de agrupadores que el usuario puede seleccionar al crear acuerdos.
// - super_admin: todos.
// - platform_user: solo agrupadores cuyo client_id el usuario tiene con
//   can_create_agreements = true.
// - agrupadores libres (client_id null): solo super_admin.
export const listAssignableGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isSuper } = await context.supabase.rpc("is_super_admin");

    let groupsQuery = context.supabase
      .from("agreement_groups")
      .select(
        "id, group_name, client_id, status, notes, created_at, clients:client_id(id, legal_name, commercial_name)",
      )
      .eq("status", "active")
      .order("group_name");

    if (!isSuper) {
      const [{ data: access, error: accErr }, { data: memberships, error: mErr }] =
        await Promise.all([
          context.supabase
            .from("user_client_access")
            .select("client_id")
            .eq("can_create_agreements", true),
          context.supabase
            .from("agreement_group_members")
            .select("agreement_group_id")
            .eq("role", "agreement_group_admin"),
        ]);
      if (accErr) throw new Error(accErr.message);
      if (mErr) throw new Error(mErr.message);
      const allowedClientIds = (access ?? [])
        .map((a) => a.client_id as string)
        .filter(Boolean);
      const memberGroupIds = (memberships ?? [])
        .map((m) => m.agreement_group_id as string)
        .filter(Boolean);
      if (allowedClientIds.length === 0 && memberGroupIds.length === 0) return [];
      const clientFilter =
        allowedClientIds.length > 0
          ? `client_id.in.(${allowedClientIds.join(",")})`
          : null;
      const memberFilter =
        memberGroupIds.length > 0 ? `id.in.(${memberGroupIds.join(",")})` : null;
      const orFilter = [clientFilter, memberFilter].filter(Boolean).join(",");
      groupsQuery = groupsQuery.or(orFilter);
    }

    const { data: groups, error } = await groupsQuery;
    if (error) throw new Error(error.message);

    const rows = groups ?? [];
    const groupIds = rows.map((g) => g.id as string);
    const agreementCount = new Map<string, number>();
    if (groupIds.length > 0) {
      const { data: ags } = await context.supabase
        .from("agreements")
        .select("id, group_id")
        .in("group_id", groupIds);
      for (const a of ags ?? []) {
        const gid = a.group_id as string;
        agreementCount.set(gid, (agreementCount.get(gid) ?? 0) + 1);
      }
    }

    return rows.map((g) => {
      const client = g.clients as {
        id: string;
        legal_name: string;
        commercial_name: string | null;
      } | null;
      return {
        id: g.id as string,
        group_name: g.group_name as string,
        client_id: (g.client_id as string | null) ?? null,
        client_display_name: client
          ? (client.commercial_name?.trim() || client.legal_name)
          : null,
        status: g.status as string,
        notes: (g.notes as string | null) ?? null,
        agreement_count: agreementCount.get(g.id as string) ?? 0,
      };
    });
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
        "id, agreement_id, product_id, client_product_match_id, client_product_id, sale_price, par_price, start_date, end_date, observations, status, pending_reason, excluded_at, excluded_by, excluded_reason, created_at, updated_at, products:product_id(sku, erp_description, commercial_brand, status)",
      )
      .eq("agreement_id", data.agreement_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const rows = lines ?? [];

    // Resolver client_product_id efectivo: directo si existe, sino vía match.
    const matchIds = rows
      .map((r) => r.client_product_match_id)
      .filter((v): v is string => !!v);
    const cpByMatch = new Map<string, string>();
    if (matchIds.length > 0) {
      const { data: matches } = await context.supabase
        .from("client_product_match")
        .select("id, client_product_id")
        .in("id", matchIds);
      for (const m of matches ?? []) {
        if (m.client_product_id)
          cpByMatch.set(m.id as string, m.client_product_id as string);
      }
    }

    const effectiveCp = new Map<string, string>();
    for (const r of rows) {
      const direct = (r as { client_product_id: string | null }).client_product_id;
      const fromMatch = r.client_product_match_id
        ? cpByMatch.get(r.client_product_match_id) ?? null
        : null;
      const cpId = direct ?? fromMatch;
      if (cpId) effectiveCp.set(r.id as string, cpId);
    }

    const cpIds = Array.from(new Set(effectiveCp.values()));
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

    return rows.map((r) => {
      const cpId = effectiveCp.get(r.id as string) ?? null;
      return {
        ...r,
        client_code: cpId ? codeByCp.get(cpId) ?? null : null,
        client_description: cpId ? descByCp.get(cpId) ?? null : null,
      };
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
    let clientProductId: string | null = null;
    if (data.client_code) {
      clientProductId = await ensureClientProduct(
        context.supabase,
        clientId,
        data.client_code,
      );
      if (data.client_description) {
        await context.supabase.from("client_product_history").insert({
          client_product_id: clientProductId,
          description: data.client_description,
          valid_from: new Date().toISOString().slice(0, 10),
        });
      }
      if (product)
        matchId = await ensureMatch(context.supabase, clientProductId, product.id);
    }

    const { data: row, error } = await context.supabase
      .from("agreement_products")
      .insert({
        agreement_id: data.agreement_id,
        product_id: product?.id ?? null,
        client_product_match_id: matchId,
        client_product_id: clientProductId,
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

    // Auto-propagación: si el SKU está vinculado en este acuerdo y se guardó
    // un precio distinto al vigente en las posiciones vinculadas, alinear todas.
    if (product?.id && data.sale_price != null) {
      const { data: linkRow } = await context.supabase
        .from("agreement_sku_links")
        .select("id")
        .eq("agreement_id", data.agreement_id)
        .eq("product_id", product.id)
        .maybeSingle();
      if (linkRow) {
        const { error: propErr } = await context.supabase
          .from("agreement_products")
          .update({ sale_price: data.sale_price, updated_by: context.userId })
          .eq("agreement_id", data.agreement_id)
          .eq("product_id", product.id)
          .neq("status", "excluded");
        if (propErr)
          throw new Error(`Posición creada pero no se pudo propagar el precio: ${propErr.message}`);
      }
    }
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
    let newClientProductId: string | null | undefined = undefined;
    if (Object.prototype.hasOwnProperty.call(data.patch, "client_code")) {
      const code = data.patch.client_code ?? null;
      if (!code) {
        newMatchId = null;
        newClientProductId = null;
      } else {
        const cpId = await ensureClientProduct(context.supabase, clientId, code);
        newClientProductId = cpId;
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
    if (newClientProductId !== undefined)
      (updatePayload as { client_product_id?: string | null }).client_product_id = newClientProductId;

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

export const searchProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const obj = (d ?? {}) as { query?: unknown; offset?: unknown; limit?: unknown };
    const query = typeof obj.query === "string" ? obj.query.trim() : "";
    if (query.length < 2) throw new Error("Query mínimo 2 caracteres");
    const offset = Number.isFinite(Number(obj.offset)) ? Math.max(0, Number(obj.offset)) : 0;
    const limitRaw = Number.isFinite(Number(obj.limit)) ? Number(obj.limit) : 20;
    const limit = Math.min(Math.max(1, limitRaw), 50);
    return { query, offset, limit };
  })
  .handler(async ({ data, context }) => {
    // Escape PostgREST .or() special chars: comma, paren; escape SQL LIKE wildcards.
    const safe = data.query.replace(/[,()%_]/g, (c) => `\\${c}`);
    const pattern = `%${safe}%`;
    const to = data.offset + data.limit - 1;
    const { data: rows, error } = await context.supabase
      .from("products")
      .select("id, sku, erp_description, commercial_brand, status")
      .or(
        `sku.ilike.${pattern},erp_description.ilike.${pattern},commercial_brand.ilike.${pattern}`,
      )
      .order("sku", { ascending: true })
      .range(data.offset, to);
    if (error) throw new Error(`No se pudo buscar productos: ${error.message}`);
    return {
      rows: (rows ?? []).map((r) => ({
        id: r.id as string,
        sku: r.sku as string,
        erp_description: (r.erp_description as string | null) ?? null,
        commercial_brand: (r.commercial_brand as string | null) ?? null,
        status: (r.status as string) === "active" ? ("active" as const) : ("inactive" as const),
      })),
      hasMore: (rows?.length ?? 0) === data.limit,
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
    const [conflicts, product] = await Promise.all([
      detectSkuConflicts(context.supabase, data.agreement_id, data.sku),
      resolveProductBySku(context.supabase, data.sku),
    ]);
    let isLinked = false;
    const product_id = product?.id ?? null;
    if (product_id) {
      const { data: linkRow } = await context.supabase
        .from("agreement_sku_links")
        .select("id")
        .eq("agreement_id", data.agreement_id)
        .eq("product_id", product_id)
        .maybeSingle();
      isLinked = !!linkRow;
    }
    return { conflicts, isLinked, product_id };
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
// Vinculación de precio por SKU
// ---------------------------------------------------------------------------

export const isSkuLinked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => skuLinkSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanAccess(context.supabase, data.agreement_id);
    const { data: row, error } = await context.supabase
      .from("agreement_sku_links")
      .select("id")
      .eq("agreement_id", data.agreement_id)
      .eq("product_id", data.product_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { linked: !!row };
  });

export const linkSkuPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => skuLinkWithPriceSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanAdmin(context.supabase, data.agreement_id);
    const { error: insErr } = await context.supabase
      .from("agreement_sku_links")
      .insert({
        agreement_id: data.agreement_id,
        product_id: data.product_id,
        created_by: context.userId,
      });
    if (insErr && !insErr.message.toLowerCase().includes("duplicate")) {
      throw new Error(`No se pudo vincular el SKU: ${insErr.message}`);
    }
    const { error, count } = await context.supabase
      .from("agreement_products")
      .update({ sale_price: data.price, updated_by: context.userId }, { count: "exact" })
      .eq("agreement_id", data.agreement_id)
      .eq("product_id", data.product_id)
      .neq("status", "excluded");
    if (error) throw new Error(`Vínculo creado pero no se pudo aplicar el precio: ${error.message}`);
    return { linked: true as const, updated: count ?? 0 };
  });

export const unlinkSkuPrice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => skuLinkSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanAdmin(context.supabase, data.agreement_id);
    const { error } = await context.supabase
      .from("agreement_sku_links")
      .delete()
      .eq("agreement_id", data.agreement_id)
      .eq("product_id", data.product_id);
    if (error) throw new Error(`No se pudo desvincular el SKU: ${error.message}`);
    return { linked: false as const };
  });

// ---------------------------------------------------------------------------
// Importación
// ---------------------------------------------------------------------------

export const importAgreementLinesPreview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => importPreviewSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanAdmin(context.supabase, data.agreement_id);
    const clientId = await resolveImportTargetClient(
      context.supabase,
      data.agreement_id,
      data.target_client_id ?? null,
    );


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
    // Validar target_client_id contra las empresas del acuerdo antes de invocar la RPC.
    const targetClientId = await resolveImportTargetClient(
      context.supabase,
      data.agreement_id,
      data.target_client_id ?? null,
    );
    const payload = {
      rows: data.rows,
      price_resolutions: data.price_resolutions ?? {},
      target_client_id: targetClientId,
    } as unknown as import("@/integrations/supabase/types").Json;
    const { data: result, error } = await context.supabase.rpc(
      "commit_agreement_import",
      { p_agreement_id: data.agreement_id, p_payload: payload },
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

// Resuelve el cliente destino para la importación:
//  - Si el acuerdo tiene 1 sola empresa → usa esa (ignora target_client_id).
//  - Si tiene >1 → target_client_id es requerido y debe estar vinculado.
async function resolveImportTargetClient(
  supabase: import("@supabase/supabase-js").SupabaseClient<
    import("@/integrations/supabase/types").Database
  >,
  agreementId: string,
  targetClientId: string | null,
): Promise<string> {
  const { data: rows, error } = await supabase
    .from("agreement_companies")
    .select("client_id")
    .eq("agreement_id", agreementId);
  if (error) throw new Error(`No se pudieron leer los clientes del acuerdo: ${error.message}`);
  const clientIds = (rows ?? [])
    .map((r) => r.client_id as string | null)
    .filter((v): v is string => !!v);
  if (clientIds.length === 0) {
    throw new Error("El acuerdo no tiene clientes vinculados");
  }
  if (clientIds.length === 1) return clientIds[0];
  if (!targetClientId) {
    throw new Error(
      "El acuerdo tiene múltiples clientes: selecciona a cuál asignar los códigos importados",
    );
  }
  if (!clientIds.includes(targetClientId)) {
    throw new Error("El cliente seleccionado no está vinculado a este acuerdo");
  }
  return targetClientId;
}


// ---------------------------------------------------------------------------
// Miembros
// ---------------------------------------------------------------------------

const listAgreementMembersInput = importPreviewSchema
  .pick({ agreement_id: true })
  .extend({ include_history: z.boolean().optional().default(false) });

export const listAgreementMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listAgreementMembersInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanAccess(context.supabase, data.agreement_id);
    let query = context.supabase
      .from("agreement_members")
      .select(
        "id, agreement_id, user_id, role, can_view_costs, assigned_by, started_by, ended_by, ended_reason, valid_from, valid_until, created_at",
      )
      .eq("agreement_id", data.agreement_id);
    if (!data.include_history) {
      query = query.is("valid_until", null);
    }
    const { data: members, error } = await query.order("created_at");
    if (error) throw new Error(error.message);
    const userIds = new Set<string>();
    for (const m of members ?? []) {
      if (m.user_id) userIds.add(m.user_id as string);
      if (m.assigned_by) userIds.add(m.assigned_by as string);
      if (m.started_by) userIds.add(m.started_by as string);
      if (m.ended_by) userIds.add(m.ended_by as string);
    }
    let profilesById = new Map<string, { full_name: string; email: string; status: string; erp_user_code: string | null }>();
    if (userIds.size > 0) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("user_id, full_name, email, status, erp_user_code")
        .in("user_id", Array.from(userIds));
      profilesById = new Map(
        (profs ?? []).map((p) => [
          p.user_id as string,
          {
            full_name: p.full_name as string,
            email: p.email as string,
            status: p.status as string,
            erp_user_code: (p.erp_user_code as string | null) ?? null,
          },
        ]),
      );
    }
    return (members ?? [])
      .map((m) => ({
        ...m,
        profile: profilesById.get(m.user_id as string) ?? null,
        assigned_by_name:
          (m.assigned_by && profilesById.get(m.assigned_by as string)?.full_name) ?? null,
        started_by_name:
          (m.started_by && profilesById.get(m.started_by as string)?.full_name) ?? null,
        ended_by_name:
          (m.ended_by && profilesById.get(m.ended_by as string)?.full_name) ?? null,
      }))
      .sort((a, b) =>
        (a.profile?.full_name ?? "").localeCompare(
          b.profile?.full_name ?? "",
          "es",
          { sensitivity: "base" },
        ),
      );
  });


export const addAgreementMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => memberAddSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanAdmin(context.supabase, data.agreement_id);

    // Garantizar fila en user_client_access para cada empresa vinculada (RN-AGR-08 / RN-16).
    const { data: companies, error: compErr } = await context.supabase
      .from("agreement_companies")
      .select("client_id")
      .eq("agreement_id", data.agreement_id);
    if (compErr) throw new Error("No se pudieron resolver los clientes del acuerdo");
    const clientIds = [...new Set((companies ?? []).map((c) => c.client_id as string))];
    if (clientIds.length === 0) throw new Error("Acuerdo sin clientes vinculados");

    for (const clientId of clientIds) {
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
    }

    const { data: row, error } = await context.supabase
      .from("agreement_members")
      .insert({
        agreement_id: data.agreement_id,
        user_id: data.user_id,
        role: data.role,
        can_view_costs: data.can_view_costs ?? false,
        assigned_by: context.userId,
        started_by: context.userId,
      })
      .select("id")
      .single();
    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("duplicate") ||
        msg.includes("agreement_members_open_period_uniq")
      )
        throw new Error("Este usuario ya es miembro vigente del acuerdo");
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
    const { data: updated, error } = await context.supabase
      .from("agreement_members")
      .update(patch)
      .eq("id", data.member_id)
      .is("valid_until", null)
      .select("id");
    if (error) {
      if (error.message.includes("at least one agreement_admin"))
        throw new Error("Un acuerdo no puede quedar sin agreement_admin");
      throw new Error(error.message);
    }
    if (!updated || updated.length === 0)
      throw new Error("No se puede editar un período histórico");
    return { ok: true };
  });

export const removeAgreementMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => memberRemoveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: m, error: mErr } = await context.supabase
      .from("agreement_members")
      .select("agreement_id, valid_until")
      .eq("id", data.member_id)
      .single();
    if (mErr || !m) throw new Error("Miembro no encontrado");
    if (m.valid_until !== null)
      throw new Error("Este miembro ya tiene un período cerrado");
    await assertCanAdmin(context.supabase, m.agreement_id as string);
    const { data: closed, error } = await context.supabase
      .from("agreement_members")
      .update({
        valid_until: new Date().toISOString(),
        ended_by: context.userId,
        ended_reason: data.reason,
      })
      .eq("id", data.member_id)
      .is("valid_until", null)
      .select("id");
    if (error) {
      if (error.message.includes("at least one agreement_admin"))
        throw new Error("Un acuerdo no puede quedar sin agreement_admin");
      throw new Error(error.message);
    }
    if (!closed || closed.length === 0)
      throw new Error("Este miembro ya tiene un período cerrado");
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Empresas
// ---------------------------------------------------------------------------

const listAgreementCompaniesInput = importPreviewSchema
  .pick({ agreement_id: true })
  .extend({ include_history: z.boolean().optional().default(false) });

export const listAgreementCompanies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listAgreementCompaniesInput.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanAccess(context.supabase, data.agreement_id);
    let query = context.supabase
      .from("agreement_companies")
      .select(
        "id, agreement_id, client_id, notes, created_at, linked_by, started_by, ended_by, ended_reason, valid_from, valid_until",
      )
      .eq("agreement_id", data.agreement_id);
    if (!data.include_history) {
      query = query.is("valid_until", null);
    }
    const { data: rows, error } = await query.order("created_at");
    if (error) throw new Error(error.message);

    const base = rows ?? [];
    const clientIds = base.map((r) => r.client_id).filter((v): v is string => !!v);
    let clients: {
      id: string;
      tax_id: string;
      commercial_name: string | null;
      legal_name: string;
      parent_client_id: string | null;
      type: string;
    }[] = [];
    if (clientIds.length > 0) {
      const { data: cRows, error: cErr } = await context.supabase
        .from("clients")
        .select("id, tax_id, commercial_name, legal_name, parent_client_id, type")
        .in("id", clientIds);
      if (cErr) throw new Error(cErr.message);
      clients = (cRows ?? []) as typeof clients;
    }
    const clientById = new Map<string, (typeof clients)[number]>();
    const parentIds = new Set<string>();
    for (const c of clients) {
      clientById.set(c.id, c);
      if (c.parent_client_id) parentIds.add(c.parent_client_id);
    }
    const parentNames = new Map<string, string>();
    if (parentIds.size > 0) {
      const { data: pRows, error: pErr } = await context.supabase
        .from("clients")
        .select("id, commercial_name, legal_name")
        .in("id", Array.from(parentIds));
      if (pErr) throw new Error(pErr.message);
      for (const p of pRows ?? []) {
        parentNames.set(
          p.id as string,
          (p.commercial_name?.trim() || p.legal_name) as string,
        );
      }
    }

    const userIds = new Set<string>();
    for (const r of base) {
      const linkedBy = r.linked_by as string | null;
      const startedBy = r.started_by as string | null;
      const endedBy = r.ended_by as string | null;
      if (linkedBy) userIds.add(linkedBy);
      if (startedBy) userIds.add(startedBy);
      if (endedBy) userIds.add(endedBy);
    }
    const userNames = new Map<string, string>();
    if (userIds.size > 0) {
      const { data: profRows, error: profErr } = await context.supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", Array.from(userIds));
      if (profErr) throw new Error(profErr.message);
      for (const p of profRows ?? []) {
        const name = (p.full_name as string | null)?.trim();
        if (name) userNames.set(p.user_id as string, name);
      }
    }

    return base
      .map((r) => {
        const c = clientById.get(r.client_id as string);
        const displayName = c?.commercial_name?.trim() || c?.legal_name || "—";
        const parentName = c?.parent_client_id
          ? parentNames.get(c.parent_client_id) ?? null
          : null;
        const linkedBy = (r.linked_by as string | null) ?? null;
        const startedBy = (r.started_by as string | null) ?? null;
        const endedBy = (r.ended_by as string | null) ?? null;
        return {
          id: r.id as string,
          agreement_id: r.agreement_id as string,
          client_id: r.client_id as string,
          notes: (r.notes as string | null) ?? null,
          created_at: r.created_at as string,
          tax_id: (c?.tax_id ?? null) as string | null,
          client_display_name: displayName,
          client_type: c?.type ?? null,
          parent_client_name: parentName,
          linked_by: linkedBy,
          linked_by_name: linkedBy ? userNames.get(linkedBy) ?? null : null,
          started_by: startedBy,
          started_by_name: startedBy ? userNames.get(startedBy) ?? null : null,
          ended_by: endedBy,
          ended_by_name: endedBy ? userNames.get(endedBy) ?? null : null,
          ended_reason: (r.ended_reason as string | null) ?? null,
          valid_from: r.valid_from as string,
          valid_until: (r.valid_until as string | null) ?? null,
        };
      })
      .sort((a, b) =>
        a.client_display_name.localeCompare(b.client_display_name, "es", {
          sensitivity: "base",
        }),
      );
  });

export const addAgreementCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companyAddSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanAdmin(context.supabase, data.agreement_id);
    await assertCanCreateForClient(context.supabase, data.client_id);
    const { data: row, error } = await context.supabase
      .from("agreement_companies")
      .insert({
        agreement_id: data.agreement_id,
        client_id: data.client_id,
        notes: data.notes,
        linked_by: context.userId,
        started_by: context.userId,
      })
      .select("id")
      .single();
    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("duplicate") ||
        msg.includes("agreement_companies_open_uniq")
      )
        throw new Error("Esta empresa ya está vinculada al acuerdo");
      throw new Error(error.message);
    }
    return { company_id: row.id as string };
  });


export const removeAgreementCompany = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => companyRemoveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: c, error: cErr } = await context.supabase
      .from("agreement_companies")
      .select("agreement_id, valid_until")
      .eq("id", data.company_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!c) return { ok: true }; // ya fue removido — idempotente
    if (c.valid_until !== null)
      throw new Error("Esta empresa ya tiene un período cerrado");
    await assertCanAdmin(context.supabase, c.agreement_id as string);

    // Bloquear el cierre si es la última empresa vinculada vigente (Decisión 3).
    const { count: total, error: countErr } = await context.supabase
      .from("agreement_companies")
      .select("id", { count: "exact", head: true })
      .eq("agreement_id", c.agreement_id as string)
      .is("valid_until", null);
    if (countErr) throw new Error(countErr.message);
    if ((total ?? 0) <= 1) {
      throw new Error("No se puede eliminar el último cliente vinculado al acuerdo");
    }
    const { data: closed, error } = await context.supabase
      .from("agreement_companies")
      .update({
        valid_until: new Date().toISOString(),
        ended_by: context.userId,
        ended_reason: data.reason,
      })
      .eq("id", data.company_id)
      .is("valid_until", null)
      .select("id");
    if (error) throw new Error(error.message);
    if (!closed || closed.length === 0)
      throw new Error("Esta empresa ya tiene un período cerrado");

    return { ok: true };
  });


// ---------------------------------------------------------------------------
// Agrupadores (detalle y miembros)
// ---------------------------------------------------------------------------

export const getAgreementGroup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => groupIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("agreement_groups")
      .select(
        "id, group_name, client_id, status, notes, created_at, updated_at, created_by, clients:client_id(id, legal_name, commercial_name, tax_id)",
      )
      .eq("id", data.group_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Agrupador no encontrado");
    const client = row.clients as {
      id: string;
      legal_name: string;
      commercial_name: string | null;
      tax_id: string;
    } | null;
    return {
      id: row.id as string,
      group_name: row.group_name as string,
      client_id: (row.client_id as string | null) ?? null,
      status: row.status as string,
      notes: (row.notes as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      created_by: (row.created_by as string | null) ?? null,
      client_display_name: client
        ? client.commercial_name?.trim() || client.legal_name
        : null,
      client_tax_id: client?.tax_id ?? null,
    };
  });

const listAgreementGroupMembersInput = groupIdSchema.extend({
  include_history: z.boolean().optional().default(false),
});

export const listAgreementGroupMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => listAgreementGroupMembersInput.parse(d))
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("agreement_group_members")
      .select(
        "id, agreement_group_id, user_id, role, assigned_by, started_by, ended_by, ended_reason, valid_from, valid_until, created_at",
      )
      .eq("agreement_group_id", data.group_id);
    if (!data.include_history) {
      query = query.is("valid_until", null);
    }
    const { data: members, error } = await query.order("created_at");
    if (error) throw new Error(error.message);
    const rows = members ?? [];
    const userIds = new Set<string>();
    for (const m of rows) {
      if (m.user_id) userIds.add(m.user_id as string);
      if (m.assigned_by) userIds.add(m.assigned_by as string);
      if (m.started_by) userIds.add(m.started_by as string);
      if (m.ended_by) userIds.add(m.ended_by as string);
    }
    let profilesById = new Map<
      string,
      { full_name: string; email: string; status: string }
    >();
    if (userIds.size > 0) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("user_id, full_name, email, status")
        .in("user_id", Array.from(userIds));
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
    return rows.map((m) => ({
      id: m.id as string,
      agreement_group_id: m.agreement_group_id as string,
      user_id: m.user_id as string,
      role: m.role as "agreement_group_admin" | "agreement_group_member",
      assigned_by: (m.assigned_by as string | null) ?? null,
      created_at: m.created_at as string,
      started_by: (m.started_by as string | null) ?? null,
      ended_by: (m.ended_by as string | null) ?? null,
      ended_reason: (m.ended_reason as string | null) ?? null,
      valid_from: m.valid_from as string,
      valid_until: (m.valid_until as string | null) ?? null,
      profile: profilesById.get(m.user_id as string) ?? null,
      assigned_by_name:
        (m.assigned_by && profilesById.get(m.assigned_by as string)?.full_name) ?? null,
      started_by_name:
        (m.started_by && profilesById.get(m.started_by as string)?.full_name) ?? null,
      ended_by_name:
        (m.ended_by && profilesById.get(m.ended_by as string)?.full_name) ?? null,
    }));
  });

export const addAgreementGroupMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => groupMemberAddSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("agreement_group_members")
      .insert({
        agreement_group_id: data.group_id,
        user_id: data.user_id,
        role: data.role,
        assigned_by: context.userId,
        started_by: context.userId,
      })
      .select("id")
      .single();
    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes("duplicate") ||
        msg.includes("agreement_group_members_open_uniq")
      )
        throw new Error("Este usuario ya es miembro vigente del agrupador");
      if (msg.includes("row-level"))
        throw new Error("No tienes permisos para agregar miembros al agrupador");
      throw new Error(error.message);
    }
    return { member_id: row.id as string };
  });

export const updateAgreementGroupMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => groupMemberUpdateSchema.parse(d))
  .handler(async ({ data, context: _context }) => {
    const { data: updated, error } = await _context.supabase
      .from("agreement_group_members")
      .update({ role: data.role })
      .eq("id", data.member_id)
      .is("valid_until", null)
      .select("id");
    if (error) {
      if (error.message.includes("último agreement_group_admin"))
        throw new Error("El agrupador no puede quedar sin admin");
      if (error.message.toLowerCase().includes("row-level"))
        throw new Error("No tienes permisos para modificar miembros del agrupador");
      throw new Error(error.message);
    }
    if (!updated || updated.length === 0)
      throw new Error("No se puede editar un período histórico");
    return { ok: true };
  });

export const removeAgreementGroupMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => groupMemberRemoveSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: m, error: mErr } = await context.supabase
      .from("agreement_group_members")
      .select("valid_until")
      .eq("id", data.member_id)
      .maybeSingle();
    if (mErr) throw new Error(mErr.message);
    if (!m) return { ok: true }; // idempotente
    if (m.valid_until !== null)
      throw new Error("Este miembro ya tiene un período cerrado");
    const { data: closed, error } = await context.supabase
      .from("agreement_group_members")
      .update({
        valid_until: new Date().toISOString(),
        ended_by: context.userId,
        ended_reason: data.reason,
      })
      .eq("id", data.member_id)
      .is("valid_until", null)
      .select("id");
    if (error) {
      if (error.message.includes("último agreement_group_admin"))
        throw new Error("El agrupador no puede quedar sin admin");
      if (error.message.toLowerCase().includes("row-level"))
        throw new Error("No tienes permisos para remover miembros del agrupador");
      throw new Error(error.message);
    }
    if (!closed || closed.length === 0)
      throw new Error("Este miembro ya tiene un período cerrado");
    return { ok: true };
  });


// ---------------------------------------------------------------------------
// Asignar un acuerdo existente a un agrupador (nuevo o existente).
// Reglas:
//  - Solo administradores del acuerdo pueden asignar.
//  - Nuevo agrupador: requiere can_create_agreement_groups; trigger
//    add_creator_as_group_admin registra al creador como admin del agrupador.
//  - Trigger check_agreement_group_reassignment valida que el usuario sea
//    super_admin o admin del agrupador destino.
// ---------------------------------------------------------------------------

export const assignAgreementToGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => assignAgreementGroupSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanAdmin(context.supabase, data.agreement_id);

    let groupId: string | null = null;
    if (data.group_id) {
      const { data: g, error } = await context.supabase
        .from("agreement_groups")
        .select("id")
        .eq("id", data.group_id)
        .maybeSingle();
      if (error) throw new Error(`No se pudo leer el agrupador: ${error.message}`);
      if (!g) throw new Error("Agrupador no encontrado o sin acceso.");
      groupId = g.id as string;
    } else if (data.group_name) {
      const { data: canGroup } = await context.supabase.rpc(
        "can_create_agreement_groups",
      );
      if (!canGroup)
        throw new Error("No tienes permiso para crear agrupadores.");
      const { data: newGroup, error: gErr } = await context.supabase
        .from("agreement_groups")
        .insert({
          group_name: data.group_name,
          client_id: null,
          notes: data.group_observations ?? null,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (gErr)
        throw new Error(`No se pudo crear el agrupador: ${gErr.message}`);
      groupId = newGroup.id as string;
    }

    const { error } = await context.supabase
      .from("agreements")
      .update({ group_id: groupId })
      .eq("id", data.agreement_id);
    if (error) throw new Error(`No se pudo asignar el agrupador: ${error.message}`);

    return { ok: true, group_id: groupId };
  });

// Resumen del agrupador para mostrar en el detalle de un acuerdo agrupado:
// nombre, acuerdos hermanos, clientes únicos totales y posiciones totales.
export const getAgreementGroupSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => groupIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: g, error: gErr } = await context.supabase
      .from("agreement_groups")
      .select("id, group_name")
      .eq("id", data.group_id)
      .maybeSingle();
    if (gErr) throw new Error(gErr.message);
    if (!g) throw new Error("Agrupador no encontrado");

    const { data: ags, error: aErr } = await context.supabase
      .from("agreements_with_counts")
      .select("id, name, lines_total, status")
      .eq("group_id", data.group_id)
      .order("name");
    if (aErr) throw new Error(aErr.message);

    const agreementIds = (ags ?? []).map((a) => a.id as string);
    let uniqueClients = 0;
    if (agreementIds.length > 0) {
      const { data: comps } = await context.supabase
        .from("agreement_companies")
        .select("client_id")
        .in("agreement_id", agreementIds);
      const set = new Set<string>();
      for (const c of comps ?? []) {
        const cid = (c as { client_id: string | null }).client_id;
        if (cid) set.add(cid);
      }
      uniqueClients = set.size;
    }

    const totalLines = (ags ?? []).reduce(
      (acc, a) => acc + Number((a as { lines_total: number | null }).lines_total ?? 0),
      0,
    );

    return {
      id: g.id as string,
      group_name: g.group_name as string,
      unique_clients: uniqueClients,
      total_lines: totalLines,
      agreements: (ags ?? []).map((a) => ({
        id: a.id as string,
        name: a.name as string,
        lines_total: Number((a as { lines_total: number | null }).lines_total ?? 0),
        status: a.status as string,
      })),
    };
  });
