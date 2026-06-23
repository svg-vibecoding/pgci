import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SumatecLogo } from "@/components/SumatecLogo";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Acceso · PGCI" }] }),
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
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError("No fue posible iniciar sesión. Verifica tus credenciales.");
      return;
    }
    navigate({ to: "/setup" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--surface-page)] px-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-5 rounded-lg border border-border bg-card p-8 shadow-sm"
      >
        <div className="flex flex-col items-center gap-3">
          <SumatecLogo className="h-10 w-auto" />
          <h1 className="text-xl font-semibold tracking-tight">Acceso PGCI</h1>
        </div>
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
