"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { fetchUsers, createUser, updateUser, deleteUser, fetchUserProfile } from "@/lib/api/users";
import { Plus, Trash2, Edit, Users as UsersIcon, Shield, User as UserIcon } from "lucide-react";
import toast from "react-hot-toast";
import { formatDateTime } from "@/lib/utils";

export function UsersManagementView() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<any>(null);
  const [userToDelete, setUserToDelete] = useState<any>(null);

  // Formular-Felder
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState<"USER" | "ADMIN">("USER");

  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserPassword, setEditUserPassword] = useState("");
  const [editUserRole, setEditUserRole] = useState<"USER" | "ADMIN" | "OWNER">("USER");
  const [editUserIsActive, setEditUserIsActive] = useState(true);

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  const { data: currentUser } = useQuery({
    queryKey: ["user-profile"],
    queryFn: fetchUserProfile,
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: {
      email: string;
      password: string;
      name: string;
      role?: "USER" | "ADMIN";
    }) => {
      return await createUser(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Benutzer erfolgreich erstellt");
      setCreateDialogOpen(false);
      setNewUserName("");
      setNewUserEmail("");
      setNewUserPassword("");
      setNewUserRole("USER");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Fehler beim Erstellen des Benutzers");
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async (data: {
      userId: string;
      name?: string;
      email?: string;
      password?: string;
      role?: "USER" | "ADMIN" | "OWNER";
      isActive?: boolean;
    }) => {
      const { userId, ...updateData } = data;
      return await updateUser(userId, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Benutzer erfolgreich aktualisiert");
      setEditDialogOpen(false);
      setUserToEdit(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Fehler beim Aktualisieren des Benutzers");
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await deleteUser(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Benutzer erfolgreich gelöscht");
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Fehler beim Löschen des Benutzers");
    },
  });

  const handleCreateUser = () => {
    if (!newUserName || !newUserEmail || !newUserPassword) {
      toast.error("Bitte fülle alle Felder aus");
      return;
    }

    if (newUserPassword.length < 8) {
      toast.error("Passwort muss mindestens 8 Zeichen lang sein");
      return;
    }

    createUserMutation.mutate({
      email: newUserEmail,
      password: newUserPassword,
      name: newUserName,
      role: newUserRole,
    });
  };

  const handleEditUser = (user: any) => {
    setUserToEdit(user);
    setEditUserName(user.name || "");
    setEditUserEmail(user.email || "");
    setEditUserPassword("");
    setEditUserRole(user.role);
    setEditUserIsActive(user.isActive);
    setEditDialogOpen(true);
  };

  const handleUpdateUser = () => {
    if (!userToEdit) return;

    const updates: any = {};

    if (editUserName !== userToEdit.name) {
      updates.name = editUserName;
    }

    if (editUserEmail !== userToEdit.email) {
      updates.email = editUserEmail;
    }

    if (editUserPassword && editUserPassword.trim() !== "") {
      if (editUserPassword.length < 8) {
        toast.error("Passwort muss mindestens 8 Zeichen lang sein");
        return;
      }
      updates.password = editUserPassword;
    }

    if (editUserRole !== userToEdit.role) {
      updates.role = editUserRole;
    }

    if (editUserIsActive !== userToEdit.isActive) {
      updates.isActive = editUserIsActive;
    }

    if (Object.keys(updates).length === 0) {
      toast.error("Keine Änderungen vorgenommen");
      return;
    }

    updateUserMutation.mutate({
      userId: userToEdit.id,
      ...updates,
    });
  };

  const handleDeleteUser = (user: any) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (userToDelete) {
      deleteUserMutation.mutate(userToDelete.id);
    }
  };

  const getRoleBadge = (role: string) => {
    if (role === "SUPERADMIN") {
      return <Badge style={{ backgroundColor: "#1A365D20", color: "#1A365D" }}>Agency-Admin</Badge>;
    }
    if (role === "OWNER") {
      return <Badge style={{ backgroundColor: "#1A365D20", color: "#1A365D" }}>Owner</Badge>;
    }
    if (role === "ADMIN") {
      return <Badge style={{ backgroundColor: "#1A365D20", color: "#1A365D" }}>Admin</Badge>;
    }
    return <Badge className="bg-gray-100 text-gray-800">Benutzer</Badge>;
  };

  const canManageUsers = currentUser?.role === "OWNER" || currentUser?.role === "ADMIN" || currentUser?.role === "SUPERADMIN";
  const canDeleteUsers = currentUser?.role === "OWNER" || currentUser?.role === "SUPERADMIN";

  if (!canManageUsers) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Benutzer-Verwaltung</CardTitle>
          <CardDescription>
            Du hast keine Berechtigung, Benutzer zu verwalten.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Benutzer-Verwaltung</CardTitle>
              <CardDescription>
                Verwalte Benutzer für Deinen Account
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Neuer Benutzer
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-gray-500">Lade Benutzer...</div>
          ) : users && users.length > 0 ? (
            <div className="space-y-4">
              {users.map((user: any) => (
                <div
                  key={user.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: "#1A365D20" }}>
                      {user.role === "OWNER" ? (
                        <Shield className="h-5 w-5" style={{ color: "#1A365D" }} />
                      ) : (
                        <UserIcon className="h-5 w-5" style={{ color: "#1A365D" }} />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium" style={{ color: "#2D3748" }}>{user.name || "Unbekannt"}</p>
                        {getRoleBadge(user.role)}
                        {!user.isActive && (
                          <Badge variant="secondary" style={{ backgroundColor: "#1A365D20", color: "#1A365D" }}>
                            Inaktiv
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-500">{user.email}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Erstellt: {formatDateTime(new Date(user.createdAt))}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditUser(user)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Bearbeiten
                    </Button>
                    {canDeleteUsers && user.role !== "OWNER" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteUser(user)}
                        className="hover:opacity-80"
                        style={{ color: "#1A365D" }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <UsersIcon className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>Noch keine Benutzer vorhanden</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Neuer Benutzer */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuer Benutzer</DialogTitle>
            <DialogDescription>
              Erstellen Sie einen neuen Benutzer für Ihren Account
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Name</label>
              <Input
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Max Mustermann"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">E-Mail</label>
              <Input
                type="email"
                value={newUserEmail}
                onChange={(e) => setNewUserEmail(e.target.value)}
                placeholder="max@beispiel.de"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Passwort</label>
              <Input
                type="password"
                value={newUserPassword}
                onChange={(e) => setNewUserPassword(e.target.value)}
                placeholder="Mindestens 8 Zeichen"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Rolle</label>
              <Select value={newUserRole} onValueChange={(value) => setNewUserRole(value as "USER" | "ADMIN")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USER">Benutzer</SelectItem>
                  {currentUser?.role === "OWNER" && (
                    <SelectItem value="ADMIN">Administrator</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleCreateUser}
              disabled={createUserMutation.isPending}
            >
              {createUserMutation.isPending ? "Wird erstellt..." : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Benutzer bearbeiten */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Benutzer bearbeiten</DialogTitle>
            <DialogDescription>
              Aktualisiere die Benutzerinformationen
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Name</label>
              <Input
                value={editUserName}
                onChange={(e) => setEditUserName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">E-Mail</label>
              <Input
                type="email"
                value={editUserEmail}
                onChange={(e) => setEditUserEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Neues Passwort (optional)
              </label>
              <Input
                type="password"
                value={editUserPassword}
                onChange={(e) => setEditUserPassword(e.target.value)}
                placeholder="Leer lassen, um nicht zu ändern"
              />
            </div>
            {userToEdit?.role !== "OWNER" && (currentUser?.role === "OWNER" || currentUser?.role === "ADMIN" || currentUser?.role === "SUPERADMIN") && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Rolle</label>
                <Select
                  value={editUserRole}
                  onValueChange={(value) => setEditUserRole(value as "USER" | "ADMIN" | "OWNER")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USER">Benutzer</SelectItem>
                    <SelectItem value="ADMIN">Administrator</SelectItem>
                    {currentUser?.role === "OWNER" && (
                      <SelectItem value="OWNER">Eigentümer</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}
            {userToEdit?.role !== "OWNER" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editUserIsActive}
                    onChange={(e) => setEditUserIsActive(e.target.checked)}
                    className="rounded"
                  />
                  Benutzer ist aktiv
                </label>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleUpdateUser}
              disabled={updateUserMutation.isPending}
            >
              {updateUserMutation.isPending ? "Wird gespeichert..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Benutzer löschen */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Benutzer löschen</DialogTitle>
            <DialogDescription>
              Möchtest Du den Benutzer &quot;{userToDelete?.name}&quot; wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? "Wird gelöscht..." : "Löschen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
