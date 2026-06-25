import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { UserForm, type UserFormValues } from "@/components/setup/UserForm";

export const Route = createFileRoute("/_authenticated/setup/users/$userId/edit")({
  head: () => ({ meta: [{ title: "Editar usuario · Setup · PGCI" }] }),
  component: EditUser,
});

function EditUser() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
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

  const update = useMutation({
    mutationFn: async (v: UserFormValues) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: v.full_name.trim(),
          role: v.role || "platform_user",
          status: v.status,
          can_create_agreements: v.role === "platform_user" ? v.can_create_agreements : false,
          erp_user_code: v.erp_user_code.trim() || null,
        })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Usuario actualizado.");
      navigate({ to: "/setup/users/$userId", params: { userId } });
    },
    onError: (err: Error) => toast.error(err.message || "No se pudo actualizar el usuario."),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!data) return <p className="text-sm text-muted-foreground">No encontrado.</p>;

  const initial: UserFormValues = {
    full_name: data.full_name ?? "",
    email: data.email ?? "",
    role: (data.role as UserFormValues["role"]) || "platform_user",
    can_create_agreements: Boolean(data.can_create_agreements),
    erp_user_code: data.erp_user_code ?? "",
    status: (data.status as "active" | "inactive") ?? "active",
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/setup/users/$userId" params={{ userId }}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver al detalle
        </Link>
      </Button>

      <header>
        <h1 className="text-2xl font-bold tracking-tight">Editar usuario</h1>
        <p className="text-sm text-muted-foreground">
          Los cambios se aplican inmediatamente. El email no se puede modificar.
        </p>
      </header>

      <UserForm
        initial={initial}
        emailLocked
        submitting={update.isPending}
        submitLabel="Guardar cambios"
        onSubmit={async (v) => {
          await update.mutateAsync(v);
        }}
        onCancel={() => navigate({ to: "/setup/users/$userId", params: { userId } })}
      />
    </div>
  );
}
