import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ClientForm, emptyClient, type ClientFormValues } from "@/components/setup/ClientForm";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/sumatec";
import { Badge } from "@/components/sumatec/Badge";
import { useIsSuperAdmin } from "@/hooks/use-profile";
import { toast } from "sonner";
import { ArrowLeft, Power } from "lucide-react";

export const Route = createFileRoute("/_authenticated/setup/clients/$clientId/edit")({
  head: () => ({ meta: [{ title: "Editar cliente · Setup · PGCI" }] }),
  component: EditClient,
});

function EditClient() {
  const { clientId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isSuperAdmin } = useIsSuperAdmin();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["clients", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const m = useMutation({
    mutationFn: async (v: ClientFormValues) => {
      const { error } = await supabase
        .from("clients")
        .update({
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
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      navigate({ to: "/setup/clients/$clientId", params: { clientId } });
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async (next: "active" | "inactive") => {
      const { error } = await supabase
        .from("clients")
        .update({ status: next })
        .eq("id", clientId);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(next === "active" ? "Cliente activado." : "Cliente inactivado.");
      setConfirmOpen(false);
    },
    onError: () => {
      toast.error("No fue posible cambiar el estado del cliente.");
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!data) return <p className="text-sm text-muted-foreground">No encontrado.</p>;

  const initial: ClientFormValues = {
    ...emptyClient,
    commercial_name: data.commercial_name ?? "",
    legal_name: data.legal_name ?? "",
    erp_name: data.erp_name ?? "",
    type: (data.type as "holding" | "direct") ?? "",
    status: (data.status as "active" | "inactive") ?? "active",
    tax_id: data.tax_id ?? "",
    tax_id_type: "NIT",
    notes: data.notes ?? "",
    parent_client_id: data.parent_client_id ?? null,
    belongs_to_holding: Boolean(data.parent_client_id),
  };

  const displayName = data.commercial_name?.trim() || data.legal_name;
  const isHolding = data.type === "holding";
  const isActive = data.status === "active";

  return (
    <div className="-mt-6 space-y-5">
      {/* Volver */}
      <Link
        to="/setup/clients"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver a clientes
      </Link>

      {/* Encabezado (igual al de Detalle) */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{displayName}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge color={isHolding ? "accent" : "neutral"} variant="soft">
              {isHolding ? "Holding" : "Directo"}
            </Badge>
            <StatusBadge
              status={isActive ? "active" : "neutral"}
              label={isActive ? "Activo" : "Inactivo"}
            />
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              · Editando
            </span>
          </div>
        </div>

        {isSuperAdmin && (
          <Button
            variant="outline"
            size="sm"
            disabled={toggleStatus.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            <Power className="mr-2 h-4 w-4" />
            {isActive ? "Inactivar" : "Activar"}
          </Button>
        )}
      </header>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isActive ? "¿Inactivar cliente?" : "¿Activar cliente?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isActive
                ? "El cliente pasará a estado inactivo y no podrá usarse en nuevos acuerdos hasta que se reactive."
                : "El cliente pasará a estado activo y podrá usarse en acuerdos."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggleStatus.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={toggleStatus.isPending}
              onClick={() => toggleStatus.mutate(isActive ? "inactive" : "active")}
            >
              {toggleStatus.isPending ? "Procesando…" : isActive ? "Inactivar" : "Activar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ClientForm
        initial={initial}
        submitting={m.isPending}
        excludeHoldingId={clientId}
        onSubmit={async (v) => {
          await m.mutateAsync(v);
        }}
        onCancel={() => navigate({ to: "/setup/clients/$clientId", params: { clientId } })}
      />
    </div>
  );
}
