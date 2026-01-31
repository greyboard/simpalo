import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { sendEmailToLead } from "@/lib/email-service";

export const dynamic = "force-dynamic";

interface SendEmailRequest {
  leadId: string;
  type: "auto-reply" | "owner-notification";
  recipientEmail: string;
  recipientName?: string;
}

/**
 * POST /api/emails/send
 * Send email via Mailgun (auto-reply or owner notification)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.accountId) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      );
    }

    const accountId = session.user.accountId;
    const body: SendEmailRequest = await request.json();
    const { leadId, type, recipientEmail, recipientName } = body;

    // Use shared email service function
    const result = await sendEmailToLead({
      leadId,
      type,
      recipientEmail,
      recipientName,
      accountId,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Error sending email:", error);
    return NextResponse.json(
      { error: error.message || "Fehler beim Senden der E-Mail" },
      { status: 500 }
    );
  }
}
