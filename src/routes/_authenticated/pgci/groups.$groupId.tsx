import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft } from "lucide-react";
import { getAgreementGroup } from "@/lib/agreements.functions";
import { AgreementGroupMembersSection } from "@/components/agreements/AgreementGroupMembersSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoField, InfoSection } from "@/components/setup/InfoSection";
import { StatusBadge, Badge } from "@/components/sumatec";
import { useIsSuperAdmin } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/pgci/groups/$groupId")({
  head: () => ({ meta: [{ title: "Agrupador · PGCI" }] }),
  component: GroupDetail,
});

function GroupDetail() {
  const { groupId } = Route.useParams();
  const getFn = useServerFn(getAgreementGroup);
  const { isSuperAdmin } = useIsSuperAdmin();

  const { data: group, isLoading } = useQuery({
    queryKey: ["agreement-groups", "detail", groupId],
    queryFn: () => getFn({ data: { group_id: groupId } }),
  });

  // Determinar si el usuario actual es agreement_group_admin.
  const { data: myRole } = useQuery({
    queryKey: ["agreement-groups", "my-role", groupId],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("agreement_group_members")
        .select("role")
        .eq("agreement_group_id", groupId)
        .eq("user_id", auth.user.id)
        .maybeSingle();
      return (data?.role as string | null) ?? null;
    },
  });

  const canAdmin = isSuperAdmin || myRole === "agreement_group_admin";

  if (isLoading || !group) {
    return <div className="text-sm text-muted-foreground">Cargando…</div>;
  }

  const isActive = group.status === "active";

  return (
    <div className="space-y-6">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 h-8 px-2 text-muted-foreground"
      >
        <Link to="/pgci/agreements">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Volver a acuerdos
        </Link>
      </Button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{group.group_name}</h1>
            <StatusBadge
              status={isActive ? "active" : "neutral"}
              label={isActive ? "Activo" : "Inactivo"}
            />
            {!group.client_id && <Badge color="accent" variant="soft">Libre</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {group.client_display_name ?? "Agrupador sin cliente asociado"}
          </p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información del agrupador</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoSection>
            <InfoField label="Nombre">{group.group_name}</InfoField>
            <InfoField label="Cliente asociado">
              {group.client_display_name ?? "—"}
            </InfoField>
            <InfoField label="NIT">{group.client_tax_id ?? "—"}</InfoField>
            <InfoField label="Estado">{isActive ? "Activo" : "Inactivo"}</InfoField>
          </InfoSection>
        </CardContent>
      </Card>

      <AgreementGroupMembersSection groupId={groupId} canAdmin={canAdmin} />
    </div>
  );
}
