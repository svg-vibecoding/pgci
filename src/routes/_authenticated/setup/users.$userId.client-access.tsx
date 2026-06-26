import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, Chip } from "@/components/sumatec";
import { useIsSuperAdmin } from "@/hooks/use-profile";
import { ArrowLeft, Check, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/setup/users/$userId/client-access")({
  head: () => ({ meta: [{ title: "Acceso a clientes · Setup · PGCI" }] }),
  component: ClientAccess,
});

type AccessState = { assigned: boolean; can_create: boolean };

const roleLabel = (r: string) =>
  r === "super_admin" ? "Super admin" : "Usuario plataforma";

function ClientAccess() {
  const { userId } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isSuperAdmin, isLoading: loadingAuth } = useIsSuperAdmin();

  const [search, setSearch] = useState("");
  const [stateMap, setStateMap] = useState<Map<string, AccessState>>(new Map());
  const [initialMap, setInitialMap] = useState<Map<string, AccessState>>(new Map());
  const [saving, setSaving] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  const profileQ = useQuery({
    queryKey: ["users", userId, "profile-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, role, status")
        .eq("user_id", userId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const clientsQ = useQuery({
    queryKey: ["clients", "active-with-parent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select(
          "id, commercial_name, legal_name, type, status, parent_client_id, parent:parent_client_id(id, commercial_name, legal_name)",
        )
        .eq("status", "active")
        .order("commercial_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const accessQ = useQuery({
    queryKey: ["users", userId, "access"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_client_access")
        .select("client_id, can_create_agreements")
        .eq("user_id", userId);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Hydrate local state once both clients + access are loaded
  useEffect(() => {
    if (!clientsQ.data || !accessQ.data) return;
    const next = new Map<string, AccessState>();
    const accessByClient = new Map(
      accessQ.data.map((a) => [a.client_id, !!a.can_create_agreements]),
    );
    clientsQ.data.forEach((c) => {
      const assigned = accessByClient.has(c.id);
      next.set(c.id, {
        assigned,
        can_create: assigned ? !!accessByClient.get(c.id) : false,
      });
    });
    setStateMap(next);
    setInitialMap(new Map([...next].map(([k, v]) => [k, { ...v }])));
  }, [clientsQ.data, accessQ.data]);

  const assignedCount = useMemo(
    () => [...stateMap.values()].filter((s) => s.assigned).length,
    [stateMap],
  );

  const createCount = useMemo(
    () => [...stateMap.values()].filter((s) => s.assigned && s.can_create).length,
    [stateMap],
  );

  const totalClients = clientsQ.data?.length ?? 0;

  const filteredClients = useMemo(() => {
    if (!clientsQ.data) return [];
    const q = search.trim().toLowerCase();
    if (!q) return clientsQ.data;
    return clientsQ.data.filter((c) => {
      const name = (c.commercial_name || c.legal_name || "").toLowerCase();
      const legal = (c.legal_name || "").toLowerCase();
      return name.includes(q) || legal.includes(q);
    });
  }, [clientsQ.data, search]);

  const visibleAllAssigned = useMemo(() => {
    if (filteredClients.length === 0) return false;
    return filteredClients.every((c) => stateMap.get(c.id)?.assigned);
  }, [filteredClients, stateMap]);

  const visibleAssignedClients = useMemo(
    () => filteredClients.filter((c) => stateMap.get(c.id)?.assigned),
    [filteredClients, stateMap],
  );

  const visibleAllCanCreate = useMemo(() => {
    if (visibleAssignedClients.length === 0) return false;
    return visibleAssignedClients.every((c) => stateMap.get(c.id)?.can_create);
  }, [visibleAssignedClients, stateMap]);

  const assignedClients = useMemo(() => {
    if (!clientsQ.data) return [];
    return clientsQ.data
      .filter((c) => stateMap.get(c.id)?.assigned)
      .sort((a, b) =>
        (a.commercial_name || a.legal_name || "—").localeCompare(
          b.commercial_name || b.legal_name || "—",
        ),
      );
  }, [clientsQ.data, stateMap]);

  const summaryText = useMemo(() => {
    if (createCount === 0) {
      return `${assignedCount} de ${totalClients} clientes asignados · Sin permiso de creación`;
    }
    return `${assignedCount} de ${totalClients} clientes asignados · ${createCount} con permiso de creación`;
  }, [assignedCount, totalClients, createCount]);

  const initialAssignedCount = useMemo(
    () => [...initialMap.values()].filter((s) => s.assigned).length,
    [initialMap],
  );

  const initialCreateCount = useMemo(
    () => [...initialMap.values()].filter((s) => s.assigned && s.can_create).length,
    [initialMap],
  );

  const initialSummaryText = useMemo(() => {
    if (initialCreateCount === 0) {
      return `${initialAssignedCount} de ${totalClients} clientes asignados · Sin permiso de creación`;
    }
    return `${initialAssignedCount} de ${totalClients} clientes asignados · ${initialCreateCount} con permiso de creación`;
  }, [initialAssignedCount, totalClients, initialCreateCount]);

  const diff = useMemo(() => {
    const toInsert: string[] = [];
    const toDelete: string[] = [];
    const toUpdate: { client_id: string; can_create_agreements: boolean }[] = [];
    stateMap.forEach((curr, id) => {
      const init = initialMap.get(id);
      const wasAssigned = !!init?.assigned;
      if (curr.assigned && !wasAssigned) {
        toInsert.push(id);
      } else if (!curr.assigned && wasAssigned) {
        toDelete.push(id);
      } else if (curr.assigned && wasAssigned && curr.can_create !== init?.can_create) {
        toUpdate.push({ client_id: id, can_create_agreements: curr.can_create });
      }
    });
    return { toInsert, toDelete, toUpdate };
  }, [stateMap, initialMap]);

  const hasChanges =
    diff.toInsert.length > 0 || diff.toDelete.length > 0 || diff.toUpdate.length > 0;

  const setAssigned = (id: string, assigned: boolean) => {
    setStateMap((prev) => {
      const next = new Map(prev);
      const curr = next.get(id) ?? { assigned: false, can_create: false };
      next.set(id, {
        assigned,
        can_create: assigned ? curr.can_create : false,
      });
      return next;
    });
  };

  const setCanCreate = (id: string, can_create: boolean) => {
    setStateMap((prev) => {
      const next = new Map(prev);
      const curr = next.get(id) ?? { assigned: false, can_create: false };
      if (!curr.assigned) return prev;
      next.set(id, { ...curr, can_create });
      return next;
    });
  };

  const toggleAllAssigned = (on: boolean) => {
    setStateMap((prev) => {
      const next = new Map(prev);
      filteredClients.forEach((c) => {
        const curr = next.get(c.id) ?? { assigned: false, can_create: false };
        next.set(c.id, {
          assigned: on,
          can_create: on ? curr.can_create : false,
        });
      });
      return next;
    });
  };

  const toggleAllCanCreate = (on: boolean) => {
    setStateMap((prev) => {
      const next = new Map(prev);
      filteredClients.forEach((c) => {
        const curr = next.get(c.id) ?? { assigned: false, can_create: false };
        if (!curr.assigned) return;
        next.set(c.id, { ...curr, can_create: on });
      });
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ops: PromiseLike<{ error: unknown }>[] = [];

      if (diff.toInsert.length) {
        ops.push(
          supabase.from("user_client_access").insert(
            diff.toInsert.map((client_id) => ({
              user_id: userId,
              client_id,
              can_create_agreements: stateMap.get(client_id)?.can_create ?? false,
            })),
          ),
        );
      }
      if (diff.toDelete.length) {
        ops.push(
          supabase
            .from("user_client_access")
            .delete()
            .eq("user_id", userId)
            .in("client_id", diff.toDelete),
        );
      }
      diff.toUpdate.forEach((u) => {
        ops.push(
          supabase
            .from("user_client_access")
            .update({ can_create_agreements: u.can_create_agreements })
            .eq("user_id", userId)
            .eq("client_id", u.client_id),
        );
      });

      const results = await Promise.all(ops);
      const firstError = results.find((r) => r && r.error);
      if (firstError) throw firstError.error;

      toast.success("Accesos actualizados.");
      await qc.invalidateQueries({ queryKey: ["users"] });
      await qc.invalidateQueries({ queryKey: ["users", userId, "access"] });
      navigate({ to: "/setup/users/$userId", params: { userId } });
    } catch (e) {
      console.error(e);
      toast.error("No fue posible guardar los accesos.");
    } finally {
      setSaving(false);
    }
  };

  if (loadingAuth) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }
  if (!isSuperAdmin) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          No tienes permisos para gestionar accesos.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/setup/users/$userId" params={{ userId }}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver al perfil
          </Link>
        </Button>
      </div>
    );
  }

  if (profileQ.isLoading || clientsQ.isLoading || accessQ.isLoading) {
    return <p className="text-sm text-muted-foreground">Cargando…</p>;
  }
  if (!profileQ.data) {
    return <p className="text-sm text-muted-foreground">Usuario no encontrado.</p>;
  }

  const user = profileQ.data;

  return (
    <div className="-mt-6 space-y-5">
      <Link
        to="/setup/users/$userId"
        params={{ userId }}
        className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver al perfil
      </Link>

      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{user.full_name}</h1>
          <Badge
            color={user.role === "super_admin" ? "accent" : "neutral"}
            variant="soft"
          >
            {roleLabel(user.role)}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Configura qué clientes puede ver y en cuáles puede crear acuerdos.
        </p>
        <p className="text-sm text-muted-foreground">
          Activa un cliente para que el usuario pueda verlo en la plataforma. Si
          además necesita crear acuerdos para ese cliente, activa también el
          permiso de creación — eso le permitirá iniciar nuevos acuerdos y
          quedar como responsable de ellos.
        </p>
        <p className="text-xs text-muted-foreground">{summaryText}</p>
      </header>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Clientes</CardTitle>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente…"
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 whitespace-nowrap text-xs font-medium text-muted-foreground">
                {search.trim() ? "Asignar visibles" : "Asignar todos"}
                <Switch
                  checked={visibleAllAssigned}
                  disabled={filteredClients.length === 0}
                  onCheckedChange={toggleAllAssigned}
                />
              </label>
              <label
                className={cn(
                  "flex items-center gap-2 whitespace-nowrap text-xs font-medium text-muted-foreground",
                  visibleAssignedClients.length === 0 && "opacity-50",
                )}
              >
                {search.trim() ? "Crear acuerdos a visibles" : "Crear acuerdos a todos"}
                <Switch
                  checked={visibleAllCanCreate}
                  disabled={visibleAssignedClients.length === 0}
                  onCheckedChange={toggleAllCanCreate}
                />
              </label>
            </div>
          </div>
          {search.trim() !== "" && (
            <p className="text-xs text-muted-foreground">
              {filteredClients.length} de {totalClients} clientes
            </p>
          )}
        </CardHeader>
        <CardContent>
          {totalClients === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No hay clientes activos disponibles.
            </p>
          ) : filteredClients.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Sin resultados para esa búsqueda.
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border">
              {filteredClients.map((c) => {
                const st = stateMap.get(c.id) ?? { assigned: false, can_create: false };
                const name = c.commercial_name?.trim() || c.legal_name || "—";
                const parent = c.parent as
                  | { id: string; commercial_name: string | null; legal_name: string }
                  | null;
                const parentName = parent
                  ? parent.commercial_name?.trim() || parent.legal_name
                  : null;
                return (
                  <li
                    key={c.id}
                    className="flex items-center justify-between gap-4 px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{name}</span>
                        {c.type === "holding" && (
                          <Badge color="accent" variant="soft">
                            Holding
                          </Badge>
                        )}
                      </div>
                      {parentName && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {parentName}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-6">
                      <label className="flex flex-col items-center gap-1 text-xs font-normal text-muted-foreground">
                        Asignar
                        <Switch
                          checked={st.assigned}
                          onCheckedChange={(v) => setAssigned(c.id, v)}
                        />
                      </label>
                      <label
                        className={cn(
                          "flex flex-col items-center gap-1 text-xs font-normal text-muted-foreground",
                          !st.assigned && "opacity-40",
                        )}
                      >
                        Crear acuerdos
                        <Switch
                          checked={st.can_create}
                          disabled={!st.assigned}
                          onCheckedChange={(v) => setCanCreate(c.id, v)}
                        />
                      </label>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-20 border-t border-border bg-background/95 backdrop-blur">
        <div className="flex flex-col gap-3 py-3">
          <div className="flex w-full items-center justify-between">
            <p className="text-xs text-muted-foreground">{summaryText}</p>
            {assignedCount > 0 && (
              <Button
                variant="link"
                size="sm"
                className="h-auto px-0 py-0 text-xs font-medium"
                onClick={() => setShowDetail((v) => !v)}
              >
                {showDetail ? "Ocultar" : "Ver detalle"}
              </Button>
            )}
          </div>

          {showDetail && assignedCount > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-background p-3">
              <div className="flex flex-wrap gap-2">
                {assignedClients.map((c) => {
                  const st = stateMap.get(c.id) ?? {
                    assigned: false,
                    can_create: false,
                  };
                  const name = c.commercial_name?.trim() || c.legal_name || "—";
                  return (
                    <Chip
                      key={c.id}
                      color={st.can_create ? "primary" : "neutral"}
                      variant="soft"
                      size="small"
                      icon={st.can_create ? Check : undefined}
                    >
                      {name}
                    </Chip>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex w-full items-center justify-end gap-2 border-t border-border pt-3">
            <Button
              variant="outline"
              disabled={saving}
              onClick={() =>
                navigate({ to: "/setup/users/$userId", params: { userId } })
              }
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!hasChanges || saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
