import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/sumatec";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/setup/products/$productId")({
  head: () => ({ meta: [{ title: "Producto · PIM · PGCI" }] }),
  component: ProductDetail,
});

const FIELDS: { k: string; l: string }[] = [
  { k: "sku", l: "Código Jaivaná" },
  { k: "erp_name", l: "Nombre Jaivaná ERP" },
  { k: "commercial_name", l: "Nombre comercial" },
  { k: "erp_brand", l: "Marca Jaivaná ERP" },
  { k: "commercial_brand", l: "Marca comercial" },
  { k: "brand_reference", l: "Referencia comercial" },
  { k: "product_classification", l: "Clasificación del producto" },
  { k: "erp_product_category_n1", l: "Línea Jaivaná ERP" },
  { k: "erp_product_category_n2", l: "Grupo Jaivaná ERP" },
  { k: "erp_product_category_n3", l: "Subgrupo Jaivaná ERP" },
  { k: "commercial_unit", l: "Unidad de medida comercial" },
];

function ProductDetail() {
  const { productId } = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["products", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  if (!data) return <p className="text-sm text-muted-foreground">No encontrado.</p>;

  return (
    <div className="space-y-6">
      <div>
        <Button asChild size="sm" variant="ghost">
          <Link to="/setup/products"><ArrowLeft className="mr-1 h-4 w-4" /> Volver al PIM</Link>
        </Button>
      </div>
      <header className="flex items-start justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{data.sku}</p>
          <h1 className="text-2xl font-bold tracking-tight">{data.erp_name}</h1>
        </div>
        <StatusBadge status={data.status === "active" ? "active" : "neutral"}>
          {data.status === "active" ? "Activo" : "Inactivo"}
        </StatusBadge>
      </header>
      <Card>
        <CardContent className="grid grid-cols-1 gap-x-8 gap-y-4 py-6 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <div key={f.k}>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {f.l}
              </p>
              <p className="mt-1 text-sm">{(data as any)[f.k] ?? "—"}</p>
            </div>
          ))}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Creado
            </p>
            <p className="mt-1 text-sm">
              {data.created_at ? new Date(data.created_at).toLocaleString("es-CO") : "—"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Actualizado
            </p>
            <p className="mt-1 text-sm">
              {data.updated_at ? new Date(data.updated_at).toLocaleString("es-CO") : "—"}
            </p>
          </div>
        </CardContent>
      </Card>
      <p className="text-xs text-muted-foreground">
        El detalle del producto es solo lectura. Para modificarlo, vuelve a importar el archivo PIM.
      </p>
    </div>
  );
}
