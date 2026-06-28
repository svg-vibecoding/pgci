import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  getAgreement,
  updateAgreement,
} from "@/lib/agreements.functions";
import {
  AgreementForm,
  type AgreementFormValues,
} from "@/components/agreements/AgreementForm";
import { BackLinkChrome, CreateViewShell } from "@/components/setup/CreateViewShell";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/pgci/agreements/$agreementId/edit")({
  head: () => ({ meta: [{ title: "Editar acuerdo · PGCI" }] }),
  component: EditAgreement,
});

function EditAgreement() {
  const { agreementId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const getFn = useServerFn(getAgreement);
  const updateFn = useServerFn(updateAgreement);

  const { data: agreement, isLoading } = useQuery({
    queryKey: ["agreements", "detail", agreementId],
    queryFn: () => getFn({ data: { agreement_id: agreementId } }),
  });

  const m = useMutation({
    mutationFn: (v: AgreementFormValues) =>
      updateFn({
        data: {
          agreement_id: agreementId,
          patch: {
            name: v.name,
            scope: v.scope,
            unit_name: v.scope === "unit" ? v.unit_name : null,
            start_date: v.start_date || undefined,
            end_date: v.end_date || undefined,
            observations: v.observations || undefined,
          },
        },
      }),
    onSuccess: () => {
      toast.success("Acuerdo actualizado");
      qc.invalidateQueries({ queryKey: ["agreements"] });
      navigate({
        to: "/pgci/agreements/$agreementId",
        params: { agreementId },
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const backLink = (
    <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 px-2 text-muted-foreground">
      <Link to="/pgci/agreements/$agreementId" params={{ agreementId }}>
        <BackLinkChrome label="Volver al acuerdo" />
      </Link>
    </Button>
  );

  if (isLoading || !agreement) {
    return (
      <CreateViewShell backLink={backLink} title="Editar acuerdo">
        <p className="text-sm text-muted-foreground">Cargando…</p>
      </CreateViewShell>
    );
  }

  const initial: AgreementFormValues = {
    client_id: (agreement.client_id as string) ?? "",
    name: agreement.name ?? "",
    scope: (agreement.scope as "global" | "unit") ?? "global",
    unit_name: agreement.unit_name ?? "",
    start_date: agreement.start_date ?? "",
    end_date: agreement.end_date ?? "",
    observations: agreement.observations ?? "",
  };

  const clientStub = [
    {
      id: (agreement.client_id as string) ?? "",
      legal_name: agreement.client_legal_name ?? "",
      commercial_name: agreement.client_commercial_name ?? null,
    },
  ];

  return (
    <CreateViewShell
      backLink={backLink}
      title="Editar acuerdo"
      description="Modifica el nombre, alcance, vigencia u observaciones del acuerdo. El cliente no puede cambiarse."
    >
      <AgreementForm
        initial={initial}
        clients={clientStub}
        lockClient
        submitting={m.isPending}
        submitLabel="Guardar cambios"
        onSubmit={async (v) => {
          await m.mutateAsync(v);
        }}
        onCancel={() =>
          navigate({
            to: "/pgci/agreements/$agreementId",
            params: { agreementId },
          })
        }
      />
    </CreateViewShell>
  );
}
