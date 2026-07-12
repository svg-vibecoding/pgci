import { createFileRoute, redirect } from "@tanstack/react-router";
import { resolveAuthLanding } from "@/integrations/supabase/auth-routing";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "PGCI · Sumatec" },
      {
        name: "description",
        content:
          "Accede a la PGCI, la Plataforma de Gestión Comercial Inteligente de Sumatec.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    // `/` no tiene UI propia: es un redirector puro basado en la sesión.
    // - Con sesión: enviar a la landing según rol.
    // - Sin sesión: enviar a /auth.
    const landing = await resolveAuthLanding();
    throw redirect({ to: landing ?? "/auth" });
  },
  component: () => null,
});
