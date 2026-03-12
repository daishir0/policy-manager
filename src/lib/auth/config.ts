import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

/**
 * Senku Auth (OAuth 2.0 / OIDC) Provider
 * 共通認証基盤 auth.senku.work を使用
 */
const SenkuAuthProvider = {
  id: "senku-auth",
  name: "Senku Auth",
  type: "oidc" as const,
  issuer: process.env.AUTH_SENKU_ISSUER,
  clientId: process.env.AUTH_SENKU_ID,
  clientSecret: process.env.AUTH_SENKU_SECRET,
  authorization: { params: { scope: "openid profile email" } },
};

const fullAuthConfig: NextAuthConfig = {
  ...authConfig,
  providers: [SenkuAuthProvider],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, account, profile }) {
      // OAuthログイン時にプロファイル情報を取得
      if (account && profile) {
        token.id = (profile as { sub?: string }).sub || "";
        token.email = profile.email || "";

        // ローカルDBからロール情報を取得
        if (profile.email) {
          const localUser = await prisma.user.findUnique({
            where: { email: profile.email },
          });
          if (localUser) {
            token.role = localUser.role;
          } else {
            // ローカルDBにユーザーがいない場合はデフォルトロール
            token.role = "STAFF";
          }
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8時間
  },
  trustHost: true,
};

export const { handlers, auth, signIn, signOut } = NextAuth(fullAuthConfig);
