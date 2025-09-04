// lib/auth.ts
import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
// import GithubProvider from "next-auth/providers/github";
// import CredentialsProvider from "next-auth/providers/credentials";
// ...any adapters, callbacks, etc.

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    // GithubProvider({ clientId: ..., clientSecret: ... }),
    // CredentialsProvider({ ... }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, user }) {
      // customize if you need
      return token;
    },
    async session({ session, token }) {
      // customize if you need
      return session;
    },
  },
  // adapter, pages, etc. if needed
};
