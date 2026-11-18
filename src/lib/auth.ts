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

        const username = credentials.username.trim();
        const password = credentials.password.trim();

        // 1. Check against environment variables (Master Admin)
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminPassword = process.env.ADMIN_PASSWORD || 'password123';

        if (username === adminUsername && password === adminPassword) {
          return {
            id: "master-admin",
            name: "Admin",
            role: "admin"
          };
        }

        // 2. Check against Database (Regular Staff/Mentor Users)
        try {
          // Dynamic import to avoid Prisma/Bcrypt issues on edge
          const { prisma } = await import("@/lib/prisma");
          const bcrypt = await import("bcryptjs");

          const user = await prisma.user.findUnique({
            where: { username }
          });

          if (user && await bcrypt.compare(password, user.passwordHash)) {
            return {
              id: user.id,
              name: user.username,
              role: user.role
            };
          }

          // 3. Check against Student Portal Credentials (Roll No + Enrollment No)
          const {
            ensureStudentCredentialTable,
            verifyPortalPassword,
            findMatchingStudentId,
          } = await import("@/lib/studentCredentials");

          await ensureStudentCredentialTable();

          const studentCred = await prisma.studentCredential.findFirst({
            where: {
              portalUsername: {
                equals: username,
                mode: "insensitive",
              },
            },
            include: {
              student: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          });

          if (studentCred && await verifyPortalPassword(password, studentCred.passwordHash)) {
            if (studentCred.isLocked) {
              throw new Error("Your student ID is currently locked. Please contact your admin or mentor.");
            }

            let resolvedStudentId = studentCred.studentId;
            if (!resolvedStudentId) {
              const matchedId = await findMatchingStudentId(
                studentCred.portalUsername,
                studentCred.enrollmentNo
              );
              if (matchedId) {
                resolvedStudentId = matchedId;
                prisma.studentCredential.update({
                  where: { id: studentCred.id },
                  data: { studentId: matchedId },
                }).catch(() => {});
              }
            }

            return {
              id: studentCred.id,
              name: studentCred.student?.name || studentCred.studentName || studentCred.portalUsername,
              role: "student",
              studentId: resolvedStudentId,
              portalUsername: studentCred.portalUsername,
              enrollmentNo: studentCred.enrollmentNo,
            } as any;
          }
        } catch (e: any) {
          if (e?.message?.includes("currently locked")) {
            throw e;
          }
          console.error("Auth error:", e);
        }

        return null;
      }
    })
  ],
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 Days (JWT token internal expiration)
  },
  useSecureCookies: process.env.NODE_ENV === "production" || process.env.NEXTAUTH_URL?.startsWith("https://"),
  cookies: {
    sessionToken: {
      name: (process.env.NODE_ENV === "production" || process.env.NEXTAUTH_URL?.startsWith("https://")) 
        ? "__Secure-next-auth.session-token" 
        : "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production" || process.env.NEXTAUTH_URL?.startsWith("https://"),
        // OMITTING maxAge and expires makes it a session cookie (cleared when browser closes)
      },
    },
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.id = user.id;
        token.studentId = (user as any).studentId ?? null;
        token.portalUsername = (user as any).portalUsername ?? null;
        token.enrollmentNo = (user as any).enrollmentNo ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session?.user) {
        (session.user as any).role = token.role;
        (session.user as any).id = token.id;
        (session.user as any).studentId = token.studentId ?? null;
        (session.user as any).portalUsername = token.portalUsername ?? null;
        (session.user as any).enrollmentNo = token.enrollmentNo ?? null;
      }
      return session;
    }
  },
  pages: {
    signIn: '/login', // We'll create a custom login page, or just let NextAuth handle it for now
  }
};
