import { createFileRoute, Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowUpRight, Plus, Search } from "lucide-react";
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
import type { SumatecBadgeColor, SumatecBadgeVariant } from "@/components/sumatec/Badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type CountSpec = {
  key: string;
  label: string;
  value: number;
  color: SumatecBadgeColor;
  variant?: SumatecBadgeVariant;
};

const COUNTER_STYLE: CSSProperties = {
  boxSizing: "border-box",
  minWidth: 24,
  height: 24,
  padding: 0,
};

function PositionsCounters({
  counts,
  agreementId,
}: {
  counts: CountSpec[];
  agreementId?: string | null;
}) {
  const visible = counts.filter((c) => c.value > 0);
  if (visible.length === 0) {
    return <span className="text-muted-foreground">0</span>;
  }
  return (
    <div className="flex items-center gap-1.5">
      {visible.map((c) => (
        <Tooltip key={c.key}>
          <TooltipTrigger asChild>
            <span className="inline-flex cursor-default">
              <Badge color={c.color} variant={c.variant ?? "soft"} style={COUNTER_STYLE}>
                {c.value}
              </Badge>
            </span>
          </TooltipTrigger>
          <TooltipContent>{c.label}</TooltipContent>
        </Tooltip>
      ))}
      {agreementId && (
        <Button asChild size="sm" variant="ghost">
          <Link
            to="/pgci/agreements/$agreementId/lines"
            params={{ agreementId: agreementId as string }}
            className="inline-flex items-center gap-px"
          >
            Abrir <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/pgci/agreements/")({
  head: () => ({ meta: [{ title: "Acuerdos · PGCI" }] }),
  component: AgreementsList,
});

type CardKey = "all" | "active" | "pending" | "review";
type StatusFilter = "all" | "active" | "inactive";

type VigenciaBadge = {
  color: "info" | "warning" | "error" | "neutral";
  label: string;
};

function vigenciaBadge(endDate: string | null): VigenciaBadge {
  if (!endDate) return { color: "neutral", label: "Sin vigencia" };
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(endDate);
  if (!m) return { color: "neutral", label: "Sin vigencia" };
  const end = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((end.getTime() - today.getTime()) / 86_400_000);
  const label = `${m[3]}/${m[2]}/${m[1]}`;
  if (diffDays < 0) return { color: "error", label };
  if (diffDays <= 30) return { color: "warning", label };
  return { color: "info", label };
}


function AgreementsList() {
  const listFn = useServerFn(listAgreements);
  const { data, isLoading } = useQuery({
    queryKey: ["agreements", "list"],
    queryFn: () => listFn(),
  });

  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState<StatusFilter>("all");
  const [activeCard, setActiveCard] = useState<CardKey>("all");

  const all = useMemo(() => data ?? [], [data]);

  const totalCount = all.length;
  const activeCount = all.filter((a) => a.status === "active").length;
  const pendingCount = all.filter((a) => (a.lines_pending ?? 0) > 0).length;
  const reviewCount = all.filter((a) => (a.lines_review ?? 0) > 0).length;

  const filtered = all.filter((a) => {
    if (activeCard === "active" && a.status !== "active") return false;
    if (activeCard === "pending" && (a.lines_pending ?? 0) === 0) return false;
    if (activeCard === "review" && (a.lines_review ?? 0) === 0) return false;

    if (statusF !== "all" && a.status !== statusF) return false;

    if (search) {
      const s = search.toLowerCase();
      const hay = [
        a.name,
        a.group_name,
        a.group_client_legal_name,
        a.group_client_commercial_name,
        a.unit_name,
        a.group_client_tax_id,
      ]
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

  const cardLabelByKey: Record<CardKey, string> = {
    all: "Acuerdos",
    active: "Activos",
    pending: "Con pendientes",
    review: "Requieren revisión",

  };

  const hasActiveFilters =
    activeCard !== "all" ||
    statusF !== "all" ||
    search.trim() !== "";

  const clearFilters = () => {
    setActiveCard("all");
    setStatusF("all");
    setSearch("");
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Acuerdos comerciales</h1>
          <p className="text-sm text-muted-foreground">
            Consulta y gestiona los acuerdos comerciales con clientes.
          </p>
        </div>
        <Button asChild>
          <Link to="/pgci/agreements/new">
            <Plus className="mr-2 h-4 w-4" /> Crear acuerdo
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
            placeholder="Buscar por acuerdo, cliente o NIT…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9"
          />
        </div>
        <div className="flex gap-2 shrink-0 md:ml-auto">
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
          <TooltipProvider delayDuration={150}>
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-auto">Acuerdo</TableHead>
                <TableHead className="w-auto">Cliente</TableHead>
                <TableHead className="w-[240px] whitespace-nowrap">Posiciones</TableHead>
                <TableHead className="w-[112px] whitespace-nowrap">Vigencia</TableHead>
                <TableHead className="w-[96px] whitespace-nowrap">Estado</TableHead>
                <TableHead className="w-[144px] whitespace-nowrap text-right">Acciones</TableHead>
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
                      ? "Aún no hay acuerdos. Crea el primero para empezar a registrar información comercial."
                      : "No hay acuerdos que coincidan con los filtros."}
                  </TableCell>
                </TableRow>
              )}
              {filtered.map((a) => {
                const clientName = a.group_client_commercial_name || a.group_client_legal_name || a.group_name || "—";
                const vig = vigenciaBadge(a.end_date ?? null);
                const counts: CountSpec[] = [
                  { key: "total", label: "Total de posiciones", value: a.lines_total ?? 0, color: "neutral" },
                  { key: "active", label: "Activas", value: (a as { lines_active?: number }).lines_active ?? 0, color: "success" },
                  { key: "pending", label: "Pendientes", value: a.lines_pending ?? 0, color: "warning" },
                  { key: "review", label: "Requieren revisión", value: a.lines_review ?? 0, color: "error" },
                  { key: "excluded", label: "Excluidas", value: (a as { lines_excluded?: number }).lines_excluded ?? 0, color: "error", variant: "solid" },
                ];
                return (
                  <TableRow key={a.id ?? undefined}>
                    <TableCell className="font-medium min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <Link
                          to="/pgci/agreements/$agreementId"
                          params={{ agreementId: a.id as string }}
                          className="hover:underline truncate"
                        >
                          {a.name}
                        </Link>
                        {a.scope === "unit" && <Badge color="info">Con alcance</Badge>}
                      </div>
                      {a.scope === "unit" && a.unit_name && (
                        <span className="block text-xs text-muted-foreground truncate max-w-[260px]" title={a.unit_name}>
                          {a.unit_name}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground min-w-0 truncate">{clientName}</TableCell>
                    <TableCell className="w-[240px] whitespace-nowrap">
                      <PositionsCounters counts={counts} agreementId={a.id ?? null} />
                    </TableCell>
                    <TableCell className="w-[112px] whitespace-nowrap">
                      <Badge color={vig.color}>{vig.label}</Badge>
                    </TableCell>
                    <TableCell className="w-[96px] whitespace-nowrap">
                      <StatusBadge
                        status={a.status === "active" ? "active" : "neutral"}
                        label={a.status === "active" ? "Activo" : "Inactivo"}
                      />
                    </TableCell>
                    <TableCell className="w-[144px] whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1">
                        <Button asChild size="sm" variant="ghost">
                          <Link
                            to="/pgci/agreements/$agreementId"
                            params={{ agreementId: a.id as string }}
                          >
                            Ver
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                          <Link
                            to="/pgci/agreements/$agreementId/edit"
                            params={{ agreementId: a.id as string }}
                          >
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
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
