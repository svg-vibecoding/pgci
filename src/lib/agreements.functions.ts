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
  lineDeleteSchema,
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
  resolveProductBySku,
  type SkuConflict,
  type SkuConflictCode,
} from "./agreements.server";
import type { Json } from "@/integrations/supabase/types";

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
      return rows.map((r) => ({ ...r, companies: [] as string[], can_admin: false }));
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



    // can_admin por fila: super_admin → todos; sino, membresía como agreement_admin vigente
    const { data: superRes } = await context.supabase.rpc("is_super_admin");
    const isSuper = !!superRes;
    const adminIds = new Set<string>();
    if (isSuper) {
      for (const id of ids) adminIds.add(id);
    } else {
      const { data: adminRows, error: aErr } = await context.supabase
        .from("agreement_members")
        .select("agreement_id")
        .eq("user_id", context.userId)
        .eq("role", "agreement_admin")
        .is("valid_until", null)
        .in("agreement_id", ids);
      if (aErr) throw new Error(`No se pudieron cargar membresías: ${aErr.message}`);
      for (const m of adminRows ?? []) {
        adminIds.add((m as { agreement_id: string }).agreement_id);
      }
    }

    return rows.map((r) => ({
      ...r,
      companies: (byAgreement.get(r.id as string) ?? []).sort((a, b) =>
        a.localeCompare(b, "es", { sensitivity: "base" }),
      ),
      
      can_admin: adminIds.has(r.id as string),
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
      const { data: participants } = await context.supabase.rpc(
        "get_agreement_participants",
        { p_agreement_id: data.agreement_id },
      );
      const match = (participants ?? []).find(
        (p: { user_id: string }) => p.user_id === row.created_by,
      );
      created_by_name = (match?.full_name as string | null) ?? null;
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
    const clientCols =
      "id, legal_name, commercial_name, tax_id, tax_id_type, type, status";
    const { data: isSuper } = await context.supabase.rpc("is_super_admin");
    if (isSuper) {
      const { data, error } = await context.supabase
        .from("clients")
        .select(clientCols)
        .eq("status", "active");
      if (error) throw new Error(error.message);
      return byName(data ?? []);
    }
    const { data, error } = await context.supabase
      .from("user_client_access")
      .select(`client_id, can_create_agreements, clients:client_id(${clientCols})`)
      .eq("can_create_agreements", true)
      .is("valid_until", null);
    if (error) throw new Error(error.message);
    const mapped = (data ?? [])
      .map((r) => r.clients as {
        id: string;
        legal_name: string;
        commercial_name: string | null;
        tax_id: string | null;
        tax_id_type: string | null;
        type: string | null;
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

    // 3) Resolver clientes iniciales.
    const companyIds = data.client_id
      ? [data.client_id]
      : data.company_ids ?? [];
    if (companyIds.length === 0) {
      throw new Error("Debes indicar al menos un cliente cubierto.");
    }

    // 4) Crear acuerdo + vincular clientes + registrar admin (transaccional, SECURITY DEFINER).
    const { data: newId, error } = await context.supabase.rpc(
      "create_agreement_tx",
      {
        p_name: data.name,
        p_scope: data.scope,
        p_unit_name: (data.unit_name ?? null) as unknown as string,
        p_start_date: (data.start_date ?? null) as unknown as string,
        p_end_date: (data.end_date ?? null) as unknown as string,
        p_observations: (data.observations ?? null) as unknown as string,
        p_group_id: (groupId ?? null) as unknown as string,
        p_client_ids: companyIds,
      },
    );
    if (error) throw new Error(`No se pudo crear el acuerdo: ${error.message}`);
    return { agreement_id: newId as string };
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
            .eq("can_create_agreements", true)
            .is("valid_until", null),
          context.supabase
            .from("agreement_group_members")
            .select("agreement_group_id")
            .eq("role", "agreement_group_admin")
            .is("valid_until", null),
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
      // fuerza al trigger a recalcular posiciones no excluidas
      await context.supabase
        .from("agreement_positions")
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


export type LineCode = {
  client_id: string;
  client_name: string | null;
  client_code: string;
  description: string | null;
};


export type AgreementLineRow = {
  kind: "position" | "transit";
  id: string;
  agreement_id: string;
  product_id: string | null;
  sale_price: number | null;
  par_price: number | null;
  start_date: string | null;
  end_date: string | null;
  observations: string | null;
  status: "active" | "requires_review" | "excluded" | "draft" | "archived";
  pending_reason: string | null;

  exclusion_reason: string | null;
  created_at: string;
  updated_at: string;
  products: {
    sku: string | null;
    erp_description: string | null;
    commercial_brand: string | null;
    status: string | null;
  } | null;
  codes: LineCode[];
};

export const listAgreementLines = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    importPreviewSchema.pick({ agreement_id: true }).parse(d),
  )
  .handler(async ({ data, context }): Promise<AgreementLineRow[]> => {
    await assertCanAccess(context.supabase, data.agreement_id);

    // Modelo de tránsito eliminado: solo se listan posiciones.
    const positionsRes = await context.supabase
      .from("agreement_positions")
      .select(
        "id, agreement_id, product_id, sale_price, par_price, start_date, end_date, observations, status, pending_reason, created_at, updated_at, products:product_id(sku, erp_description, commercial_brand, status)",
      )
      .eq("agreement_id", data.agreement_id)
      .order("created_at", { ascending: false });
    if (positionsRes.error) throw new Error(positionsRes.error.message);
    const positions = positionsRes.data ?? [];
    const transit: never[] = [];

    // Razones de exclusión (período abierto) para posiciones excluidas.
    const excludedIds = positions
      .filter((p) => p.status === "excluded")
      .map((p) => p.id as string);
    const exclusionByPos = new Map<string, string>();
    if (excludedIds.length > 0) {
      const { data: excs } = await context.supabase
        .from("agreement_position_exclusions")
        .select("position_id, exclusion_reason")
        .in("position_id", excludedIds)
        .is("valid_until", null);
      for (const e of excs ?? []) {
        exclusionByPos.set(e.position_id as string, (e.exclusion_reason as string | null) ?? "");
      }
    }

    // Códigos por posición (período abierto), con nombre de cliente y código.
    const posIds = positions.map((p) => p.id as string);
    const apccRes =
      posIds.length > 0
        ? await context.supabase
            .from("agreement_position_client_codes")
            .select(
              "agreement_position_id, client_id, client_product_id, clients!agreement_position_client_codes_client_id_fkey(commercial_name, legal_name), client_products!agreement_position_client_codes_client_product_id_fkey(client_code)",
            )
            .in("agreement_position_id", posIds)
            .is("valid_until", null)
        : { data: [] as unknown[], error: null };

    type ClientEmbed = { commercial_name: string | null; legal_name: string | null } | null;
    type ApccRow = {
      agreement_position_id: string;
      client_id: string;
      client_product_id: string;
      clients: ClientEmbed;
      client_products: { client_code: string | null } | null;
    };
    const apcc = ((apccRes.data ?? []) as unknown as ApccRow[]);
    const clientDisplay = (c: ClientEmbed): string | null =>
      c?.commercial_name ?? c?.legal_name ?? null;

    // Historial de descripciones más recientes por client_product_id.
    const cpIdsSet = new Set<string>();
    for (const c of apcc) if (c.client_product_id) cpIdsSet.add(c.client_product_id);
    const descByCp = new Map<string, string | null>();
    if (cpIdsSet.size > 0) {
      const { data: hist } = await context.supabase
        .from("client_product_history")
        .select("client_product_id, description, valid_from")
        .in("client_product_id", Array.from(cpIdsSet))
        .is("valid_until", null)
        .order("valid_from", { ascending: false })
        .order("created_at", { ascending: false });
      for (const h of hist ?? []) {
        const cpId = h.client_product_id as string;
        if (!descByCp.has(cpId)) {
          descByCp.set(cpId, (h.description as string | null) ?? null);
        }
      }
    }

    const codesByPos = new Map<string, LineCode[]>();
    for (const c of apcc) {
      const code = c.client_products?.client_code ?? null;
      if (!code) continue;
      const arr = codesByPos.get(c.agreement_position_id) ?? [];
      arr.push({
        client_id: c.client_id,
        client_name: clientDisplay(c.clients),
        client_code: code,
        description: descByCp.get(c.client_product_id) ?? null,
      });
      codesByPos.set(c.agreement_position_id, arr);
    }

    const positionRows: AgreementLineRow[] = positions.map((r) => ({
      kind: "position",
      id: r.id as string,
      agreement_id: r.agreement_id as string,
      product_id: (r.product_id as string | null) ?? null,
      sale_price: (r.sale_price as number | null) ?? null,
      par_price: (r.par_price as number | null) ?? null,
      start_date: (r.start_date as string | null) ?? null,
      end_date: (r.end_date as string | null) ?? null,
      observations: (r.observations as string | null) ?? null,
      status: r.status as AgreementLineRow["status"],
      pending_reason: (r.pending_reason as string | null) ?? null,
      exclusion_reason: exclusionByPos.get(r.id as string) ?? null,
      created_at: r.created_at as string,
      updated_at: r.updated_at as string,
      products: r.products as AgreementLineRow["products"],
      codes: codesByPos.get(r.id as string) ?? [],
    }));

    // Silencia variable no usada: `transit` es un placeholder tras la eliminación del modelo.
    void transit;

    return positionRows.sort((a, b) =>
      (b.created_at ?? "").localeCompare(a.created_at ?? ""),
    );
  });

export type BlockReason = {
  code: string;
  client_id?: string;
  client_product_id?: string;
  conflicting_position_id?: string;
  conflicting_sku?: string;
};

export type CreateAgreementLineResult = {
  position_id: string;
};

export type UpdateAgreementLineResult = {
  promoted: boolean;
  position_id?: string;
  transit_id?: string;
  blocked?: boolean;
  block_reason?: BlockReason | null;
};

export const createAgreementLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => lineCreateSchema.parse(d))
  .handler(async ({ data, context }): Promise<CreateAgreementLineResult> => {
    const payload = {
      sku: data.sku,
      sale_price: data.sale_price,
      par_price: data.par_price,
      start_date: data.start_date,
      end_date: data.end_date,
      observations: data.observations,
      client_codes: data.client_codes,
    } as unknown as Json;
    const { data: res, error } = await context.supabase.rpc("create_agreement_line", {
      p_agreement_id: data.agreement_id,
      p_payload: payload,
    });
    if (error) {
      if (error.code === "42501") throw new Error("No tienes permisos sobre este acuerdo");
      if (error.code === "23514") {
        throw new Error(
          "La línea requiere al menos SKU, descripción o un código del cliente",
        );
      }
      throw new Error(`No se pudo crear la línea: ${error.message}`);
    }
    return res as unknown as CreateAgreementLineResult;
  });

export const updateAgreementLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => linePatchSchema.parse(d))
  .handler(async ({ data, context }): Promise<UpdateAgreementLineResult> => {
    const { data: rpcRes, error } = await context.supabase.rpc("update_agreement_line", {
      p_line_id: data.line_id,
      p_patch: data.patch as unknown as Json,
      p_confirm_n_conflict: data.confirm_n_conflict ?? false,
    });
    if (error) {
      if (error.code === "42501") throw new Error("No tienes permisos sobre este acuerdo");
      throw new Error(`No se pudo actualizar la línea: ${error.message}`);
    }
    return rpcRes as unknown as UpdateAgreementLineResult;
  });

class NConflictError extends Error {
  conflicts: SkuConflict[];
  constructor(conflicts: SkuConflict[]) {
    super("N_CONFLICT");
    this.name = "NConflictError";
    this.conflicts = conflicts;
  }
}

export const excludeAgreementLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => lineExcludeSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("exclude_agreement_position", {
      p_position_id: data.line_id,
      p_reason: data.reason ?? "",
    });
    if (error) {
      if (error.code === "42501") throw new Error("No tienes permisos sobre este acuerdo");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const reactivateAgreementLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => lineReactivateSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("reactivate_agreement_position", {
      p_position_id: data.line_id,
      p_reason: null as unknown as string,
    });
    if (error) {
      if (error.code === "42501") throw new Error("No tienes permisos sobre este acuerdo");
      // 23505 y otros mensajes específicos del RPC (identidad duplicada, códigos,
      // SKU) se propagan tal cual: son legibles y accionables.
      throw new Error(error.message);
    }
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Publicación de posiciones (draft/requires_review → active)
// ---------------------------------------------------------------------------

export type PublishPositionsDetail = {
  position_id: string;
  result: "publicada" | "no_publicable" | "omitida";
  reason: string | null;
};

export type PublishPositionsResult = {
  published: number;
  not_publishable: number;
  skipped: number;
  details: PublishPositionsDetail[];
};

export const publishAgreementPositions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(d),
  )
  .handler(async ({ data, context }): Promise<PublishPositionsResult> => {
    const { data: res, error } = await context.supabase.rpc("publish_positions", {
      p_position_ids: data.ids,
    });
    if (error) {
      if (error.code === "42501")
        throw new Error("No tienes permisos sobre este acuerdo");
      throw new Error(`No se pudo publicar: ${error.message}`);
    }
    return res as unknown as PublishPositionsResult;
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

export type ProductAgreementPosition = {
  position_id: string;
  position_status: "active" | "excluded" | "requires_review" | "draft";
  published_at: string | null;
  sale_price: number | null;
  codes: Array<{
    client_id: string;
    client_name: string | null;
    client_code: string;
    description: string | null;
  }>;
  exclusion_reason: string | null;
  exclusion_date: string | null;
};

export type ProductAgreementStatus =
  | { kind: "free" }
  | { kind: "in_agreement"; positions: ProductAgreementPosition[] };

export const searchProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const obj = (d ?? {}) as {
      query?: unknown;
      offset?: unknown;
      limit?: unknown;
      agreement_id?: unknown;
    };
    const query = typeof obj.query === "string" ? obj.query.trim() : "";
    if (query.length < 2) throw new Error("Query mínimo 2 caracteres");
    const offset = Number.isFinite(Number(obj.offset)) ? Math.max(0, Number(obj.offset)) : 0;
    const limitRaw = Number.isFinite(Number(obj.limit)) ? Number(obj.limit) : 20;
    const limit = Math.min(Math.max(1, limitRaw), 50);
    const agreement_id =
      typeof obj.agreement_id === "string" && obj.agreement_id.length > 0
        ? z.string().uuid().parse(obj.agreement_id)
        : null;
    return { query, offset, limit, agreement_id };
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

    // Estado por SKU respecto al acuerdo (batch por product_ids del page).
    const statusByProduct = new Map<string, ProductAgreementStatus>();
    if (data.agreement_id && (rows?.length ?? 0) > 0) {
      await assertCanAccess(context.supabase, data.agreement_id);
      const productIds = (rows ?? []).map((r) => r.id as string);

      const { data: positions, error: posErr } = await context.supabase
        .from("agreement_positions")
        .select("id, status, sale_price, product_id, published_at")
        .eq("agreement_id", data.agreement_id)
        .in("product_id", productIds);
      if (posErr) throw new Error(`No se pudieron consultar posiciones: ${posErr.message}`);

      const posRows = positions ?? [];
      const posIds = posRows.map((p) => p.id as string);
      const excludedPosIds = posRows
        .filter((p) => (p.status as string) === "excluded")
        .map((p) => p.id as string);

      // Códigos vigentes por posición.
      const codesByPos = new Map<string, ProductAgreementPosition["codes"]>();
      const cpIdsForDesc: string[] = [];
      if (posIds.length > 0) {
        const { data: apcc, error: apccErr } = await context.supabase
          .from("agreement_position_client_codes")
          .select(
            "agreement_position_id, client_id, client_product_id, clients!agreement_position_client_codes_client_id_fkey(commercial_name, legal_name), client_products!agreement_position_client_codes_client_product_id_fkey(client_code)",
          )
          .in("agreement_position_id", posIds)
          .is("valid_until", null);
        if (apccErr) throw new Error(apccErr.message);
        for (const c of apcc ?? []) {
          const client = c.clients as {
            commercial_name: string | null;
            legal_name: string | null;
          } | null;
          const cp = c.client_products as { client_code: string | null } | null;
          const code = cp?.client_code ?? null;
          if (!code) continue;
          const cpId = c.client_product_id as string;
          cpIdsForDesc.push(cpId);
          const entry: ProductAgreementPosition["codes"][number] = {
            client_id: c.client_id as string,
            client_name: client?.commercial_name ?? client?.legal_name ?? null,
            client_code: code,
            description: null,
          };
          const arr = codesByPos.get(c.agreement_position_id as string) ?? [];
          arr.push(entry);
          codesByPos.set(c.agreement_position_id as string, arr);
        }
      }

      // Descripción más reciente por client_product_id (misma forma que detectSkuConflicts).
      const descByCp = new Map<string, string | null>();
      const uniqueCpIds = Array.from(new Set(cpIdsForDesc));
      if (uniqueCpIds.length > 0) {
        const { data: hist } = await context.supabase
          .from("client_product_history")
          .select("client_product_id, description, valid_from")
          .in("client_product_id", uniqueCpIds)
          .order("valid_from", { ascending: false });
        for (const h of hist ?? []) {
          const cpId = h.client_product_id as string;
          if (!descByCp.has(cpId)) {
            descByCp.set(cpId, (h.description as string | null) ?? null);
          }
        }
      }
      for (const [, codes] of codesByPos) {
        for (const c of codes) {
          // recover cp_id via lookup key: we stored client_product_id above; but
          // we didn't retain it on the entry. Re-derive: match description by
          // (client_id, client_code) is ambiguous. Simpler: attach description
          // in a second pass by re-fetching per-position. Since we lose cp_id
          // when pushing, extend the entry type to carry it internally.
          void c;
        }
      }

      // Exclusion reason/date por posición.
      const exclusionByPos = new Map<string, { reason: string | null; date: string | null }>();
      if (excludedPosIds.length > 0) {
        const { data: excls, error: exclErr } = await context.supabase
          .from("agreement_position_exclusions")
          .select("position_id, exclusion_reason, valid_from")
          .in("position_id", excludedPosIds)
          .is("valid_until", null);
        if (exclErr) throw new Error(exclErr.message);
        for (const e of excls ?? []) {
          const reasonRaw = (e.exclusion_reason as string | null) ?? null;
          exclusionByPos.set(e.position_id as string, {
            reason: reasonRaw && reasonRaw.trim() !== "" ? reasonRaw : null,
            date: (e.valid_from as string | null) ?? null,
          });
        }
      }

      // Reconstruir codes con description a partir de un segundo pase:
      // re-consultar apcc para obtener client_product_id por (position, client),
      // luego mapear a descByCp. Simplificación: rehacer el fetch de apcc
      // aquí es innecesario — extendemos codes con cp_id en el primer pase.
      // Para evitar refactor mayor, hacemos una segunda consulta ligera:
      if (posIds.length > 0 && uniqueCpIds.length > 0) {
        // Ya cargamos (posId, clientId) -> cp_id implícitamente al construir codes.
        // Necesitamos recuperar cp_id por (posId, clientId). Segunda pasada rápida:
        const { data: apcc2 } = await context.supabase
          .from("agreement_position_client_codes")
          .select("agreement_position_id, client_id, client_product_id")
          .in("agreement_position_id", posIds)
          .is("valid_until", null);
        const cpByPosClient = new Map<string, string>();
        for (const r of apcc2 ?? []) {
          cpByPosClient.set(
            `${r.agreement_position_id as string}|${r.client_id as string}`,
            r.client_product_id as string,
          );
        }
        for (const [posId, codes] of codesByPos) {
          for (const code of codes) {
            const cpId = cpByPosClient.get(`${posId}|${code.client_id}`);
            if (cpId) code.description = descByCp.get(cpId) ?? null;
          }
        }
      }

      // Ensamblar por product_id.
      const byProduct = new Map<string, ProductAgreementPosition[]>();
      for (const p of posRows) {
        const rawStatus = p.status as string;
        const posStatus: ProductAgreementPosition["position_status"] =
          rawStatus === "excluded"
            ? "excluded"
            : rawStatus === "requires_review"
              ? "requires_review"
              : rawStatus === "draft"
                ? "draft"
                : "active";
        const excl = posStatus === "excluded" ? exclusionByPos.get(p.id as string) ?? null : null;
        const entry: ProductAgreementPosition = {
          position_id: p.id as string,
          position_status: posStatus,
          published_at: (p.published_at as string | null) ?? null,
          sale_price: (p.sale_price as number | null) ?? null,
          codes: codesByPos.get(p.id as string) ?? [],
          exclusion_reason: excl?.reason ?? null,
          exclusion_date: excl?.date ?? null,
        };
        const arr = byProduct.get(p.product_id as string) ?? [];
        arr.push(entry);
        byProduct.set(p.product_id as string, arr);
      }

      for (const pid of productIds) {
        const list = byProduct.get(pid);
        statusByProduct.set(
          pid,
          list && list.length > 0
            ? { kind: "in_agreement", positions: list }
            : { kind: "free" },
        );
      }
    }

    return {
      rows: (rows ?? []).map((r) => ({
        id: r.id as string,
        sku: r.sku as string,
        erp_description: (r.erp_description as string | null) ?? null,
        commercial_brand: (r.commercial_brand as string | null) ?? null,
        status: (r.status as string) === "active" ? ("active" as const) : ("inactive" as const),
        agreement_status: statusByProduct.get(r.id as string) ?? ({ kind: "free" } as const),
      })),
      hasMore: (rows?.length ?? 0) === data.limit,
    };
  });

// ---------------------------------------------------------------------------
// Buscador de código de cliente (para LineEditDialog / tarjeta por cliente)
// ---------------------------------------------------------------------------

export type ClientCodeSearchResult = {
  client_product_id: string;
  client_code: string;
  description: string | null;
  status:
    | { kind: "free" }
    | {
        kind: "taken";
        position_id: string;
        position_status: "active" | "excluded" | "requires_review" | "draft";
        sku: string | null;
        product_description: string | null;
        sale_price: number | null;
        exclusion_reason: string | null;
        exclusion_date: string | null;
      };
};


export const searchClientCodes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => {
    const obj = (d ?? {}) as {
      agreement_id?: unknown;
      client_id?: unknown;
      query?: unknown;
    };
    const agreement_id = z.string().uuid().parse(obj.agreement_id);
    const client_id = z.string().uuid().parse(obj.client_id);
    const query = typeof obj.query === "string" ? obj.query.trim() : "";
    if (query.length < 2) throw new Error("Query mínimo 2 caracteres");
    return { agreement_id, client_id, query };
  })
  .handler(async ({ data, context }): Promise<ClientCodeSearchResult[]> => {
    await assertCanAccess(context.supabase, data.agreement_id);
    const safe = data.query.replace(/[,()%_]/g, (c) => `\\${c}`);
    const pattern = `%${safe}%`;
    const HARD_LIMIT = 50;

    // Match por código (client_products) y por descripción vigente
    // (client_product_history con join inner a client_products para forzar
    // el filtro por client_id — la RLS de history solo exige has_client_access).
    const [codeRes, descRes] = await Promise.all([
      context.supabase
        .from("client_products")
        .select("id, client_code")
        .eq("client_id", data.client_id)
        .ilike("client_code", pattern)
        .order("client_code", { ascending: true })
        .limit(HARD_LIMIT),
      context.supabase
        .from("client_product_history")
        .select(
          "client_product_id, description, client_products!inner(id, client_id, client_code)",
        )
        .eq("client_products.client_id", data.client_id)
        .is("valid_until", null)
        .ilike("description", pattern)
        .limit(HARD_LIMIT),
    ]);
    if (codeRes.error) throw new Error(codeRes.error.message);
    if (descRes.error) throw new Error(descRes.error.message);

    // Unificar por client_product_id. codeRes trae code sin descripción;
    // descRes trae ambos. Cap 50 sobre el conjunto unido.
    const merged = new Map<string, { client_code: string; description: string | null }>();
    for (const row of codeRes.data ?? []) {
      const id = row.id as string;
      if (!merged.has(id)) merged.set(id, { client_code: row.client_code as string, description: null });
    }
    for (const row of descRes.data ?? []) {
      const cp = row.client_products as { id: string; client_code: string } | null;
      if (!cp) continue;
      const id = cp.id;
      const desc = (row.description as string | null) ?? null;
      const existing = merged.get(id);
      if (existing) {
        if (existing.description == null) existing.description = desc;
      } else if (merged.size < HARD_LIMIT) {
        merged.set(id, { client_code: cp.client_code, description: desc });
      }
    }
    if (merged.size === 0) return [];

    // Cap definitivo tras el merge.
    const allIds = Array.from(merged.keys()).slice(0, HARD_LIMIT);

    // Descripción vigente para ids que aún no la tengan (match solo por código).
    const missingDescIds = allIds.filter((id) => merged.get(id)?.description == null);
    if (missingDescIds.length > 0) {
      const { data: hist, error: histErr } = await context.supabase
        .from("client_product_history")
        .select("client_product_id, description")
        .in("client_product_id", missingDescIds)
        .is("valid_until", null);
      if (histErr) throw new Error(histErr.message);
      for (const h of hist ?? []) {
        const id = h.client_product_id as string;
        const entry = merged.get(id);
        if (entry && entry.description == null) {
          entry.description = (h.description as string | null) ?? null;
        }
      }
    }

    // Estado en el acuerdo: activa/excluida/pendiente sin filtrar por estado
    // — el nuevo modelo mantiene el código en la posición para siempre.
    const { data: apcc, error: apccErr } = await context.supabase
      .from("agreement_position_client_codes")
      .select(
        "client_product_id, agreement_position_id, agreement_positions!inner(id, status, sale_price, product_id, products(sku, erp_description))",
      )
      .eq("agreement_id", data.agreement_id)
      .in("client_product_id", allIds);
    if (apccErr) throw new Error(apccErr.message);

    const statusByCp = new Map<string, ClientCodeSearchResult["status"]>();
    const excludedPosIds: string[] = [];
    const takenRows: Array<{
      cp_id: string;
      pos_id: string;
      pos_status: "active" | "excluded" | "requires_review" | "draft";
      sku: string | null;
      product_description: string | null;
      sale_price: number | null;
    }> = [];
    for (const row of apcc ?? []) {
      const pos = row.agreement_positions as {
        id: string;
        status: string;
        sale_price: number | null;
        product_id: string | null;
        products: { sku: string | null; erp_description: string | null } | null;
      } | null;
      if (!pos) continue;
      const posStatus: "active" | "excluded" | "requires_review" | "draft" =
        pos.status === "excluded"
          ? "excluded"
          : pos.status === "requires_review"
            ? "requires_review"
            : pos.status === "draft"
              ? "draft"
              : "active";
      takenRows.push({
        cp_id: row.client_product_id as string,
        pos_id: pos.id,
        pos_status: posStatus,
        sku: pos.products?.sku ?? null,
        product_description: pos.products?.erp_description ?? null,
        sale_price: pos.sale_price,
      });
      if (posStatus === "excluded") excludedPosIds.push(pos.id);
    }

    const exclusionByPos = new Map<
      string,
      { reason: string | null; date: string | null }
    >();
    if (excludedPosIds.length > 0) {
      const { data: excls, error: exclErr } = await context.supabase
        .from("agreement_position_exclusions")
        .select("position_id, exclusion_reason, valid_from")
        .in("position_id", excludedPosIds)
        .is("valid_until", null);
      if (exclErr) throw new Error(exclErr.message);
      for (const e of excls ?? []) {
        const reasonRaw = (e.exclusion_reason as string | null) ?? null;
        exclusionByPos.set(e.position_id as string, {
          reason: reasonRaw && reasonRaw.trim() !== "" ? reasonRaw : null,
          date: (e.valid_from as string | null) ?? null,
        });
      }
    }

    for (const t of takenRows) {
      const excl = t.pos_status === "excluded" ? exclusionByPos.get(t.pos_id) ?? null : null;
      statusByCp.set(t.cp_id, {
        kind: "taken",
        position_id: t.pos_id,
        position_status: t.pos_status,
        sku: t.sku,
        product_description: t.product_description,
        sale_price: t.sale_price,
        exclusion_reason: excl?.reason ?? null,
        exclusion_date: excl?.date ?? null,
      });
    }



    return allIds.map((id) => {
      const m = merged.get(id)!;
      return {
        client_product_id: id,
        client_code: m.client_code,
        description: m.description,
        status: statusByCp.get(id) ?? { kind: "free" as const },
      };
    });
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
      .from("agreement_positions")
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
  .handler(async ({ data: _data, context: _context }): Promise<{ linked: true; updated: number }> => {
    // R-09 style: puerta cerrada, cuerpo conservado (comentado).
    // La vinculación de precios queda deshabilitada mientras se estabiliza
    // el modelo de posiciones (grupos + miembros para subconjuntos del mismo SKU).
    // Ver PGCI_03.21.00 §5.3.
    throw new Error(
      "La vinculación de precios está temporalmente deshabilitada mientras se estabiliza el modelo de posiciones. Ver PGCI_03.21.00 §5.3.",
    );
    // --- Cuerpo original conservado para reactivación futura ---
    // await assertCanAdmin(_context.supabase, _data.agreement_id);
    // const { error: insErr } = await _context.supabase
    //   .from("agreement_sku_links")
    //   .insert({
    //     agreement_id: _data.agreement_id,
    //     product_id: _data.product_id,
    //     created_by: _context.userId,
    //   });
    // if (insErr && !insErr.message.toLowerCase().includes("duplicate")) {
    //   throw new Error(`No se pudo vincular el SKU: ${insErr.message}`);
    // }
    // const { error, count } = await _context.supabase
    //   .from("agreement_positions")
    //   .update({ sale_price: _data.price, updated_by: _context.userId }, { count: "exact" })
    //   .eq("agreement_id", _data.agreement_id)
    //   .eq("product_id", _data.product_id)
    //   .neq("status", "excluded");
    // if (error) throw new Error(`Vínculo creado pero no se pudo aplicar el precio: ${error.message}`);
    // return { linked: true as const, updated: count ?? 0 };
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
// Detección N:1 en la vista de posiciones — agrupa por product_id
// ---------------------------------------------------------------------------

export type AgreementSkuGroupPosition = {
  id: string;
  client_code: string | null;
  client_description: string | null;
  sale_price: number | null;
};

export type AgreementSkuGroup = {
  product_id: string;
  client_id: string;
  client_name: string | null;
  sku: string | null;
  product_description: string | null;
  position_ids: string[];
  positions: AgreementSkuGroupPosition[];
  prices: number[];
  linked: boolean;
  // Contrato §7: agrupación por SKU + cliente.
  // "unified" = precio vinculado; "conflict" = precios distintos; "repeated" = repetido con mismo precio.
  state: "conflict" | "unified" | "repeated";
};

export const listAgreementSkuGroups = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ agreement_id: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }): Promise<AgreementSkuGroup[]> => {
    await assertCanAccess(context.supabase, data.agreement_id);

    const { data: positions, error } = await context.supabase
      .from("agreement_positions")
      .select(
        "id, product_id, sale_price, products:product_id(sku, erp_description)",
      )
      .eq("agreement_id", data.agreement_id)
      .neq("status", "excluded")
      .not("product_id", "is", null);
    if (error) throw new Error(`No se pudieron cargar posiciones: ${error.message}`);

    type PositionRow = {
      id: string;
      product_id: string;
      sale_price: number | null;
      products: { sku: string | null; erp_description: string | null } | null;
    };
    const rows = ((positions ?? []) as unknown as PositionRow[]);
    if (rows.length === 0) return [];

    const posIds = rows.map((r) => r.id);
    const { data: apcc, error: apccErr } = await context.supabase
      .from("agreement_position_client_codes")
      .select(
        "agreement_position_id, client_id, client_product_id, clients!agreement_position_client_codes_client_id_fkey(commercial_name, legal_name), client_products!agreement_position_client_codes_client_product_id_fkey(client_code)",
      )
      .in("agreement_position_id", posIds)
      .is("valid_until", null);
    if (apccErr) throw new Error(`No se pudieron cargar códigos: ${apccErr.message}`);

    type ApccRow = {
      agreement_position_id: string;
      client_id: string;
      client_product_id: string;
      clients: { commercial_name: string | null; legal_name: string | null } | null;
      client_products: { client_code: string | null } | null;
    };
    const apccRows = ((apcc ?? []) as unknown as ApccRow[]);

    // Descripciones vigentes por client_product_id.
    const cpIds = Array.from(
      new Set(apccRows.map((c) => c.client_product_id).filter((v): v is string => !!v)),
    );
    const descByCp = new Map<string, string | null>();
    if (cpIds.length > 0) {
      const { data: hist } = await context.supabase
        .from("client_product_history")
        .select("client_product_id, description, valid_from")
        .in("client_product_id", cpIds)
        .is("valid_until", null)
        .order("valid_from", { ascending: false })
        .order("created_at", { ascending: false });
      for (const h of hist ?? []) {
        const cpId = h.client_product_id as string;
        if (!descByCp.has(cpId)) descByCp.set(cpId, (h.description as string | null) ?? null);
      }
    }

    // Agrupar códigos por posición.
    type CodeEntry = {
      client_id: string;
      client_name: string | null;
      client_code: string;
      description: string | null;
    };
    const codesByPos = new Map<string, CodeEntry[]>();
    for (const c of apccRows) {
      const code = c.client_products?.client_code ?? null;
      if (!code) continue;
      const arr = codesByPos.get(c.agreement_position_id) ?? [];
      arr.push({
        client_id: c.client_id,
        client_name: c.clients?.commercial_name ?? c.clients?.legal_name ?? null,
        client_code: code,
        description: descByCp.get(c.client_product_id) ?? null,
      });
      codesByPos.set(c.agreement_position_id, arr);
    }

    // Contrato §7: agrupar por product_id + client_id. Una posición se cuenta
    // una vez por cada cliente al que pertenece.
    type GroupEntry = {
      product_id: string;
      client_id: string;
      client_name: string | null;
      sku: string | null;
      description: string | null;
      ids: Set<string>;
      positions: AgreementSkuGroupPosition[];
      prices: Set<number>;
    };
    const groups = new Map<string, GroupEntry>();
    const keyFor = (pid: string, cid: string) => `${pid}::${cid}`;
    for (const r of rows) {
      const codes = codesByPos.get(r.id) ?? [];
      if (codes.length === 0) continue; // sin códigos → no participa en agrupación por cliente
      for (const c of codes) {
        const k = keyFor(r.product_id, c.client_id);
        const entry = groups.get(k) ?? {
          product_id: r.product_id,
          client_id: c.client_id,
          client_name: c.client_name,
          sku: r.products?.sku ?? null,
          description: r.products?.erp_description ?? null,
          ids: new Set<string>(),
          positions: [],
          prices: new Set<number>(),
        };
        if (!entry.ids.has(r.id)) {
          entry.ids.add(r.id);
          entry.positions.push({
            id: r.id,
            client_code: c.client_code,
            client_description: c.description,
            sale_price: r.sale_price,
          });
          if (typeof r.sale_price === "number") entry.prices.add(r.sale_price);
        }
        groups.set(k, entry);
      }
    }

    const repeated = Array.from(groups.values()).filter((g) => g.ids.size >= 2);
    if (repeated.length === 0) return [];

    const productIds = Array.from(new Set(repeated.map((g) => g.product_id)));
    const { data: links, error: linkErr } = await context.supabase
      .from("agreement_sku_links")
      .select("product_id")
      .eq("agreement_id", data.agreement_id)
      .in("product_id", productIds);
    if (linkErr) throw new Error(`No se pudieron cargar vínculos: ${linkErr.message}`);
    const linkedSet = new Set((links ?? []).map((l) => l.product_id as string));

    return repeated.map((g) => {
      const prices = Array.from(g.prices);
      const linked = linkedSet.has(g.product_id);
      const state: AgreementSkuGroup["state"] = linked
        ? "unified"
        : prices.length > 1
          ? "conflict"
          : "repeated";
      return {
        product_id: g.product_id,
        client_id: g.client_id,
        client_name: g.client_name,
        sku: g.sku,
        product_description: g.description,
        position_ids: Array.from(g.ids),
        positions: g.positions,
        prices,
        linked,
        state,
      };
    });
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
    .eq("agreement_id", agreementId)
    .is("valid_until", null);
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
      const { data: profs } = await context.supabase.rpc(
        "get_agreement_participants",
        { p_agreement_id: data.agreement_id },
      );
      profilesById = new Map(
        (profs ?? []).map((p: { user_id: string; full_name: string | null; email: string | null; status: string; erp_user_code: string | null }) => [
          p.user_id,
          {
            full_name: (p.full_name ?? "") as string,
            email: (p.email ?? "") as string,
            status: p.status,
            erp_user_code: p.erp_user_code ?? null,
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
      .eq("agreement_id", data.agreement_id)
      .is("valid_until", null);
    if (compErr) throw new Error("No se pudieron resolver los clientes del acuerdo");
    const clientIds = [...new Set((companies ?? []).map((c) => c.client_id as string))];
    if (clientIds.length === 0) throw new Error("Acuerdo sin clientes vinculados");

    for (const clientId of clientIds) {
      const { data: existingAccess } = await context.supabase
        .from("user_client_access")
        .select("id")
        .eq("user_id", data.user_id)
        .eq("client_id", clientId)
        .is("valid_until", null)
        .maybeSingle();
      if (!existingAccess) {
        const { error: accErr } = await context.supabase
          .from("user_client_access")
          .insert({
            user_id: data.user_id,
            client_id: clientId,
            can_create_agreements: false,
            assigned_by: context.userId,
            started_by: context.userId,
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
      const { data: profRows, error: profErr } = await context.supabase.rpc(
        "get_agreement_participants",
        { p_agreement_id: data.agreement_id },
      );
      if (profErr) throw new Error(profErr.message);
      for (const p of (profRows ?? []) as { user_id: string; full_name: string | null }[]) {
        const name = p.full_name?.trim();
        if (name) userNames.set(p.user_id, name);
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
    let created_by_name: string | null = null;
    if (row.created_by) {
      const { data: participants } = await context.supabase.rpc(
        "get_agreement_group_participants",
        { p_group_id: data.group_id },
      );
      const match = (participants ?? []).find(
        (p: { user_id: string }) => p.user_id === row.created_by,
      );
      created_by_name = (match?.full_name as string | null) ?? null;
    }
    return {
      id: row.id as string,
      group_name: row.group_name as string,
      client_id: (row.client_id as string | null) ?? null,
      status: row.status as string,
      notes: (row.notes as string | null) ?? null,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      created_by: (row.created_by as string | null) ?? null,
      created_by_name,
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
      const { data: profs } = await context.supabase.rpc(
        "get_agreement_group_participants",
        { p_group_id: data.group_id },
      );
      profilesById = new Map(
        (profs ?? []).map((p: { user_id: string; full_name: string | null; email: string | null; status: string }) => [
          p.user_id,
          {
            full_name: (p.full_name ?? "") as string,
            email: (p.email ?? "") as string,
            status: p.status,
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
    if (!g) {
      // Sin acceso al agrupador (RLS) o eliminado: devolver un resumen vacío
      // para que la sección del detalle del acuerdo no rompa la vista.
      return {
        id: data.group_id,
        group_name: "Agrupador",
        unique_clients: 0,
        unique_users: 0,
        total_lines: 0,
        agreements: [] as Array<{
          id: string;
          name: string;
          lines_total: number;
          status: "active" | "inactive";
        }>,
      };
    }

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
        .in("agreement_id", agreementIds)
        .is("valid_until", null);
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

    const { data: gmems } = await context.supabase
      .from("agreement_group_members")
      .select("user_id")
      .eq("agreement_group_id", data.group_id)
      .is("valid_until", null);
    const userSet = new Set<string>();
    for (const m of gmems ?? []) {
      const uid = (m as { user_id: string | null }).user_id;
      if (uid) userSet.add(uid);
    }

    return {
      id: g.id as string,
      group_name: g.group_name as string,
      unique_clients: uniqueClients,
      unique_users: userSet.size,
      total_lines: totalLines,
      agreements: (ags ?? []).map((a) => ({
        id: a.id as string,
        name: a.name as string,
        lines_total: Number((a as { lines_total: number | null }).lines_total ?? 0),
        status: a.status as string,
      })),
    };
  });

// ---------------------------------------------------------------------------
// Vista dedicada del agrupador
// ---------------------------------------------------------------------------


export const getAgreementGroupRollup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => groupIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: ags, error: aErr } = await context.supabase
      .from("agreements_with_counts")
      .select(
        "id, lines_total, lines_active, lines_review, lines_excluded, lines_draft, lines_archived, lines_expired, start_date, end_date",
      )
      .eq("group_id", data.group_id);
    if (aErr) throw new Error(aErr.message);
    const rows = ags ?? [];
    const agreementIds = rows.map((a) => a.id as string);

    let uniqueClients = 0;
    if (agreementIds.length > 0) {
      const { data: comps, error: cErr } = await context.supabase
        .from("agreement_companies")
        .select("client_id")
        .in("agreement_id", agreementIds)
        .is("valid_until", null);
      if (cErr) throw new Error(cErr.message);
      const cset = new Set<string>();
      for (const c of comps ?? []) {
        const cid = (c as { client_id: string | null }).client_id;
        if (cid) cset.add(cid);
      }
      uniqueClients = cset.size;
    }

    // Miembros del agrupador (agreement_group_members) — deduplicados por user_id.
    const { data: gmems, error: gmErr } = await context.supabase
      .from("agreement_group_members")
      .select("user_id")
      .eq("agreement_group_id", data.group_id)
      .is("valid_until", null);
    if (gmErr) throw new Error(gmErr.message);
    const gset = new Set<string>();
    for (const m of gmems ?? []) {
      const uid = (m as { user_id: string | null }).user_id;
      if (uid) gset.add(uid);
    }
    const uniqueUsers = gset.size;


    let minStart: string | null = null;
    let maxEnd: string | null = null;
    for (const r of rows) {
      const s = (r as { start_date: string | null }).start_date;
      const e = (r as { end_date: string | null }).end_date;
      if (s && (!minStart || s < minStart)) minStart = s;
      if (e && (!maxEnd || e > maxEnd)) maxEnd = e;
    }

    const sumField = (key: "lines_total" | "lines_active" | "lines_review" | "lines_excluded" | "lines_draft" | "lines_archived" | "lines_expired") =>
      rows.reduce(
        (acc, a) => acc + Number((a as Record<string, number | null>)[key] ?? 0),
        0,
      );

    return {
      agreements_count: rows.length,
      unique_clients: uniqueClients,
      unique_users: uniqueUsers,
      total_lines: sumField("lines_total"),
      lines_active: sumField("lines_active"),
      
      lines_review: sumField("lines_review"),
      lines_excluded: sumField("lines_excluded"),
      min_start: minStart,
      max_end: maxEnd,
    };
  });

export const listGroupAgreementMembers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => groupIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: ags, error: aErr } = await context.supabase
      .from("agreements")
      .select("id, name")
      .eq("group_id", data.group_id);
    if (aErr) throw new Error(aErr.message);
    const agreements = ags ?? [];
    const agreementIds = agreements.map((a) => a.id as string);
    if (agreementIds.length === 0) return [];
    const agreementNameById = new Map(
      agreements.map((a) => [a.id as string, a.name as string]),
    );

    const { data: mems, error: mErr } = await context.supabase
      .from("agreement_members")
      .select("id, agreement_id, user_id, role, can_view_costs, created_at")
      .in("agreement_id", agreementIds)
      .is("valid_until", null);
    if (mErr) throw new Error(mErr.message);
    const rows = mems ?? [];
    const userIds = Array.from(
      new Set(rows.map((m) => m.user_id as string).filter(Boolean)),
    );
    let profilesById = new Map<string, { full_name: string; email: string }>();
    if (userIds.length > 0) {
      const results = await Promise.all(
        agreementIds.map((aid) =>
          context.supabase.rpc("get_agreement_participants", {
            p_agreement_id: aid,
          }),
        ),
      );
      for (const r of results) {
        for (const p of (r.data ?? []) as {
          user_id: string;
          full_name: string | null;
          email: string | null;
        }[]) {
          if (!profilesById.has(p.user_id)) {
            profilesById.set(p.user_id, {
              full_name: (p.full_name ?? "") as string,
              email: (p.email ?? "") as string,
            });
          }
        }
      }
    }

    return rows
      .map((m) => ({
        id: m.id as string,
        agreement_id: m.agreement_id as string,
        agreement_name: agreementNameById.get(m.agreement_id as string) ?? "",
        user_id: m.user_id as string,
        role: m.role as string,
        can_view_costs: !!m.can_view_costs,
        created_at: m.created_at as string,
        user_name: profilesById.get(m.user_id as string)?.full_name ?? "",
        user_email: profilesById.get(m.user_id as string)?.email ?? "",
      }))
      .sort((a, b) => {
        const n = a.user_name.localeCompare(b.user_name, "es", {
          sensitivity: "base",
        });
        if (n !== 0) return n;
        return a.agreement_name.localeCompare(b.agreement_name, "es", {
          sensitivity: "base",
        });
      });
  });




export const listAgreementsInGroup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => groupIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: ags, error } = await context.supabase
      .from("agreements_with_counts")
      .select("id, name, status, lines_total")
      .eq("group_id", data.group_id)
      .order("name");
    if (error) throw new Error(error.message);
    const rows = ags ?? [];
    const ids = rows.map((r) => r.id as string).filter(Boolean);
    const byAgreement = new Map<string, string[]>();
    if (ids.length > 0) {
      const { data: comps, error: cErr } = await context.supabase
        .from("agreement_companies")
        .select("agreement_id, clients:client_id(commercial_name, legal_name)")
        .in("agreement_id", ids)
        .is("valid_until", null);
      if (cErr) throw new Error(cErr.message);
      for (const c of comps ?? []) {
        const client = (c as { clients: { commercial_name: string | null; legal_name: string | null } | null }).clients;
        const name = client?.commercial_name?.trim() || client?.legal_name || "—";
        const aid = (c as { agreement_id: string }).agreement_id;
        const arr = byAgreement.get(aid) ?? [];
        arr.push(name);
        byAgreement.set(aid, arr);
      }
    }
    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      status: r.status as string,
      lines_total: Number((r as { lines_total: number | null }).lines_total ?? 0),
      companies: (byAgreement.get(r.id as string) ?? []).sort((a, b) =>
        a.localeCompare(b, "es", { sensitivity: "base" }),
      ),
    }));
  });

// Acuerdos elegibles para meter en este agrupador:
// - group_id IS NULL (aún no pertenecen a ninguno)
// - el usuario actual es agreement_admin activo (o super_admin)
export const listEligibleAgreementsForGroup = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isSuper } = await context.supabase.rpc("is_super_admin");
    let agreementIds: string[] | null = null;
    if (!isSuper) {
      const { data: mems, error: mErr } = await context.supabase
        .from("agreement_members")
        .select("agreement_id")
        .eq("user_id", context.userId)
        .eq("role", "agreement_admin")
        .is("valid_until", null);
      if (mErr) throw new Error(mErr.message);
      agreementIds = (mems ?? [])
        .map((m) => m.agreement_id as string)
        .filter(Boolean);
      if (agreementIds.length === 0) return [];
    }

    let q = context.supabase
      .from("agreements_with_counts")
      .select("id, name, status, lines_total, group_id")
      .is("group_id", null)
      .order("name");
    if (agreementIds) q = q.in("id", agreementIds);

    const { data: ags, error } = await q;
    if (error) throw new Error(error.message);
    const rows = ags ?? [];
    const ids = rows.map((r) => r.id as string).filter(Boolean);
    const byAgreement = new Map<string, string[]>();
    if (ids.length > 0) {
      const { data: comps } = await context.supabase
        .from("agreement_companies")
        .select("agreement_id, clients:client_id(commercial_name, legal_name)")
        .in("agreement_id", ids)
        .is("valid_until", null);
      for (const c of comps ?? []) {
        const client = (c as { clients: { commercial_name: string | null; legal_name: string | null } | null }).clients;
        const name = client?.commercial_name?.trim() || client?.legal_name || "—";
        const aid = (c as { agreement_id: string }).agreement_id;
        const arr = byAgreement.get(aid) ?? [];
        arr.push(name);
        byAgreement.set(aid, arr);
      }
    }
    return rows.map((r) => ({
      id: r.id as string,
      name: r.name as string,
      status: r.status as string,
      lines_total: Number((r as { lines_total: number | null }).lines_total ?? 0),
      companies: (byAgreement.get(r.id as string) ?? []).sort((a, b) =>
        a.localeCompare(b, "es", { sensitivity: "base" }),
      ),
    }));
  });

const addAgreementsToGroupSchema = z.object({
  group_id: z.string().uuid(),
  agreement_ids: z.array(z.string().uuid()).min(1),
});

export const addAgreementsToGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => addAgreementsToGroupSchema.parse(d))
  .handler(async ({ data, context }) => {
    // Verificar cada acuerdo: user debe ser admin y group_id debe ser null.
    for (const aid of data.agreement_ids) {
      await assertCanAdmin(context.supabase, aid);
      const { data: row, error } = await context.supabase
        .from("agreements")
        .select("group_id")
        .eq("id", aid)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!row) throw new Error("Acuerdo no encontrado");
      if (row.group_id !== null)
        throw new Error("Uno de los acuerdos ya pertenece a un agrupador");
    }
    // Trigger check_agreement_group_reassignment valida admin del grupo destino.
    const { error } = await context.supabase
      .from("agreements")
      .update({ group_id: data.group_id })
      .in("id", data.agreement_ids);
    if (error) throw new Error(error.message);
    return { ok: true, count: data.agreement_ids.length };
  });

