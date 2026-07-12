import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Use getSession() (local, reads from localStorage) instead of getUser()
    // (network call to /auth/v1/user). getUser() on every navigation caused
    // transient network failures to log the user out mid-session. The server
    // still validates the bearer token in requireSupabaseAuth for every RPC.
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  component: () => <Outlet />,
});
