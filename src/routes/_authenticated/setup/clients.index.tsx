import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Plus, Building2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/setup/clients/")({
  head: () => ({ meta: [{ title: "Clientes · Setup · PGCI" }] }),
  component: ClientsList,
});

function ClientsList() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState<"all" | "active" | "inactive">("all");
  const [typeF, setTypeF] = useState<"all" | "holding" | "direct">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["clients", "list"],
    queryFn: async () => {
      const { data: clients, error } = await supabase
        .from("clients")
        .select("id, commercial_name, legal_name, erp_name, type, status, updated_at")
        .order("commercial_name");
      if (error) throw error;

      const ids = (clients ?? []).map((c) => c.id);
      const companyCounts = new Map<string, number>();
      const agreementCounts = new Map<string, number>();
      if (ids.length) {
        const { data: companies } = await supabase
          .from("client_companies")
          .select("client_id")
          .in("client_id", ids);
        (companies ?? []).forEach((c) => {
          if (c.client_id)
            companyCounts.set(c.client_id, (companyCounts.get(c.client_id) ?? 0) + 1);
        });
        const { data: agreements } = await supabase
          .from("agreements")
          .select("client_id")
          .in("client_id", ids);
        (agreements ?? []).forEach((a) => {
          if (a.client_id)
            agreementCounts.set(a.client_id, (agreementCounts.get(a.client_id) ?? 0) + 1);
        });
      }
      return (clients ?? []).map((c) => ({
        ...c,
        company_count: companyCounts.get(c.id) ?? 0,
        agreement_count: agreementCounts.get(c.id) ?? 0,
      }));
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async (c: { id: string; status: string | null }) => {
      const next = c.status === "active" ? "inactive" : "active";
      const { error } = await supabase.from("clients").update({ status: next }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients", "list"] }),
  });

  const filtered = (data ?? []).filter((c) => {
    if (statusF !== "all" && c.status !== statusF) return false;
    if (typeF !== "all" && c.type !== typeF) return false;
    if (search) {
      const s = search.toLowerCase();
      const hay = [c.commercial_name, c.legal_name, c.erp_name]
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
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Administra clientes y holdings como base para la gestión de acuerdos y la operación comercial.
          </p>
        </div>
        <Button asChild>
          <Link to="/setup/clients/new">
            <Plus className="mr-2 h-4 w-4" /> Crear cliente
          </Link>
        </Button>
      </header>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Buscar por nombre comercial, legal o ERP…"
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
        <Select value={typeF} onValueChange={(v) => setTypeF(v as any)}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            <SelectItem value="holding">Holding</SelectItem>
            <SelectItem value="direct">Directo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>Razón social</TableHead>
              <TableHead>Nombre ERP</TableHead>
              <TableHead>Tipo</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Empresas</TableHead>
              <TableHead className="text-right">Acuerdos</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                  {data?.length === 0
                    ? "Aún no hay clientes creados. Crea los clientes piloto para continuar."
                    : "No hay clientes que coincidan con los filtros."}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  <Link to="/setup/clients/$clientId" params={{ clientId: c.id }} className="hover:underline">
                    {c.commercial_name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{c.legal_name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.erp_name ?? "—"}</TableCell>
                <TableCell>{c.type === "holding" ? "Holding" : "Directo"}</TableCell>
                <TableCell>
                  <StatusBadge status={c.status === "active" ? "active" : "neutral"} label={c.status === "active" ? "Activo" : "Inactivo"} />
                </TableCell>
                <TableCell className="text-right">{c.company_count}</TableCell>
                <TableCell className="text-right">{c.agreement_count}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {c.type === "holding" && (
                      <Button asChild size="sm" variant="ghost">
                        <Link to="/setup/clients/$clientId/companies" params={{ clientId: c.id }}>
                          <Building2 className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/setup/clients/$clientId" params={{ clientId: c.id }}>Editar</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggleStatus.mutate(c)}
                      disabled={toggleStatus.isPending}
                    >
                      {c.status === "active" ? "Inactivar" : "Activar"}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
