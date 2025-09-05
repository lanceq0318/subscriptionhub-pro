import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    return NextResponse.next();
  },
  {
    pages: {
      signIn: "/login",
      error: "/login",
    },
    callbacks: {
      authorized: ({ token }) => {
        // Require authentication for protected routes
        return !!token;
      },
    },
  }
);

// Protect dashboard and API routes
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/((?!auth|db/init).*)",
  ],
};