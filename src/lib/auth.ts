import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: "Admin Login",
      credentials: {
        username: { label: "Username", type: "text", placeholder: "admin" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }
        
        // 1. Check against environment variables (Master Admin)
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminPassword = process.env.ADMIN_PASSWORD || 'password123';
        
        if (credentials.username === adminUsername && credentials.password === adminPassword) {
          return {
            id: "master-admin",
            name: "Admin",
            role: "admin"
          };
        }
        
        // 2. Check against Database (Regular Users)
        try {
          // Dynamic import to avoid Prisma/Bcrypt issues on edge
          const { prisma } = await import("@/lib/prisma");
          const bcrypt = await import("bcryptjs");

          const user = await prisma.user.findUnique({
            where: { username: credentials.username }
          });

          if (user && await bcrypt.compare(credentials.password, user.passwordHash)) {
            return {
              id: user.id,
              name: user.username,
              role: user.role
            };
          }
        } catch (e) {
          console.error("Auth error:", e);
        }

        return null;
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 Days
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login', // We'll create a custom login page, or just let NextAuth handle it for now
  }
};
