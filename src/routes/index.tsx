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
    // Redirector puro basado en sesión.
    const landing = await resolveAuthLanding();
    throw redirect({ to: landing ?? "/auth" });
  },
  component: () => null,
});
