import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Unlink, Building2, Search } from "lucide-react";
import {
  listAgreementCompanies,
  addAgreementCompany,
  removeAgreementCompany,
} from "@/lib/agreements.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/sumatec";

export function AgreementCompaniesSection({
  agreementId,
  canAdmin,
}: {
  agreementId: string;
  canAdmin: boolean;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listAgreementCompanies);
  const addFn = useServerFn(addAgreementCompany);
  const removeFn = useServerFn(removeAgreementCompany);

  const { data: companies } = useQuery({
    queryKey: ["agreements", "companies", agreementId],
    queryFn: () => listFn({ data: { agreement_id: agreementId } }),
  });

  const [addOpen, setAddOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const clientsQ = useQuery({
    queryKey: ["clients", "picker-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, commercial_name, legal_name, tax_id, tax_id_type, type")
        .eq("status", "active");
      if (error) throw error;
      return [...(data ?? [])].sort((a, b) =>
        (a.commercial_name?.trim() || a.legal_name || "").localeCompare(
          b.commercial_name?.trim() || b.legal_name || "",
          "es",
          { sensitivity: "base" },
        ),
      );
    },
    enabled: addOpen,
  });

  const linkedClientIds = useMemo(
    () => new Set((companies ?? []).map((c) => c.client_id as string)),
    [companies],
  );

  const availableClients = useMemo(() => {
    const list = (clientsQ.data ?? []).filter((c) => !linkedClientIds.has(c.id));
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => {
      const name = (c.commercial_name || c.legal_name || "").toLowerCase();
      const legal = (c.legal_name || "").toLowerCase();
      const tax = (c.tax_id || "").toLowerCase();
      return name.includes(q) || legal.includes(q) || tax.includes(q);
    });
  }, [clientsQ.data, linkedClientIds, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const resetPicker = () => {
    setSelected(new Set());
    setSearch("");
  };

  const add = useMutation({
    mutationFn: async () => {
      const chosen = (clientsQ.data ?? []).filter((c) => selected.has(c.id));
      for (const c of chosen) {
        await addFn({
          data: {
            agreement_id: agreementId,
            client_id: c.id,
          },
        });
      }
      return chosen.length;
    },
    onSuccess: (count) => {
      toast.success(count === 1 ? "Cliente agregado" : `${count} clientes agregados`);
      qc.invalidateQueries({ queryKey: ["agreements", "companies", agreementId] });
      resetPicker();
      setAddOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { company_id: id } }),
    onSuccess: () => {
      toast.success("Cliente removido");
      qc.invalidateQueries({ queryKey: ["agreements", "companies", agreementId] });
      setRemoveId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Clientes cubiertos</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Clientes que cubre este acuerdo y bajo los cuales se factura.
          </p>
        </div>
        {canAdmin && (
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Agregar clientes
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {(companies ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            <Building2 className="h-6 w-6" />
            Sin clientes adicionales.
          </div>
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>NIT</TableHead>
                  {canAdmin && <TableHead className="w-12 text-right"><span className="sr-only">Acciones</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(companies ?? []).map((c) => (
                  <TableRow key={c.id as string}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span>{(c.client_display_name as string | null) ?? "—"}</span>
                        {(c.client_type as string | null) === "holding" && (
                          <Badge color="accent" variant="soft">
                            Holding
                          </Badge>
                        )}
                      </div>
                      {(c.parent_client_name as string | null) && (
                        <span className="block text-xs text-muted-foreground truncate max-w-[260px]">
                          {c.parent_client_name as string}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.tax_id as string}</TableCell>
                    {canAdmin && (
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setRemoveId(c.id as string)}
                          aria-label="Remover"
                        >
                          <Unlink className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) resetPicker();
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Agregar clientes</DialogTitle>
            <DialogDescription>
              Selecciona uno o varios clientes disponibles para vincularlos a este acuerdo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o NIT…"
                className="pl-9"
              />
            </div>

            <div className="max-h-80 overflow-y-auto rounded-md border border-border">
              {clientsQ.isLoading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Cargando…</p>
              ) : availableClients.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {search.trim()
                    ? "Sin resultados para esa búsqueda."
                    : "No hay clientes disponibles para vincular."}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {availableClients.map((c) => {
                    const name = c.commercial_name?.trim() || c.legal_name || "—";
                    const isChecked = selected.has(c.id);
                    return (
                      <li key={c.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/40">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggle(c.id)}
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate font-medium">{name}</span>
                              {c.type === "holding" && (
                                <Badge color="accent" variant="soft">
                                  Holding
                                </Badge>
                              )}
                            </div>
                            <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
                              {c.tax_id_type ?? "NIT"} · {c.tax_id}
                            </p>
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setAddOpen(false)}
              disabled={add.isPending}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => add.mutate()}
              disabled={selected.size === 0 || add.isPending}
            >
              {selected.size > 1 ? `Agregar (${selected.size})` : "Agregar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeId} onOpenChange={(o) => !o && setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover cliente</AlertDialogTitle>
            <AlertDialogDescription>
              Se desvincula del acuerdo. Esta acción no afecta otros acuerdos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (removeId) remove.mutate(removeId);
              }}
              disabled={remove.isPending}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
