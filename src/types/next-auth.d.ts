import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      userId: string;
      organizationId: string;
      role: "ADMIN" | "STAFF";
      name?: string | null;
    };
  }
  interface User {
    organizationId: string;
    role: "ADMIN" | "STAFF";
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    organizationId: string;
    role: "ADMIN" | "STAFF";
  }
}
