import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatusBadge, Chip } from "@/components/sumatec";
import { Upload, Download, ChevronDown, Search } from "lucide-react";
import { exportProductsXlsx } from "@/lib/product-export";

export const Route = createFileRoute("/_authenticated/setup/products/")({
  head: () => ({ meta: [{ title: "PIM · Setup · PGCI" }] }),
  component: ProductsList,
});

async function fetchAllPaginated<T>(
  fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const PAGE = 1000;
  const all: T[] = [];
  let from = 0;
  while (true) {
    const to = from + PAGE - 1;
    const { data, error } = await fetchPage(from, to);
    if (error) throw new Error(`Error cargando datos paginados (rango ${from}-${to}): ${error.message}`);
    const batch = data ?? [];
    all.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return all;
}



function ProductsList() {
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState<"all" | "active" | "inactive">("all");
  const [withAgreementsOnly, setWithAgreementsOnly] = useState(false);

  const {
    data: products,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["products", "list"],
    queryFn: async () => {
      return fetchAllPaginated(async (from, to) => {
        const res = await supabase
          .from("products")
          .select(
            "id, sku, erp_description, commercial_description, erp_brand, commercial_brand, brand_reference, product_classification, erp_product_category_n1, erp_product_category_n2, erp_product_category_n3, commercial_unit, status, created_at, updated_at",
          )
          .order("sku")
          .range(from, to);
        return { data: res.data, error: res.error };
      });
    },
  });

  const { data: agreementCounts } = useQuery({
    queryKey: ["products", "agreement-counts"],
    queryFn: async () => {
      const rows = await fetchAllPaginated(async (from, to) => {
        const res = await supabase
          .from("agreement_products")
          .select("product_id")
          .range(from, to);
        return { data: res.data, error: res.error };
      });
      const counts = new Map<string, number>();
      rows.forEach((row) => {
        if (!row.product_id) return;
        counts.set(row.product_id, (counts.get(row.product_id) ?? 0) + 1);
      });
      return counts;
    },
  });


  const getBrand = (p: { commercial_brand: string | null; erp_brand: string | null }) => {
    if (p.commercial_brand && p.commercial_brand.trim()) return p.commercial_brand;
    if (p.erp_brand && p.erp_brand.trim()) return p.erp_brand;
    return "—";
  };

  const all = products ?? [];
  const filtered = all.filter((p) => {
    if (statusF !== "all" && p.status !== statusF) return false;
    if (withAgreementsOnly && (agreementCounts?.get(p.id) ?? 0) === 0) return false;
    if (search) {
      const s = search.toLowerCase();
      const hay = [
        p.sku,
        p.erp_description,
        p.commercial_description,
        p.commercial_brand,
        p.erp_brand,
      ]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(s));
      if (!hay) return false;
    }
    return true;
  });

  const totalCount = all.length;
  const activeCount = all.filter((p) => p.status === "active").length;
  const inactiveCount = all.filter((p) => p.status === "inactive").length;
  const withAgreementsCount = all.filter(
    (p) => (agreementCounts?.get(p.id) ?? 0) > 0,
  ).length;

  const hasFilters = search !== "" || statusF !== "all" || withAgreementsOnly;
  const canDownload = !isLoading && !isError && totalCount > 0;

  const handleExport = (mode: "all" | "filtered") => {
    const rows = mode === "filtered" ? filtered : all;
    exportProductsXlsx(rows, agreementCounts, { filtered: mode === "filtered" });
  };

  type CardKey = "all" | "active" | "inactive" | "withAgreements";
  const activeCard: CardKey =
    withAgreementsOnly ? "withAgreements"
    : statusF === "active" ? "active"
    : statusF === "inactive" ? "inactive"
    : "all";

  const selectCard = (key: CardKey) => {
    if (key === "all") {
      setStatusF("all");
      setWithAgreementsOnly(false);
    } else if (key === "active") {
      setStatusF("active");
      setWithAgreementsOnly(false);
    } else if (key === "inactive") {
      setStatusF("inactive");
      setWithAgreementsOnly(false);
    } else {
      setWithAgreementsOnly(true);
    }
  };

  const summaryCards: { key: CardKey; label: string; value: number }[] = [
    { key: "all", label: "Productos", value: totalCount },
    { key: "active", label: "Activos", value: activeCount },
    { key: "inactive", label: "Inactivos", value: inactiveCount },
    { key: "withAgreements", label: "Con acuerdos", value: withAgreementsCount },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Productos</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo de Productos Jaivaná ERP.
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={!canDownload}>
                <Download className="mr-2 h-4 w-4" /> Descargar productos
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport("all")}>
                Todos los productos ({totalCount})
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={!hasFilters}
                onClick={() => handleExport("filtered")}
              >
                Productos filtrados ({filtered.length})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button asChild>
            <Link to="/setup/products/import">
              <Upload className="mr-2 h-4 w-4" /> Importar productos
            </Link>
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {summaryCards.map((c) => {
          const selected = activeCard === c.key;
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => selectCard(c.key)}
              aria-pressed={selected}
              className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
            >
              <Card
                className={
                  selected
                    ? "border-l-4 border-l-primary/40 shadow-sm transition-colors"
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
        <div className="relative w-full md:w-1/2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código, descripción o marca…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9"
          />
        </div>
      </div>

      <div className="space-y-2">
        {hasFilters && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-sm text-muted-foreground">
              {filtered.length} de {totalCount} {totalCount === 1 ? "producto" : "productos"}
            </p>
            <div className="flex flex-wrap gap-2">
              {activeCard !== "all" && (
                <Chip
                  size="small"
                  variant="soft"
                  color="neutral"
                  onRemove={() => selectCard("all")}
                >
                  {activeCard === "active" ? "Activos" : activeCard === "inactive" ? "Inactivos" : "Con acuerdos"}
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
              onClick={() => {
                setSearch("");
                setStatusF("all");
                setWithAgreementsOnly(false);
              }}
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
                <TableHead>Producto</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead className="text-center">Acuerdos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Última actualización</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
              )}
              {!isLoading && isError && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-destructive">
                    No fue posible cargar el catálogo de productos. Intenta de nuevo más tarde.
                  </TableCell>
                </TableRow>
              )}
              {!isLoading && !isError && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    {all.length === 0
                      ? "Aún no hay productos en el PIM. Impórtalos desde archivo para empezar."
                      : "No hay productos que coincidan con los filtros."}
                  </TableCell>
                </TableRow>
              )}
              {!isError && filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <div className="font-mono text-sm text-muted-foreground">{p.sku}</div>

                    <Link
                      to="/setup/products/$productId"
                      params={{ productId: p.id }}
                      className="hover:underline"
                    >
                      {p.erp_description}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{getBrand(p)}</TableCell>
                  <TableCell className="text-center font-mono text-sm">
                    {agreementCounts?.get(p.id) ?? 0}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={p.status === "active" ? "active" : "neutral"} label={p.status === "active" ? "Activo" : "Inactivo"} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {p.updated_at ? new Date(p.updated_at).toLocaleDateString("es-CO") : "—"}
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
