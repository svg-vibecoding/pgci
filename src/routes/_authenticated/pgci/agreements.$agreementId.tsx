import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { getAgreement } from "@/lib/agreements.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/pgci/agreements/$agreementId")({
  head: () => ({ meta: [{ title: "Acuerdo · PGCI" }] }),
  component: AgreementDetail,
});

function AgreementDetail() {
  const { agreementId } = Route.useParams();
  const getFn = useServerFn(getAgreement);
  const { data, isLoading } = useQuery({
    queryKey: ["agreements", "detail", agreementId],
    queryFn: () => getFn({ data: { agreement_id: agreementId } }),
  });

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 px-2 text-muted-foreground">
        <Link to="/pgci/agreements">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Volver a acuerdos
        </Link>
      </Button>
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          {isLoading ? "Cargando…" : data?.name ?? "Acuerdo"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {data?.client_commercial_name || data?.client_legal_name}
        </p>
      </header>
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          La vista de detalle (líneas, miembros, importación) se construye en el siguiente paso.
        </CardContent>
      </Card>
    </div>
  );
}
