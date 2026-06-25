import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { StatusBadge, Badge } from "@/components/sumatec";
import { useIsSuperAdmin } from "@/hooks/use-profile";
import {
  ArrowLeft,
  Pencil,
  Power,
  Plus,
  Trash2,
  Building2,
  Check,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/setup/users/$userId/")({
  head: () => ({ meta: [{ title: "Usuario · Setup · PGCI" }] }),
  component: UserDetail,
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm text-foreground">{children}</div>
    </div>
  );
}

const roleLabel = (r: string) =>
  r === "super_admin" ? "Super admin" : "Usuario plataforma";

function UserDetail() {
  const { userId } = Route.useParams();
  const qc = useQueryClient();
  const { isSuperAdmin } = useIsSuperAdmin();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data: user, isLoading } = useQuery({
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

  const { data: access } = useQuery({
    queryKey: ["users", userId, "access"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_client_access")
        .select("id, client_id, created_at, clients ( id, commercial_name, legal_name, type, status )")
        .eq("user_id", userId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients", "active-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, commercial_name, legal_name, type, status")
        .eq("status", "active")
        .order("commercial_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async (next: "active" | "inactive") => {
      const { error } = await supabase
        .from("profiles")
        .update({ status: next })
        .eq("user_id", userId);
      if (error) throw error;
      return next;
    },
    onSuccess: (next) => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success(next === "active" ? "Usuario activado." : "Usuario inactivado.");
      setConfirmOpen(false);
    },
    onError: () => toast.error("No fue posible cambiar el estado."),
  });

  const addAccess = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from("user_client_access")
        .insert({ user_id: userId, client_id: clientId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users", userId, "access"] });
      toast.success("Acceso asignado.");
      setPickerOpen(false);
    },
    onError: (err: Error) => {
      toast.error(err.message.includes("duplicate") ? "El usuario ya tiene acceso a este cliente." : "No se pudo asignar el acceso.");
    },
  });

  const removeAccess = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_client_access").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users", userId, "access"] });
      toast.success("Acceso removido.");
    },
    onError: () => toast.error("No se pudo remover el acceso."),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!user) return <p className="text-sm text-muted-foreground">No encontrado.</p>;

  const isActive = user.status === "active";
  const isSuper = user.role === "super_admin";
  const assignedIds = new Set((access ?? []).map((a) => a.client_id));
  const availableClients = (clients ?? []).filter((c) => !assignedIds.has(c.id));

  return (
    <div className="-mt-6 space-y-5">
      <Link
        to="/setup/users"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver a usuarios
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{user.full_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge color={isSuper ? "accent" : "neutral"} variant="soft">
              {roleLabel(user.role)}
            </Badge>
            <StatusBadge
              status={isActive ? "active" : "neutral"}
              label={isActive ? "Activo" : "Inactivo"}
            />
            {user.can_create_agreements && !isSuper && (
              <Badge color="info" variant="soft">Crea acuerdos</Badge>
            )}
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
        </div>

        {isSuperAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/setup/users/$userId/edit" params={{ userId }}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={toggleStatus.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              <Power className="mr-2 h-4 w-4" />
              {isActive ? "Inactivar" : "Activar"}
            </Button>
          </div>
        )}
      </header>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isActive ? "¿Inactivar usuario?" : "¿Activar usuario?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isActive
                ? "El usuario perderá acceso a la plataforma hasta que se reactive."
                : "El usuario podrá volver a iniciar sesión en la plataforma."}
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Clientes asignados
          </p>
          <p className="mt-1 text-xl font-semibold text-foreground">
            {isSuper ? "Todos" : access?.length ?? 0}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Rol
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">{roleLabel(user.role)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Creado
          </p>
          <p className="mt-1 text-sm text-foreground">
            {new Date(user.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información general</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nombre completo">{user.full_name}</Field>
          <Field label="Email">{user.email}</Field>
          <Field label="Rol">{roleLabel(user.role)}</Field>
          <Field label="Código ERP">{user.erp_user_code || "—"}</Field>
          <Field label="Puede crear acuerdos">
            {isSuper ? "Implícito (super admin)" : user.can_create_agreements ? "Sí" : "No"}
          </Field>
          <Field label="Estado">
            <StatusBadge
              status={isActive ? "active" : "neutral"}
              label={isActive ? "Activo" : "Inactivo"}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base">Accesos a clientes</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              {isSuper
                ? "Los super admins tienen acceso implícito a todos los clientes."
                : "Clientes a los que este usuario puede acceder en la plataforma."}
            </p>
          </div>
          {isSuperAdmin && !isSuper && (
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="outline" disabled={availableClients.length === 0}>
                  <Plus className="mr-2 h-4 w-4" /> Asignar cliente
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[320px] p-0" align="end">
                <Command>
                  <CommandInput placeholder="Buscar cliente…" />
                  <CommandList>
                    <CommandEmpty>Sin resultados.</CommandEmpty>
                    <CommandGroup>
                      {availableClients.map((c) => {
                        const name = c.commercial_name?.trim() || c.legal_name;
                        return (
                          <CommandItem
                            key={c.id}
                            value={name}
                            onSelect={() => addAccess.mutate(c.id)}
                            disabled={addAccess.isPending}
                          >
                            <Check className="mr-2 h-4 w-4 opacity-0" />
                            <span className="flex-1 truncate">{name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {c.type === "holding" ? "Holding" : "Directo"}
                            </span>
                          </CommandItem>
                        );
                      })}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </CardHeader>
        <CardContent>
          {isSuper ? (
            <p className="text-sm text-muted-foreground">
              Sin asignaciones manuales. El acceso se otorga por el rol.
            </p>
          ) : !access || access.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-8 text-center">
              <Building2 className="mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">Sin clientes asignados.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isSuperAdmin
                  ? "Asigna clientes para habilitar el acceso a sus acuerdos."
                  : "Aún no tiene acceso a clientes."}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {access.map((a) => {
                const c = a.clients;
                const name = c?.commercial_name?.trim() || c?.legal_name || "—";
                return (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex items-center gap-2">
                      {c ? (
                        <Link
                          to="/setup/clients/$clientId"
                          params={{ clientId: c.id }}
                          className="truncate font-medium hover:underline"
                        >
                          {name}
                        </Link>
                      ) : (
                        <span className="truncate font-medium">{name}</span>
                      )}
                      {c?.type === "holding" && (
                        <Badge color="accent" variant="soft">Holding</Badge>
                      )}
                      {c?.status === "inactive" && (
                        <Badge color="neutral" variant="soft">Inactivo</Badge>
                      )}
                    </div>
                    {isSuperAdmin && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={removeAccess.isPending}
                        onClick={() => removeAccess.mutate(a.id)}
                      >
                        <Trash2 className="mr-1.5 h-4 w-4" /> Remover
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
