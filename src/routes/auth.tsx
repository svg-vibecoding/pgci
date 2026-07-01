import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SumatecLogo } from "@/components/SumatecLogo";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Acceso · PGCI" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("user_id", data.user.id)
      .maybeSingle();
    const isSuper = profile?.role === "super_admin" && profile?.status === "active";
    throw redirect({ to: isSuper ? "/setup" : "/pgci" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !signIn.user) {
      setLoading(false);
      setError("No fue posible iniciar sesión. Verifica tus credenciales.");
      return;
    }
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, status")
      .eq("user_id", signIn.user.id)
      .maybeSingle();
    setLoading(false);
    const isSuper = profile?.role === "super_admin" && profile?.status === "active";
    navigate({ to: isSuper ? "/setup" : "/pgci" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--surface-page)] px-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md space-y-5 rounded-lg border border-border bg-card p-8 shadow-sm"
      >
        <div className="flex flex-col items-center">
          <SumatecLogo className="h-14 w-auto" />
        </div>
        <h1 className="text-left text-lg font-semibold text-foreground">
          PGCI Gestión Comercial Inteligente
        </h1>
        <div className="space-y-2">
          <Label htmlFor="email">Correo</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Ingresando…" : "Ingresar"}
        </Button>
      </form>
    </main>
  );
}
