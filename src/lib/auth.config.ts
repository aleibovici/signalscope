import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

/**
 * Auth.js config shared between middleware (Edge) and server.
 * Kept free of Node.js-only imports (Prisma, bcrypt) so the
 * Edge middleware can import it safely.
 *
 * The actual credential verification happens in `auth.ts` via
 * the full NextAuth() call that layers on the `authorize` callback.
 */
export const authConfig = {
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // authorize is implemented in auth.ts where Node APIs are available
      authorize: () => null,
    }),
  ],
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;
