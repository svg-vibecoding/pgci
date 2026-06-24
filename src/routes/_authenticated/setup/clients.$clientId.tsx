import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/sumatec";
import { Badge } from "@/components/sumatec/Badge";
import { useIsSuperAdmin } from "@/hooks/use-profile";
import { toast } from "sonner";
import { ArrowLeft, Building2, Pencil, Power, FileText, Users } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/setup/clients/$clientId")({
  head: () => ({ meta: [{ title: "Cliente · Setup · PGCI" }] }),
  component: ViewClient,
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

function ViewClient() {
  const { clientId } = Route.useParams();
  const qc = useQueryClient();
  const { isSuperAdmin } = useIsSuperAdmin();

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

  const { data: parent } = useQuery({
    queryKey: ["clients", "parent", data?.parent_client_id ?? null],
    enabled: Boolean(data?.parent_client_id),
    queryFn: async () => {
      const { data: p } = await supabase
        .from("clients")
        .select("id, commercial_name, legal_name")
        .eq("id", data!.parent_client_id!)
        .maybeSingle();
      return p;
    },
  });

  const { data: children } = useQuery({
    queryKey: ["clients", "children", clientId],
    enabled: data?.type === "holding",
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from("clients")
        .select("id, commercial_name, legal_name, tax_id, status")
        .eq("parent_client_id", clientId)
        .order("commercial_name");
      if (error) throw error;
      return rows ?? [];
    },
  });

  const { data: agreements } = useQuery({
    queryKey: ["clients", clientId, "agreements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreements")
        .select("id, updated_at, created_at")
        .eq("client_id", clientId)
        .order("updated_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data ?? [];
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async (next: "active" | "inactive") => {
      const { error } = await supabase
        .from("clients")
        .update({ status: next })
        .eq("id", clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!data) return <p className="text-sm text-muted-foreground">No encontrado.</p>;

  const displayName = data.commercial_name?.trim() || data.legal_name;
  const isHolding = data.type === "holding";
  const isActive = data.status === "active";
  const parentName = parent?.commercial_name?.trim() || parent?.legal_name;

  return (
    <div className="-mt-6 space-y-5">
      {/* Volver */}
      <Link
        to="/setup/clients"
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver a clientes
      </Link>

      {/* Encabezado */}
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
            {parentName && (
              <span className="text-xs text-muted-foreground">
                Pertenece a{" "}
                <Link
                  to="/setup/clients/$clientId"
                  params={{ clientId: parent!.id }}
                  className="font-medium text-foreground hover:underline"
                >
                  {parentName}
                </Link>
              </span>
            )}
          </div>
        </div>

        {isSuperAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/setup/clients/$clientId/edit" params={{ clientId }}>
                <Pencil className="mr-2 h-4 w-4" /> Editar
              </Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={toggleStatus.isPending}
              onClick={() => toggleStatus.mutate(isActive ? "inactive" : "active")}
            >
              <Power className="mr-2 h-4 w-4" />
              {isActive ? "Inactivar" : "Activar"}
            </Button>
          </div>
        )}
      </header>

      {/* Resumen */}
      <div
        className={`grid grid-cols-1 gap-3 ${isHolding ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
      >
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Acuerdos asociados
          </p>
          <p className="mt-1 text-xl font-semibold text-foreground">{agreements?.length ?? 0}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Usuarios asociados
          </p>
          <p className="mt-1 text-xl font-semibold text-foreground">0</p>
        </div>
        {isHolding && (
          <div className="rounded-lg border border-border bg-card p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Empresas asociadas
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">
              {children?.length ?? 0}
            </p>
          </div>
        )}
      </div>

      {/* Información general */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información general</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Razón social">{data.legal_name || "—"}</Field>
          <Field label="Nombre comercial">{data.commercial_name?.trim() || "—"}</Field>
          <Field label="Nombre ERP">{data.erp_name?.trim() || "—"}</Field>
          <Field label="Tipo ID">{data.tax_id_type || "NIT"}</Field>
          <Field label="NIT">{data.tax_id || "—"}</Field>
          <Field label="Tipo de cliente">{isHolding ? "Holding" : "Directo"}</Field>
          <Field label="Estado">
            <StatusBadge
              status={isActive ? "active" : "neutral"}
              label={isActive ? "Activo" : "Inactivo"}
            />
          </Field>
          {data.type === "direct" && (
            <Field label="Holding asociado">
              {parentName ? (
                <Link
                  to="/setup/clients/$clientId"
                  params={{ clientId: parent!.id }}
                  className="text-foreground hover:underline"
                >
                  {parentName}
                </Link>
              ) : (
                "—"
              )}
            </Field>
          )}
        </CardContent>
      </Card>

      {/* Notas internas */}
      {data.notes?.trim() && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notas internas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-foreground">{data.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Acuerdos asociados */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acuerdos asociados</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Acuerdos comerciales registrados para este cliente.
          </p>
        </CardHeader>
        <CardContent>
          {!agreements || agreements.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-8 text-center">
              <FileText className="mb-2 h-6 w-6 text-muted-foreground" />
              <p className="text-sm font-medium">Sin acuerdos asociados.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Los acuerdos se crean desde el módulo de Acuerdos.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {agreements.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-xs text-muted-foreground">
                      {a.id.slice(0, 8)}
                    </p>
                    {a.updated_at && (
                      <p className="text-xs text-muted-foreground">
                        Actualizado {new Date(a.updated_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Usuarios asociados */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuarios asociados</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Usuarios con acceso a este cliente. Se gestionan desde el módulo Usuarios.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-8 text-center">
            <Users className="mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-medium">Sin usuarios asociados aún.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Disponible cuando se construya el módulo de Usuarios.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Empresas del cliente (solo holdings) */}
      {isHolding && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Empresas del cliente</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Clientes directos asociados a este holding.
            </p>
          </CardHeader>
          <CardContent>
            {!children || children.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border py-8 text-center">
                <Building2 className="mb-2 h-6 w-6 text-muted-foreground" />
                <p className="text-sm font-medium">Aún no hay empresas asociadas.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Registra clientes directos vinculados a este holding.
                </p>
              </div>
            ) : (
              <div className="rounded-md border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>NIT</TableHead>
                      <TableHead>Estado</TableHead>
                      {isSuperAdmin && <TableHead className="text-right">Acciones</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {children.map((c) => {
                      const name = c.commercial_name?.trim() || c.legal_name;
                      const active = c.status === "active";
                      return (
                        <TableRow key={c.id}>
                          <TableCell className="font-medium">
                            <Link
                              to="/setup/clients/$clientId"
                              params={{ clientId: c.id }}
                              className="hover:underline"
                            >
                              {name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{c.tax_id ?? "—"}</TableCell>
                          <TableCell>
                            <StatusBadge
                              status={active ? "active" : "neutral"}
                              label={active ? "Activo" : "Inactivo"}
                            />
                          </TableCell>
                          {isSuperAdmin && (
                            <TableCell className="text-right">
                              <Button asChild size="sm" variant="ghost">
                                <Link
                                  to="/setup/clients/$clientId/edit"
                                  params={{ clientId: c.id }}
                                >
                                  <Pencil className="mr-1.5 h-4 w-4" /> Editar
                                </Link>
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
