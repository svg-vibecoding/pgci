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
import { Chip, StatusBadge } from "@/components/sumatec";
import { Plus, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/setup/users/")({
  head: () => ({ meta: [{ title: "Usuarios y accesos · Setup · PGCI" }] }),
  component: UsersList,
});

type CardKey = "all" | "active" | "inactive" | "alerts";
type RoleFilter = "all" | "super_admin" | "platform_user";
type CreateFilter = "all" | "yes" | "no";
type GestionFilter = "all" | "active" | "none";

function UsersList() {
  const [search, setSearch] = useState("");
  const [roleF, setRoleF] = useState<RoleFilter>("all");
  const [createF, setCreateF] = useState<CreateFilter>("all");
  const [gestionF, setGestionF] = useState<GestionFilter>("all");
  const [activeCard, setActiveCard] = useState<CardKey>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["users", "list"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select(
          "user_id, full_name, email, role, status, erp_user_code, updated_at",
        )
        .order("full_name");
      if (error) throw error;

      const ids = (profiles ?? []).map((p) => p.user_id);
      const accessCounts = new Map<string, number>();
      const createCounts = new Map<string, number>();
      if (ids.length) {
        const { data: access } = await supabase
          .from("user_client_access")
          .select("user_id, can_create_agreements")
          .in("user_id", ids);
        (access ?? []).forEach((a) => {
          if (a.user_id) {
            accessCounts.set(a.user_id, (accessCounts.get(a.user_id) ?? 0) + 1);
            if (a.can_create_agreements) {
              createCounts.set(a.user_id, (createCounts.get(a.user_id) ?? 0) + 1);
            }
          }
        });
      }
      const agreementCounts = new Map<string, number>();
      if (ids.length) {
        const { data: members } = await supabase
          .from("agreement_members")
          .select("user_id")
          .in("user_id", ids);
        (members ?? []).forEach((m) => {
          if (m.user_id) {
            agreementCounts.set(m.user_id, (agreementCounts.get(m.user_id) ?? 0) + 1);
          }
        });
      }
      return (profiles ?? []).map((p) => ({
        ...p,
        client_count: accessCounts.get(p.user_id) ?? 0,
        create_count: createCounts.get(p.user_id) ?? 0,
        agreement_count: agreementCounts.get(p.user_id) ?? 0,
      })) as UserRow[];
    },
  });

  const all = data ?? [];
  const totalCount = all.length;
  const activeCount = all.filter((u) => u.status === "active").length;
  const inactiveCount = all.filter((u) => u.status === "inactive").length;
  const alertsCount = all.filter((u) => getUserIssues(u).length > 0).length;

  const filtered = all.filter((u) => {
    if (activeCard === "active" && u.status !== "active") return false;
    if (activeCard === "inactive" && u.status !== "inactive") return false;
    if (activeCard === "alerts" && getUserIssues(u).length === 0) return false;

    if (roleF !== "all" && u.role !== roleF) return false;

    if (createF === "yes" && !(u.role === "platform_user" && u.create_count > 0)) return false;
    if (createF === "no" && !(u.role === "platform_user" && u.create_count === 0)) return false;

    if (gestionF === "active" && !(u.agreement_count > 0)) return false;
    if (gestionF === "none" && !(u.role === "platform_user" && u.agreement_count === 0)) return false;

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
    { key: "alerts", label: "Alertas", value: alertsCount },
  ];

  const cardLabelByKey: Record<CardKey, string> = {
    all: "Usuarios",
    active: "Activos",
    inactive: "Inactivos",
    alerts: "Alertas",
  };

  const hasActiveFilters =
    activeCard !== "all" ||
    roleF !== "all" ||
    createF !== "all" ||
    gestionF !== "all" ||
    search.trim() !== "";

  const clearFilters = () => {
    setActiveCard("all");
    setRoleF("all");
    setCreateF("all");
    setGestionF("all");
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
          <label htmlFor="create-select" className="text-xs text-muted-foreground">
            Crea acuerdos
          </label>
          <Select value={createF} onValueChange={(v) => setCreateF(v as CreateFilter)}>
            <SelectTrigger id="create-select" className="w-48">
              <SelectValue placeholder="Crea acuerdos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="yes">Sí</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="gestion-select" className="text-xs text-muted-foreground">
            En gestión
          </label>
          <Select value={gestionF} onValueChange={(v) => setGestionF(v as GestionFilter)}>
            <SelectTrigger id="gestion-select" className="w-48">
              <SelectValue placeholder="En gestión" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">Con acuerdos</SelectItem>
              <SelectItem value="none">Sin acuerdos</SelectItem>
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
              {createF !== "all" && (
                <Chip size="small" variant="soft" color="neutral" onRemove={() => setCreateF("all")}>
                  {createF === "yes" ? "Crea acuerdos: Sí" : "Crea acuerdos: No"}
                </Chip>
              )}
              {gestionF !== "all" && (
                <Chip size="small" variant="soft" color="neutral" onRemove={() => setGestionF("all")}>
                  {gestionF === "active" ? "En gestión: Con acuerdos" : "En gestión: Sin acuerdos"}
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
                <TableHead>Código</TableHead>
                <TableHead>Cartera</TableHead>
                <TableHead>Crea acuerdos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    {all.length === 0
                      ? "Aún no hay usuarios creados."
                      : "No hay usuarios que coincidan con los filtros."}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((u) => {
                const issues = getUserIssues(u);
                const isSuper = u.role === "super_admin";
                const isActive = u.status === "active";
                return (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          to="/setup/users/$userId"
                          params={{ userId: u.user_id }}
                          className="hover:underline"
                        >
                          {u.full_name}
                        </Link>
                        {isSuper && <Chip size="small" color="info">Super admin</Chip>}
                        {issues.length > 0 && (
                          <StatusBadge
                            status="warning"
                            label="Alerta"
                            title={issues.join(" · ")}
                          />
                        )}
                      </div>
                      <span className="block text-xs text-muted-foreground">{u.email}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {u.erp_user_code ? u.erp_user_code : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {isSuper ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span>
                          {u.client_count} {u.client_count === 1 ? "cliente" : "clientes"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {isSuper ? (
                        <span className="text-muted-foreground">—</span>
                      ) : u.create_count > 0 ? (
                        <span>
                          {u.create_count} de {u.client_count}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={isActive ? "active" : "neutral"}
                        label={isActive ? "Activo" : "Inactivo"}
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
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

type UserRow = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  status: string;
  erp_user_code: string | null;
  updated_at: string | null;
  client_count: number;
  create_count: number;
  agreement_count: number;
};

function getUserIssues(u: UserRow): string[] {
  const issues: string[] = [];
  if (u.role === "platform_user" && u.client_count === 0) {
    issues.push("Sin clientes asignados");
  }
  if (u.status === "inactive" && u.client_count > 0) {
    issues.push("Usuario inactivo con accesos existentes");
  }
  return issues;
}
