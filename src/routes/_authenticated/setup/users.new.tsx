import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserForm, emptyUser, type UserFormValues } from "@/components/setup/UserForm";
import { createUser } from "@/lib/users.functions";

export const Route = createFileRoute("/_authenticated/setup/users/new")({
  head: () => ({ meta: [{ title: "Crear usuario · Setup · PGCI" }] }),
  component: NewUser,
});

function NewUser() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const createUserFn = useServerFn(createUser);
  const [credentials, setCredentials] = useState<{
    email: string;
    full_name: string;
    temp_password: string;
    user_id: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const mutation = useMutation({
    mutationFn: (v: UserFormValues) =>
      createUserFn({
        data: {
          full_name: v.full_name.trim(),
          email: v.email.trim(),
          role: v.role as "super_admin" | "platform_user",
          can_create_agreements: v.can_create_agreements,
          erp_user_code: v.erp_user_code.trim() || undefined,
          status: v.status,
        },
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setCredentials(res);
      toast.success("Usuario creado correctamente");
    },
    onError: (err: Error) => {
      toast.error(err.message || "No se pudo crear el usuario");
    },
  });

  const copyCredentials = async () => {
    if (!credentials) return;
    const text = `Plataforma PGCI\nEmail: ${credentials.email}\nContraseña temporal: ${credentials.temp_password}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/setup/users">
          <ArrowLeft className="mr-2 h-4 w-4" /> Volver a usuarios
        </Link>
      </Button>

      <header>
        <h1 className="text-2xl font-bold tracking-tight">Crear usuario</h1>
        <p className="text-sm text-muted-foreground">
          Se generará una contraseña temporal que deberás compartir manualmente con el usuario.
        </p>
      </header>

      <UserForm
        initial={emptyUser}
        submitting={mutation.isPending}
        onSubmit={async (v) => {
          await mutation.mutateAsync(v);
        }}
        onCancel={() => navigate({ to: "/setup/users" })}
      />

      <Dialog
        open={!!credentials}
        onOpenChange={(open) => {
          if (!open && credentials) {
            const id = credentials.user_id;
            setCredentials(null);
            navigate({ to: "/setup/users/$userId", params: { userId: id } });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Usuario creado</DialogTitle>
            <DialogDescription>
              Comparte estas credenciales con {credentials?.full_name}. La contraseña no volverá
              a mostrarse.
            </DialogDescription>
          </DialogHeader>
          {credentials && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="font-medium">{credentials.email}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Contraseña temporal</p>
                <p className="font-mono text-base">{credentials.temp_password}</p>
              </div>
            </div>
          )}
          <DialogFooter className="sm:justify-between">
            <Button type="button" variant="outline" onClick={copyCredentials}>
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" /> Copiado
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" /> Copiar credenciales
                </>
              )}
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!credentials) return;
                const id = credentials.user_id;
                setCredentials(null);
                navigate({ to: "/setup/users/$userId", params: { userId: id } });
              }}
            >
              Ir al detalle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
