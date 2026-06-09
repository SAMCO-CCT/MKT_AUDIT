import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { pool } from "./lib/db";

type AppUserRow = {
  id: number;
  company: string;
  username: string;
  password_hash: string | null;
  password: string | null;
  display_name: string | null;
  role: string | null;
  is_active: boolean;
};

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

        const result = await pool.query<AppUserRow>(
          `
          SELECT
            id,
            company,
            username,
            password_hash,
            password,
            display_name,
            role,
            is_active
          FROM app_users
          WHERE company = $1
            AND username = $2
          LIMIT 1
          `,
          [company, username]
        );

        const user = result.rows[0];
        if (!user || !user.is_active) return null;

        let validPassword = false;

        if (user.password_hash) {
          validPassword = await bcrypt.compare(password, user.password_hash);
        } else if (user.password) {
          // Fallback for existing plain-text password rows. Use password_hash in production.
          validPassword = user.password === password;
        }

        if (!validPassword) return null;

        await pool.query(
          `
          UPDATE app_users
          SET
            last_login_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          `,
          [user.id]
        );

        return {
          id: String(user.id),
          name: user.display_name || user.username,
          email: `${user.username}@local.samco`,
          username: user.username,
          displayName: user.display_name || user.username,
          role: user.role || "user",
          company: user.company,
          companyName,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.username = user.username;
        token.displayName = user.displayName;
        token.role = user.role;
        token.company = user.company;
        token.companyName = user.companyName;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        ...session.user,
        username: token.username,
        displayName: token.displayName,
        role: token.role,
        company: token.company,
        companyName: token.companyName,
      };
      return session;
    },
  },
};
