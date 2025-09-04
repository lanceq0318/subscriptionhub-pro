// app/api/auth/[...nextauth]/route.ts
import NextAuth, { type NextAuthOptions } from "next-auth";
import AzureADProvider from "next-auth/providers/azure-ad";

// Optional but allowed in App Router:
export const runtime = "nodejs";

const authOptions: NextAuthOptions = {
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID!,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET!,
      // Use your tenant ID (or "common" if multi-tenant):
      tenantId: process.env.AZURE_AD_TENANT_ID ?? "common",
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account }) {
      if (account) token.microsoftId = account.providerAccountId;
      return token;
    },
    async session({ session, token }) {
      (session as any).microsoftId = token.microsoftId;
      return session;
    },
  },
};

const handler = NextAuth(authOptions);

// Only export GET/POST (and allowed config like runtime)
export { handler as GET, handler as POST };
