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
import { StatusBadge } from "@/components/sumatec";
import { Upload, Download } from "lucide-react";
import { downloadPimTemplate } from "@/lib/pim-import";

export const Route = createFileRoute("/_authenticated/setup/products/")({
  head: () => ({ meta: [{ title: "PIM · Setup · PGCI" }] }),
  component: ProductsList,
});

function ProductsList() {
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState<"all" | "active" | "inactive">("all");

  const {
    data: products,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["products", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(
          "id, sku, erp_description, commercial_description, erp_brand, commercial_brand, status, updated_at",
        )
        .order("sku");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Contador de acuerdos: query independiente y no bloqueante.
  // Si falla, el listado de productos no se rompe.
  const { data: agreementCounts } = useQuery({
    queryKey: ["products", "agreement-counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agreement_products")
        .select("product_id");
      if (error) throw error;
      const counts = new Map<string, number>();
      (data ?? []).forEach((row) => {
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

  const filtered = (products ?? []).filter((p) => {
    if (statusF !== "all" && p.status !== statusF) return false;
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

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Productos</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo Jaivaná. La escritura es solo por importación de archivo.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={downloadPimTemplate}>
            <Download className="mr-2 h-4 w-4" /> Descargar plantilla
          </Button>
          <Button asChild>
            <Link to="/setup/products/import">
              <Upload className="mr-2 h-4 w-4" /> Importar productos
            </Link>
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por código, descripción o marca…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusF} onValueChange={(v) => setStatusF(v as any)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Activo</SelectItem>
            <SelectItem value="inactive">Inactivo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código Jaivaná</TableHead>
              <TableHead>Descripción Jaivaná</TableHead>
              <TableHead>Marca</TableHead>
              <TableHead className="text-center">Acuerdos</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Última actualización</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
            )}
            {!isLoading && isError && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-destructive">
                  No fue posible cargar el catálogo de productos. Intenta de nuevo más tarde.
                </TableCell>
              </TableRow>
            )}
            {!isLoading && !isError && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {(products ?? []).length === 0
                    ? "Aún no hay productos en el PIM. Impórtalos desde archivo para empezar."
                    : "No hay productos que coincidan con los filtros."}
                </TableCell>
              </TableRow>
            )}
            {!isError && filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">
                  <Link to="/setup/products/$productId" params={{ productId: p.id }} className="hover:underline">
                    {p.sku}
                  </Link>
                </TableCell>
                <TableCell>{p.erp_description}</TableCell>
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
  );
}
