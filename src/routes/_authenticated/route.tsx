import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ context }) => {
    // Espera a que el store resuelva por primera vez (evento real de supabase).
    // En navegaciones internas ya está resuelto → retorna sincrónicamente.
    await context.authStore.ready;
    const s = context.authStore.getState();
    if (s.status !== "signed-in") throw redirect({ to: "/auth" });
    return { user: s.session.user };
  },
  component: () => <Outlet />,
});
