import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
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
import { BackLinkChrome, CreateViewShell } from "@/components/setup/CreateViewShell";

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
    mutationFn: async (v: UserFormValues) => {
      const res = await createUserFn({
        data: {
          full_name: v.full_name.trim(),
          email: v.email.trim(),
          role: v.role,
          erp_user_code: v.erp_user_code.trim() || undefined,
          status: v.status,
          can_create_agreement_groups: v.can_create_agreement_groups,
        },
      });
      if ("error" in res) throw new Error(res.error);
      return res;
    },
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
    let ok = false;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.top = "0";
        ta.style.left = "0";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopied(true);
      toast.success("Credenciales copiadas en tu portapapeles");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("No se pudieron copiar las credenciales");
    }
  };

  return (
    <>
    <CreateViewShell
      backLink={
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 px-2 text-muted-foreground">
          <Link to="/setup/users">
            <BackLinkChrome label="Volver a usuarios" />
          </Link>
        </Button>
      }
      title="Crear usuario"
    >
      <UserForm
        initial={emptyUser}
        submitting={mutation.isPending}
        submitLabel="Crear usuario"
        onSubmit={async (v) => {
          await mutation.mutateAsync(v);
        }}
        onCancel={() => navigate({ to: "/setup/users" })}
      />
    </CreateViewShell>

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
              Guarda las credenciales de acceso para compartir con{" "}
              {credentials?.full_name}. La contraseña no volverá a mostrarse.
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
          <DialogFooter className="flex-col gap-3 sm:flex-col">
            <Button
              type="button"
              variant="outline"
              onClick={copyCredentials}
              className="w-full"
            >
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
            <div className="flex w-full items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  if (!credentials) return;
                  const id = credentials.user_id;
                  setCredentials(null);
                  navigate({ to: "/setup/users/$userId", params: { userId: id } });
                }}
              >
                Ir al detalle
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!credentials) return;
                  const id = credentials.user_id;
                  setCredentials(null);
                  navigate({
                    to: "/setup/users/$userId/client-access",
                    params: { userId: id },
                  });
                }}
              >
                Clientes y permisos
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
