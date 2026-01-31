"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Users,
  Search,
  MessageSquare,
  Settings,
  Zap,
  Phone,
  Route,
  FileText,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Kontakte", href: "/dashboard/leads", icon: Users },
  { name: "Lead-Suche", href: "/dashboard/search", icon: Search },
  { name: "Kampagnen", href: "/dashboard/campaigns", icon: MessageSquare },
  // Temporarily hidden: { name: "AI-Features", href: "/dashboard/ai", icon: Zap },
];

const aiFeatures = [
  { name: "Route-Planner", href: "/dashboard/ai/route", icon: Route },
  { name: "Cold-Call-Trainer", href: "/dashboard/ai/call-trainer", icon: Phone },
  { name: "Website-Builder", href: "/dashboard/ai/website-builder", icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <div className="w-64 flex flex-col" style={{ backgroundColor: "#1A365D" }}>
      <div className="p-6 border-b" style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}>
        <Link href="/dashboard" className="flex items-center">
          <Image
            src="/logo.png"
            alt="Simpalo - das einfachste CRM für den deutschen Markt"
            width={240}
            height={80}
            className="h-16 w-auto"
            priority
          />
        </Link>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          // Spezielle Behandlung für Dashboard: Nur aktiv wenn exakt /dashboard, nicht bei Unterseiten
          let isActive;
          if (item.href === "/dashboard") {
            isActive = pathname === "/dashboard" || pathname === "/dashboard/";
          } else {
            isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
          }
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors",
                isActive ? "text-white" : "text-gray-400"
              )}
              style={isActive 
                ? { backgroundColor: "rgba(255, 255, 255, 0.15)" } 
                : {}
              }
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "#2A4365";
                  e.currentTarget.style.color = "#FFFFFF";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "#9CA3AF";
                }
              }}
            >
              <item.icon 
                className="mr-3 h-5 w-5" 
                style={isActive ? { color: "#FFFFFF" } : { color: "#94A3B8" }}
              />
              {item.name}
            </Link>
          );
        })}
        
        {/* Temporarily hidden: AI-Features section */}
        {false && (
          <div className="pt-4 mt-4 border-t" style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}>
            <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              AI-Features
            </p>
            {aiFeatures.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    "flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive ? "text-white" : "text-gray-400"
                  )}
                  style={isActive 
                    ? { backgroundColor: "rgba(255, 255, 255, 0.15)" } 
                    : {}
                  }
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "#2A4365";
                      e.currentTarget.style.color = "#FFFFFF";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.color = "#9CA3AF";
                    }
                  }}
                >
                  <item.icon 
                    className="mr-3 h-5 w-5" 
                    style={isActive ? { color: "#FFFFFF" } : { color: "#94A3B8" }}
                  />
                  {item.name}
                </Link>
              );
            })}
          </div>
        )}
      </nav>
      
      <div className="p-4 border-t" style={{ borderColor: "rgba(255, 255, 255, 0.1)" }}>
        <Link
          href="/dashboard/settings"
          className={cn(
            "flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors",
            pathname === "/dashboard/settings" ? "text-white" : "text-gray-400"
          )}
          style={pathname === "/dashboard/settings" 
            ? { backgroundColor: "rgba(255, 255, 255, 0.15)" } 
            : { color: "#94A3B8" }
          }
          onMouseEnter={(e) => {
            if (pathname !== "/dashboard/settings") {
              e.currentTarget.style.backgroundColor = "#2A4365";
              e.currentTarget.style.color = "#FFFFFF";
              const icon = e.currentTarget.querySelector("svg");
              if (icon) icon.style.color = "#FFFFFF";
            }
          }}
          onMouseLeave={(e) => {
            if (pathname !== "/dashboard/settings") {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#94A3B8";
              const icon = e.currentTarget.querySelector("svg");
              if (icon) icon.style.color = "#94A3B8";
            }
          }}
        >
          <Settings 
            className="mr-3 h-5 w-5" 
            style={pathname === "/dashboard/settings" ? { color: "#FFFFFF" } : { color: "#94A3B8" }} 
          />
          Einstellungen
        </Link>
      </div>
    </div>
  );
}