import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseAddress } from "@/lib/utils";

// Prevent build errors on Vercel - API routes with database access must be dynamic
export const dynamic = "force-dynamic";

/**
 * POST /api/webhooks/[id]/test
 * Testet einen Webhook mit einem Beispiel-Payload
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const webhook = await prisma.webhook.findUnique({
      where: { id: params.id },
    });

    if (!webhook) {
      return NextResponse.json(
        { error: "Webhook nicht gefunden" },
        { status: 404 }
      );
    }

    const { testPayload } = await request.json();

    if (!testPayload) {
      return NextResponse.json(
        { error: "Test-Payload ist erforderlich" },
        { status: 400 }
      );
    }

    // Extrahiere Lead-Daten aus dem Payload
    const settings = webhook.settings as any || {};
    const fieldMapping = settings.fieldMapping || {};

    // Standard-Feld-Mapping (kann über Settings überschrieben werden)
    const getField = (fieldName: string, defaultValue: any = null) => {
      const mappedField = fieldMapping[fieldName] || fieldName;
      return testPayload[mappedField] || testPayload[fieldName] || defaultValue;
    };

    // Lead-Daten zusammenstellen (ohne tatsächlich zu speichern)
    const firstName = getField("firstName") || getField("first_name") || null;
    const lastName = getField("lastName") || getField("last_name") || null;
    const fullName = getField("name") || getField("fullName") || getField("full_name") || null;
    
    // Name zusammenstellen: Falls firstName/lastName vorhanden, kombinieren, sonst fullName oder Fallback
    let leadName = fullName;
    if (firstName && lastName) {
      leadName = `${firstName} ${lastName}`;
    } else if (firstName || lastName) {
      leadName = (firstName || "") + (lastName || "");
    }
    if (!leadName) {
      leadName = getField("businessName") || getField("company") || "Unbekannt";
    }
    
    const leadData: any = {
      name: leadName,
      firstName: firstName || null,
      lastName: lastName || null,
      businessName: getField("businessName") || getField("company") || getField("firma") || null,
      email: getField("email") || getField("emailAddress") || null,
      phone: getField("phone") || getField("telephone") || getField("phoneNumber") || null,
      website: getField("website") || getField("url") || getField("websiteUrl") || null,
      address: getField("address") || getField("formatted_address") || getField("street") || null,
      city: getField("city") || null,
      state: getField("state") || getField("province") || null,
      zipCode: getField("zipCode") || getField("zip") || getField("postalCode") || getField("postcode") || null,
      country: getField("country") || "DE",
      category: getField("category") || getField("type") || getField("industry") || null,
      source: webhook.source,
      status: getField("status") || "NEW",
      priority: getField("priority") || "MEDIUM",
      // UTM-Parameter
      utmSource: getField("utmSource") || getField("utm_source") || null,
      utmMedium: getField("utmMedium") || getField("utm_medium") || null,
      utmCampaign: getField("utmCampaign") || getField("utm_campaign") || null,
      utmTerm: getField("utmTerm") || getField("utm_term") || null,
      utmContent: getField("utmContent") || getField("utm_content") || null,
    };

    // Adresse parsen, wenn nur address vorhanden
    if (leadData.address && !leadData.city) {
      const parsedAddress = parseAddress(leadData.address);
      leadData.city = leadData.city || parsedAddress.city;
      leadData.zipCode = leadData.zipCode || parsedAddress.zipCode;
      leadData.state = leadData.state || parsedAddress.state;
    }

    // Zeige Mapping-Details
    const mappingDetails: any = {};
    Object.keys(leadData).forEach((key) => {
      const mappedField = fieldMapping[key] || key;
      mappingDetails[key] = {
        mappedFrom: mappedField,
        value: leadData[key],
        found: testPayload[mappedField] !== undefined || testPayload[key] !== undefined,
      };
    });

    return NextResponse.json({
      success: true,
      originalPayload: testPayload,
      mappedData: leadData,
      mappingDetails,
      fieldMapping: fieldMapping,
      message: "Webhook-Test erfolgreich (kein Lead erstellt)",
    });
  } catch (error: any) {
    console.error("Error testing webhook:", error);
    return NextResponse.json(
      {
        error: "Fehler beim Testen des Webhooks",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
