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
  });

export const agreementCreateSchema = z
  .object({
    client_id: z.string().uuid(),
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
  })
  .refine((d) => d.scope !== "unit" || !!d.unit_name, {
    path: ["unit_name"],
    message: "Indica el nombre de la unidad",
  });

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

export const lineCreateSchema = z.object({
  agreement_id: z.string().uuid(),
  sku: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length ? v : null)),
  client_code: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => (v && v.length ? v : null)),
  client_description: trimmedOptional,
  sale_price: priceOptional,
  par_price: priceOptional,
  start_date: dateOptional,
  end_date: dateOptional,
  observations: trimmedOptional,
});

export const linePatchSchema = z.object({
  line_id: z.string().uuid(),
  patch: z
    .object({
      sku: z.string().trim().nullable().optional(),
      client_code: z.string().trim().max(120).nullable().optional(),
      client_description: z.string().trim().max(2000).nullable().optional(),
      sale_price: priceOptional,
      par_price: priceOptional,
      start_date: dateOptional,
      end_date: dateOptional,
      observations: trimmedOptional,
    })
    .strict(),
  confirm_n_conflict: z.boolean().optional(),
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
  rows: z.array(importRowSchema),
});

export const importCommitSchema = z.object({
  agreement_id: z.string().uuid(),
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
});

export const companyAddSchema = z.object({
  agreement_id: z.string().uuid(),
  tax_id: z.string().trim().min(1).max(40),
  tax_id_type: z.string().trim().min(1).max(20).default("NIT"),
  legal_name: trimmedOptional,
  notes: trimmedOptional,
});

export const companyRemoveSchema = z.object({
  company_id: z.string().uuid(),
});

export type AgreementCreateInput = z.input<typeof agreementCreateSchema>;
export type AgreementUpdateInput = z.input<typeof agreementUpdateSchema>;
export type LineCreateInput = z.input<typeof lineCreateSchema>;
export type LinePatchInput = z.input<typeof linePatchSchema>;
export type ImportRowInput = z.input<typeof importRowSchema>;
export type ImportCommitInput = z.input<typeof importCommitSchema>;
export type MemberAddInput = z.input<typeof memberAddSchema>;
export type CompanyAddInput = z.input<typeof companyAddSchema>;
