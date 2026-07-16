import { z } from "zod";

// ---------------------------------------------------------------------------
// Esquemas client-safe del módulo Acuerdos. NO imports de servidor aquí.
// ---------------------------------------------------------------------------

export const agreementScopeEnum = z.enum(["global", "unit"]);
export const agreementStatusEnum = z.enum(["active", "inactive"]);
export const lineStatusEnum = z.enum([
  "active",
  "pending",
  "requires_review",
  "excluded",
]);

const trimmedOptional = z
  .string()
  .trim()
  .max(2000)
  .optional()
  .transform((v) => (v && v.length ? v : null));

const dateOptional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length ? v : null))
  .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: "Fecha debe ser YYYY-MM-DD",
  });

const priceOptional = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined || v === null || v === "") return null;
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isNaN(n)) return null;
    return n;
  })
  .refine((v) => v === null || v > 0, {
    message: "El precio debe ser mayor a 0",
  });

const agreementBaseFields = {
  name: z.string().trim().min(1, "Nombre requerido").max(160),
  scope: agreementScopeEnum.default("global"),
  unit_name: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((v) => (v && v.length ? v : null)),
  start_date: dateOptional,
  end_date: dateOptional,
  observations: trimmedOptional,
};

const scopeRefine = (d: { scope: "global" | "unit"; unit_name: string | null }) =>
  d.scope !== "unit" || !!d.unit_name;
const scopeRefineOpts: { path: (string | number)[]; message: string } = {
  path: ["unit_name"],
  message: "Indica el nombre de la unidad",
};

// Creación unificada (Fase 2):
//  - group_id / group_name: opcionales y mutuamente excluyentes.
//    · group_id → usar agrupador existente.
//    · group_name → crear agrupador nuevo (requiere can_create_agreement_groups).
//    · ninguno → acuerdo sin agrupador (group_id = null).
//  - client_id / company_ids: opcionales y mutuamente excluyentes.
//    · client_id → vincular una única empresa al crear.
//    · company_ids → vincular varias.
//    · ninguno → sin empresas iniciales.
export const agreementCreateSchema = z
  .object({
    client_id: z.string().uuid().nullable().optional(),
    group_id: z.string().uuid().nullable().optional(),
    group_name: z
      .string()
      .trim()
      .max(160)
      .nullable()
      .optional()
      .transform((v) => (v && v.length ? v : null)),
    group_observations: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .optional()
      .transform((v) => (v && v.length ? v : null)),
    company_ids: z.array(z.string().uuid()).optional().default([]),
    ...agreementBaseFields,
  })
  .refine((d) => !(d.group_id && d.group_name), {
    path: ["group_name"],
    message: "Usa un agrupador existente o crea uno nuevo, no ambos.",
  })
  .refine((d) => !(d.client_id && (d.company_ids?.length ?? 0) > 0), {
    path: ["company_ids"],
    message: "Elige un solo cliente o varios clientes, no ambos.",
  })
  .refine(scopeRefine, scopeRefineOpts);



export const agreementUpdateSchema = z.object({
  agreement_id: z.string().uuid(),
  patch: z
    .object({
      name: z.string().trim().min(1).max(160).optional(),
      scope: agreementScopeEnum.optional(),
      unit_name: z
        .string()
        .trim()
        .max(160)
        .nullable()
        .optional(),
      start_date: dateOptional,
      end_date: dateOptional,
      observations: trimmedOptional,
    })
    .strict(),
});

export const agreementStatusSchema = z.object({
  agreement_id: z.string().uuid(),
  status: agreementStatusEnum,
});

// Multi-cliente: cada código pertenece a un cliente del acuerdo.
// La lista es DECLARATIVA en el patch: lo que llega es el estado final;
// lo ausente se cierra (valid_until = today) por la RPC update_agreement_line.
export const clientCodeSchema = z.object({
  client_id: z.string().uuid(),
  client_code: z.string().trim().min(1, "Código requerido").max(120),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((v) => (v && v.length ? v : null)),
});
export type ClientCodeInput = z.input<typeof clientCodeSchema>;
export type ClientCode = z.output<typeof clientCodeSchema>;

export const lineCreateSchema = z.object({
  agreement_id: z.string().uuid(),
  sku: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length ? v : null)),
  client_codes: z.array(clientCodeSchema).optional().default([]),
  sale_price: priceOptional,
  par_price: priceOptional,
  start_date: dateOptional,
  end_date: dateOptional,
  observations: trimmedOptional,
});

