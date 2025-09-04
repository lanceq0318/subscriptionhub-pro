import NextAuth from 'next-auth';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

// In production, store users in a database
// This is a simple in-memory store for demo purposes
const users = [
  {
    id: '1',
    email: 'demo@example.com',
    password: '$2a$10$HGxVwS8USLfdJ6pnZKxBzOqFc3kGKQR3xKlXvYK1xKzXH5r5gYGEW', // demo123
    name: 'Demo User',
    company: 'Demo Company',
  },
  {
    id: '2', 
    email: 'admin@example.com',
    password: '$2a$10$zF4YR7g43uK3NpT4VhXOneJlZ3Y2FYqVT9xvHkGF.fXUyIvUP0FUW', // admin123
    name: 'Admin User',
    company: 'Admin Corp',
  }
];

// Store new users (in production, use a database)
export const userStore = [...users];

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Invalid credentials');
        }

        // Find user
        const user = userStore.find(u => u.email === credentials.email);
        
        if (!user) {
          throw new Error('User not found');
        }

        // Check password
        const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
        
        if (!isPasswordValid) {
          throw new Error('Invalid password');
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production',
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.email = token.email as string;
        session.user.name = token.name as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET || 'your-secret-key-change-in-production',
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };