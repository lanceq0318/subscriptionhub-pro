// NOTE: This file is no longer used. The canonical NextAuth config lives at:
// app/api/auth/[...nextauth]/route.ts
// You may safely delete this file to avoid confusion.
//
// If you prefer a single source of truth, you can import and export the same options here:

import type { NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";

export const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      tenantId: process.env.AZURE_AD_TENANT_ID!,
      authorization: { params: { scope: "openid profile email User.Read" } },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token }) {
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // @ts-expect-error augmenting with id
        session.user.id = (token as any).id || token.sub || '';
      }
      return session;
    },
  },
};
