import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Trash2, Building2 } from "lucide-react";
import {
  listAgreementCompanies,
  addAgreementCompany,
  removeAgreementCompany,
} from "@/lib/agreements.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  const [taxId, setTaxId] = useState("");
  const [legalName, setLegalName] = useState("");
  const [notes, setNotes] = useState("");

  const add = useMutation({
    mutationFn: () =>
      addFn({
        data: {
          agreement_id: agreementId,
          tax_id: taxId.trim(),
          tax_id_type: "NIT",
          legal_name: legalName.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      }),
    onSuccess: () => {
      toast.success("Empresa agregada");
      qc.invalidateQueries({ queryKey: ["agreements", "companies", agreementId] });
      setTaxId("");
      setLegalName("");
      setNotes("");
      setAddOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { company_id: id } }),
    onSuccess: () => {
      toast.success("Empresa removida");
      qc.invalidateQueries({ queryKey: ["agreements", "companies", agreementId] });
      setRemoveId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Empresas vinculadas</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            NITs adicionales (filiales, sucursales) que también facturan bajo este acuerdo.
          </p>
        </div>
        {canAdmin && (
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" /> Agregar empresa
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {(companies ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            <Building2 className="h-6 w-6" />
            Sin empresas adicionales.
          </div>
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NIT</TableHead>
                  <TableHead>Razón social</TableHead>
                  <TableHead>Notas</TableHead>
                  {canAdmin && <TableHead className="w-12 text-right"><span className="sr-only">Acciones</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(companies ?? []).map((c) => (
                  <TableRow key={c.id as string}>
                    <TableCell className="font-mono text-sm">{c.tax_id as string}</TableCell>
                    <TableCell>{(c.legal_name as string | null) ?? "—"}</TableCell>
                    <TableCell className="max-w-md text-xs text-muted-foreground">
                      {(c.notes as string | null) ?? "—"}
                    </TableCell>
                    {canAdmin && (
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setRemoveId(c.id as string)}
                          aria-label="Remover"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
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

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar empresa</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>
                NIT <span className="text-primary">*</span>
              </Label>
              <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Razón social</Label>
              <Input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Notas</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={add.isPending}>
              Cancelar
            </Button>
            <Button onClick={() => add.mutate()} disabled={!taxId.trim() || add.isPending}>
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeId} onOpenChange={(o) => !o && setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover empresa</AlertDialogTitle>
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
