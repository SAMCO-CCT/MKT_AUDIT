import NextAuth from "next-auth";

/**
 * NextAuth session augmentation for SAMCO Audit.
 * app_users.id is UUID and must be available in API routes as session.user.id.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      username?: string;
      displayName?: string;
      company?: string;
      companyName?: string;
    };
  }

  interface User {
    id: string;
    username?: string;
    displayName?: string;
    company?: string;
    companyName?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    username?: string;
    displayName?: string;
    company?: string;
    companyName?: string;
  }
}
