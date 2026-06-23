import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClientForm, emptyClient, type ClientFormValues } from "@/components/setup/ClientForm";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/setup/clients/$clientId")({
  head: () => ({ meta: [{ title: "Cliente · Setup · PGCI" }] }),
  component: EditClient,
});

function EditClient() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["clients", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: agreementCount } = useQuery({
    queryKey: ["clients", clientId, "agreements-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("agreements")
        .select("*", { count: "exact", head: true })
        .eq("client_id", clientId);
      return count ?? 0;
    },
  });

  const m = useMutation({
    mutationFn: async (v: ClientFormValues) => {
      const { error } = await supabase
        .from("clients")
        .update({
          commercial_name: v.commercial_name.trim() || null,
          legal_name: v.legal_name.trim(),
          erp_name: v.erp_name.trim() || null,
          type: v.type as "holding" | "direct",
          status: v.status,
          tax_id: v.tax_id.trim(),
          tax_id_type: "NIT",
          notes: v.notes.trim() || null,
          parent_client_id: v.parent_client_id,
        })
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      navigate({ to: "/setup/clients" });
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!data) return <p className="text-sm text-muted-foreground">No encontrado.</p>;

  const initial: ClientFormValues = {
    ...emptyClient,
    commercial_name: data.commercial_name ?? "",
    legal_name: data.legal_name ?? "",
    erp_name: data.erp_name ?? "",
    type: (data.type as "holding" | "direct") ?? "",
    status: (data.status as "active" | "inactive") ?? "active",
    tax_id: data.tax_id ?? "",
    tax_id_type: "NIT",
    notes: data.notes ?? "",
    parent_client_id: data.parent_client_id ?? null,
    belongs_to_holding: Boolean(data.parent_client_id),
  };


  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{data.commercial_name}</h1>
        <p className="text-sm text-muted-foreground">Editar cliente</p>
      </header>

      <ClientForm
        initial={initial}
        submitting={m.isPending}
        excludeHoldingId={clientId}
        onSubmit={async (v) => {
          await m.mutateAsync(v);
        }}
        onCancel={() => navigate({ to: "/setup/clients" })}
      />

      {data.type === "holding" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Empresas del cliente</CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link to="/setup/clients/$clientId/companies" params={{ clientId }}>
                <Building2 className="mr-2 h-4 w-4" /> Gestionar empresas
              </Link>
            </Button>
          </CardHeader>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acuerdos asociados</CardTitle>
        </CardHeader>
        <CardContent>
          {agreementCount && agreementCount > 0 ? (
            <p className="text-sm text-muted-foreground">
              Este cliente tiene {agreementCount} acuerdo(s) asociado(s).
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Este cliente todavía no tiene acuerdos. Los acuerdos se crean desde el módulo de
              Acuerdos.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
