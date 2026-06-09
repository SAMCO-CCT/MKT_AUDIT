import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      username?: string;
      displayName?: string;
      role?: string;
      company?: string;
      companyName?: string;
    };
  }

  interface User {
    username?: string;
    displayName?: string;
    role?: string;
    company?: string;
    companyName?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    username?: string;
    displayName?: string;
    role?: string;
    company?: string;
    companyName?: string;
  }
}
