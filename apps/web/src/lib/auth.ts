import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import crypto from "node:crypto";
import { getDb } from "./db";
import { users } from "@tg2wa/db";
import { eq } from "drizzle-orm";

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = stored.split(":");
  if (!salt || !key) return false;
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  const keyBuf = Buffer.from(key, "hex");
  const hashBuf = Buffer.from(hash, "hex");
  if (keyBuf.length !== hashBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, hashBuf);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: {
    strategy: "jwt",
  },
  providers: [
    Credentials({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = (credentials.email as string).trim().toLowerCase();
        const password = credentials.password as string;

        const db = getDb();
        const existingUsers = await db.select().from(users).where(eq(users.email, email)).limit(1);

        if (existingUsers.length === 0) {
          // Automatic seamless sign-up for new users
          const passwordHash = hashPassword(password);
          const [newUser] = await db
            .insert(users)
            .values({
              email,
              name: email.split("@")[0],
              passwordHash,
            })
            .returning();
          return { id: newUser.id, email: newUser.email, name: newUser.name };
        }

        const user = existingUsers[0];
        if (!user.passwordHash) {
          return null;
        }

        const isValid = verifyPassword(password, user.passwordHash);
        if (!isValid) {
          return null;
        }

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/sign-in",
  },
});
