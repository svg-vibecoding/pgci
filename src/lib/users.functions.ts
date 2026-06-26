import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createUserSchema = z.object({
  full_name: z.string().trim().min(1, "Nombre requerido").max(120),
  email: z.string().trim().toLowerCase().email("Email inválido").max(255),
  role: z.enum(["super_admin", "platform_user"]),
  can_create_agreements: z.boolean().default(false),
  erp_user_code: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v.length ? v : null)),
  status: z.enum(["active", "inactive"]).default("active"),
  client_ids: z.array(z.string().uuid()).default([]),
});

export type CreateUserInput = z.input<typeof createUserSchema>;

function generateTempPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const digits = "23456789";
  const symbols = "!@#$%*?";
  const all = upper + lower + digits + symbols;
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  const base = [pick(upper), pick(lower), pick(digits), pick(symbols)];
  for (let i = 0; i < 8; i++) base.push(pick(all));
  return base.sort(() => Math.random() - 0.5).join("");
}

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => createUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isSuper, error: roleErr } = await supabase.rpc("is_super_admin");
    if (roleErr) throw new Error("No se pudo verificar permisos");
    if (!isSuper) throw new Error("Solo super admins pueden crear usuarios");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const tempPassword = generateTempPassword();

    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });

    if (createErr || !created.user) {
      const msg = createErr?.message ?? "No se pudo crear el usuario";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("registered")) {
        throw new Error("Ya existe un usuario con ese email");
      }
      throw new Error(msg);
    }

    const newUserId = created.user.id;

    const { error: profileErr } = await supabaseAdmin.from("profiles").insert({
      user_id: newUserId,
      email: data.email,
      full_name: data.full_name,
      role: data.role,
      status: data.status,
      can_create_agreements: data.role === "platform_user" ? data.can_create_agreements : false,
      erp_user_code: data.erp_user_code,
      created_by: userId,
    });

    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(`No se pudo crear el perfil: ${profileErr.message}`);
    }

    if (data.role === "platform_user" && data.client_ids.length > 0) {
      const rows = data.client_ids.map((client_id) => ({
        user_id: newUserId,
        client_id,
        assigned_by: userId,
      }));
      const { error: accessErr } = await supabaseAdmin
        .from("user_client_access")
        .insert(rows);
      if (accessErr) {
        // Profile created but access failed — surface a warning but keep the user.
        return {
          user_id: newUserId,
          email: data.email,
          full_name: data.full_name,
          temp_password: tempPassword,
          access_error: accessErr.message,
        };
      }
    }

    return {
      user_id: newUserId,
      email: data.email,
      full_name: data.full_name,
      temp_password: tempPassword,
    };
  });

const updateUserSchema = z.object({
  user_id: z.string().uuid(),
  full_name: z.string().trim().min(1, "Nombre requerido").max(120),
  role: z.enum(["super_admin", "platform_user"]),
  can_create_agreements: z.boolean().default(false),
  erp_user_code: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v.length ? v : null)),
  status: z.enum(["active", "inactive"]).default("active"),
  client_ids: z.array(z.string().uuid()).default([]),
});

export type UpdateUserInput = z.input<typeof updateUserSchema>;

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: isSuper, error: roleErr } = await supabase.rpc("is_super_admin");
    if (roleErr) throw new Error("No se pudo verificar permisos");
    if (!isSuper) throw new Error("Solo super admins pueden editar usuarios");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const effectiveClientIds = data.role === "platform_user" ? data.client_ids : [];
    const canCreate =
      data.role === "platform_user" ? data.can_create_agreements : false;

    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        role: data.role,
        status: data.status,
        can_create_agreements: canCreate,
        erp_user_code: data.erp_user_code,
      })
      .eq("user_id", data.user_id);

    if (profileErr) throw new Error(`No se pudo actualizar el perfil: ${profileErr.message}`);

    // Reconcile client access
    const { data: existing, error: readErr } = await supabaseAdmin
      .from("user_client_access")
      .select("client_id")
      .eq("user_id", data.user_id);
    if (readErr) throw new Error(`No se pudieron leer los accesos: ${readErr.message}`);

    const current = new Set((existing ?? []).map((r) => r.client_id));
    const desired = new Set(effectiveClientIds);

    const toInsert = [...desired].filter((id) => !current.has(id));
    const toDelete = [...current].filter((id) => !desired.has(id));

    if (toDelete.length > 0) {
      const { error: delErr } = await supabaseAdmin
        .from("user_client_access")
        .delete()
        .eq("user_id", data.user_id)
        .in("client_id", toDelete);
      if (delErr) {
        return { user_id: data.user_id, access_error: delErr.message };
      }
    }

    if (toInsert.length > 0) {
      const rows = toInsert.map((client_id) => ({
        user_id: data.user_id,
        client_id,
        assigned_by: userId,
      }));
      const { error: insErr } = await supabaseAdmin
        .from("user_client_access")
        .insert(rows);
      if (insErr) {
        return { user_id: data.user_id, access_error: insErr.message };
      }
    }

    return { user_id: data.user_id };
  });