const removeAgreementFromGroupSchema = z.object({
  agreement_id: z.string().uuid(),
});

export const removeAgreementFromGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => removeAgreementFromGroupSchema.parse(d))
  .handler(async ({ data, context }) => {
    await assertCanAdmin(context.supabase, data.agreement_id);
    const { error } = await context.supabase
      .from("agreements")
      .update({ group_id: null })
      .eq("id", data.agreement_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const updateAgreementGroupSchema = z.object({
  group_id: z.string().uuid(),
  group_name: z.string().trim().min(1).max(160).optional(),
  notes: z
    .string()
    .max(4000)
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? undefined : v && v.trim().length ? v : null)),
});

export const updateAgreementGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => updateAgreementGroupSchema.parse(d))
  .handler(async ({ data, context }) => {
    const patch: { group_name?: string; notes?: string | null } = {};
    if (data.group_name !== undefined) patch.group_name = data.group_name;
    if (data.notes !== undefined) patch.notes = data.notes;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await context.supabase
      .from("agreement_groups")
      .update(patch)
      .eq("id", data.group_id);
    if (error) {
      if (error.message.toLowerCase().includes("row-level"))
        throw new Error("No tienes permisos para editar el agrupador");
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteAgreementGroup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => groupIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    // ON DELETE SET NULL en agreements.group_id.
    const { error } = await context.supabase
      .from("agreement_groups")
      .delete()
      .eq("id", data.group_id);
    if (error) {
      if (error.message.toLowerCase().includes("row-level"))
        throw new Error("No tienes permisos para borrar el agrupador");
      throw new Error(error.message);
    }
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Permisos de catálogo por cliente para un acuerdo dado. Se apoya en la RPC
// SECURITY DEFINER `can_manage_client_catalog(uuid)`; verificado que el rol
// `authenticated` tiene EXECUTE sobre ella.
// ---------------------------------------------------------------------------
export const listClientCatalogPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    importPreviewSchema.pick({ agreement_id: true }).parse(d),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<Array<{ client_id: string; can_manage: boolean }>> => {
      await assertCanAccess(context.supabase, data.agreement_id);
      const { data: comps, error } = await context.supabase
        .from("agreement_companies")
        .select("client_id")
        .eq("agreement_id", data.agreement_id)
        .is("valid_until", null);
      if (error) throw new Error(error.message);
      const ids = Array.from(
        new Set((comps ?? []).map((c) => c.client_id as string).filter(Boolean)),
      );
      if (ids.length === 0) return [];
      const results = await Promise.all(
        ids.map(async (client_id) => {
          const { data: canManage, error: rpcErr } = await context.supabase.rpc(
            "can_manage_client_catalog",
            { p_client_id: client_id },
          );
          if (rpcErr) throw new Error(rpcErr.message);
          return { client_id, can_manage: !!canManage };
        }),
      );
      return results;
    },
  );

export const listAssignableUsersForAgreement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    importPreviewSchema.pick({ agreement_id: true }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc(
      "list_assignable_users_for_agreement",
      { p_agreement_id: data.agreement_id },
    );
    if (error) throw new Error(error.message);
    return (rows ?? []) as {
      user_id: string;
      full_name: string | null;
      email: string | null;
      status: string;
    }[];
  });

export const listAssignableUsersForAgreementGroup = createServerFn({
  method: "GET",
})
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => groupIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase.rpc(
      "list_assignable_users_for_agreement_group",
      { p_group_id: data.group_id },
    );
    if (error) throw new Error(error.message);
    return (rows ?? []) as {
      user_id: string;
      full_name: string | null;
      email: string | null;
      status: string;
    }[];
  });

