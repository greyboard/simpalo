import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    // Exclude public webhook endpoints from authentication
    const pathname = req.nextUrl.pathname;
    
    // Public webhook endpoints - no authentication required
    if (pathname.startsWith("/api/webhooks/incoming/") || pathname === "/api/webhooks/mailgun") {
      return NextResponse.next();
    }
    
    // Public endpoint for registration processing (called by landing page)
    // WICHTIG: Diese Route muss VOR der Admin-Prüfung kommen!
    if (pathname.includes("/process-registration")) {
      console.log("[MIDDLEWARE] Process-registration Route erkannt, erlaube Zugriff:", pathname);
      return NextResponse.next();
    }
    
    // Check role-based access for admin API routes (if needed in future)
    // Note: Admin dashboard has been removed - project is now self-hosted
    if (pathname.startsWith("/api/admin")) {
      const token = req.nextauth.token;
      if (!token || (token as any).role !== "SUPERADMIN") {
        // Return 403 for admin API routes
        return NextResponse.json(
          { error: "Keine Berechtigung" },
          { status: 403 }
        );
      }
    }
    
    // All other routes require authentication (handled by withAuth)
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        
        // Public webhook endpoints - no authentication required
        if (pathname.startsWith("/api/webhooks/incoming/") || pathname === "/api/webhooks/mailgun") {
          return true;
        }
        
        // Public endpoint for registration processing (called by landing page)
        // WICHTIG: Diese Route muss VOR der Admin-Prüfung kommen!
        if (pathname.includes("/process-registration")) {
          console.log("[MIDDLEWARE] Process-registration Route erkannt in authorized callback:", pathname);
          return true;
        }
        
        // All other routes require authentication
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/leads/:path*",
    "/api/tags/:path*",
    "/api/notes/:path*",
    "/api/campaigns/:path*",
    "/api/templates/:path*",
    "/api/webhooks/:path*",
    "/api/crm/:path*",
    "/api/admin/:path*",
  ],
};
