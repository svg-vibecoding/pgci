import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndicatorCard } from "@/components/setup/IndicatorCard";
import { InfoField, InfoSection } from "@/components/setup/InfoSection";
import { StatusBadge } from "@/components/sumatec";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/setup/products/$productId")({
  head: () => ({ meta: [{ title: "Producto · PIM · PGCI" }] }),
  component: ProductDetail,
});

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
        .from("agreement_positions")
        .select("*", { count: "exact", head: true })
        .eq("product_id", productId);
      if (error) return 0;
      return count ?? 0;
    },
  });

  const { data: associatedClients = 0 } = useQuery({
    queryKey: ["products", productId, "associated-clients"],
    queryFn: async () => {
      const { data: rows, error: err1 } = await supabase
        .from("agreement_positions")
        .select("agreement_id")
        .eq("product_id", productId);
      if (err1 || !rows?.length) return 0;
      const ids = [...new Set(rows.map((r) => r.agreement_id))];
      const { data: links, error: err2 } = await supabase
        .from("agreement_companies")
        .select("client_id")
        .in("agreement_id", ids)
        .is("valid_until", null);
      if (err2) return 0;
      const clients = new Set(
        (links ?? []).map((l) => l.client_id as string | null).filter(Boolean) as string[],
      );
      return clients.size;
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
          <h1 className="text-2xl font-bold tracking-tight">{val(data.erp_description)}</h1>
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <IndicatorCard label="Acuerdos asociados" value={agreementCount} />
        <IndicatorCard label="Clientes asociados" value={associatedClients} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información del producto</CardTitle>
        </CardHeader>
        <CardContent>
          <InfoSection>
            <InfoField label="Código Jaivaná">{val(data.sku)}</InfoField>
            <InfoField label="Descripción Jaivaná">{val(data.erp_description)}</InfoField>
            <InfoField label="Descripción comercial">{val(data.commercial_description)}</InfoField>
            <InfoField label="Marca Jaivaná">{val(data.erp_brand)}</InfoField>
            <InfoField label="Marca">{brand}</InfoField>
            <InfoField label="Referencia">{val(data.brand_reference)}</InfoField>
            <InfoField label="Clasificación">{val(data.product_classification)}</InfoField>
            <InfoField label="Línea">{val(data.erp_product_category_n1)}</InfoField>
            <InfoField label="Grupo">{val(data.erp_product_category_n2)}</InfoField>
            <InfoField label="Subgrupo">{val(data.erp_product_category_n3)}</InfoField>
            <InfoField label="Unidad">{val(data.commercial_unit)}</InfoField>
            <InfoField label="Estado">
              <StatusBadge
                status={isActive ? "active" : "neutral"}
                label={isActive ? "Activo" : "Inactivo"}
              />
            </InfoField>
            <InfoField label="Fecha de creación">{createdAt}</InfoField>
            <InfoField label="Última actualización">{updatedAt}</InfoField>
          </InfoSection>
        </CardContent>
      </Card>

    </div>
  );
}
