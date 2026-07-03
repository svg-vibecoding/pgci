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
import { Badge, Chip, StatusBadge } from "@/components/sumatec";
import { useIsSuperAdmin } from "@/hooks/use-profile";
import { ArrowLeft, Check, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/setup/users/$userId/client-access")({
  head: () => ({ meta: [{ title: "Acceso a clientes · Setup · PGCI" }] }),
  component: ClientAccess,
});

type AccessState = {
  assigned: boolean;
  can_create: boolean;
  can_manage_client_catalog: boolean;
  can_manage_matching: boolean;
};

const DEFAULT_ACCESS_STATE: AccessState = {
  assigned: false,
  can_create: false,
  can_manage_client_catalog: false,
  can_manage_matching: false,
};

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
        .select("client_id, can_create_agreements, can_manage_client_catalog, can_manage_matching")
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
      accessQ.data.map((a) => [
        a.client_id,
        {
          can_create: !!a.can_create_agreements,
          can_manage_client_catalog: !!a.can_manage_client_catalog,
          can_manage_matching: !!a.can_manage_matching,
        },
      ]),
    );
    clientsQ.data.forEach((c) => {
      const access = accessByClient.get(c.id);
      next.set(c.id, {
        assigned: !!access,
        can_create: !!access?.can_create,
        can_manage_client_catalog: !!access?.can_manage_client_catalog,
        can_manage_matching: !!access?.can_manage_matching,
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

  const catalogCount = useMemo(
    () => [...stateMap.values()].filter((s) => s.assigned && s.can_manage_client_catalog).length,
    [stateMap],
  );

  const matchingCount = useMemo(
    () => [...stateMap.values()].filter((s) => s.assigned && s.can_manage_matching).length,
    [stateMap],
  );

  const totalClients = clientsQ.data?.length ?? 0;

  const filteredClients = useMemo(() => {
    if (!clientsQ.data) return [];
    const q = search.trim().toLowerCase();
    const list = q
      ? clientsQ.data.filter((c) => {
          const name = (c.commercial_name || c.legal_name || "").toLowerCase();
          const legal = (c.legal_name || "").toLowerCase();
          return name.includes(q) || legal.includes(q);
        })
      : clientsQ.data;
    return [...list].sort((a, b) => {
      const nameA = (a.commercial_name || a.legal_name || "").toLowerCase();
      const nameB = (b.commercial_name || b.legal_name || "").toLowerCase();
      return nameA.localeCompare(nameB);
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

  const visibleAllCanManageCatalog = useMemo(() => {
    if (visibleAssignedClients.length === 0) return false;
    return visibleAssignedClients.every((c) => stateMap.get(c.id)?.can_manage_client_catalog);
  }, [visibleAssignedClients, stateMap]);

  const visibleAllCanManageMatching = useMemo(() => {
    if (visibleAssignedClients.length === 0) return false;
    return visibleAssignedClients.every((c) => stateMap.get(c.id)?.can_manage_matching);
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
    const base = `${assignedCount} de ${totalClients} clientes asignados`;
    if (createCount === 0 && catalogCount === 0 && matchingCount === 0) {
      return `${base} · Sin permisos adicionales`;
    }
    const parts = [base];
    if (createCount > 0) parts.push(`${createCount} con permiso de creación`);
    if (catalogCount > 0) parts.push(`${catalogCount} gestionan catálogo`);
    if (matchingCount > 0) parts.push(`${matchingCount} gestionan matching`);
    return parts.join(" · ");
  }, [assignedCount, totalClients, createCount, catalogCount, matchingCount]);

  const initialAssignedCount = useMemo(
    () => [...initialMap.values()].filter((s) => s.assigned).length,
    [initialMap],
  );

  const initialCreateCount = useMemo(
    () => [...initialMap.values()].filter((s) => s.assigned && s.can_create).length,
    [initialMap],
  );

  const initialCatalogCount = useMemo(
    () => [...initialMap.values()].filter((s) => s.assigned && s.can_manage_client_catalog).length,
    [initialMap],
  );

  const initialMatchingCount = useMemo(
    () => [...initialMap.values()].filter((s) => s.assigned && s.can_manage_matching).length,
    [initialMap],
  );

  const initialSummaryText = useMemo(() => {
    const base = `${initialAssignedCount} de ${totalClients} clientes asignados`;
    if (initialCreateCount === 0 && initialCatalogCount === 0 && initialMatchingCount === 0) {
      return `${base} · Sin permisos adicionales`;
    }
    const parts = [base];
    if (initialCreateCount > 0) parts.push(`${initialCreateCount} con permiso de creación`);
    if (initialCatalogCount > 0) parts.push(`${initialCatalogCount} gestionan catálogo`);
    if (initialMatchingCount > 0) parts.push(`${initialMatchingCount} gestionan matching`);
    return parts.join(" · ");
  }, [initialAssignedCount, totalClients, initialCreateCount, initialCatalogCount, initialMatchingCount]);

  const diff = useMemo(() => {
    const toInsert: string[] = [];
    const toDelete: string[] = [];
    const toUpdate: {
      client_id: string;
      can_create_agreements: boolean;
      can_manage_client_catalog: boolean;
      can_manage_matching: boolean;
    }[] = [];
    stateMap.forEach((curr, id) => {
      const init = initialMap.get(id);
      const wasAssigned = !!init?.assigned;
      if (curr.assigned && !wasAssigned) {
        toInsert.push(id);
      } else if (!curr.assigned && wasAssigned) {
        toDelete.push(id);
      } else if (
        curr.assigned &&
        wasAssigned &&
        (curr.can_create !== init?.can_create ||
          curr.can_manage_client_catalog !== init?.can_manage_client_catalog ||
          curr.can_manage_matching !== init?.can_manage_matching)
      ) {
        toUpdate.push({
          client_id: id,
          can_create_agreements: curr.can_create,
          can_manage_client_catalog: curr.can_manage_client_catalog,
          can_manage_matching: curr.can_manage_matching,
        });
      }
    });
    return { toInsert, toDelete, toUpdate };
  }, [stateMap, initialMap]);

  const hasChanges =
    diff.toInsert.length > 0 || diff.toDelete.length > 0 || diff.toUpdate.length > 0;

  const setAssigned = (id: string, assigned: boolean) => {
    setStateMap((prev) => {
      const next = new Map(prev);
      const curr = next.get(id) ?? DEFAULT_ACCESS_STATE;
      next.set(id, {
        assigned,
        can_create: assigned ? curr.can_create : false,
        can_manage_client_catalog: assigned ? curr.can_manage_client_catalog : false,
        can_manage_matching: assigned ? curr.can_manage_matching : false,
      });
      return next;
    });
  };

  const setCanCreate = (id: string, can_create: boolean) => {
    setStateMap((prev) => {
      const next = new Map(prev);
      const curr = next.get(id) ?? DEFAULT_ACCESS_STATE;
      if (!curr.assigned) return prev;
      next.set(id, { ...curr, can_create });
      return next;
    });
  };

  const setCanManageCatalog = (id: string, can_manage_client_catalog: boolean) => {
    setStateMap((prev) => {
      const next = new Map(prev);
      const curr = next.get(id) ?? DEFAULT_ACCESS_STATE;
      if (!curr.assigned) return prev;
      next.set(id, { ...curr, can_manage_client_catalog });
      return next;
    });
  };

  const setCanManageMatching = (id: string, can_manage_matching: boolean) => {
    setStateMap((prev) => {
      const next = new Map(prev);
      const curr = next.get(id) ?? DEFAULT_ACCESS_STATE;
      if (!curr.assigned) return prev;
      next.set(id, { ...curr, can_manage_matching });
      return next;
    });
  };

  const toggleAllAssigned = (on: boolean) => {
    setStateMap((prev) => {
      const next = new Map(prev);
      filteredClients.forEach((c) => {
        const curr = next.get(c.id) ?? DEFAULT_ACCESS_STATE;
        next.set(c.id, {
          assigned: on,
          can_create: on ? curr.can_create : false,
          can_manage_client_catalog: on ? curr.can_manage_client_catalog : false,
          can_manage_matching: on ? curr.can_manage_matching : false,
        });
      });
      return next;
    });
  };

  const toggleAllCanCreate = (on: boolean) => {
    setStateMap((prev) => {
      const next = new Map(prev);
      filteredClients.forEach((c) => {
        const curr = next.get(c.id) ?? DEFAULT_ACCESS_STATE;
        if (!curr.assigned) return;
        next.set(c.id, { ...curr, can_create: on });
      });
      return next;
    });
  };

  const toggleAllCanManageCatalog = (on: boolean) => {
    setStateMap((prev) => {
      const next = new Map(prev);
      filteredClients.forEach((c) => {
        const curr = next.get(c.id) ?? DEFAULT_ACCESS_STATE;
        if (!curr.assigned) return;
        next.set(c.id, { ...curr, can_manage_client_catalog: on });
      });
      return next;
    });
  };

  const toggleAllCanManageMatching = (on: boolean) => {
    setStateMap((prev) => {
      const next = new Map(prev);
      filteredClients.forEach((c) => {
        const curr = next.get(c.id) ?? DEFAULT_ACCESS_STATE;
        if (!curr.assigned) return;
        next.set(c.id, { ...curr, can_manage_matching: on });
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
              can_manage_client_catalog: stateMap.get(client_id)?.can_manage_client_catalog ?? false,
              can_manage_matching: stateMap.get(client_id)?.can_manage_matching ?? false,
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
            .update({
              can_create_agreements: u.can_create_agreements,
              can_manage_client_catalog: u.can_manage_client_catalog,
              can_manage_matching: u.can_manage_matching,
            })
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
        <h1 className="text-2xl font-bold tracking-tight">
          Gestión de capacidades comerciales
        </h1>
        <p className="text-base font-semibold text-foreground flex items-center gap-2">
          <StatusBadge
            status={user.status === "active" ? "active" : "neutral"}
            label={user.status === "active" ? "Activo" : "Inactivo"}
          />
          {user.full_name}
        </p>
        <p className="text-sm text-muted-foreground">
          Asígnale al usuario los clientes que podrá ver en la plataforma. También puedes habilitarle permisos de creación de acuerdos, gestión de catálogo del cliente y gestión de matching sobre clientes asignados.
        </p>
        <p className="text-sm font-medium text-foreground">{initialSummaryText}</p>
      </header>

      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="text-base">Clientes</CardTitle>
          <div className="flex items-center gap-6">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar cliente…"
                className="pl-9"
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-end gap-3">
                <span className="text-right text-xs font-medium text-muted-foreground">
                  {search.trim() ? "Acceso a clientes visibles" : "Acceso a todos los clientes"}
                </span>
                <Switch
                  checked={visibleAllAssigned}
                  disabled={filteredClients.length === 0}
                  onCheckedChange={toggleAllAssigned}
                />
              </div>
              <div
                className={cn(
                  "flex items-center justify-end gap-3",
                  visibleAssignedClients.length === 0 && "opacity-50",
                )}
              >
                <span className="text-right text-xs font-medium text-muted-foreground">
                  {search.trim() ? "Crear acuerdos en clientes visibles asignados" : "Crear acuerdos en todos los clientes asignados"}
                </span>
                <Switch
                  checked={visibleAllCanCreate}
                  disabled={visibleAssignedClients.length === 0}
                  onCheckedChange={toggleAllCanCreate}
                />
              </div>
              <div
                className={cn(
                  "flex items-center justify-end gap-3",
                  visibleAssignedClients.length === 0 && "opacity-50",
                )}
              >
                <span className="text-right text-xs font-medium text-muted-foreground">
                  {search.trim() ? "Gestionar catálogo del cliente en clientes visibles asignados" : "Gestionar catálogo del cliente en todos los clientes asignados"}
                </span>
                <Switch
                  checked={visibleAllCanManageCatalog}
                  disabled={visibleAssignedClients.length === 0}
                  onCheckedChange={toggleAllCanManageCatalog}
                />
              </div>
              <div
                className={cn(
                  "flex items-center justify-end gap-3",
                  visibleAssignedClients.length === 0 && "opacity-50",
                )}
              >
                <span className="text-right text-xs font-medium text-muted-foreground">
                  {search.trim() ? "Gestionar matching en clientes visibles asignados" : "Gestionar matching en todos los clientes asignados"}
                </span>
                <Switch
                  checked={visibleAllCanManageMatching}
                  disabled={visibleAssignedClients.length === 0}
                  onCheckedChange={toggleAllCanManageMatching}
                />
              </div>
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
                const st = stateMap.get(c.id) ?? DEFAULT_ACCESS_STATE;
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
                      <label className="flex flex-col items-center gap-1 text-xs font-medium text-muted-foreground">
                        Asignar
                        <Switch
                          checked={st.assigned}
                          onCheckedChange={(v) => setAssigned(c.id, v)}
                        />
                      </label>
                      <label
                        className={cn(
                          "flex flex-col items-center gap-1 text-xs font-medium text-muted-foreground",
                          !st.assigned && "opacity-40",
                        )}
                      >
                        Crear&nbsp;
                        <Switch
                          checked={st.can_create}
                          disabled={!st.assigned}
                          onCheckedChange={(v) => setCanCreate(c.id, v)}
                        />
                      </label>
                      <label
                        className={cn(
                          "flex flex-col items-center gap-1 text-xs font-medium text-muted-foreground text-center",
                          !st.assigned && "opacity-40",
                        )}
                      >
                        Gestionar catálogo del cliente
                        <Switch
                          checked={st.can_manage_client_catalog}
                          disabled={!st.assigned}
                          onCheckedChange={(v) => setCanManageCatalog(c.id, v)}
                        />
                      </label>
                      <label
                        className={cn(
                          "flex flex-col items-center gap-1 text-xs font-medium text-muted-foreground",
                          !st.assigned && "opacity-40",
                        )}
                      >
                        Gestionar matching
                        <Switch
                          checked={st.can_manage_matching}
                          disabled={!st.assigned}
                          onCheckedChange={(v) => setCanManageMatching(c.id, v)}
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
            <p className="text-sm font-medium text-foreground">{summaryText}</p>
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
                  const st = stateMap.get(c.id) ?? DEFAULT_ACCESS_STATE;
                  const name = c.commercial_name?.trim() || c.legal_name || "—";
                  return (
                    <Chip
                      key={c.id}
                      color={st.can_create ? "info" : "neutral"}
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
