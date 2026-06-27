import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/")({
  ssr: false,
  beforeLoad: async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("user_id", auth.user.id)
      .maybeSingle();
    if (!profile || profile.status !== "active") {
      await supabase.auth.signOut();
      throw redirect({ to: "/auth" });
    }
    if (profile.role === "super_admin") throw redirect({ to: "/setup" });
    throw redirect({ to: "/app" });
  },
  component: () => null,
});
