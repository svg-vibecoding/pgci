import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getLandingForUserId,
  resolveAuthLanding,
} from "@/integrations/supabase/auth-routing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SumatecLogo } from "@/components/SumatecLogo";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Acceso · PGCI" }] }),
  beforeLoad: async () => {
    const landing = await resolveAuthLanding();
    if (landing) throw redirect({ to: landing });
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
    const landing = await getLandingForUserId(signIn.user.id);
    setLoading(false);
    navigate({ to: landing });
  }

  return (
    <main className="grid min-h-screen grid-cols-1 lg:grid-cols-3">
      {/* Panel de marca */}
      <section className="flex flex-col justify-center bg-[var(--surface-page)] px-8 py-12 sm:px-12 lg:col-span-2 lg:px-20 lg:py-16">
        <div className="max-w-3xl">
          <SumatecLogo className="mb-4 h-12 w-auto lg:h-14" />
          <h1 className="suma-display-md text-text-primary lg:suma-display-lg">
            La gestión comercial, convertida en{" "}
            <br />
            <span className="text-[var(--red-500)]">fuente de verdad.</span>
          </h1>
          <p className="suma-subtitle mt-10 hidden font-normal sm:block">
            <span className="text-text-secondary">
              La PGCI reúne solicitudes, acuerdos, equivalencias de productos, precios, vigencias y condiciones comerciales en un solo lugar:{" "}
            </span>
            <span className="font-semibold text-text-primary">
              Información estructurada, disponible y con todo su historial.
            </span>
          </p>
        </div>
      </section>


      {/* Panel de login */}
      <section className="flex items-center justify-center bg-[var(--surface-card)] px-6 py-10 sm:px-10 lg:border-l lg:border-border lg:py-16">
        <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5">
          <h2 className="suma-h4 text-text-primary">Ingresa a PGCI</h2>
          <div className="space-y-2">
            <Label htmlFor="email" className="suma-label">Correo</Label>
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
            <Label htmlFor="password" className="suma-label">Contraseña</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="suma-caption text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Ingresando…" : "Ingresar"}
          </Button>
        </form>
      </section>
    </main>
  );
}
