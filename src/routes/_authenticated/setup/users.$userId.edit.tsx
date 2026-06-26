import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueries, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { UserForm, type UserFormValues } from "@/components/setup/UserForm";
import { updateUser } from "@/lib/users.functions";
import { BackLinkChrome, CreateViewShell } from "@/components/setup/CreateViewShell";

export const Route = createFileRoute("/_authenticated/setup/users/$userId/edit")({
  head: () => ({ meta: [{ title: "Editar usuario · Setup · PGCI" }] }),
  component: EditUser,
});

function EditUser() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const updateUserFn = useServerFn(updateUser);

  const [profileQ, accessQ, clientsQ] = useQueries({
    queries: [
      {
        queryKey: ["users", userId],
        queryFn: async () => {
          const { data, error } = await supabase
            .from("profiles")
            .select("*")
            .eq("user_id", userId)
            .single();
          if (error) throw error;
          return data;
        },
      },
      {
        queryKey: ["user_client_access", userId],
        queryFn: async () => {
          const { data, error } = await supabase
            .from("user_client_access")
            .select("client_id")
            .eq("user_id", userId);
          if (error) throw error;
          return (data ?? []).map((r) => r.client_id);
        },
      },
      {
        queryKey: ["clients", "active-options"],
        queryFn: async () => {
          const { data, error } = await supabase
            .from("clients")
            .select(
              "id, commercial_name, legal_name, type, status, parent_client_id, parent:parent_client_id(commercial_name, legal_name)",
            )
            .eq("status", "active")
            .order("commercial_name");
          if (error) throw error;
          return data ?? [];
        },
      },
    ],
  });

  const mutation = useMutation({
    mutationFn: (v: UserFormValues) =>
      updateUserFn({
        data: {
          user_id: userId,
          full_name: v.full_name.trim(),
          role: v.role,
          can_create_agreements: v.can_create_agreements,
          erp_user_code: v.erp_user_code.trim() || undefined,
          status: v.status,
          client_ids: v.role === "platform_user" ? v.client_ids : [],
        },
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["user_client_access", userId] });
      if (res && "access_error" in res && res.access_error) {
        toast.warning("Perfil actualizado, pero hubo un problema con los clientes.");
      } else {
        toast.success("Usuario actualizado.");
      }
      navigate({ to: "/setup/users/$userId", params: { userId } });
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo actualizar el usuario."),
  });

  const isLoading = profileQ.isLoading || accessQ.isLoading || clientsQ.isLoading;

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }
  if (!profileQ.data) {
    return <p className="text-sm text-muted-foreground">Usuario no encontrado.</p>;
  }

  const profile = profileQ.data;
  const initial: UserFormValues = {
    full_name: profile.full_name ?? "",
    email: profile.email ?? "",
    role: (profile.role as UserFormValues["role"]) || "platform_user",
    can_create_agreements: Boolean(profile.can_create_agreements),
    erp_user_code: profile.erp_user_code ?? "",
    status: (profile.status as "active" | "inactive") ?? "active",
    client_ids: accessQ.data ?? [],
  };

  return (
    <CreateViewShell
      backLink={
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 px-2 text-muted-foreground">
          <Link to="/setup/users/$userId" params={{ userId }}>
            <BackLinkChrome label="Volver al detalle" />
          </Link>
        </Button>
      }
      title="Editar usuario"
      description="Actualiza los datos del usuario y sus clientes asignados. El email no se puede modificar."
    >
      {profile.status === "inactive" && (
        <Alert variant="info" className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Este usuario está inactivo. Los cambios se guardarán, pero no podrá ingresar hasta que
            lo actives.
          </AlertDescription>
        </Alert>
      )}
      <UserForm
        initial={initial}
        emailLocked
        submitting={mutation.isPending}
        submitLabel="Guardar cambios"
        clients={clientsQ.data ?? []}
        onSubmit={async (v) => {
          await mutation.mutateAsync(v);
        }}
        onCancel={() => navigate({ to: "/setup/users/$userId", params: { userId } })}
      />
    </CreateViewShell>
  );
}
