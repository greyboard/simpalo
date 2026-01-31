"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Route, Phone, FileText, Zap } from "lucide-react";
import Link from "next/link";

const aiFeatures = [
  {
    name: "AI-Route-Planner",
    description: "Optimiere Deine Besuchs- und Akquise-Routen für den Außendienst",
    icon: Route,
    href: "/dashboard/ai/route",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  {
    name: "AI-Cold-Call-Trainer",
    description: "Simulationen und Tipps zur professionellen Gesprächsführung",
    icon: Phone,
    href: "/dashboard/ai/call-trainer",
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  {
    name: "AI-Website-Builder",
    description: "Ein-Klick-Generierung von Websites für Lead-Präsentationen",
    icon: FileText,
    href: "/dashboard/ai/website-builder",
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  {
    name: "Power-Dialer",
    description: "Automatisches Wahltool direkt aus der Leadliste",
    icon: Zap,
    href: "/dashboard/ai/power-dialer",
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
];

export function AIFeaturesView() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">AI-Features</h1>
        <p className="text-gray-500 mt-1">
          Nutze KI-gestützte Tools für effiziente Lead-Akquise
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {aiFeatures.map((feature) => {
          const Icon = feature.icon;
          return (
            <Card key={feature.name} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className={`${feature.bgColor} p-3 rounded-lg`}>
                    <Icon className={`h-6 w-6 ${feature.color}`} />
                  </div>
                  <div className="flex-1">
                    <CardTitle>{feature.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {feature.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Link href={feature.href}>
                  <Button>Öffnen</Button>
                </Link>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}