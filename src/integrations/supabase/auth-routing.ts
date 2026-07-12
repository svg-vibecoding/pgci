// Fuente única de verdad para decidir a dónde va un usuario autenticado
// según su rol. La usan `/`, `/auth` y el post-login para no divergir.

import { supabase } from "./client";
import { authStore } from "./auth-store";

export type AuthenticatedLanding = "/setup" | "/pgci";

export async function getLandingForUserId(
  userId: string,
): Promise<AuthenticatedLanding> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("user_id", userId)
    .maybeSingle();
  const isSuper =
    profile?.role === "super_admin" && profile?.status === "active";
  return isSuper ? "/setup" : "/pgci";
}

// Decide destino esperando a que el auth-store resuelva por primera vez.
// - Sin sesión: null (el llamador decide, típicamente redirigir a /auth).
// - Con sesión: "/setup" o "/pgci" según rol.
export async function resolveAuthLanding(): Promise<
  AuthenticatedLanding | null
> {
  await authStore.ready;
  const s = authStore.getState();
  if (s.status !== "signed-in") return null;
  return getLandingForUserId(s.session.user.id);
}
