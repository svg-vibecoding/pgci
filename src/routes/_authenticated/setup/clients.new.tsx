import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ClientForm, emptyClient, type ClientFormValues } from "@/components/setup/ClientForm";

export const Route = createFileRoute("/_authenticated/setup/clients/new")({
  head: () => ({ meta: [{ title: "Nuevo cliente · Setup · PGCI" }] }),
  component: NewClient,
});

function NewClient() {
  const navigate = useNavigate();
  const m = useMutation({
    mutationFn: async (v: ClientFormValues) => {
      const isDirect = v.type === "direct";
      const { data, error } = await supabase
        .from("clients")
        .insert({
          commercial_name: v.commercial_name.trim() || null,
          legal_name: v.legal_name.trim(),
          erp_name: v.erp_name.trim() || null,
          type: v.type as "holding" | "direct",
          status: v.status,
          tax_id: isDirect ? v.tax_id.trim() : null,
          tax_id_type: isDirect ? v.tax_id_type : null,
          notes: v.notes.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },

    onSuccess: (d) => navigate({ to: "/setup/clients/$clientId", params: { clientId: d.id } }),
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Nuevo cliente</h1>
        <p className="text-sm text-muted-foreground">
          Registra un cliente piloto del programa.
        </p>
      </header>
      <ClientForm
        initial={emptyClient}
        submitting={m.isPending}
        onSubmit={async (v) => {
          await m.mutateAsync(v);
        }}
        onCancel={() => navigate({ to: "/setup/clients" })}
      />
    </div>
  );
}
