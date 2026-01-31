"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchUserProfile, updateUserProfile } from "@/lib/api/users";
import { User, Lock, Mail, Phone } from "lucide-react";
import toast from "react-hot-toast";

export function ProfileSettingsView() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile"],
    queryFn: fetchUserProfile,
  });

  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setEmail(profile.email || "");
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: async (data: {
      name?: string;
      email?: string;
      password?: string;
      currentPassword?: string;
    }) => {
      return await updateUserProfile(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      toast.success("Profil erfolgreich aktualisiert");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || "Fehler beim Aktualisieren des Profils");
    },
  });

  const handleSaveProfile = () => {
    const updates: any = {};

    if (name !== profile?.name) {
      updates.name = name;
    }

    if (email !== profile?.email) {
      updates.email = email;
    }

    if (newPassword) {
      if (newPassword.length < 8) {
        toast.error("Passwort muss mindestens 8 Zeichen lang sein");
        return;
      }

      if (newPassword !== confirmPassword) {
        toast.error("Passwörter stimmen nicht überein");
        return;
      }

      updates.password = newPassword;
      updates.currentPassword = currentPassword;
    }

    if (Object.keys(updates).length === 0) {
      toast.error("Keine Änderungen vorgenommen");
      return;
    }

    updateProfileMutation.mutate(updates);
  };

  if (isLoading) {
    return <div className="text-gray-500">Lade Profil...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Profil-Einstellungen</CardTitle>
          <CardDescription>
            Verwalte Deine persönlichen Informationen
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <User className="h-4 w-4" />
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Dein Name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              E-Mail-Adresse
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ihre.email@beispiel.de"
            />
          </div>

          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Lock className="h-4 w-4" />
              Passwort ändern
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Aktuelles Passwort
                </label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Aktuelles Passwort"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Neues Passwort
                </label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mindestens 8 Zeichen"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  Neues Passwort bestätigen
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Passwort wiederholen"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveProfile}
              disabled={updateProfileMutation.isPending}
            >
              {updateProfileMutation.isPending ? "Wird gespeichert..." : "Änderungen speichern"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
