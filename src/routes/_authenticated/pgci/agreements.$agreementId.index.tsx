import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Power,
  UserPlus,
  Trash2,
  Info,
  Boxes,
} from "lucide-react";
import {
  getAgreement,
  getAgreementContext,
  listAgreementMembers,
  addAgreementMember,
  updateAgreementMember,
  removeAgreementMember,
  setAgreementStatus,
} from "@/lib/agreements.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, Badge } from "@/components/sumatec";
import { IndicatorCard } from "@/components/setup/IndicatorCard";
import { InfoField, InfoSection } from "@/components/setup/InfoSection";
import { AgreementCompaniesSection } from "@/components/agreements/AgreementCompaniesSection";
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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

export const Route = createFileRoute("/_authenticated/pgci/agreements/$agreementId/")({
  head: () => ({ meta: [{ title: "Acuerdo · PGCI" }] }),
  component: AgreementDetail,
});

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : value;
}

function AgreementDetail() {
  const { agreementId } = Route.useParams();
  const qc = useQueryClient();

  const getFn = useServerFn(getAgreement);
  const ctxFn = useServerFn(getAgreementContext);
  const membersFn = useServerFn(listAgreementMembers);
  const addMemberFn = useServerFn(addAgreementMember);
  const updateMemberFn = useServerFn(updateAgreementMember);
  const removeMemberFn = useServerFn(removeAgreementMember);
  const setStatusFn = useServerFn(setAgreementStatus);

  const { data: agreement, isLoading } = useQuery({
    queryKey: ["agreements", "detail", agreementId],
    queryFn: () => getFn({ data: { agreement_id: agreementId } }),
  });
  const { data: ctx } = useQuery({
    queryKey: ["agreements", "ctx", agreementId],
    queryFn: () => ctxFn({ data: { agreement_id: agreementId } }),
  });
  const { data: members } = useQuery({
    queryKey: ["agreements", "members", agreementId],
    queryFn: () => membersFn({ data: { agreement_id: agreementId } }),
  });

  const canAdmin = !!ctx?.can_admin;

  const [statusOpen, setStatusOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [editMember, setEditMember] = useState<{ id: string; name: string; role: "agreement_admin" | "agreement_member" } | null>(null);

  const toggleStatus = useMutation({
    mutationFn: () =>
      setStatusFn({
        data: {
          agreement_id: agreementId,
          status: agreement?.status === "active" ? "inactive" : "active",
        },
      }),
    onSuccess: () => {
      toast.success(
        agreement?.status === "active" ? "Acuerdo inactivado" : "Acuerdo activado",
      );
      qc.invalidateQueries({ queryKey: ["agreements"] });
      setStatusOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: (memberId: string) => removeMemberFn({ data: { member_id: memberId } }),
    onSuccess: () => {
      toast.success("Miembro removido");
      qc.invalidateQueries({ queryKey: ["agreements", "members", agreementId] });
      setRemoveId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMember = useMutation({
    mutationFn: (vars: { member_id: string; role?: "agreement_admin" | "agreement_member"; can_view_costs?: boolean }) =>
      updateMemberFn({ data: vars }),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["agreements", "members", agreementId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !agreement) {
    return <div className="text-sm text-muted-foreground">Cargando…</div>;
  }

  const clientName =
    agreement.client_commercial_name?.trim() ||
    agreement.client_legal_name ||
    "—";
  const isActive = agreement.status === "active";
  const total = agreement.lines_total ?? 0;
  const active = agreement.lines_active ?? 0;
  const pending = agreement.lines_pending ?? 0;
  const review = agreement.lines_review ?? 0;
  const excluded = agreement.lines_excluded ?? 0;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2 h-8 px-2 text-muted-foreground">
        <Link to="/pgci/agreements">
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Volver a acuerdos
        </Link>
      </Button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">{agreement.name}</h1>
            <StatusBadge
              status={isActive ? "active" : "neutral"}
              label={isActive ? "Activo" : "Inactivo"}
            />
            {agreement.scope === "unit" && <Badge color="info">Con alcance</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {clientName}
            {agreement.scope === "unit" && agreement.unit_name && (
              <> · {agreement.unit_name}</>
            )}
          </p>
        </div>
        {canAdmin && (
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" variant="outline">
              <Link
                to="/pgci/agreements/$agreementId/lines"
                params={{ agreementId }}
              >
                <Boxes className="mr-1.5 h-4 w-4" /> Posiciones
              </Link>
            </Button>
            <Button variant="outline" asChild size="sm">
              <Link
                to="/pgci/agreements/$agreementId/edit"
                params={{ agreementId }}
              >
                <Pencil className="mr-1.5 h-4 w-4" /> Editar
              </Link>
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStatusOpen(true)}>
              <Power className="mr-1.5 h-4 w-4" />
              {isActive ? "Inactivar" : "Activar"}
            </Button>
          </div>
        )}
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información comercial / Posiciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <IndicatorCard label="Posiciones" value={total} />
            <IndicatorCard label="Activas" value={active} />
            <IndicatorCard label="Pendientes" value={pending} />
            <IndicatorCard label="Requieren revisión" value={review} />
            <IndicatorCard label="Excluidas" value={excluded} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Información del acuerdo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <InfoSection>
            <InfoField label="Acuerdo">{agreement.name}</InfoField>
            <InfoField label="Cliente">{clientName}</InfoField>
            <InfoField label="Holding">
              {agreement.parent_commercial_name?.trim() ||
                agreement.parent_legal_name ||
                "—"}
            </InfoField>

            <InfoField label="Posiciones">{total}</InfoField>
            <InfoField label="Usuarios">{agreement.members_count ?? 0}</InfoField>
            <InfoField label="Empresas">{agreement.companies_count ?? 0}</InfoField>

            <InfoField label="Alcance">
              {agreement.scope === "unit"
                ? `Por unidad${agreement.unit_name ? ` · ${agreement.unit_name}` : ""}`
                : "Global"}
            </InfoField>
            <InfoField label="Vigencia desde">
              {formatDate(agreement.start_date)}
            </InfoField>
            <InfoField label="Vigencia hasta">
              {formatDate(agreement.end_date)}
            </InfoField>

            <InfoField label="Estado">{isActive ? "Activo" : "Inactivo"}</InfoField>
            <InfoField label="Creado">{formatDate(agreement.created_at)}</InfoField>
            <InfoField label="Actualizado">{formatDate(agreement.updated_at)}</InfoField>
          </InfoSection>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Observaciones
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm">
              {agreement.observations?.trim() ? agreement.observations : "—"}
            </p>
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Miembros del acuerdo</CardTitle>
          {canAdmin && (
            <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
              <UserPlus className="mr-1.5 h-4 w-4" /> Agregar
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <TooltipProvider delayDuration={150}>
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Ve costos</TableHead>
                  {canAdmin && <TableHead className="w-24 text-right"><span className="sr-only">Acciones</span></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(members ?? []).length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={canAdmin ? 4 : 3}
                      className="py-6 text-center text-sm text-muted-foreground"
                    >
                      Aún no hay miembros adicionales.
                    </TableCell>
                  </TableRow>
                )}
                {(members ?? []).map((m) => {
                  const roleLabel = m.role === "agreement_admin" ? "Administrador" : "Miembro";
                  const erpCode = (m.profile as { erp_user_code?: string | null } | null)?.erp_user_code;
                  return (
                  <TableRow key={m.id as string}>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">
                          {m.profile?.full_name ?? "—"}
                        </span>
                        {erpCode && (
                          <Badge color="neutral" variant="soft">{erpCode}</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {m.profile?.email ?? ""}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{roleLabel}</TableCell>
                    <TableCell>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={0} className="inline-flex">
                            <Switch checked={!!m.can_view_costs} disabled />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>Disponible próximamente.</TooltipContent>
                      </Tooltip>
                    </TableCell>
                    {canAdmin && (
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              setEditMember({
                                id: m.id as string,
                                name: m.profile?.full_name ?? "—",
                                role: m.role as "agreement_admin" | "agreement_member",
                              })
                            }
                            aria-label="Editar miembro"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setRemoveId(m.id as string)}
                            aria-label="Remover miembro"
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
          </TooltipProvider>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Al agregar un miembro, se le otorga acceso al cliente del acuerdo automáticamente.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Administrador:</span> gestiona el acuerdo, carga y edita posiciones, administra miembros y empresas vinculadas. <span className="font-medium text-foreground">Miembro:</span> consulta el acuerdo y sus posiciones.
          </p>
        </CardContent>
      </Card>

      <AgreementCompaniesSection agreementId={agreementId} canAdmin={canAdmin} />


      <AlertDialog open={statusOpen} onOpenChange={setStatusOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isActive ? "Inactivar acuerdo" : "Activar acuerdo"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isActive
                ? "Las posiciones no se eliminan, pero el acuerdo dejará de estar activo en consultas operativas."
                : "El acuerdo volverá a estar disponible y sus posiciones se recalcularán según vigencia."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={toggleStatus.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                toggleStatus.mutate();
              }}
              disabled={toggleStatus.isPending}
            >
              {isActive ? "Inactivar" : "Activar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!removeId} onOpenChange={(o) => !o && setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover miembro</AlertDialogTitle>
            <AlertDialogDescription>
              El usuario perderá acceso al acuerdo. Su asignación al cliente se mantiene.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMember.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (removeId) removeMember.mutate(removeId);
              }}
              disabled={removeMember.isPending}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AddMemberDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        agreementId={agreementId}
        existingUserIds={(members ?? []).map((m) => m.user_id as string)}
        onAdded={() =>
          qc.invalidateQueries({ queryKey: ["agreements", "members", agreementId] })
        }
        addMemberFn={addMemberFn}
      />
    </div>
  );
}

function AddMemberDialog({
  open,
  onOpenChange,
  agreementId,
  existingUserIds,
  onAdded,
  addMemberFn,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  agreementId: string;
  existingUserIds: string[];
  onAdded: () => void;
  addMemberFn: (args: { data: { agreement_id: string; user_id: string; role: "agreement_admin" | "agreement_member"; can_view_costs?: boolean } }) => Promise<unknown>;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string>("");
  const [role, setRole] = useState<"agreement_admin" | "agreement_member">(
    "agreement_member",
  );
  const [canViewCosts, setCanViewCosts] = useState(false);

  const { data: users } = useQuery({
    queryKey: ["profiles", "active-search", search],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("profiles")
        .select("user_id, full_name, email, status")
        .eq("status", "active")
        .order("full_name")
        .limit(20);
      if (search.trim()) q = q.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).filter((u) => !existingUserIds.includes(u.user_id as string));
    },
  });

  const add = useMutation({
    mutationFn: () =>
      addMemberFn({
        data: {
          agreement_id: agreementId,
          user_id: selected,
          role,
          can_view_costs: canViewCosts,
        },
      }),
    onSuccess: () => {
      toast.success("Miembro agregado");
      onAdded();
      setSelected("");
      setRole("agreement_member");
      setCanViewCosts(false);
      setSearch("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Agregar miembro</DialogTitle>
          <DialogDescription>
            Otorga acceso a este acuerdo a un usuario de la plataforma.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="member-search">Buscar usuario</Label>
            <Input
              id="member-search"
              placeholder="Nombre o email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-60 overflow-y-auto rounded-md border border-border">
            {(users ?? []).length === 0 && (
              <p className="p-4 text-center text-sm text-muted-foreground">
                {search ? "Sin resultados." : "No hay usuarios disponibles."}
              </p>
            )}
            {(users ?? []).map((u) => {
              const id = u.user_id as string;
              const isSel = selected === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelected(id)}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-muted ${
                    isSel ? "bg-muted" : ""
                  }`}
                >
                  <span>
                    <span className="block font-medium">{u.full_name}</span>
                    <span className="block text-xs text-muted-foreground">{u.email}</span>
                  </span>
                  {isSel && <Badge color="info">Seleccionado</Badge>}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Rol</Label>
              <Select value={role} onValueChange={(v) => setRole(v as typeof role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="agreement_member">Miembro</SelectItem>
                  <SelectItem value="agreement_admin">Admin del acuerdo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end justify-between rounded-md border border-border px-3 py-2">
              <div>
                <Label className="text-sm">Ve costos</Label>
                <p className="text-xs text-muted-foreground">Acceso a costos internos.</p>
              </div>
              <Switch checked={canViewCosts} onCheckedChange={setCanViewCosts} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={add.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => add.mutate()} disabled={!selected || add.isPending}>
            {add.isPending ? "Agregando…" : "Agregar miembro"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
