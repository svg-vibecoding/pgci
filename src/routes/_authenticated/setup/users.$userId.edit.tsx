import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

  const profileQ = useQuery({
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
  });

  const mutation = useMutation({
    mutationFn: (v: UserFormValues) =>
      updateUserFn({
        data: {
          user_id: userId,
          full_name: v.full_name.trim(),
          role: v.role,
          erp_user_code: v.erp_user_code.trim() || undefined,
          status: v.status,
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Usuario actualizado.");
      navigate({ to: "/setup/users/$userId", params: { userId } });
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo actualizar el usuario."),
  });

  if (profileQ.isLoading) {
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
    erp_user_code: profile.erp_user_code ?? "",
    status: (profile.status as "active" | "inactive") ?? "active",
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
      description="Actualiza los datos del usuario. El email no se puede modificar."
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
        onSubmit={async (v) => {
          await mutation.mutateAsync(v);
        }}
        onCancel={() => navigate({ to: "/setup/users/$userId", params: { userId } })}
      />
    </CreateViewShell>
  );
}
