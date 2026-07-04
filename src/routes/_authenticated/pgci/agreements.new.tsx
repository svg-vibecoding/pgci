import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createAgreement,
  listAssignableClients,
  listAssignableGroups,
} from "@/lib/agreements.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  AgreementForm,
  emptyAgreement,
  type AgreementFormValues,
} from "@/components/agreements/AgreementForm";
import { BackLinkChrome, CreateViewShell } from "@/components/setup/CreateViewShell";
import { Button } from "@/components/ui/button";

const searchSchema = z.object({
  client: z.string().uuid().optional(),
});

export const Route = createFileRoute("/_authenticated/pgci/agreements/new")({
  head: () => ({ meta: [{ title: "Nuevo acuerdo · PGCI" }] }),
  validateSearch: searchSchema,
  component: NewAgreement,
});

function NewAgreement() {
  const navigate = useNavigate();
  const { client } = Route.useSearch();
  const listClientsFn = useServerFn(listAssignableClients);
  const listGroupsFn = useServerFn(listAssignableGroups);
  const createFn = useServerFn(createAgreement);

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["agreements", "assignable-clients"],
    queryFn: () => listClientsFn(),
  });

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ["agreements", "assignable-groups"],
    queryFn: () => listGroupsFn(),
  });

  const { data: canCreateGroups } = useQuery({
    queryKey: ["rpc", "can_create_agreement_groups"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_create_agreement_groups");
      if (error) throw error;
      return !!data;
    },
  });

  const m = useMutation({
    mutationFn: (v: AgreementFormValues) => {
      const base = {
        name: v.name,
        scope: v.scope,
        unit_name: v.scope === "unit" ? v.unit_name : undefined,
        start_date: v.start_date || undefined,
        end_date: v.end_date || undefined,
        observations: v.observations || undefined,
      };
      return createFn({
        data: {
          ...base,
          group_id: v.group_mode === "existing" ? v.group_id : undefined,
          group_name: v.group_mode === "new" ? v.group_name : undefined,
          group_observations:
            v.group_mode === "new" ? v.group_observations || undefined : undefined,
          client_id: v.company_mode === "single" ? v.client_id : undefined,
          company_ids: v.company_mode === "multi" ? v.company_ids : [],
        },
      });
    },
    onSuccess: (res) =>
      navigate({
        to: "/pgci/agreements/$agreementId",
        params: { agreementId: res.agreement_id },
      }),
  });

  const initial: AgreementFormValues = client
    ? {
        ...emptyAgreement,
        company_mode: "multi",
        company_ids: [client],
      }
    : emptyAgreement;

  return (
    <CreateViewShell
      backLink={
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 px-2 text-muted-foreground">
          <Link to="/pgci/agreements">
            <BackLinkChrome label="Volver a acuerdos" />
          </Link>
        </Button>
      }
      title="Crear acuerdo"
      description="Registra la información general del acuerdo."
    >
      <AgreementForm
        initial={initial}
        clients={clients ?? []}
        clientsLoading={clientsLoading}
        groups={groups ?? []}
        groupsLoading={groupsLoading}
        canCreateGroups={!!canCreateGroups}
        submitting={m.isPending}
        
        onSubmit={async (v) => {
          await m.mutateAsync(v);
        }}
        onCancel={() => navigate({ to: "/pgci/agreements" })}
      />
    </CreateViewShell>
  );
}
