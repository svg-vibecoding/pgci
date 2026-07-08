import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowUpRight,
  Boxes,
  FileText,
  Pencil,
  Plus,
  Search,
  Trash2,
  Unlink,
} from "lucide-react";

import {
  addAgreementsToGroup,
  deleteAgreementGroup,
  getAgreementGroup,
  getAgreementGroupRollup,
  listAgreementsInGroup,
  listEligibleAgreementsForGroup,
  listGroupAgreementMembers,
  removeAgreementFromGroup,
  updateAgreementGroup,
} from "@/lib/agreements.functions";

import { AgreementGroupMembersSection } from "@/components/agreements/AgreementGroupMembersSection";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { InfoField, InfoSection } from "@/components/setup/InfoSection";
import { IndicatorCard } from "@/components/setup/IndicatorCard";
import { StatusBadge, Badge } from "@/components/sumatec";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsSuperAdmin } from "@/hooks/use-profile";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/pgci/groups/$groupId")({
  head: () => ({ meta: [{ title: "Agrupador · PGCI" }] }),
  component: GroupDetail,
});

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

function GroupDetail() {
  const { groupId } = Route.useParams();
  const qc = useQueryClient();
  const { isSuperAdmin } = useIsSuperAdmin();

  const getFn = useServerFn(getAgreementGroup);
  const rollupFn = useServerFn(getAgreementGroupRollup);
  const listAgFn = useServerFn(listAgreementsInGroup);

  const { data: group, isLoading } = useQuery({
    queryKey: ["agreement-groups", "detail", groupId],
    queryFn: () => getFn({ data: { group_id: groupId } }),
  });

  const { data: rollup } = useQuery({
    queryKey: ["agreement-groups", "rollup", groupId],
    queryFn: () => rollupFn({ data: { group_id: groupId } }),
  });

  const { data: agreements } = useQuery({
    queryKey: ["agreement-groups", "agreements", groupId],
    queryFn: () => listAgFn({ data: { group_id: groupId } }),
  });

  const { data: myRole } = useQuery({
    queryKey: ["agreement-groups", "my-role", groupId],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return null;
      const { data } = await supabase
        .from("agreement_group_members")
        .select("role")
        .eq("agreement_group_id", groupId)
        .eq("user_id", auth.user.id)
        .is("valid_until", null)
        .maybeSingle();
      return (data?.role as string | null) ?? null;
    },
  });

  const canAdmin = isSuperAdmin || myRole === "agreement_group_admin";

  const [renameOpen, setRenameOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [removeAgId, setRemoveAgId] = useState<string | null>(null);

  if (isLoading || !group) {
    return <div className="text-sm text-muted-foreground">Cargando…</div>;
  }

  const agreementsCount = rollup?.agreements_count ?? 0;
  const uniqueClients = rollup?.unique_clients ?? 0;
  const uniqueUsers = rollup?.unique_users ?? 0;
  const totalLines = rollup?.total_lines ?? 0;




  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["agreement-groups"] });
    qc.invalidateQueries({ queryKey: ["agreements"] });
  };

  return (
    <div className="space-y-6">
      <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 h-8 px-2 text-muted-foreground"
      >
        <Link to="/pgci/agreements">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Volver a acuerdos
        </Link>
      </Button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">{group.group_name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <span>
              {`${agreementsCount} ${agreementsCount === 1 ? "acuerdo" : "acuerdos"}`}
              {` · ${uniqueClients} ${uniqueClients === 1 ? "cliente" : "clientes"}`}
              {` · ${uniqueUsers} ${uniqueUsers === 1 ? "miembro" : "miembros"}`}
              {` · ${totalLines} ${totalLines === 1 ? "posición" : "posiciones"}`}
            </span>
          </div>
        </div>
        {canAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <a href="#agreements">
                <Boxes className="mr-1.5 h-4 w-4" /> Acuerdos
              </a>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRenameOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" /> Editar
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDeleteOpen(true)}
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Borrar
            </Button>
          </div>
        )}
      </header>

      {/* Resumen — mismo card que "Información comercial / Posiciones en el acuerdo" */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Información comercial / Posiciones en el agrupador
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <IndicatorCard label="Posiciones" value={totalLines} />
            <IndicatorCard label="Activas" value={rollup?.lines_active ?? 0} />
            <IndicatorCard label="Pendientes" value={rollup?.lines_pending ?? 0} />
            <IndicatorCard
              label="Requieren revisión"
              value={rollup?.lines_review ?? 0}
            />
            <IndicatorCard label="Excluidas" value={rollup?.lines_excluded ?? 0} />
          </div>
        </CardContent>
      </Card>


      {/* Información general */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Información general</CardTitle>
          {canAdmin && (
            <Button size="sm" variant="outline" onClick={() => setNotesOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" /> Editar condiciones
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <InfoSection>
            <InfoField label="Acuerdos">{agreementsCount}</InfoField>
            <InfoField label="Clientes">{uniqueClients}</InfoField>
            <InfoField label="Miembros del agrupador">{uniqueUsers}</InfoField>

            <InfoField label="Vigencia derivada desde">
              {formatDate(rollup?.min_start ?? null)}
            </InfoField>
            <InfoField label="Vigencia derivada hasta">
              {formatDate(rollup?.max_end ?? null)}
            </InfoField>
            <div className="hidden lg:block" />

            <InfoField label="Creado por">
              {group.created_by_name ?? "—"}
            </InfoField>
            <InfoField label="Creado">{formatDate(group.created_at)}</InfoField>
            <InfoField label="Actualizado">{formatDate(group.updated_at)}</InfoField>
          </InfoSection>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Condiciones generales
            </p>
            <div className="mt-1 min-h-[80px] whitespace-pre-wrap rounded-md border border-input bg-background px-3 py-2 text-sm">
              {group.notes?.trim() ? group.notes : ""}
            </div>
          </div>
        </CardContent>
      </Card>


      {/* Acuerdos */}
      <Card id="agreements" className="scroll-mt-20">

        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Acuerdos</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Acuerdos que pertenecen a este agrupador.
            </p>
          </div>
          {canAdmin && (
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> Agregar acuerdo
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <TooltipProvider delayDuration={150}>
            {(agreements ?? []).length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                <FileText className="h-6 w-6" />
                Este agrupador aún no contiene acuerdos.
              </div>
            ) : (
              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Acuerdo</TableHead>
                      <TableHead>Cobertura</TableHead>
                      <TableHead className="w-[120px] whitespace-nowrap">Posiciones</TableHead>
                      <TableHead className="w-[96px] whitespace-nowrap">Estado</TableHead>
                      <TableHead className="w-[140px] whitespace-nowrap text-right">
                        <span className="sr-only">Acciones</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(agreements ?? []).map((a) => {
                      const first = a.companies[0] ?? null;
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium min-w-0">
                            <Link
                              to="/pgci/agreements/$agreementId"
                              params={{ agreementId: a.id }}
                              className="hover:underline"
                            >
                              {a.name}
                            </Link>
                          </TableCell>
                          <TableCell className="min-w-0">
                            {a.companies.length === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : a.companies.length === 1 ? (
                              <div className="flex items-center gap-2 min-w-0">
                                <Badge color="neutral">Cliente</Badge>
                                <span
                                  className="truncate"
                                  title={first ?? undefined}
                                >
                                  {first}
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 min-w-0">
                                <Badge color="accent">Múltiple</Badge>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="text-sm whitespace-nowrap cursor-default">
                                      {a.companies.length} Clientes…
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="max-w-xs">
                                    <ul className="space-y-0.5">
                                      {a.companies.map((c) => (
                                        <li key={c}>{c}</li>
                                      ))}
                                    </ul>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {a.lines_total}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <StatusBadge
                              status={a.status === "active" ? "active" : "neutral"}
                              label={a.status === "active" ? "Activo" : "Inactivo"}
                            />
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-right">
                            <div className="inline-flex items-center gap-1">
                              <Button asChild size="sm" variant="ghost">
                                <Link
                                  to="/pgci/agreements/$agreementId"
                                  params={{ agreementId: a.id }}
                                >
                                  Ver <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                                </Link>
                              </Button>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    aria-label="Sacar del agrupador"
                                    onClick={() => setRemoveAgId(a.id)}
                                  >
                                    <Unlink className="h-4 w-4 text-destructive" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Sacar del agrupador</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </TooltipProvider>
        </CardContent>
      </Card>

      <AgreementGroupMembersSection groupId={groupId} canAdmin={canAdmin} />

      <MembersByAgreementSection groupId={groupId} />


      <RenameGroupDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        groupId={groupId}
        currentName={group.group_name}
        onDone={invalidateAll}
      />

      <NotesDialog
        open={notesOpen}
        onOpenChange={setNotesOpen}
        groupId={groupId}
        currentNotes={group.notes}
        onDone={invalidateAll}
      />

      <DeleteGroupDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        groupId={groupId}
        agreementsCount={agreementsCount}
      />

      <AddAgreementsDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        groupId={groupId}
        onDone={invalidateAll}
      />

      <RemoveAgreementDialog
        agreementId={removeAgId}
        onClose={() => setRemoveAgId(null)}
        onDone={invalidateAll}
      />
    </div>
  );
}

function MembersByAgreementSection({ groupId }: { groupId: string }) {
  const listFn = useServerFn(listGroupAgreementMembers);
  const { data: rows, isLoading } = useQuery({
    queryKey: ["agreement-groups", "members-by-agreement", groupId],
    queryFn: () => listFn({ data: { group_id: groupId } }),
  });

  const roleLabel = (r: string) => {
    switch (r) {
      case "agreement_admin":
        return "Admin del acuerdo";
      case "agreement_member":
        return "Miembro del acuerdo";
      default:
        return r;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Miembros por acuerdo</CardTitle>
        <p className="mt-1 text-xs text-muted-foreground">
          Personas con acceso a los acuerdos que agrupa este grupo.
        </p>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : (rows ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            Sin miembros en los acuerdos del grupo.
          </div>
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Acuerdo</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Ve costos</TableHead>
                  <TableHead>Agregado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows ?? []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{m.user_name || "—"}</span>
                        <span className="text-xs text-muted-foreground">
                          {m.user_email}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        to="/pgci/agreements/$agreementId"
                        params={{ agreementId: m.agreement_id }}
                        className="hover:underline"
                      >
                        {m.agreement_name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge
                        color={m.role === "agreement_admin" ? "accent" : "neutral"}
                        variant="soft"
                      >
                        {roleLabel(m.role)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {m.can_view_costs ? "Sí" : "No"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(m.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


function RenameGroupDialog({
  open,
  onOpenChange,
  groupId,
  currentName,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groupId: string;
  currentName: string;
  onDone: () => void;
}) {
  const [name, setName] = useState(currentName);
  const fn = useServerFn(updateAgreementGroup);
  const mut = useMutation({
    mutationFn: () => fn({ data: { group_id: groupId, group_name: name.trim() } }),
    onSuccess: () => {
      toast.success("Agrupador renombrado");
      onDone();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) setName(currentName);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Renombrar agrupador</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Nombre <span className="text-primary">*</span>
          </label>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={160}
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mut.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={mut.isPending || !name.trim() || name.trim() === currentName}
          >
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NotesDialog({
  open,
  onOpenChange,
  groupId,
  currentNotes,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groupId: string;
  currentNotes: string | null;
  onDone: () => void;
}) {
  const [text, setText] = useState(currentNotes ?? "");
  const fn = useServerFn(updateAgreementGroup);
  const mut = useMutation({
    mutationFn: () => fn({ data: { group_id: groupId, notes: text } }),
    onSuccess: () => {
      toast.success("Condiciones actualizadas");
      onDone();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (o) setText(currentNotes ?? "");
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Condiciones generales del agrupador</DialogTitle>
          <DialogDescription>
            Aplican a todos los acuerdos del agrupador.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          maxLength={4000}
        />
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={mut.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteGroupDialog({
  open,
  onOpenChange,
  groupId,
  agreementsCount,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groupId: string;
  agreementsCount: number;
}) {
  const fn = useServerFn(deleteAgreementGroup);
  const mut = useMutation({
    mutationFn: () => fn({ data: { group_id: groupId } }),
    onSuccess: () => {
      toast.success("Agrupador borrado");
      // Navegar de vuelta a acuerdos.
      window.location.href = "/pgci/agreements";
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Borrar agrupador</AlertDialogTitle>
          <AlertDialogDescription>
            {agreementsCount === 0
              ? "Se eliminará el agrupador. No contiene acuerdos."
              : `Se eliminará el agrupador. ${agreementsCount} ${
                  agreementsCount === 1 ? "acuerdo quedará" : "acuerdos quedarán"
                } sin agrupador (no se borran).`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mut.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              mut.mutate();
            }}
            disabled={mut.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Borrar agrupador
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function AddAgreementsDialog({
  open,
  onOpenChange,
  groupId,
  onDone,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groupId: string;
  onDone: () => void;
}) {
  const listFn = useServerFn(listEligibleAgreementsForGroup);
  const addFn = useServerFn(addAgreementsToGroup);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: eligible, isLoading } = useQuery({
    queryKey: ["agreement-groups", "eligible-agreements"],
    queryFn: () => listFn(),
    enabled: open,
  });

  const filtered = useMemo(() => {
    const list = eligible ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((a) => {
      const hay = [a.name, ...a.companies].join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [eligible, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reset = () => {
    setSelected(new Set());
    setSearch("");
  };

  const mut = useMutation({
    mutationFn: () =>
      addFn({
        data: { group_id: groupId, agreement_ids: Array.from(selected) },
      }),
    onSuccess: (r) => {
      toast.success(
        r.count === 1 ? "Acuerdo agregado" : `${r.count} acuerdos agregados`,
      );
      reset();
      onDone();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Agregar acuerdo al agrupador</DialogTitle>
          <DialogDescription>
            Se listan acuerdos que administras y que no pertenecen aún a ningún
            agrupador.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o cliente…"
              className="pl-9"
            />
          </div>

          <div className="max-h-80 overflow-y-auto rounded-md border border-border">
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Cargando…
              </p>
            ) : filtered.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {search.trim()
                  ? "Sin resultados para esa búsqueda."
                  : "No hay acuerdos disponibles para agregar."}
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((a) => {
                  const isChecked = selected.has(a.id);
                  const coverage =
                    a.companies.length === 0
                      ? "Sin clientes"
                      : a.companies.length === 1
                        ? a.companies[0]
                        : `${a.companies.length} clientes`;
                  return (
                    <li key={a.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/40">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => toggle(a.id)}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium">{a.name}</div>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {coverage} · {a.lines_total}{" "}
                            {a.lines_total === 1 ? "posición" : "posiciones"}
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
            onClick={() => onOpenChange(false)}
            disabled={mut.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() => mut.mutate()}
            disabled={selected.size === 0 || mut.isPending}
          >
            {selected.size > 1 ? `Agregar (${selected.size})` : "Agregar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RemoveAgreementDialog({
  agreementId,
  onClose,
  onDone,
}: {
  agreementId: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const fn = useServerFn(removeAgreementFromGroup);
  const mut = useMutation({
    mutationFn: (id: string) => fn({ data: { agreement_id: id } }),
    onSuccess: () => {
      toast.success("Acuerdo desvinculado del agrupador");
      onDone();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <AlertDialog open={!!agreementId} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sacar acuerdo del agrupador</AlertDialogTitle>
          <AlertDialogDescription>
            El acuerdo sigue existiendo, solo deja de pertenecer a este agrupador.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={mut.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              if (agreementId) mut.mutate(agreementId);
            }}
            disabled={mut.isPending}
          >
            Sacar del agrupador
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
