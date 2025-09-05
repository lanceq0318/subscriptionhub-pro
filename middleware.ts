import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
    },
    callbacks: {
      authorized: ({ req, token }) => {
        // Protect all routes except public ones
        const publicPaths = ['/login', '/api/auth', '/', '/favicon.ico'];
        const path = req.nextUrl.pathname;
        
        // Allow public paths
        if (publicPaths.some(p => path.startsWith(p))) {
          return true;
        }
        
        // Require authentication for everything else
        return !!token;
      }
    }
  }
);

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ]
};