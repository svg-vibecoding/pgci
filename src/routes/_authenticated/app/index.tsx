import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile } from "@/hooks/use-profile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info, Users } from "lucide-react";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "Inicio · PGCI" }] }),
  component: AppHome,
});

function AppHome() {
  const { data: profile } = useMyProfile();
  const { data: clientCount, isLoading } = useQuery({
    queryKey: ["my-client-access-count"],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return 0;
      const { count, error } = await supabase
        .from("user_client_access")
        .select("client_id", { count: "exact", head: true })
        .eq("user_id", auth.user.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-[var(--text-primary)]">
          Hola{firstName ? `, ${firstName}` : ""}
        </h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Te damos la bienvenida a la PGCI.
        </p>
      </div>

      <Alert variant="info">
        <Info className="h-4 w-4" />
        <AlertTitle>La plataforma está en configuración</AlertTitle>
        <AlertDescription>
          El equipo administrador está terminando de configurar el acceso y los acuerdos
          comerciales. Pronto verás aquí las funcionalidades disponibles para tu operación.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-[var(--text-tertiary)]" />
            Tu acceso
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-[var(--text-secondary)]">Cargando…</p>
          ) : (clientCount ?? 0) === 0 ? (
            <div>
              <p className="text-sm text-[var(--text-primary)]">
                Aún no tienes clientes asignados.
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                El administrador configurará tu acceso próximamente.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
                {clientCount} {clientCount === 1 ? "cliente asignado" : "clientes asignados"}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Pronto podrás consultar los acuerdos comerciales asociados.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
