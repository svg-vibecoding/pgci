import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/sumatec";
import { getAgreement, getAgreementContext } from "@/lib/agreements.functions";
import { AgreementLinesSection } from "@/components/agreements/AgreementLinesSection";
import { AgreementImportWizard } from "@/components/agreements/AgreementImportWizard";

export const Route = createFileRoute(
  "/_authenticated/pgci/agreements/$agreementId/lines",
)({
  head: () => ({ meta: [{ title: "Líneas del acuerdo · PGCI" }] }),
  component: AgreementLinesPage,
});

function AgreementLinesPage() {
  const { agreementId } = Route.useParams();
  const getFn = useServerFn(getAgreement);
  const ctxFn = useServerFn(getAgreementContext);

  const { data: agreement, isLoading } = useQuery({
    queryKey: ["agreements", "detail", agreementId],
    queryFn: () => getFn({ data: { agreement_id: agreementId } }),
  });
  const { data: ctx } = useQuery({
    queryKey: ["agreements", "ctx", agreementId],
    queryFn: () => ctxFn({ data: { agreement_id: agreementId } }),
  });

  const [importOpen, setImportOpen] = useState(false);

  if (isLoading || !agreement) {
    return <div className="text-sm text-muted-foreground">Cargando…</div>;
  }

  const canAdmin = !!ctx?.can_admin;
  const isActive = agreement.status === "active";
  const clientName =
    agreement.client_commercial_name?.trim() ||
    agreement.client_legal_name ||
    "—";

  return (
    <div className="space-y-6">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 h-8 px-2 text-muted-foreground"
      >
        <Link
          to="/pgci/agreements/$agreementId"
          params={{ agreementId }}
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Volver al acuerdo
        </Link>
      </Button>

      <header className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">
            {agreement.name}
          </h1>
          <StatusBadge
            status={isActive ? "active" : "neutral"}
            label={isActive ? "Activo" : "Inactivo"}
          />
          {agreement.scope === "unit" && <Badge color="info">Con alcance</Badge>}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Gestión de productos · {clientName}
          {agreement.scope === "unit" && agreement.unit_name && (
            <> · {agreement.unit_name}</>
          )}
        </p>
      </header>

      <AgreementLinesSection
        agreementId={agreementId}
        agreementName={agreement.name as string}
        canAdmin={canAdmin}
        onOpenImport={() => setImportOpen(true)}
      />

      <AgreementImportWizard
        open={importOpen}
        onOpenChange={setImportOpen}
        agreementId={agreementId}
      />
    </div>
  );
}
