import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      accountId: string;
      role: "USER" | "ADMIN" | "OWNER" | "SUPERADMIN";
    };
  }

  interface User {
    id: string;
    email: string;
    name?: string | null;
    accountId: string;
    role: "USER" | "ADMIN" | "OWNER" | "SUPERADMIN";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accountId: string;
    role: "USER" | "ADMIN" | "OWNER" | "SUPERADMIN";
  }
}
