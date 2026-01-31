"use client";

import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ProfileSettingsView } from "./profile-settings-view";
import { UsersManagementView } from "./users-management-view";
import { AccountSettingsView } from "./account-settings-view";
import { WebhooksView } from "./webhooks-view";
import { EmailSettingsView } from "./email-settings-view";
import { SalesScriptSettingsView } from "./sales-script-settings-view";
import { SecurityEventsView } from "./security-events-view";

export function SettingsView() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const userRole = session?.user?.role;
  const isSuperAdmin = userRole === "SUPERADMIN";
  const canManageEmail = userRole === "ADMIN" || userRole === "OWNER" || userRole === "SUPERADMIN";
  
  // Get initial tab from URL parameter, default to "profile"
  const initialTab = searchParams?.get("tab") || "profile";
  const validTabs = canManageEmail 
    ? ["profile", "sales-script", "account", "users", "webhooks", "email", "security"]
    : ["profile", "sales-script", "account", "users", "webhooks", "security"];
  const defaultTab = validTabs.includes(initialTab) ? initialTab : "profile";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Einstellungen</h1>
        <p className="text-gray-500 mt-1">
          Verwalte Deine Kontoeinstellungen und Benutzer
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList>
          <TabsTrigger value="profile">Profil</TabsTrigger>
          <TabsTrigger value="sales-script">Persönliches Verkaufsscript</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="users">Benutzer</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          {canManageEmail && (
            <TabsTrigger value="email">E-Mail</TabsTrigger>
          )}
          <TabsTrigger value="security">Security Events</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-6">
          <ProfileSettingsView />
        </TabsContent>

        <TabsContent value="sales-script" className="mt-6">
          <SalesScriptSettingsView />
        </TabsContent>

        <TabsContent value="account" className="mt-6">
          <AccountSettingsView />
        </TabsContent>

        <TabsContent value="users" className="mt-6">
          <UsersManagementView />
        </TabsContent>

        <TabsContent value="webhooks" className="mt-6">
          <WebhooksView />
        </TabsContent>

        {canManageEmail && (
          <TabsContent value="email" className="mt-6">
            <EmailSettingsView />
          </TabsContent>
        )}

        <TabsContent value="security" className="mt-6">
          <SecurityEventsView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
