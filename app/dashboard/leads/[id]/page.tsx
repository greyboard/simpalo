import { LeadDetailView } from "@/components/leads/lead-detail-view";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Metadata } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.accountId) {
      return {
        title: "Kontaktinformationen - simpalo",
      };
    }

    const lead = await prisma.lead.findFirst({
      where: {
        id: params.id,
        accountId: session.user.accountId,
      },
      select: {
        name: true,
      },
    });

    if (lead?.name) {
      return {
        title: `${lead.name} - Kontaktinformationen - simpalo`,
      };
    }

    return {
      title: "Kontaktinformationen - simpalo",
    };
  } catch (error) {
    return {
      title: "Kontaktinformationen - simpalo",
    };
  }
}

export default function LeadDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <div className="flex h-screen" style={{ backgroundColor: "#F7FAFC" }}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <LeadDetailView leadId={params.id} />
        </main>
      </div>
    </div>
  );
}