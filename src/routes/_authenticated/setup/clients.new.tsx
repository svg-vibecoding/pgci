import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { ClientForm, emptyClient, type ClientFormValues } from "@/components/setup/ClientForm";
import { BackLinkChrome, CreateViewShell } from "@/components/setup/CreateViewShell";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({
  parent: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/setup/clients/new")({
  head: () => ({ meta: [{ title: "Nuevo cliente · Setup · PGCI" }] }),
  validateSearch: searchSchema,
  component: NewClient,
});

function NewClient() {
  const navigate = useNavigate();
  const { parent } = Route.useSearch();

  const { data: parentClient } = useQuery({
    queryKey: ["clients", "parent-prefill", parent ?? null],
    enabled: Boolean(parent),
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, commercial_name, legal_name")
        .eq("id", parent!)
        .maybeSingle();
      return data;
    },
  });

  const m = useMutation({
    mutationFn: async (v: ClientFormValues) => {
      const { data, error } = await supabase
        .from("clients")
        .insert({
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
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (d) =>
      navigate({ to: "/setup/clients/$clientId", params: { clientId: d.id } }),
  });

  const initial: ClientFormValues = parent
    ? {
        ...emptyClient,
        type: "direct",
        belongs_to_holding: true,
        parent_client_id: parent,
      }
    : emptyClient;

  const backLink = parent ? (
    <BackLink to="/setup/clients/$clientId" params={{ clientId: parent }} label="Volver al holding" />
  ) : (
    <BackLink to="/setup/clients" label="Volver a clientes" />
  );

  return (
    <CreateViewShell
      backLink={backLink}
      title="Crear cliente"
      description={
        parentClient
          ? `Registra una nueva empresa asociada a ${parentClient.commercial_name?.trim() || parentClient.legal_name}.`
          : "Registra clientes tipo holding o directos, como base para acuerdos, accesos y operación comercial."
      }
    >
      <ClientForm
        initial={initial}
        submitting={m.isPending}
        submitLabel="Crear cliente"
        onSubmit={async (v) => {
          await m.mutateAsync(v);
        }}
        onCancel={() =>
          parent
            ? navigate({ to: "/setup/clients/$clientId", params: { clientId: parent } })
            : navigate({ to: "/setup/clients" })
        }
      />
    </CreateViewShell>
  );
}
