import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { waitForAuthReady } from "@/integrations/supabase/auth-ready";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Esperar a que supabase-js termine de rehidratar la sesión desde
    // localStorage antes de decidir redirigir. Evita el falso negativo en F5
    // donde getSession() devuelve null porque el cliente aún no restauró.
    const session = await waitForAuthReady();
    if (!session?.user) throw redirect({ to: "/auth" });
    return { user: session.user };
  },
  component: () => <Outlet />,
});