export const linePatchSchema = z.object({
  line_id: z.string().uuid(),
  kind: z.enum(["position", "transit"]).optional().default("position"),
  patch: z
    .object({
      sku: z.string().trim().nullable().optional(),
      client_codes: z.array(clientCodeSchema).optional(),
      sale_price: priceOptional,
      par_price: priceOptional,
      start_date: dateOptional,
      end_date: dateOptional,
      observations: trimmedOptional,
      // R-09: etiqueta parseable + narrativa cuando cambia el SKU en una
      // posición publicada. La RPC valida obligatoriedad (solo ella sabe si
      // el product_id realmente cambió). Si el SKU no cambia, se ignoran.
      sku_change_kind: z
        .enum(["sku_changed", "sku_corrected"])
        .optional(),
      sku_change_note: z
        .string()
        .trim()
        .max(500)
        .optional()
        .transform((v) => (v && v.length ? v : undefined)),
    })
    .strict(),
  // Se conserva por compatibilidad; la RPC nueva no lo usa.
  confirm_n_conflict: z.boolean().optional(),
});

export const transitDeleteSchema = z.object({
  transit_id: z.string().uuid(),
});

export const lineDeleteSchema = z.object({
  line_id: z.string().uuid(),
});


export const lineExcludeSchema = z.object({
  line_id: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length ? v : null)),
});

export const lineReactivateSchema = z.object({
  line_id: z.string().uuid(),
});

export const lineArchiveSchema = z.object({
  line_id: z.string().uuid(),
  reason: z.string().trim().min(1, "Archivar exige un motivo.").max(500),
});

export const nConflictDetectSchema = z.object({
  agreement_id: z.string().uuid(),
  sku: z.string().trim().min(1),
  new_price: z.number().optional(),
});

export const applyPriceSchema = z.object({
  agreement_id: z.string().uuid(),
  sku: z.string().trim().min(1),
  new_price: z.number(),
});

export const skuLinkSchema = z.object({
  agreement_id: z.string().uuid(),
  product_id: z.string().uuid(),
});

export const skuLinkWithPriceSchema = skuLinkSchema.extend({
  price: z.number().nonnegative(),
});

export const importRowSchema = z.object({
  row_number: z.number().int().positive(),
  sku: z.string().trim().nullable().optional(),
  client_code: z.string().trim().nullable().optional(),
  description: z.string().trim().nullable().optional(),
  sale_price: z.number().nullable().optional(),
  par_price: z.number().nullable().optional(),
  start_date: z.string().nullable().optional(),
  end_date: z.string().nullable().optional(),
  observations: z.string().nullable().optional(),
});

export const importPreviewSchema = z.object({
  agreement_id: z.string().uuid(),
  target_client_id: z.string().uuid().optional(),
  rows: z.array(importRowSchema),
});

export const importCommitSchema = z.object({
  agreement_id: z.string().uuid(),
  target_client_id: z.string().uuid().optional(),
  rows: z.array(importRowSchema),
  price_resolutions: z
    .record(z.string(), z.enum(["applyAll", "keepDistinct"]))
    .optional()
    .default({}),
});


export const memberAddSchema = z.object({
  agreement_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(["agreement_admin", "agreement_member"]),
  can_view_costs: z.boolean().optional().default(false),
});

export const memberUpdateSchema = z.object({
  member_id: z.string().uuid(),
  role: z.enum(["agreement_admin", "agreement_member"]).optional(),
  can_view_costs: z.boolean().optional(),
});

export const memberRemoveSchema = z.object({
  member_id: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length ? v : null)),
});

export const companyAddSchema = z.object({
  agreement_id: z.string().uuid(),
  client_id: z.string().uuid(),
  notes: trimmedOptional,
});

export const companyRemoveSchema = z.object({
  company_id: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length ? v : null)),
});

export const groupMemberAddSchema = z.object({
  group_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: z.enum(["agreement_group_admin", "agreement_group_member"]),
});

export const groupMemberUpdateSchema = z.object({
  member_id: z.string().uuid(),
  role: z.enum(["agreement_group_admin", "agreement_group_member"]),
});

export const groupMemberRemoveSchema = z.object({
  member_id: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .max(500)
    .optional()
    .transform((v) => (v && v.length ? v : null)),
});

export const groupIdSchema = z.object({
  group_id: z.string().uuid(),
});

export const assignAgreementGroupSchema = z
  .object({
    agreement_id: z.string().uuid(),
    group_id: z.string().uuid().nullable().optional(),
    group_name: z
      .string()
      .trim()
      .max(160)
      .nullable()
      .optional()
      .transform((v) => (v && v.length ? v : null)),
    group_observations: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .optional()
      .transform((v) => (v && v.length ? v : null)),
  })
  .refine((d) => !(d.group_id && d.group_name), {
    path: ["group_name"],
    message: "Usa un agrupador existente o crea uno nuevo, no ambos.",
  });

export type AgreementCreateInput = z.input<typeof agreementCreateSchema>;
export type AgreementUpdateInput = z.input<typeof agreementUpdateSchema>;
export type LineCreateInput = z.input<typeof lineCreateSchema>;
export type LinePatchInput = z.input<typeof linePatchSchema>;
export type ImportRowInput = z.input<typeof importRowSchema>;
export type ImportCommitInput = z.input<typeof importCommitSchema>;
export type MemberAddInput = z.input<typeof memberAddSchema>;
export type CompanyAddInput = z.input<typeof companyAddSchema>;
