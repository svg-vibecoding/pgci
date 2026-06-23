import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Building2, Package, Users, FileText, KeyRound, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/setup/")({
  head: () => ({ meta: [{ title: "Setup · PGCI" }] }),
  component: SetupHome,
});

function useSetupCounts() {
  return useQuery({
    queryKey: ["setup", "counts"],
    queryFn: async () => {
      const [clients, companies, productsActive, productsInactive, users, accesses] =
        await Promise.all([
          supabase.from("clients").select("*", { count: "exact", head: true }),
          supabase.from("client_companies").select("*", { count: "exact", head: true }),
          supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("status", "active"),
          supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("status", "inactive"),
          supabase
            .from("profiles")
            .select("*", { count: "exact", head: true })
            .eq("status", "active"),
          supabase.from("user_client_access").select("*", { count: "exact", head: true }),
        ]);
      return {
        clients: clients.count ?? 0,
        companies: companies.count ?? 0,
        productsActive: productsActive.count ?? 0,
        productsInactive: productsInactive.count ?? 0,
        users: users.count ?? 0,
        accesses: accesses.count ?? 0,
      };
    },
  });
}

function SetupHome() {
  const { data } = useSetupCounts();
  const cards = [
    { label: "Clientes piloto", value: `${data?.clients ?? 0} / 4`, icon: Building2 },
    { label: "Empresas registradas", value: data?.companies ?? 0, icon: Building2 },
    {
      label: "Productos PIM",
      value: `${data?.productsActive ?? 0} activos · ${data?.productsInactive ?? 0} inactivos`,
      icon: Package,
    },
    { label: "Usuarios activos", value: data?.users ?? 0, icon: Users },
    { label: "Accesos configurados", value: data?.accesses ?? 0, icon: KeyRound },
  ];

  const alerts: string[] = [];
  if ((data?.clients ?? 0) === 0)
    alerts.push("Aún no hay clientes creados. Crea los clientes piloto para continuar.");
  if ((data?.productsActive ?? 0) === 0)
    alerts.push("Aún no hay productos activos en el PIM. Impórtalos desde archivo.");

  const isEmpty = (data?.clients ?? 0) === 0 && (data?.productsActive ?? 0) === 0;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Setup Operativo</h1>
        <p className="text-sm text-muted-foreground">
          Configuración base del piloto: clientes, empresas, productos y accesos.
        </p>
      </header>

      {isEmpty && (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Aún no hay datos de Setup Operativo. Empieza creando los clientes piloto.
            </p>
            <Button asChild className="mt-4">
              <Link to="/setup/clients/new">Crear primer cliente</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {c.label}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{c.value}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {alerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-[var(--warning-strong)]" />
              Alertas de setup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {alerts.map((a) => (
                <li key={a}>• {a}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-3">
        <Button asChild variant="outline">
          <Link to="/setup/clients">
            <Building2 className="mr-2 h-4 w-4" /> Ir a Clientes
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/setup/products">
            <Package className="mr-2 h-4 w-4" /> Ir a PIM
          </Link>
        </Button>
        <Button variant="outline" disabled title="Disponible cuando se construya Usuarios (S-08)">
          <FileText className="mr-2 h-4 w-4" /> Ir a Usuarios
        </Button>
      </div>
    </div>
  );
}
