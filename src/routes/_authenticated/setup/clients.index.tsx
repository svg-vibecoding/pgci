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
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

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
        .select("id, commercial_name, legal_name, erp_name, tax_id, type, status, parent_client_id, updated_at")
        .order("commercial_name");
      if (error) throw error;

      const ids = (clients ?? []).map((c) => c.id);
      const childCounts = new Map<string, number>();
      const agreementCounts = new Map<string, number>();
      if (ids.length) {
        (clients ?? []).forEach((c) => {
          if (c.parent_client_id) {
            childCounts.set(
              c.parent_client_id,
              (childCounts.get(c.parent_client_id) ?? 0) + 1,
            );
          }
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
      const nameById = new Map<string, string>();
      (clients ?? []).forEach((c) => {
        nameById.set(c.id, c.commercial_name?.trim() || c.legal_name);
      });
      return (clients ?? []).map((c) => ({
        ...c,
        display_name: c.commercial_name?.trim() || c.legal_name,
        company_count: childCounts.get(c.id) ?? 0,
        agreement_count: agreementCounts.get(c.id) ?? 0,
        parent_name: c.parent_client_id ? nameById.get(c.parent_client_id) ?? null : null,
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
      const hay = [c.commercial_name, c.legal_name, c.erp_name, c.tax_id]
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
            Administra clientes como base para la gestión de acuerdos y la operación comercial.
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
          placeholder="Buscar por nombre o NIT…"
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
                <TableHead>NIT</TableHead>
                <TableHead className="text-right">Empresas</TableHead>
                <TableHead className="text-right">Acuerdos</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground">Cargando…</TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">
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
                    {c.display_name}
                  </Link>
                  {c.parent_client_id && (
                    <span
                      className="block text-xs text-muted-foreground truncate max-w-[260px]"
                      title={c.parent_name ?? undefined}
                    >
                      {c.parent_name ?? "—"}
                    </span>
                  )}
                </TableCell>
                <TableCell>{c.type === "holding" ? "Holding" : "Directo"}</TableCell>
                <TableCell className="text-muted-foreground">{c.tax_id ?? "—"}</TableCell>
                <TableCell className="text-right">
                  {c.type === "holding" ? c.company_count : "—"}
                </TableCell>
                <TableCell className="text-right">{c.agreement_count}</TableCell>
                <TableCell>
                  <StatusBadge status={c.status === "active" ? "active" : "neutral"} label={c.status === "active" ? "Activo" : "Inactivo"} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/setup/clients/$clientId" params={{ clientId: c.id }}>Ver</Link>
                    </Button>
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/setup/clients/$clientId/edit" params={{ clientId: c.id }}>Editar</Link>
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
