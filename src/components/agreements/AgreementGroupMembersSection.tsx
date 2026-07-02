import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { UserPlus, Trash2, Users, Search } from "lucide-react";
import {
  listAgreementGroupMembers,
  addAgreementGroupMember,
  updateAgreementGroupMember,
  removeAgreementGroupMember,
} from "@/lib/agreements.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/sumatec";

type Role = "agreement_group_admin" | "agreement_group_member";

export function AgreementGroupMembersSection({
  groupId,
  canAdmin,
}: {
  groupId: string;
  canAdmin: boolean;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listAgreementGroupMembers);
  const addFn = useServerFn(addAgreementGroupMember);
  const updateFn = useServerFn(updateAgreementGroupMember);
  const removeFn = useServerFn(removeAgreementGroupMember);

  const { data: members } = useQuery({
    queryKey: ["agreement-groups", "members", groupId],
    queryFn: () => listFn({ data: { group_id: groupId } }),
  });

  const [addOpen, setAddOpen] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("agreement_group_member");
  const [search, setSearch] = useState("");

  const usersQ = useQuery({
    queryKey: ["profiles", "picker-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, status")
        .eq("status", "active")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: addOpen,
  });

  const memberUserIds = useMemo(
    () => new Set((members ?? []).map((m) => m.user_id)),
    [members],
  );

  const availableUsers = useMemo(() => {
    const list = (usersQ.data ?? []).filter((u) => !memberUserIds.has(u.user_id));
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (u) =>
        (u.full_name || "").toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q),
    );
  }, [usersQ.data, memberUserIds, search]);

  const resetPicker = () => {
    setSelectedUser(null);
    setRole("agreement_group_member");
    setSearch("");
  };

  const add = useMutation({
    mutationFn: () =>
      addFn({
        data: { group_id: groupId, user_id: selectedUser!, role },
      }),
    onSuccess: () => {
      toast.success("Miembro agregado");
      qc.invalidateQueries({ queryKey: ["agreement-groups", "members", groupId] });
      resetPicker();
      setAddOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: (vars: { member_id: string; role: Role }) =>
      updateFn({ data: vars }),
    onSuccess: () => {
      toast.success("Rol actualizado");
      qc.invalidateQueries({ queryKey: ["agreement-groups", "members", groupId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => removeFn({ data: { member_id: id } }),
    onSuccess: () => {
      toast.success("Miembro removido");
      qc.invalidateQueries({ queryKey: ["agreement-groups", "members", groupId] });
      setRemoveId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Miembros del agrupador</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Usuarios con acceso al agrupador. Los admins pueden gestionar miembros y
            editar el agrupador.
          </p>
        </div>
        {canAdmin && (
          <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
            <UserPlus className="mr-1.5 h-4 w-4" /> Agregar miembro
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {(members ?? []).length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            <Users className="h-6 w-6" />
            Sin miembros.
          </div>
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Rol</TableHead>
                  {canAdmin && (
                    <TableHead className="w-12 text-right">
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(members ?? []).map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{m.profile?.full_name ?? "—"}</span>
                        <span className="text-xs text-muted-foreground">
                          {m.profile?.email ?? ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {canAdmin ? (
                        <Select
                          value={m.role}
                          onValueChange={(v) =>
                            update.mutate({ member_id: m.id, role: v as Role })
                          }
                        >
                          <SelectTrigger className="h-8 w-[220px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="agreement_group_admin">
                              Admin del agrupador
                            </SelectItem>
                            <SelectItem value="agreement_group_member">
                              Miembro del agrupador
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge color={m.role === "agreement_group_admin" ? "accent" : "neutral"} variant="soft">
                          {m.role === "agreement_group_admin" ? "Admin" : "Miembro"}
                        </Badge>
                      )}
                    </TableCell>
                    {canAdmin && (
                      <TableCell className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setRemoveId(m.id)}
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

      <Dialog
        open={addOpen}
        onOpenChange={(o) => {
          setAddOpen(o);
          if (!o) resetPicker();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Agregar miembro al agrupador</DialogTitle>
            <DialogDescription>
              Selecciona un usuario y asigna un rol.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nombre o correo…"
                className="pl-9"
              />
            </div>

            <div className="max-h-64 overflow-y-auto rounded-md border border-border">
              {usersQ.isLoading ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Cargando…
                </p>
              ) : availableUsers.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Sin usuarios disponibles.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {availableUsers.map((u) => (
                    <li key={u.user_id}>
                      <label className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-muted/40">
                        <input
                          type="radio"
                          name="user"
                          checked={selectedUser === u.user_id}
                          onChange={() => setSelectedUser(u.user_id)}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="block truncate font-medium">
                            {u.full_name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {u.email}
                          </span>
                        </div>
                      </label>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium">Rol</label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agreement_group_admin">
                    Admin del agrupador
                  </SelectItem>
                  <SelectItem value="agreement_group_member">
                    Miembro del agrupador
                  </SelectItem>
                </SelectContent>
              </Select>
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
              disabled={!selectedUser || add.isPending}
            >
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!removeId} onOpenChange={(o) => !o && setRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover miembro</AlertDialogTitle>
            <AlertDialogDescription>
              El usuario pierde el acceso a este agrupador. No se pueden remover el
              último admin del agrupador.
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
