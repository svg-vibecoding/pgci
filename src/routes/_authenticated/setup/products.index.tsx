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

  const { data, isLoading } = useQuery({
    queryKey: ["products", "list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, sku, erp_name, commercial_name, erp_brand, commercial_unit, status, updated_at")
        .order("sku");
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = (data ?? []).filter((p) => {
    if (statusF !== "all" && p.status !== statusF) return false;
    if (search) {
      const s = search.toLowerCase();
      const hay = [p.sku, p.erp_name, p.commercial_name, p.erp_brand]
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
          <h1 className="text-2xl font-bold tracking-tight">PIM — Productos</h1>
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
          placeholder="Buscar por código, nombre o marca…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusF} onValueChange={(v) => setStatusF(v as any)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
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
              <TableHead>Nombre Jaivaná ERP</TableHead>
              <TableHead>Nombre comercial</TableHead>
              <TableHead>Marca Jaivaná ERP</TableHead>
              <TableHead>Unidad comercial</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Última actualización</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  {(data ?? []).length === 0
                    ? "Aún no hay productos en el PIM. Impórtalos desde archivo para empezar."
                    : "No hay productos que coincidan con los filtros."}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-xs">
                  <Link to="/setup/products/$productId" params={{ productId: p.id }} className="hover:underline">
                    {p.sku}
                  </Link>
                </TableCell>
                <TableCell>{p.erp_name}</TableCell>
                <TableCell className="text-muted-foreground">{p.commercial_name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{p.erp_brand ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{p.commercial_unit ?? "—"}</TableCell>
                <TableCell>
                  <StatusBadge status={p.status === "active" ? "active" : "neutral"}>
                    {p.status === "active" ? "Activo" : "Inactivo"}
                  </StatusBadge>
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
