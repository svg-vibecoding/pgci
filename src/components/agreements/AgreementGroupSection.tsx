import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { ArrowRight, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/sumatec";
import {
  AgreementGroupPicker,
  type AgreementGroupValue,
  type AssignableGroup,
} from "./AgreementGroupPicker";
import {
  assignAgreementToGroup,
  getAgreementGroupSummary,
  listAssignableGroups,
} from "@/lib/agreements.functions";
import { supabase } from "@/integrations/supabase/client";

const emptyPickerValue: AgreementGroupValue = {
  group_mode: "none",
  group_id: "",
  group_name: "",
  group_observations: "",
};

/**
 * Sección "Agrupador" del detalle de un acuerdo.
 * - Con agrupador → resumen para cualquier usuario con acceso.
 * - Sin agrupador + editor → acordeón (mismo que en creación) + Confirmar.
 * - Sin agrupador + solo consulta → texto plano informativo.
 */
export function AgreementGroupSection({
  agreementId,
  groupId,
  canAdmin,
}: {
  agreementId: string;
  groupId: string | null;
  canAdmin: boolean;
}) {
  if (groupId) {
    return <GroupedSummary groupId={groupId} currentAgreementId={agreementId} />;
  }
  return <UngroupedSection agreementId={agreementId} canAdmin={canAdmin} />;
}

function GroupedSummary({
  groupId,
  currentAgreementId,
}: {
  groupId: string;
  currentAgreementId: string;
}) {
  const fn = useServerFn(getAgreementGroupSummary);
  const { data, isLoading } = useQuery({
    queryKey: ["agreement-group-summary", groupId],
    queryFn: () => fn({ data: { group_id: groupId } }),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Agrupador</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-base font-semibold truncate">
                  {data.group_name}
                </span>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/pgci/groups/$groupId" params={{ groupId }}>
                  Ver agrupador <ArrowRight className="ml-1.5 h-4 w-4" />
                </Link>
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              {data.agreements.length}{" "}
              {data.agreements.length === 1 ? "acuerdo" : "acuerdos"} · {data.unique_clients}{" "}
              {data.unique_clients === 1 ? "cliente único" : "clientes únicos"} ·{" "}
              {data.total_lines}{" "}
              {data.total_lines === 1 ? "posición" : "posiciones"} en total
            </p>

            {data.agreements.length > 1 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Otros acuerdos del agrupador
                </p>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {data.agreements
                    .filter((a) => a.id !== currentAgreementId)
                    .map((a) => (
                      <li key={a.id}>
                        <Link
                          to="/pgci/agreements/$agreementId"
                          params={{ agreementId: a.id }}
                          className="flex items-center justify-between gap-3 px-3 py-2 text-sm hover:bg-muted/40"
                        >
                          <span className="flex items-center gap-2 min-w-0">
                            <span className="truncate font-medium">{a.name}</span>
                            <StatusBadge
                              status={a.status === "active" ? "active" : "neutral"}
                              label={a.status === "active" ? "Activo" : "Inactivo"}
                            />
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {a.lines_total}{" "}
                            {a.lines_total === 1 ? "posición" : "posiciones"}
                          </span>
                        </Link>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function UngroupedSection({
  agreementId,
  canAdmin,
}: {
  agreementId: string;
  canAdmin: boolean;
}) {
  const qc = useQueryClient();
  const [value, setValue] = useState<AgreementGroupValue>(emptyPickerValue);
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<{ group_id?: string; group_name?: string }>({});

  const groupsFn = useServerFn(listAssignableGroups);
  const assignFn = useServerFn(assignAgreementToGroup);

  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ["agreements", "assignable-groups"],
    queryFn: () => groupsFn(),
    enabled: canAdmin,
  });

  const { data: canCreateGroups } = useQuery({
    queryKey: ["rpc", "can_create_agreement_groups"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("can_create_agreement_groups");
      if (error) throw error;
      return !!data;
    },
    enabled: canAdmin,
  });

  const assign = useMutation({
    mutationFn: () =>
      assignFn({
        data: {
          agreement_id: agreementId,
          group_id: value.group_mode === "existing" ? value.group_id : undefined,
          group_name: value.group_mode === "new" ? value.group_name : undefined,
          group_observations:
            value.group_mode === "new" ? value.group_observations : undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Acuerdo agrupado");
      qc.invalidateQueries({ queryKey: ["agreements", "detail", agreementId] });
      qc.invalidateQueries({ queryKey: ["agreements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!canAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agrupador</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Este acuerdo no pertenece a ningún agrupador.
          </p>
        </CardContent>
      </Card>
    );
  }

  const canConfirm =
    (value.group_mode === "existing" && !!value.group_id) ||
    (value.group_mode === "new" && !!value.group_name.trim());

  const handleConfirm = () => {
    const next: { group_id?: string; group_name?: string } = {};
    if (value.group_mode === "existing" && !value.group_id)
      next.group_id = "Selecciona un agrupador.";
    if (value.group_mode === "new" && !value.group_name.trim())
      next.group_name = "Indica el nombre del agrupador.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    assign.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Agrupador</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <AgreementGroupPicker
          value={value}
          onChange={setValue}
          open={open}
          onOpenChange={setOpen}
          canCreateGroups={!!canCreateGroups}
          groups={groups as AssignableGroup[] | undefined}
          groupsLoading={groupsLoading}
          errors={errors}
        />

        {value.group_mode !== "none" && (
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={!canConfirm || assign.isPending}
            >
              {assign.isPending ? "Guardando…" : "Confirmar agrupación"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
