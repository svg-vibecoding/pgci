import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAgreement, listAgreementMembers } from "@/lib/agreements.functions";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "@/components/sumatec";

interface AgreementHeaderProps {
  agreementId: string;
}

export function AgreementHeader({ agreementId }: AgreementHeaderProps) {
  const getFn = useServerFn(getAgreement);
  const membersFn = useServerFn(listAgreementMembers);

  const { data: agreement, isLoading: loadingAgreement } = useQuery({
    queryKey: ["agreements", "detail", agreementId],
    queryFn: () => getFn({ data: { agreement_id: agreementId } }),
  });

  const { data: members } = useQuery({
    queryKey: ["agreements", "members", agreementId],
    queryFn: () => membersFn({ data: { agreement_id: agreementId } }),
  });

  const { data: companiesCount } = useQuery({
    queryKey: ["agreements", "companies-count", agreementId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("agreement_companies")
        .select("id", { count: "exact", head: true })
        .eq("agreement_id", agreementId)
        .is("valid_until", null);
      if (error) throw error;
      return count ?? 0;
    },
  });

  if (loadingAgreement || !agreement) {
    return <div className="h-16 animate-pulse rounded-md bg-muted" />;
  }

  const isActive = agreement.status === "active";
  const total = agreement.lines_total ?? 0;
  const memberCount = members?.length ?? 0;
  const companyCount = companiesCount ?? 0;

  return (
    <div className="min-w-0">
      <h1 className="suma-h1">{agreement.name}</h1>
      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 suma-caption">

        <StatusBadge
          status={isActive ? "active" : "neutral"}
          label={isActive ? "Activo" : "Inactivo"}
        />
        <span>
          {`${companyCount} ${companyCount === 1 ? "cliente cubierto" : "clientes cubiertos"}`}
          {` · ${memberCount} ${memberCount === 1 ? "miembro" : "miembros"}`}
          {` · ${total} ${total === 1 ? "posición" : "posiciones"}`}
        </span>
      </div>
    </div>
  );
}
