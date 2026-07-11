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
  Badge,
  Chip,
  StatusBadge,
  DataTable,
  type DataTableColumn,
  type RowAction,
} from "@/components/sumatec";
import { Eye, Pencil, Plus, Search, Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/setup/clients/")({
  head: () => ({ meta: [{ title: "Clientes · Setup · PGCI" }] }),
  component: ClientsList,
});

type CardKey = "all" | "holdings" | "direct" | "withAgreements";
type StatusFilter = "all" | "active" | "inactive";
type HoldingRelFilter = "all" | "linked" | "unlinked";

type ClientRow = {
  id: string;
  commercial_name: string | null;
  legal_name: string;
  erp_name: string | null;
  tax_id: string | null;
  type: string;
  status: string;
  parent_client_id: string | null;
  updated_at: string | null;
  display_name: string;
  company_count: number;
  agreement_count: number;
  parent_name: string | null;
};

function ClientsList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState<StatusFilter>("all");
  const [holdingRelF, setHoldingRelF] = useState<HoldingRelFilter>("all");
  const [activeCard, setActiveCard] = useState<CardKey>("all");

  const { data, isLoading } = useQuery({
    queryKey: ["clients", "list"],
    queryFn: async () => {
      const { data: clientsRaw, error } = await supabase
        .from("clients")
        .select("id, commercial_name, legal_name, erp_name, tax_id, type, status, parent_client_id, updated_at");
      if (error) throw error;
      const clients = [...(clientsRaw ?? [])].sort((a, b) =>
        (a.commercial_name?.trim() || a.legal_name || "").localeCompare(
          b.commercial_name?.trim() || b.legal_name || "",
          "es",
          { sensitivity: "base" },
        ),
      );

      const ids = clients.map((c) => c.id);
      const childCounts = new Map<string, number>();
      const agreementCounts = new Map<string, number>();
      if (ids.length) {
        clients.forEach((c) => {
          if (c.parent_client_id) {
            childCounts.set(
              c.parent_client_id,
              (childCounts.get(c.parent_client_id) ?? 0) + 1,
            );
          }
        });
        const { data: agreementLinks } = await supabase
          .from("agreement_companies")
          .select("client_id")
          .in("client_id", ids)
          .is("valid_until", null);
        (agreementLinks ?? []).forEach((a) => {
          if (a.client_id)
            agreementCounts.set(a.client_id, (agreementCounts.get(a.client_id) ?? 0) + 1);
        });
      }
      const nameById = new Map<string, string>();
      clients.forEach((c) => {
        nameById.set(c.id, c.commercial_name?.trim() || c.legal_name);
      });
      return clients.map((c) => ({
        ...c,
        display_name: c.commercial_name?.trim() || c.legal_name,
        company_count: childCounts.get(c.id) ?? 0,
        agreement_count: agreementCounts.get(c.id) ?? 0,
        parent_name: c.parent_client_id ? nameById.get(c.parent_client_id) ?? null : null,
      })) as ClientRow[];
    },
  });

  const all = data ?? [];

  const totalCount = all.length;
  const holdingsCount = all.filter((c) => c.type === "holding").length;
  const directCount = all.filter((c) => c.type === "direct").length;
  const withAgreementsCount = all.filter((c) => c.agreement_count > 0).length;

  const filtered = all.filter((c) => {
    if (activeCard === "holdings" && c.type !== "holding") return false;
    if (activeCard === "direct" && c.type !== "direct") return false;
    if (activeCard === "withAgreements" && c.agreement_count === 0) return false;

    if (statusF !== "all" && c.status !== statusF) return false;

    if (holdingRelF === "linked") {
      if (c.type !== "direct" || !c.parent_client_id) return false;
    } else if (holdingRelF === "unlinked") {
      if (c.type !== "direct" || c.parent_client_id) return false;
    }

    if (search) {
      const s = search.toLowerCase();
      const hay = [c.commercial_name, c.legal_name, c.erp_name, c.tax_id]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(s));
      if (!hay) return false;
    }
    return true;
  });

  const summaryCards: { key: CardKey; label: string; value: number }[] = [
    { key: "all", label: "Clientes", value: totalCount },
    { key: "holdings", label: "Holdings", value: holdingsCount },
    { key: "direct", label: "Directos", value: directCount },
    { key: "withAgreements", label: "Con acuerdos", value: withAgreementsCount },
  ];

  const cardLabelByKey: Record<CardKey, string> = {
    all: "Clientes",
    holdings: "Holdings",
    direct: "Directos",
    withAgreements: "Con acuerdos",
  };

  const hasActiveFilters =
    activeCard !== "all" ||
    statusF !== "all" ||
    holdingRelF !== "all" ||
    search.trim() !== "";

  const clearFilters = () => {
    setActiveCard("all");
    setStatusF("all");
    setHoldingRelF("all");
    setSearch("");
  };

  const columns: DataTableColumn<ClientRow>[] = [
    {
      id: "client",
      header: "Cliente",
      cell: (c) => (
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="min-w-0 truncate text-[13px] font-semibold text-text-primary">
              {c.display_name}
            </span>
            {c.type === "holding" && <Badge color="info">Holding</Badge>}
          </div>
          {c.parent_client_id && (
            <div
              className="line-clamp-2 text-[13px] leading-[1.35] text-text-secondary"
              title={c.parent_name ?? undefined}
            >
              {c.parent_name ?? "—"}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "nit",
      header: "NIT",
      width: 140,
      wrap: false,
      cell: (c) =>
        c.tax_id ? (
          <span className="font-mono text-[12.5px] text-text-primary">{c.tax_id}</span>
        ) : (
          <span className="text-text-tertiary">—</span>
        ),
    },
    {
      id: "companies",
      header: "Empresas",
      width: 100,
      numeric: true,
      cell: (c) =>
        c.type === "holding" ? (
          c.company_count
        ) : (
          <span className="text-text-tertiary">—</span>
        ),
    },
    {
      id: "agreements",
      header: "Acuerdos",
      width: 100,
      numeric: true,
      cell: (c) => c.agreement_count,
    },
    {
      id: "status",
      header: "Estado",
      width: 110,
      wrap: false,
      cell: (c) => (
        <StatusBadge
          status={c.status === "active" ? "active" : "neutral"}
          label={c.status === "active" ? "Activo" : "Inactivo"}
        />
      ),
    },
  ];

  const rowActions = (c: ClientRow): RowAction<ClientRow>[] => [
    {
      label: "Ver detalle",
      icon: <Eye className="h-4 w-4" />,
      onSelect: () =>
        navigate({ to: "/setup/clients/$clientId", params: { clientId: c.id } }),
    },
    {
      label: "Editar",
      icon: <Pencil className="h-4 w-4" />,
      onSelect: () =>
        navigate({ to: "/setup/clients/$clientId/edit", params: { clientId: c.id } }),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="suma-h1">Clientes</h1>
          <p className="suma-body text-text-secondary">
            Administra clientes como base para la gestión de acuerdos y la operación comercial.
          </p>
        </div>
        <Button asChild>
          <Link to="/setup/clients/new">
            <Plus className="mr-2 h-4 w-4" /> Crear cliente
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
                  <div className="suma-overline text-text-tertiary">{c.label}</div>
                  <div className="mt-1 suma-metric">
                    {isLoading ? "—" : c.value}
                  </div>
                </CardContent>
              </Card>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 md:flex-nowrap">
        <div className="relative w-full flex-1 min-w-[16rem]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre o NIT…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9"
          />
        </div>
        <div className="flex gap-2 shrink-0 md:ml-auto">
          <Select value={holdingRelF} onValueChange={(v) => setHoldingRelF(v as HoldingRelFilter)}>
            <SelectTrigger className="w-44 shrink-0">
              <SelectValue placeholder="Relación con holding" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Relación: todos</SelectItem>
              <SelectItem value="linked">Asociados a holding</SelectItem>
              <SelectItem value="unlinked">Sin holding</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusF} onValueChange={(v) => setStatusF(v as StatusFilter)}>
            <SelectTrigger className="w-44 shrink-0">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Estado: todos</SelectItem>
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
              {filtered.length} de {totalCount} {totalCount === 1 ? "cliente" : "clientes"}
            </p>
            <div className="flex flex-wrap gap-2">
              {activeCard !== "all" && (
                <Chip size="small" variant="soft" color="neutral" onRemove={() => setActiveCard("all")}>
                  {cardLabelByKey[activeCard]}
                </Chip>
              )}
              {statusF !== "all" && (
                <Chip size="small" variant="soft" color="neutral" onRemove={() => setStatusF("all")}>
                  {statusF === "active" ? "Activos" : "Inactivos"}
                </Chip>
              )}
              {holdingRelF !== "all" && (
                <Chip size="small" variant="soft" color="neutral" onRemove={() => setHoldingRelF("all")}>
                  {holdingRelF === "linked" ? "Asociados a holding" : "Sin holding"}
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
          getRowId={(c) => c.id}
          rowActions={rowActions}
          onRowClick={(c) =>
            navigate({ to: "/setup/clients/$clientId", params: { clientId: c.id } })
          }
          loading={isLoading}
          empty={{
            icon: <Building2 className="h-5 w-5" />,
            title:
              all.length === 0 ? "Aún no hay clientes" : "Sin resultados",
            description:
              all.length === 0
                ? "Crea los clientes piloto para continuar."
                : "No hay clientes que coincidan con los filtros.",
          }}
          ariaLabel="Clientes"
        />
      </div>
    </div>
  );
}
