"use client";

import { Search, LogOut, X, User, Building2, Mail, Phone, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchLeads, type SearchResult } from "@/lib/api/leads";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export function Header() {
  const { data: session } = useSession();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounced search
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["header-search", searchQuery],
    queryFn: () => searchLeads(searchQuery),
    enabled: searchQuery.trim().length >= 2,
    staleTime: 300,
  });

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Show results when search query changes
  useEffect(() => {
    if (searchQuery.trim().length >= 2 && searchResults) {
      setShowResults(true);
    } else {
      setShowResults(false);
    }
  }, [searchQuery, searchResults]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut({ 
        redirect: false,
        callbackUrl: "/auth/login" 
      });
      router.push("/auth/login");
      router.refresh();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleResultClick = () => {
    setSearchQuery("");
    setShowResults(false);
  };

  // Get first name of user for avatar
  const getUserFirstName = () => {
    if (session?.user?.name) {
      const nameParts = session.user.name.trim().split(/\s+/);
      return nameParts[0]; // First name (first word)
    }
    if (session?.user?.email) {
      return session.user.email.split("@")[0]; // Username part of email
    }
    return "U";
  };
  const userFirstName = getUserFirstName();

  const results = searchResults?.results || [];

  return (
    <header className="px-6 py-4" style={{ backgroundColor: "#FFFFFF", borderBottom: "1px solid #E2E8F0" }}>
      <div className="flex items-center justify-between">
        <div className="flex-1 max-w-xl relative" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              type="search"
              placeholder="Suche nach Name, E-Mail, Telefon, Google Place ID..."
              className="pl-10 pr-10 bg-gray-50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (searchQuery.trim().length >= 2 && results.length > 0) {
                  setShowResults(true);
                }
              }}
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setShowResults(false);
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showResults && searchQuery.trim().length >= 2 && (
            <div className="absolute z-50 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto">
              {isSearching ? (
                <div className="p-4 text-center text-gray-500">
                  Suche...
                </div>
              ) : results.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  Keine Ergebnisse gefunden
                </div>
              ) : (
                <div className="py-2">
                  {results.map((result: SearchResult) => (
                    <Link
                      key={result.id}
                      href={`/dashboard/leads/${result.id}`}
                      onClick={handleResultClick}
                      className="block px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-1">
                          {result.type === "COMPANY" ? (
                            <Building2 className="h-5 w-5" style={{ color: "#1A365D" }} />
                          ) : (
                            <User className="h-5 w-5" style={{ color: "#1A365D" }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium truncate" style={{ color: "#2D3748" }}>
                              {result.name}
                            </p>
                            <Badge
                              variant="secondary"
                              className="text-xs"
                            >
                              {result.type === "COMPANY" ? "Firma" : "Kontakt"}
                            </Badge>
                          </div>
                          {result.company && (
                            <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {result.company.name}
                              {result.company.city && (
                                <span className="text-gray-400"> • {result.company.city}</span>
                              )}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-3 mt-1 text-xs text-gray-500">
                            {result.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {result.email}
                              </span>
                            )}
                            {result.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {result.phone}
                              </span>
                            )}
                            {result.company?.address && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {result.company.address}
                              </span>
                            )}
                          </div>
                          {result.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {result.tags.slice(0, 3).map((tag) => (
                                <Badge
                                  key={tag.id}
                                  variant="secondary"
                                  className="text-xs"
                                  style={{
                                    borderColor: tag.color || undefined,
                                    color: tag.color || undefined,
                                  }}
                                >
                                  {tag.name}
                                </Badge>
                              ))}
                              {result.tags.length > 3 && (
                                <span className="text-xs text-gray-400">
                                  +{result.tags.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                  {results.length >= 20 && (
                    <div className="px-4 py-2 text-xs text-gray-500 text-center border-t border-gray-100">
                      Zeige die ersten 20 Ergebnisse
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="px-3 py-1 rounded-full flex items-center justify-center text-white text-sm font-semibold whitespace-nowrap" style={{ backgroundColor: "#48BB78" }}>
              {userFirstName}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Abmelden</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}