// Fuente única de verdad para decidir a dónde va un usuario autenticado
// según su rol. La usan `/`, `/auth` y el post-login para no divergir.

import { supabase } from "./client";
import { waitForAuthReady } from "./auth-ready";

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

// Decide destino esperando a que supabase-js termine de rehidratar.
// - Sin sesión: null (el llamador decide, típicamente redirigir a /auth).
// - Con sesión: "/setup" o "/pgci" según rol.
export async function resolveAuthLanding(): Promise<
  AuthenticatedLanding | null
> {
  const session = await waitForAuthReady();
  if (!session?.user) return null;
  return getLandingForUserId(session.user.id);
}
