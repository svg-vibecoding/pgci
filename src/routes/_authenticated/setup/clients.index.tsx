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
import { Badge, Chip, StatusBadge } from "@/components/sumatec";
import { Plus, Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/setup/clients/")({
  head: () => ({ meta: [{ title: "Clientes · Setup · PGCI" }] }),
  component: ClientsList,
});

type CardKey = "all" | "holdings" | "direct" | "withAgreements";
type StatusFilter = "all" | "active" | "inactive";
type HoldingRelFilter = "all" | "linked" | "unlinked";

function ClientsList() {
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

      const ids = (clients ?? []).map((c) => c.id);
      const childCounts = new Map<string, number>();
      const agreementCounts = new Map<string, number>();
      if (ids.length) {
        (clients ?? []).forEach((c) => {
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
      (clients ?? []).forEach((c) => {
        nameById.set(c.id, c.commercial_name?.trim() || c.legal_name);
      });
      return (clients ?? []).map((c) => ({
        ...c,
        display_name: c.commercial_name?.trim() || c.legal_name,
        company_count: childCounts.get(c.id) ?? 0,
        agreement_count: agreementCounts.get(c.id) ?? 0,
        parent_name: c.parent_client_id ? nameById.get(c.parent_client_id) ?? null : null,
      }));
    },
  });

  const all = data ?? [];

  const totalCount = all.length;
  const holdingsCount = all.filter((c) => c.type === "holding").length;
  const directCount = all.filter((c) => c.type === "direct").length;
  const withAgreementsCount = all.filter((c) => c.agreement_count > 0).length;

  const filtered = all.filter((c) => {
    // Card filter
    if (activeCard === "holdings" && c.type !== "holding") return false;
    if (activeCard === "direct" && c.type !== "direct") return false;
    if (activeCard === "withAgreements" && c.agreement_count === 0) return false;

    // Status filter
    if (statusF !== "all" && c.status !== statusF) return false;

    // Holding relation filter (applies only to direct clients)
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

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
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
                <Chip
                  size="small"
                  variant="soft"
                  color="neutral"
                  onRemove={() => setActiveCard("all")}
                >
                  {cardLabelByKey[activeCard]}
                </Chip>
              )}
              {statusF !== "all" && (
                <Chip
                  size="small"
                  variant="soft"
                  color="neutral"
                  onRemove={() => setStatusF("all")}
                >
                  {statusF === "active" ? "Activos" : "Inactivos"}
                </Chip>
              )}
              {holdingRelF !== "all" && (
                <Chip
                  size="small"
                  variant="soft"
                  color="neutral"
                  onRemove={() => setHoldingRelF("all")}
                >
                  {holdingRelF === "linked" ? "Asociados a holding" : "Sin holding"}
                </Chip>
              )}
              {search.trim() && (
                <Chip
                  size="small"
                  variant="soft"
                  color="neutral"
                  onRemove={() => setSearch("")}
                >
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
                <TableHead>Cliente</TableHead>
                <TableHead>NIT</TableHead>
                <TableHead className="text-right">Empresas</TableHead>
                <TableHead className="text-right">Acuerdos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
                    {all.length === 0
                      ? "Aún no hay clientes creados. Crea los clientes piloto para continuar."
                      : "No hay clientes que coincidan con los filtros."}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <Link to="/setup/clients/$clientId" params={{ clientId: c.id }} className="hover:underline">
                        {c.display_name}
                      </Link>
                      {c.type === "holding" && (
                        <Badge color="info">Holding</Badge>
                      )}
                    </div>
                    {c.parent_client_id && (
                      <span
                        className="block text-xs text-muted-foreground truncate max-w-[260px]"
                        title={c.parent_name ?? undefined}
                      >
                        {c.parent_name ?? "—"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.tax_id ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    {c.type === "holding" ? c.company_count : "—"}
                  </TableCell>
                  <TableCell className="text-right">{c.agreement_count}</TableCell>
                  <TableCell>
                    <StatusBadge status={c.status === "active" ? "active" : "neutral"} label={c.status === "active" ? "Activo" : "Inactivo"} />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/setup/clients/$clientId" params={{ clientId: c.id }}>Ver</Link>
                      </Button>
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/setup/clients/$clientId/edit" params={{ clientId: c.id }}>Editar</Link>
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
