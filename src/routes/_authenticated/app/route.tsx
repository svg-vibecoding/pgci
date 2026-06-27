import { createFileRoute, Outlet, redirect, Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SumatecLogo } from "@/components/SumatecLogo";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useMyProfile } from "@/hooks/use-profile";

export const Route = createFileRoute("/_authenticated/app")({
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
  },
  component: AppLayout,
});

function AppLayout() {
  const { data: profile } = useMyProfile();
  return (
    <div className="min-h-screen bg-[var(--surface-page)]">
      <header className="border-b border-[var(--border-subtle)] bg-[var(--surface-card)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link to="/app" aria-label="PGCI · Inicio" className="inline-flex items-center">
            <SumatecLogo className="h-10 w-auto -ml-2" />
          </Link>
          <div className="flex items-center gap-4">
            {profile?.full_name && (
              <span className="text-sm text-[var(--text-secondary)]">{profile.full_name}</span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/auth";
              }}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar sesión
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Outlet />
      </main>
    </div>
  );
}
