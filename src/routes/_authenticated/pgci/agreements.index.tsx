import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Search } from "lucide-react";
import { listAgreements } from "@/lib/agreements.functions";
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

export const Route = createFileRoute("/_authenticated/pgci/agreements/")({
  head: () => ({ meta: [{ title: "Acuerdos · PGCI" }] }),
  component: AgreementsList,
});

type CardKey = "all" | "active" | "pending" | "review" | "mine";
type StatusFilter = "all" | "active" | "inactive";
type ScopeFilter = "all" | "global" | "unit";

function formatDate(value: string | null) {
  if (!value) return "—";
  // value is YYYY-MM-DD; display dd/mm/yyyy
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

function AgreementsList() {
  const listFn = useServerFn(listAgreements);
  const { data, isLoading } = useQuery({
    queryKey: ["agreements", "list"],
    queryFn: () => listFn(),
  });

  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState<StatusFilter>("all");
  const [scopeF, setScopeF] = useState<ScopeFilter>("all");
  const [activeCard, setActiveCard] = useState<CardKey>("all");

  const all = useMemo(() => data ?? [], [data]);

  const totalCount = all.length;
  const activeCount = all.filter((a) => a.status === "active").length;
  const pendingCount = all.filter((a) => (a.lines_pending ?? 0) > 0).length;
  const reviewCount = all.filter((a) => (a.lines_review ?? 0) > 0).length;
  const mineCount = all.filter(
    (a) => a.my_role && a.my_role !== "super_admin",
  ).length;

  const filtered = all.filter((a) => {
    if (activeCard === "active" && a.status !== "active") return false;
    if (activeCard === "pending" && (a.lines_pending ?? 0) === 0) return false;
    if (activeCard === "review" && (a.lines_review ?? 0) === 0) return false;
    if (
      activeCard === "mine" &&
      (!a.my_role || a.my_role === "super_admin")
    )
      return false;

    if (statusF !== "all" && a.status !== statusF) return false;
    if (scopeF !== "all" && a.scope !== scopeF) return false;

    if (search) {
      const s = search.toLowerCase();
      const hay = [a.name, a.client_legal_name, a.client_commercial_name, a.unit_name]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(s));
      if (!hay) return false;
    }
    return true;
  });

  const summaryCards: { key: CardKey; label: string; value: number }[] = [
    { key: "all", label: "Acuerdos", value: totalCount },
    { key: "active", label: "Activos", value: activeCount },
    { key: "pending", label: "Con pendientes", value: pendingCount },
    { key: "review", label: "Requieren revisión", value: reviewCount },
  ];
  // "Mine" sólo si el usuario es miembro de algún acuerdo (rol distinto a SA).
  if (mineCount > 0) {
    summaryCards.push({ key: "mine", label: "En los que participo", value: mineCount });
  }

  const cardLabelByKey: Record<CardKey, string> = {
    all: "Acuerdos",
    active: "Activos",
    pending: "Con pendientes",
    review: "Requieren revisión",
    mine: "En los que participo",
  };

  const hasActiveFilters =
    activeCard !== "all" ||
    statusF !== "all" ||
    scopeF !== "all" ||
    search.trim() !== "";

  const clearFilters = () => {
    setActiveCard("all");
    setStatusF("all");
    setScopeF("all");
    setSearch("");
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Acuerdos comerciales</h1>
          <p className="text-sm text-muted-foreground">
            Consulta y gestiona los acuerdos comerciales activos por cliente.
          </p>
        </div>
        <Button asChild>
          <Link to="/pgci/agreements/new">
            <Plus className="mr-2 h-4 w-4" /> Crear acuerdo
          </Link>
        </Button>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
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
            placeholder="Buscar por nombre, cliente o unidad…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9"
          />
        </div>
        <div className="flex gap-2 shrink-0 md:ml-auto">
          <Select value={scopeF} onValueChange={(v) => setScopeF(v as ScopeFilter)}>
            <SelectTrigger className="w-44 shrink-0">
              <SelectValue placeholder="Alcance" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alcance: todos</SelectItem>
              <SelectItem value="global">Global</SelectItem>
              <SelectItem value="unit">Por unidad</SelectItem>
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
              {filtered.length} de {totalCount} {totalCount === 1 ? "acuerdo" : "acuerdos"}
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
              {scopeF !== "all" && (
                <Chip size="small" variant="soft" color="neutral" onRemove={() => setScopeF("all")}>
                  {scopeF === "global" ? "Global" : "Por unidad"}
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
                <TableHead>Acuerdo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Vigencia</TableHead>
                <TableHead className="text-right">Líneas</TableHead>
                <TableHead className="text-right">Pendientes</TableHead>
                <TableHead className="text-right">Revisión</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                    Cargando…
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                    {all.length === 0
                      ? "Aún no hay acuerdos. Crea el primero para empezar a registrar información comercial."
                      : "No hay acuerdos que coincidan con los filtros."}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((a) => {
                const clientName = a.client_commercial_name || a.client_legal_name || "—";
                const vigencia = `${formatDate(a.start_date)} – ${formatDate(a.end_date)}`;
                return (
                  <TableRow key={a.id ?? undefined}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Link
                          to="/pgci/agreements/$agreementId"
                          params={{ agreementId: a.id as string }}
                          className="hover:underline"
                        >
                          {a.name}
                        </Link>
                        {a.scope === "unit" && <Badge color="info">Unidad</Badge>}
                      </div>
                      {a.scope === "unit" && a.unit_name && (
                        <span className="block text-xs text-muted-foreground truncate max-w-[260px]" title={a.unit_name}>
                          {a.unit_name}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{clientName}</TableCell>
                    <TableCell className="text-muted-foreground">{vigencia}</TableCell>
                    <TableCell className="text-right">{a.lines_total ?? 0}</TableCell>
                    <TableCell className="text-right">
                      {(a.lines_pending ?? 0) > 0 ? (
                        <Badge color="warning">{a.lines_pending}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {(a.lines_review ?? 0) > 0 ? (
                        <Badge color="danger">{a.lines_review}</Badge>
                      ) : (
                        <span className="text-muted-foreground">0</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={a.status === "active" ? "active" : "neutral"}
                        label={a.status === "active" ? "Activo" : "Inactivo"}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button asChild size="sm" variant="ghost">
                        <Link
                          to="/pgci/agreements/$agreementId"
                          params={{ agreementId: a.id as string }}
                        >
                          Ver
                        </Link>
                      </Button>
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
