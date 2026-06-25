import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/sumatec";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/setup/products/$productId")({
  head: () => ({ meta: [{ title: "Producto · PIM · PGCI" }] }),
  component: ProductDetail,
});

const FIELDS: { k: string; l: string }[] = [
  { k: "sku", l: "Código Jaivaná" },
  { k: "erp_description", l: "Descripción Jaivaná" },
  { k: "commercial_description", l: "Descripción comercial" },
  { k: "erp_brand", l: "Marca Jaivaná" },
  { k: "commercial_brand", l: "Marca" },
  { k: "brand_reference", l: "Referencia" },
  { k: "product_classification", l: "Clasificación" },
  { k: "erp_product_category_n1", l: "Línea" },
  { k: "erp_product_category_n2", l: "Grupo" },
  { k: "erp_product_category_n3", l: "Subgrupo" },
  { k: "commercial_unit", l: "Unidad" },
];

function val(v: unknown) {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function ProductDetail() {
  const { productId } = Route.useParams();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["products", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: agreementCount = 0 } = useQuery({
    queryKey: ["products", productId, "agreement-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("agreement_products")
        .select("*", { count: "exact", head: true })
        .eq("product_id", productId);
      if (error) return 0;
      return count ?? 0;
    },
  });

  const backLink = (
    <Link
      to="/setup/products"
      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Volver a Productos
    </Link>
  );

  if (isLoading) {
    return (
      <div className="-mt-6 space-y-5">
        {backLink}
        <p className="text-sm text-muted-foreground">Cargando producto…</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="-mt-6 space-y-5">
        {backLink}
        <p className="text-sm text-destructive">No fue posible cargar el producto. Intenta nuevamente.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="-mt-6 space-y-5">
        {backLink}
        <p className="text-sm text-muted-foreground">Producto no encontrado o sin acceso.</p>
      </div>
    );
  }

  const brand = data.commercial_brand || data.erp_brand || "—";
  const updatedAt = data.updated_at ? new Date(data.updated_at).toLocaleString("es-CO") : "—";
  const createdAt = data.created_at ? new Date(data.created_at).toLocaleString("es-CO") : "—";
  const isActive = data.status === "active";

  return (
    <div className="-mt-6 space-y-5">
      {backLink}

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs text-muted-foreground">{val(data.sku)}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">{val(data.erp_description)}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge
              status={isActive ? "active" : "neutral"}
              label={isActive ? "Activo" : "Inactivo"}
            />
            <span className="text-xs text-muted-foreground">
              Marca: <span className="font-medium text-foreground">{brand}</span>
            </span>
            <span className="text-xs text-muted-foreground">
              Actualizado: <span className="font-medium text-foreground">{updatedAt}</span>
            </span>
          </div>
        </div>
      </header>

      <Card>
        <CardContent className="py-6">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Acuerdos asociados
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{agreementCount}</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid grid-cols-1 gap-x-8 gap-y-4 py-6 sm:grid-cols-2">
          {FIELDS.map((f) => {
            const raw = (data as Record<string, unknown>)[f.k];
            const display = f.k === "commercial_brand" ? brand : val(raw);
            return (
              <div key={f.k}>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {f.l}
                </p>
                <p className="mt-1 text-sm">{display}</p>
              </div>
            );
          })}
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estado</p>
            <p className="mt-1 text-sm">{data.status === "active" ? "Activo" : "Inactivo"}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fecha de creación</p>
            <p className="mt-1 text-sm">{createdAt}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Última actualización</p>
            <p className="mt-1 text-sm">{updatedAt}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
