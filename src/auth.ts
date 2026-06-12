import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./lib/prisma";
import { hasCompanyPermission } from "@/lib/permissions";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        company: { label: "Company", type: "text" },
        companyName: { label: "Company Name", type: "text" },
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const company = String(credentials?.company || "").trim();
        const companyName = String(credentials?.companyName || company).trim();
        const username = String(credentials?.username || "").trim();
        const password = String(credentials?.password || "");

        if (!company || !username || !password) return null;

        const user = await prisma.app_users.findUnique({
          where: { username },
          select: {
            id: true,
            username: true,
            password_hash: true,
            display_name: true,
            email: true,
            is_active: true,
          },
        });

        if (!user || !user.is_active || !user.password_hash) return null;

        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) return null;

        const canAccessCompany = await hasCompanyPermission(user.id, company);
        if (!canAccessCompany) return null;

        await prisma.app_users.update({
          where: { id: user.id },
          data: {
            last_login_at: new Date(),
            updated_at: new Date(),
          },
        });

        return {
          id: user.id,
          name: user.display_name || user.username,
          email: user.email || `${user.username}@local.samco`,
          username: user.username,
          displayName: user.display_name || user.username,
          company,
          companyName,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.displayName = user.displayName;
        token.company = user.company;
        token.companyName = user.companyName;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        id: token.id as string,
        username: token.username,
        displayName: token.displayName,
        company: token.company,
        companyName: token.companyName,
      };
      return session;
    },
  },
};
