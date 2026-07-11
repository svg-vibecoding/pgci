import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Eye, FileText, Pencil, Plus, Search } from "lucide-react";
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
import { Card, CardContent } from "@/components/ui/card";
import {
  Badge,
  Chip,
  StatusBadge,
  DataTable,
  type DataTableColumn,
  type RowAction,
} from "@/components/sumatec";
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

function PositionsCounters({ counts }: { counts: CountSpec[] }) {
  const visible = counts.filter((c) => c.value > 0);
  if (visible.length === 0) {
    return <span className="text-text-tertiary">0</span>;
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
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/pgci/agreements/")({
  head: () => ({ meta: [{ title: "Acuerdos · PGCI" }] }),
  component: AgreementsList,
});

type CardKey = "all" | "active" | "review" | "transit";
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
  const navigate = useNavigate();
  const listFn = useServerFn(listAgreements);
  const { data, isLoading } = useQuery({
    queryKey: ["agreements", "list"],
    queryFn: () => listFn(),
  });

  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState<StatusFilter>("all");
  const [activeCard, setActiveCard] = useState<CardKey>("all");

  const all = useMemo(() => data ?? [], [data]);
  type AgreementRow = (typeof all)[number];

  const totalCount = all.length;
  const activeCount = all.filter((a) => a.status === "active").length;
  const reviewCount = all.filter(
    (a) => ((a as { lines_review?: number }).lines_review ?? 0) > 0,
  ).length;
  const transitCount = all.filter(
    (a) => ((a as { lines_transit?: number }).lines_transit ?? 0) > 0,
  ).length;

  const filtered = all.filter((a) => {
    if (activeCard === "active" && a.status !== "active") return false;
    if (activeCard === "review" && ((a as { lines_review?: number }).lines_review ?? 0) === 0)
      return false;
    if (activeCard === "transit" && ((a as { lines_transit?: number }).lines_transit ?? 0) === 0)
      return false;

    if (statusF !== "all" && a.status !== statusF) return false;

    if (search) {
      const s = search.toLowerCase();
      const companies = ((a as { companies?: string[] }).companies ?? []).join(" ");
      const hay = [a.name, a.group_name, a.unit_name, companies]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(s));
      if (!hay) return false;
    }
    return true;
  });

  const summaryCards: { key: CardKey; label: string; value: number }[] = [
    { key: "all", label: "Acuerdos", value: totalCount },
    { key: "active", label: "Acuerdos activos", value: activeCount },
    { key: "review", label: "Requieren revisión", value: reviewCount },
    { key: "transit", label: "En tránsito", value: transitCount },
  ];

  const cardLabelByKey: Record<CardKey, string> = {
    all: "Acuerdos",
    active: "Acuerdos activos",
    review: "Requieren revisión",
    transit: "En tránsito",
  };

  const hasActiveFilters =
    activeCard !== "all" || statusF !== "all" || search.trim() !== "";

  const clearFilters = () => {
    setActiveCard("all");
    setStatusF("all");
    setSearch("");
  };

  const columns: DataTableColumn<AgreementRow>[] = [
    {
      id: "agreement",
      header: "Acuerdo",
      cell: (a) => (
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span className="min-w-0 truncate text-[13px] font-semibold text-text-primary">
              {a.name}
            </span>
            {a.scope === "unit" && <Badge color="info">Con alcance</Badge>}
          </div>
          {(a.group_name || (a.scope === "unit" && a.unit_name)) && (
            <div className="line-clamp-2 text-[13px] leading-[1.35] text-text-secondary">
              {[a.group_name, a.scope === "unit" ? a.unit_name : null]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
        </div>
      ),
    },
    {
      id: "coverage",
      header: "Cobertura",
      cell: (a) => {
        const companies = ((a as { companies?: string[] }).companies ?? []) as string[];
        const first = companies[0] ?? null;
        if (companies.length === 0) {
          return <span className="text-text-tertiary">—</span>;
        }
        if (companies.length === 1) {
          return (
            <div className="flex min-w-0 items-center gap-2">
              <Badge color="neutral">Cliente</Badge>
              <span className="min-w-0 truncate" title={first ?? undefined}>
                {first}
              </span>
            </div>
          );
        }
        return (
          <div className="flex items-center gap-2">
            <Badge color="accent">Múltiple</Badge>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-default text-[13px] whitespace-nowrap">
                  {companies.length} clientes…
                </span>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <ul className="space-y-0.5">
                  {companies.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          </div>
        );
      },
    },
    {
      id: "positions",
      header: "Posiciones",
      width: 200,
      wrap: false,
      cell: (a) => {
        const counts: CountSpec[] = [
          {
            key: "total",
            label: "Total de posiciones",
            value:
              ((a as { lines_active?: number }).lines_active ?? 0) +
              (a.lines_review ?? 0) +
              ((a as { lines_excluded?: number }).lines_excluded ?? 0),
            color: "neutral",
          },
          {
            key: "active",
            label: "Activas",
            value: (a as { lines_active?: number }).lines_active ?? 0,
            color: "success",
          },
          {
            key: "review",
            label: "Requieren revisión",
            value: a.lines_review ?? 0,
            color: "error",
          },
          {
            key: "transit",
            label: "En tránsito",
            value: (a as { lines_transit?: number }).lines_transit ?? 0,
            color: "warning",
          },
        ];
        return <PositionsCounters counts={counts} />;
      },
    },
    {
      id: "vigencia",
      header: "Vigencia",
      width: 120,
      wrap: false,
      cell: (a) => {
        const vig = vigenciaBadge(a.end_date ?? null);
        return <Badge color={vig.color}>{vig.label}</Badge>;
      },
    },
    {
      id: "status",
      header: "Estado",
      width: 110,
      wrap: false,
      cell: (a) => (
        <StatusBadge
          status={a.status === "active" ? "active" : "neutral"}
          label={a.status === "active" ? "Activo" : "Inactivo"}
        />
      ),
    },
  ];

  const rowActions = (a: AgreementRow): RowAction<AgreementRow>[] => {
    const items: RowAction<AgreementRow>[] = [
      {
        label: "Ver detalle",
        icon: <Eye className="h-4 w-4" />,
        onSelect: () =>
          navigate({
            to: "/pgci/agreements/$agreementId",
            params: { agreementId: a.id as string },
          }),
      },
      {
        label: "Ver posiciones",
        icon: <FileText className="h-4 w-4" />,
        onSelect: () =>
          navigate({
            to: "/pgci/agreements/$agreementId/lines",
            params: { agreementId: a.id as string },
          }),
      },
    ];
    if ((a as { can_admin?: boolean }).can_admin) {
      items.push({
        label: "Editar",
        icon: <Pencil className="h-4 w-4" />,
        onSelect: () =>
          navigate({
            to: "/pgci/agreements/$agreementId/edit",
            params: { agreementId: a.id as string },
          }),
      });
    }
    return items;
  };

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="suma-h1">Acuerdos comerciales</h1>
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

        <TooltipProvider delayDuration={150}>
          <DataTable
            data={filtered}
            columns={columns}
            getRowId={(a) => (a.id as string) ?? ""}
            rowActions={rowActions}
            onRowClick={(a) =>
              navigate({
                to: "/pgci/agreements/$agreementId",
                params: { agreementId: a.id as string },
              })
            }
            loading={isLoading}
            empty={{
              icon: <FileText className="h-5 w-5" />,
              title: all.length === 0 ? "Aún no hay acuerdos" : "Sin resultados",
              description:
                all.length === 0
                  ? "Crea el primero para empezar a registrar información comercial."
                  : "No hay acuerdos que coincidan con los filtros.",
            }}
            ariaLabel="Acuerdos"
          />
        </TooltipProvider>
      </div>
    </div>
  );
}
