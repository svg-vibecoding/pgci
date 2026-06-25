import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Chip, StatusBadge, Badge } from "@/components/sumatec";
import { Plus, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/setup/users/")({
  head: () => ({ meta: [{ title: "Usuarios y accesos · Setup · PGCI" }] }),
  component: UsersList,
});

type CardKey = "all" | "active" | "inactive" | "superAdmins";
type StatusFilter = "all" | "active" | "inactive";
type RoleFilter = "all" | "super_admin" | "platform_user";

function UsersList() {
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState<StatusFilter>("all");
  const [roleF, setRoleF] = useState<RoleFilter>("all");
  const [activeCard, setActiveCard] = useState<CardKey>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["users", "list"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select(
          "user_id, full_name, email, role, status, can_create_agreements, erp_user_code, updated_at",
        )
        .order("full_name");
      if (error) throw error;

      const ids = (profiles ?? []).map((p) => p.user_id);
      const accessCounts = new Map<string, number>();
      if (ids.length) {
        const { data: access } = await supabase
          .from("user_client_access")
          .select("user_id")
          .in("user_id", ids);
        (access ?? []).forEach((a) => {
          if (a.user_id)
            accessCounts.set(a.user_id, (accessCounts.get(a.user_id) ?? 0) + 1);
        });
      }
      return (profiles ?? []).map((p) => ({
        ...p,
        client_count: accessCounts.get(p.user_id) ?? 0,
      }));
    },
  });

  const all = data ?? [];
  const totalCount = all.length;
  const activeCount = all.filter((u) => u.status === "active").length;
  const inactiveCount = all.filter((u) => u.status === "inactive").length;
  const superAdminsCount = all.filter((u) => u.role === "super_admin").length;

  const filtered = all.filter((u) => {
    if (activeCard === "active" && u.status !== "active") return false;
    if (activeCard === "inactive" && u.status !== "inactive") return false;
    if (activeCard === "superAdmins" && u.role !== "super_admin") return false;

    if (statusF !== "all" && u.status !== statusF) return false;
    if (roleF !== "all" && u.role !== roleF) return false;

    if (search) {
      const s = search.toLowerCase();
      const hay = [u.full_name, u.email, u.erp_user_code]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(s));
      if (!hay) return false;
    }
    return true;
  });

  const summaryCards: { key: CardKey; label: string; value: number }[] = [
    { key: "all", label: "Usuarios", value: totalCount },
    { key: "active", label: "Activos", value: activeCount },
    { key: "inactive", label: "Inactivos", value: inactiveCount },
    { key: "superAdmins", label: "Super admins", value: superAdminsCount },
  ];

  const cardLabelByKey: Record<CardKey, string> = {
    all: "Usuarios",
    active: "Activos",
    inactive: "Inactivos",
    superAdmins: "Super admins",
  };

  const hasActiveFilters =
    activeCard !== "all" ||
    statusF !== "all" ||
    roleF !== "all" ||
    search.trim() !== "";

  const clearFilters = () => {
    setActiveCard("all");
    setStatusF("all");
    setRoleF("all");
    setSearch("");
  };

  const roleLabel = (r: string) =>
    r === "super_admin" ? "Super admin" : "Usuario plataforma";

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuarios y accesos</h1>
          <p className="text-sm text-muted-foreground">
            Administra los usuarios internos de la plataforma y sus accesos a clientes.
          </p>
        </div>
        <Button asChild>
          <Link to="/setup/users/new">
            <Plus className="mr-2 h-4 w-4" /> Crear usuario
          </Link>
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {summaryCards.map((c) => {
          const selected = activeCard === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => setActiveCard(c.key)}
              aria-pressed={selected}
              className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
            >
              <Card
                className={
                  selected
                    ? "border-l-2 border-l-primary/40 shadow-sm transition-colors"
                    : "hover:border-muted-foreground/20 hover:bg-muted/30 transition-colors"
                }
              >
                <CardContent className="p-4">
                  <div className="text-xs text-muted-foreground">{c.label}</div>
                  <div className="mt-1 text-2xl font-semibold tracking-tight">
                    {isLoading ? "—" : c.value}
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div className="relative w-full md:w-[calc(50%-0.375rem)]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email o código ERP…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="role-select" className="text-xs text-muted-foreground">
            Rol
          </label>
          <Select value={roleF} onValueChange={(v) => setRoleF(v as RoleFilter)}>
            <SelectTrigger id="role-select" className="w-56">
              <SelectValue placeholder="Rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="super_admin">Super admin</SelectItem>
              <SelectItem value="platform_user">Usuario plataforma</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="status-select" className="text-xs text-muted-foreground">
            Estado
          </label>
          <Select value={statusF} onValueChange={(v) => setStatusF(v as StatusFilter)}>
            <SelectTrigger id="status-select" className="w-44">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Activos</SelectItem>
              <SelectItem value="inactive">Inactivos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-sm text-muted-foreground">
              {filtered.length} de {totalCount} {totalCount === 1 ? "usuario" : "usuarios"}
            </p>
            <div className="flex flex-wrap gap-2">
              {activeCard !== "all" && (
                <Chip size="small" variant="soft" color="neutral" onRemove={() => setActiveCard("all")}>
                  {cardLabelByKey[activeCard]}
                </Chip>
              )}
              {roleF !== "all" && (
                <Chip size="small" variant="soft" color="neutral" onRemove={() => setRoleF("all")}>
                  {roleLabel(roleF)}
                </Chip>
              )}
              {statusF !== "all" && (
                <Chip size="small" variant="soft" color="neutral" onRemove={() => setStatusF("all")}>
                  {statusF === "active" ? "Activos" : "Inactivos"}
                </Chip>
              )}
              {search.trim() && (
                <Chip size="small" variant="soft" color="neutral" onRemove={() => setSearch("")}>
                  Búsqueda: {search.trim()}
                </Chip>
              )}
            </div>
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-medium text-primary hover:underline"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        <div className="rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead className="text-right">Clientes</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">
                    {all.length === 0
                      ? "Aún no hay usuarios creados."
                      : "No hay usuarios que coincidan con los filtros."}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((u) => (
                <TableRow key={u.user_id}>
                  <TableCell className="font-medium">
                    <Link
                      to="/setup/users/$userId"
                      params={{ userId: u.user_id }}
                      className="hover:underline"
                    >
                      {u.full_name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{u.email}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{roleLabel(u.role)}</span>
                      {u.can_create_agreements && u.role === "platform_user" && (
                        <Badge color="info">Crea acuerdos</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {u.role === "super_admin" ? "Todos" : u.client_count}
                  </TableCell>
                  <TableCell>
                    <StatusBadge
                      status={u.status === "active" ? "active" : "neutral"}
                      label={u.status === "active" ? "Activo" : "Inactivo"}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/setup/users/$userId" params={{ userId: u.user_id }}>
                          Ver
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/setup/users/$userId/edit" params={{ userId: u.user_id }}>
                          Editar
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
