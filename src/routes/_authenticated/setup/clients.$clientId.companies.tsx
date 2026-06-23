import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Plus, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/setup/clients/$clientId/companies")({
  head: () => ({ meta: [{ title: "Empresas · Setup · PGCI" }] }),
  component: ClientCompanies,
});

type CompanyForm = {
  legal_name: string;
  commercial_name: string;
  erp_name: string;
  tax_id: string;
  tax_id_type: "NIT" | "RFC" | "EIN" | "Otro";
  status: "active" | "inactive";
};

const emptyCompany: CompanyForm = {
  legal_name: "",
  commercial_name: "",
  erp_name: "",
  tax_id: "",
  tax_id_type: "NIT",
  status: "active",
};

function ClientCompanies() {
  const { clientId } = Route.useParams();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CompanyForm>(emptyCompany);
  const [errors, setErrors] = useState<Partial<Record<keyof CompanyForm, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: client } = useQuery({
    queryKey: ["clients", clientId, "header"],
    queryFn: async () => {
      const { data } = await supabase
        .from("clients")
        .select("id, commercial_name")
        .eq("id", clientId)
        .maybeSingle();
      return data;
    },
  });

  const { data: companies, isLoading } = useQuery({
    queryKey: ["client_companies", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_companies")
        .select("*")
        .eq("client_id", clientId)
        .order("legal_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const save = useMutation({
    mutationFn: async (v: CompanyForm) => {
      const payload = {
        client_id: clientId,
        legal_name: v.legal_name.trim(),
        commercial_name: v.commercial_name.trim() || null,
        erp_name: v.erp_name.trim() || null,
        tax_id: v.tax_id.trim(),
        tax_id_type: v.tax_id_type,
        status: v.status,
      };
      if (editingId) {
        const { error } = await supabase
          .from("client_companies")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("client_companies").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_companies", clientId] });
      setOpen(false);
      setEditingId(null);
      setForm(emptyCompany);
      setErrors({});
      setServerError(null);
    },
    onError: (e: any) => {
      const msg = String(e?.message ?? "");
      if (msg.includes("uq_client_companies_taxid") || msg.includes("duplicate"))
        setServerError("Ya existe una empresa con esta identificación para este cliente.");
      else setServerError("No fue posible guardar la empresa. Intenta nuevamente.");
    },
  });

  const toggleStatus = useMutation({
    mutationFn: async (c: { id: string; status: string | null }) => {
      const next = c.status === "active" ? "inactive" : "active";
      const { error } = await supabase
        .from("client_companies")
        .update({ status: next })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client_companies", clientId] }),
  });

  function openNew() {
    setEditingId(null);
    setForm(emptyCompany);
    setErrors({});
    setServerError(null);
    setOpen(true);
  }
  function openEdit(c: any) {
    setEditingId(c.id);
    setForm({
      legal_name: c.legal_name ?? "",
      commercial_name: c.commercial_name ?? "",
      erp_name: c.erp_name ?? "",
      tax_id: c.tax_id ?? "",
      tax_id_type: (c.tax_id_type as any) ?? "NIT",
      status: (c.status as any) ?? "active",
    });
    setErrors({});
    setServerError(null);
    setOpen(true);
  }
  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: typeof errors = {};
    if (!form.legal_name.trim()) next.legal_name = "La razón social es obligatoria.";
    if (!form.tax_id.trim()) next.tax_id = "La identificación tributaria es obligatoria.";
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate(form);
  }

  const filtered = (companies ?? []).filter((c) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return [c.legal_name, c.commercial_name, c.erp_name, c.tax_id]
      .filter(Boolean)
      .some((v) => v!.toLowerCase().includes(s));
  });

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link to="/setup/clients/$clientId" params={{ clientId }}>
                <ArrowLeft className="mr-1 h-4 w-4" /> Volver al cliente
              </Link>
            </Button>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            Empresas — {client?.commercial_name ?? ""}
          </h1>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-2 h-4 w-4" /> Crear empresa
        </Button>
      </header>

      <Input
        placeholder="Buscar empresa…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="max-w-xs"
      />

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Razón social</TableHead>
              <TableHead>Nombre comercial</TableHead>
              <TableHead>Nombre ERP</TableHead>
              <TableHead>Identificación</TableHead>
              <TableHead>Tipo</TableHead>
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
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  {(companies ?? []).length === 0
                    ? "Este cliente aún no tiene empresas registradas."
                    : "No hay empresas que coincidan con la búsqueda."}
                </TableCell>
              </TableRow>
            )}
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.legal_name}</TableCell>
                <TableCell className="text-muted-foreground">{c.commercial_name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.erp_name ?? "—"}</TableCell>
                <TableCell>{c.tax_id}</TableCell>
                <TableCell>{c.tax_id_type}</TableCell>
                <TableCell>
                  <StatusBadge status={c.status === "active" ? "active" : "neutral"}>
                    {c.status === "active" ? "Activo" : "Inactivo"}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(c)}>Editar</Button>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar empresa" : "Crear empresa"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>Razón social *</Label>
              <Input
                value={form.legal_name}
                onChange={(e) => setForm({ ...form, legal_name: e.target.value })}
              />
              {errors.legal_name && <p className="text-sm text-destructive">{errors.legal_name}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nombre comercial</Label>
                <Input
                  value={form.commercial_name}
                  onChange={(e) => setForm({ ...form, commercial_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Nombre ERP</Label>
                <Input
                  value={form.erp_name}
                  onChange={(e) => setForm({ ...form, erp_name: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Identificación tributaria *</Label>
                <Input
                  value={form.tax_id}
                  onChange={(e) => setForm({ ...form, tax_id: e.target.value })}
                />
                {errors.tax_id && <p className="text-sm text-destructive">{errors.tax_id}</p>}
              </div>
              <div className="space-y-2">
                <Label>Tipo identificación</Label>
                <Select
                  value={form.tax_id_type}
                  onValueChange={(v) => setForm({ ...form, tax_id_type: v as any })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NIT">NIT</SelectItem>
                    <SelectItem value="RFC">RFC</SelectItem>
                    <SelectItem value="EIN">EIN</SelectItem>
                    <SelectItem value="Otro">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Estado</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as any })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {serverError && <p className="text-sm text-destructive">{serverError}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Guardando…" : "Guardar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
