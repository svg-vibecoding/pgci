import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const createUserSchema = z.object({
  full_name: z.string().trim().min(1, "Nombre requerido").max(120),
  email: z.string().trim().toLowerCase().email("Email inválido").max(255),
  role: z.enum(["super_admin", "platform_user"]),
  erp_user_code: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v.length ? v : null)),
  status: z.enum(["active", "inactive"]).default("active"),
  can_create_agreement_groups: z.boolean().optional().default(false),
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
      erp_user_code: data.erp_user_code,
      can_create_agreement_groups:
        data.role === "super_admin" ? false : data.can_create_agreement_groups,
      created_by: userId,
    });

    if (profileErr) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId);
      throw new Error(`No se pudo crear el perfil: ${profileErr.message}`);
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
  email: z.string().trim().toLowerCase().email("Email inválido").max(255).optional(),
  role: z.enum(["super_admin", "platform_user"]),
  erp_user_code: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => (v && v.length ? v : null)),
  status: z.enum(["active", "inactive"]).default("active"),
  new_password: z.string().min(8, "Mínimo 8 caracteres").optional(),
});

export type UpdateUserInput = z.input<typeof updateUserSchema>;

export const updateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => updateUserSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: isSuper, error: roleErr } = await supabase.rpc("is_super_admin");
    if (roleErr) throw new Error("No se pudo verificar permisos");
    if (!isSuper) throw new Error("Solo super admins pueden editar usuarios");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let emailToPersist: string | undefined;

    if (data.email) {
      const { data: current, error: curErr } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("user_id", data.user_id)
        .single();
      if (curErr) throw new Error("No se pudo leer el usuario actual");

      if (current.email !== data.email) {
        const { data: dup } = await supabaseAdmin
          .from("profiles")
          .select("user_id")
          .eq("email", data.email)
          .neq("user_id", data.user_id)
          .maybeSingle();
        if (dup) throw new Error("Ya existe un usuario con ese email.");

        const { error: authErr } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
          email: data.email,
        });
        if (authErr) throw new Error(`No se pudo actualizar el email: ${authErr.message}`);

        emailToPersist = data.email;
      }
    }

    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.full_name,
        role: data.role,
        status: data.status,
        erp_user_code: data.erp_user_code,
        ...(emailToPersist ? { email: emailToPersist } : {}),
      })
      .eq("user_id", data.user_id);

    if (profileErr) throw new Error(`No se pudo actualizar el perfil: ${profileErr.message}`);

    if (data.new_password) {
      const { error: pwErr } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
        password: data.new_password,
      });
      if (pwErr) throw new Error(`No se pudo actualizar la contraseña: ${pwErr.message}`);
    }

    return { user_id: data.user_id };
  });

