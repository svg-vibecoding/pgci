import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  createAgreement,
  listAssignableClients,
} from "@/lib/agreements.functions";
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
  const createFn = useServerFn(createAgreement);

  const { data: clients, isLoading: clientsLoading } = useQuery({
    queryKey: ["agreements", "assignable-clients"],
    queryFn: () => listClientsFn(),
  });

  const m = useMutation({
    mutationFn: (v: AgreementFormValues) =>
      createFn({
        data: {
          client_id: v.client_id,
          name: v.name,
          scope: v.scope,
          unit_name: v.scope === "unit" ? v.unit_name : undefined,
          start_date: v.start_date || undefined,
          end_date: v.end_date || undefined,
          observations: v.observations || undefined,
        },
      }),
    onSuccess: (res) =>
      navigate({
        to: "/pgci/agreements/$agreementId",
        params: { agreementId: res.agreement_id },
      }),
  });

  const initial: AgreementFormValues = client
    ? { ...emptyAgreement, client_id: client }
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
      description="Registra un nuevo acuerdo comercial. Después podrás cargar productos y precios."
    >
      <AgreementForm
        initial={initial}
        clients={clients ?? []}
        clientsLoading={clientsLoading}
        submitting={m.isPending}
        lockClient={Boolean(client)}
        onSubmit={async (v) => {
          await m.mutateAsync(v);
        }}
        onCancel={() => navigate({ to: "/pgci/agreements" })}
      />
    </CreateViewShell>
  );
}
