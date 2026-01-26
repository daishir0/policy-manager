import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import type { Session, User } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

const fullAuthConfig = {
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        try {
          console.log("[Auth] Authorize called with credentials:", credentials?.email);

          if (!credentials?.email || !credentials?.password) {
            console.log("[Auth] Missing email or password");
            return null;
          }

          const email = credentials.email as string;
          const password = credentials.password as string;

          console.log("[Auth] Looking up user:", email);
          const user = await prisma.user.findUnique({
            where: { email },
            include: { role: true },
          });

          if (!user) {
            console.log("[Auth] User not found:", email);
            return null;
          }
          console.log("[Auth] User found:", user.email, "Role:", user.role?.name);
          console.log("[Auth] User password exists:", !!user.password, "Length:", user.password?.length);

          // アカウントロックチェック
          if (user.lockedUntil && user.lockedUntil > new Date()) {
            throw new Error("ACCOUNT_LOCKED");
          }

          console.log("[Auth] Comparing password...");
          const isPasswordValid = await bcrypt.compare(password, user.password);
          console.log("[Auth] Password valid:", isPasswordValid);

          if (!isPasswordValid) {
            // ログイン失敗回数をインクリメント
            const failedAttempts = user.failedLoginAttempts + 1;
            const updateData: { failedLoginAttempts: number; lockedUntil?: Date } = {
              failedLoginAttempts: failedAttempts,
            };

            // 5回連続失敗でアカウントロック（30分）
            if (failedAttempts >= 5) {
              updateData.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
            }

            await prisma.user.update({
              where: { id: user.id },
              data: updateData,
            });

            return null;
          }

          // ログイン成功時は失敗回数をリセット
          if (user.failedLoginAttempts > 0) {
            await prisma.user.update({
              where: { id: user.id },
              data: { failedLoginAttempts: 0, lockedUntil: null },
            });
          }

          console.log("[Auth] Login successful, returning user");
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role?.name || "employee",
            image: user.image,
          };
        } catch (error) {
          console.error("[Auth] Error in authorize:", error);
          throw error;
        }
      },
    }),
  ],
  callbacks: authConfig.callbacks,
};

export const { handlers, auth, signIn, signOut } = NextAuth(fullAuthConfig);
