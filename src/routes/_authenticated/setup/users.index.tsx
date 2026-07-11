import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Chip,
  StatusBadge,
  DataTable,
  type DataTableColumn,
  type RowAction,
} from "@/components/sumatec";
import { Eye, Pencil, Plus, Search, UserPlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/setup/users/")({
  head: () => ({ meta: [{ title: "Usuarios y accesos · Setup · PGCI" }] }),
  component: UsersList,
});

type CardKey = "all" | "active" | "inactive" | "alerts";
type CreateFilter = "all" | "yes" | "no";
type ParticipationFilter = "all" | "admin" | "member" | "both" | "none";

function UsersList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [createF, setCreateF] = useState<CreateFilter>("all");
  const [participationF, setParticipationF] = useState<ParticipationFilter>("all");
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
          .in("user_id", ids)
          .is("valid_until", null);
        (access ?? []).forEach((a) => {
          if (a.user_id) {
            accessCounts.set(a.user_id, (accessCounts.get(a.user_id) ?? 0) + 1);
            if (a.can_create_agreements) {
              createCounts.set(a.user_id, (createCounts.get(a.user_id) ?? 0) + 1);
            }
          }
        });
      }
      const adminCounts = new Map<string, number>();
      const memberCounts = new Map<string, number>();
      if (ids.length) {
        const { data: members } = await supabase
          .from("agreement_members")
          .select("user_id, role")
          .in("user_id", ids)
          .is("valid_until", null);
        (members ?? []).forEach((m) => {
          if (!m.user_id) return;
          if (m.role === "agreement_admin") {
            adminCounts.set(m.user_id, (adminCounts.get(m.user_id) ?? 0) + 1);
          } else if (m.role === "agreement_member") {
            memberCounts.set(m.user_id, (memberCounts.get(m.user_id) ?? 0) + 1);
          }
        });
      }
      return (profiles ?? []).map((p) => {
        const admin_count = adminCounts.get(p.user_id) ?? 0;
        const member_count = memberCounts.get(p.user_id) ?? 0;
        return {
          ...p,
          client_count: accessCounts.get(p.user_id) ?? 0,
          create_count: createCounts.get(p.user_id) ?? 0,
          admin_count,
          member_count,
          agreement_count: admin_count + member_count,
        };
      }) as UserRow[];
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

    if (createF === "yes" && !(u.role === "platform_user" && u.create_count > 0)) return false;
    if (createF === "no" && !(u.role === "platform_user" && u.create_count === 0)) return false;

    if (participationF === "admin" && !(u.admin_count > 0)) return false;
    if (participationF === "member" && !(u.member_count > 0)) return false;
    if (participationF === "both" && !(u.admin_count > 0 && u.member_count > 0)) return false;
    if (participationF === "none" && !(u.role === "platform_user" && u.agreement_count === 0)) return false;

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

  const createLabelByKey: Record<Exclude<CreateFilter, "all">, string> = {
    yes: "Puede crear",
    no: "No puede crear",
  };

  const participationLabelByKey: Record<Exclude<ParticipationFilter, "all">, string> = {
    admin: "Administra acuerdos",
    member: "Participa como miembro",
    both: "Administra y participa",
    none: "Sin acuerdos activos",
  };

  const hasActiveFilters =
    activeCard !== "all" ||
    createF !== "all" ||
    participationF !== "all" ||
    search.trim() !== "";

  const clearFilters = () => {
    setActiveCard("all");
    setCreateF("all");
    setParticipationF("all");
    setSearch("");
  };

  const columns: DataTableColumn<UserRow>[] = [
    {
      id: "user",
      header: "Usuario",
      cell: (u) => {
        const issues = getUserIssues(u);
        const isSuper = u.role === "super_admin";
        return (
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="min-w-0 truncate font-ui text-[13px] font-semibold text-text-primary">
                {u.full_name ?? "—"}
              </span>
              {isSuper && (
                <StatusBadge status="info" label="Super admin" withIcon={false} />
              )}
              {issues.length > 0 && (
                <StatusBadge status="warning" label="Alerta" title={issues.join(" · ")} />
              )}
            </div>
            <div className="text-[12px] leading-[1.35] text-text-tertiary">
              {u.email ?? "—"}
            </div>
          </div>
        );
      },
    },
    {
      id: "code",
      header: "Código",
      width: 120,
      wrap: false,
      cell: (u) =>
        u.erp_user_code ? (
          <span className="font-mono text-[12.5px] text-text-primary">
            {u.erp_user_code}
          </span>
        ) : (
          <span className="text-text-tertiary">—</span>
        ),
    },
    {
      id: "cartera",
      header: "Cartera",
      width: 130,
      wrap: false,
      cell: (u) =>
        u.role === "super_admin" ? (
          <span className="text-text-tertiary">—</span>
        ) : (
          <span>
            {u.client_count} {u.client_count === 1 ? "cliente" : "clientes"}
          </span>
        ),
    },
    {
      id: "status",
      header: "Estado",
      width: 110,
      wrap: false,
      cell: (u) => (
        <StatusBadge
          status={u.status === "active" ? "active" : "neutral"}
          label={u.status === "active" ? "Activo" : "Inactivo"}
        />
      ),
    },
  ];

  const rowActions = (u: UserRow): RowAction<UserRow>[] => [
    {
      label: "Ver detalle",
      icon: <Eye className="h-4 w-4" />,
      onSelect: () =>
        navigate({ to: "/setup/users/$userId", params: { userId: u.user_id } }),
    },
    {
      label: "Editar",
      icon: <Pencil className="h-4 w-4" />,
      onSelect: () =>
        navigate({ to: "/setup/users/$userId/edit", params: { userId: u.user_id } }),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="suma-h1">Usuarios y accesos</h1>
          <p className="suma-body text-text-secondary">
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
                    ? "border-l-[3px] border-l-primary shadow-sm transition-colors"
                    : "hover:border-muted-foreground/20 hover:bg-muted/30 transition-colors"
                }
              >
                <CardContent className="p-4">
                  <div className="suma-body text-text-tertiary">{c.label}</div>
                  <div className="mt-1 suma-metric">
                    {isLoading ? "—" : c.value}
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 items-end md:flex-nowrap">
        <div className="relative w-full md:flex-1 md:min-w-[16rem]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, email o código ERP…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9"
          />
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <label htmlFor="create-select" className="text-xs text-muted-foreground">
            Permiso de creación
          </label>
          <Select value={createF} onValueChange={(v) => setCreateF(v as CreateFilter)}>
            <SelectTrigger id="create-select" className="w-44">
              <SelectValue placeholder="Permiso de creación" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="yes">Puede crear</SelectItem>
              <SelectItem value="no">No puede crear</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5 shrink-0">
          <label htmlFor="participation-select" className="text-xs text-muted-foreground">
            Participación en acuerdos
          </label>
          <Select
            value={participationF}
            onValueChange={(v) => setParticipationF(v as ParticipationFilter)}
          >
            <SelectTrigger id="participation-select" className="w-44">
              <SelectValue placeholder="Participación en acuerdos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="admin">Administra acuerdos</SelectItem>
              <SelectItem value="member">Participa como miembro</SelectItem>
              <SelectItem value="both">Administra y participa</SelectItem>
              <SelectItem value="none">Sin acuerdos activos</SelectItem>
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
              {createF !== "all" && (
                <Chip size="small" variant="soft" color="neutral" onRemove={() => setCreateF("all")}>
                  Permiso: {createLabelByKey[createF]}
                </Chip>
              )}
              {participationF !== "all" && (
                <Chip size="small" variant="soft" color="neutral" onRemove={() => setParticipationF("all")}>
                  Participación: {participationLabelByKey[participationF]}
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

        <DataTable
          data={filtered}
          columns={columns}
          getRowId={(u) => u.user_id}
          rowActions={rowActions}
          onRowClick={(u) =>
            navigate({ to: "/setup/users/$userId", params: { userId: u.user_id } })
          }
          loading={isLoading}
          empty={{
            icon: <UserPlus className="h-5 w-5" />,
            title:
              all.length === 0
                ? "Aún no hay usuarios creados"
                : "Sin resultados",
            description:
              all.length === 0
                ? "Crea el primer usuario para empezar."
                : "No hay usuarios que coincidan con los filtros.",
          }}
          ariaLabel="Usuarios"
        />
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
  admin_count: number;
  member_count: number;
  agreement_count: number;
};

function formatParticipation(admin: number, member: number): string {
  if (admin > 0 && member > 0) {
    return `Administra ${admin} · Participa en ${member}`;
  }
  if (admin > 0) {
    return `Administra ${admin} ${admin === 1 ? "acuerdo" : "acuerdos"}`;
  }
  if (member > 0) {
    return `Participa en ${member} ${member === 1 ? "acuerdo" : "acuerdos"}`;
  }
  return "Sin acuerdos";
}

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
