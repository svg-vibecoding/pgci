import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ClientForm, emptyClient, type ClientFormValues } from "@/components/setup/ClientForm";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BackLinkChrome, CreateViewShell } from "@/components/setup/CreateViewShell";

export const Route = createFileRoute("/_authenticated/setup/clients/$clientId/edit")({
  head: () => ({ meta: [{ title: "Editar cliente · Setup · PGCI" }] }),
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
      navigate({ to: "/setup/clients/$clientId", params: { clientId } });
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
    <CreateViewShell
      backLink={
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 px-2 text-muted-foreground">
          <Link to="/setup/clients/$clientId" params={{ clientId }}>
            <BackLinkChrome label="Volver al detalle" />
          </Link>
        </Button>
      }
      title="Editar cliente"
      description="Actualiza los datos del cliente. El tipo y la relación con holding pueden modificarse."
    >
      {data.status === "inactive" && (
        <Alert variant="info" className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Este cliente está inactivo. Los cambios se guardarán, pero no aparecerá en selectores
            hasta que lo actives.
          </AlertDescription>
        </Alert>
      )}
      <ClientForm
        initial={initial}
        submitting={m.isPending}
        excludeHoldingId={clientId}
        onSubmit={async (v) => {
          await m.mutateAsync(v);
        }}
        onCancel={() => navigate({ to: "/setup/clients/$clientId", params: { clientId } })}
      />
    </CreateViewShell>
  );
}
