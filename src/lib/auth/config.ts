import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

// userinfoのレスポンス型
interface AuthUserInfo {
  sub: string;
  email: string;
  name?: string;
  nickname?: string;
  picture?: string;
  roles?: string[];
  permissions?: string[];
  primary_organization?: {
    id: string;
    name: string;
    code: string;
  };
  organizations?: Array<{
    id: string;
    name: string;
    code: string;
    is_primary: boolean;
    position: {
      id: string;
      name: string;
      code: string;
      level: number;
    } | null;
    start_date: string;
    end_date: string | null;
  }>;
  profile?: {
    display_name?: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string;
    phone?: string;
    hire_date?: string;
  };
}

/**
 * Auth Provider (OAuth 2.0 / OIDC)
 * 共通認証基盤を使用
 */
const AuthProvider = {
  id: "auth-provider",
  name: "Auth Provider",
  type: "oidc" as const,
  issuer: process.env.AUTH_PROVIDER_ISSUER,
  clientId: process.env.AUTH_PROVIDER_ID,
  clientSecret: process.env.AUTH_PROVIDER_SECRET,
  authorization: { params: { scope: "openid profile email custom" } },
};

/**
 * ユーザー情報をローカルDBに同期
 */
async function syncUserToLocalDB(userInfo: AuthUserInfo): Promise<void> {
  const userId = userInfo.sub;

  await prisma.user.upsert({
    where: { id: userId },
    create: {
      id: userId,
      email: userInfo.email,
      name: userInfo.name || userInfo.nickname || userInfo.email.split("@")[0],
      image: userInfo.picture || userInfo.profile?.avatar_url,
      authRoles: userInfo.roles || [],
      syncedAt: new Date(),
    },
    update: {
      email: userInfo.email,
      name: userInfo.name || userInfo.nickname || undefined,
      image: userInfo.picture || userInfo.profile?.avatar_url || undefined,
      authRoles: userInfo.roles || [],
      syncedAt: new Date(),
    },
  });
}

const fullAuthConfig: NextAuthConfig = {
  ...authConfig,
  providers: [AuthProvider],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, account, profile }) {
      // OAuthログイン時にプロファイル情報を取得
      if (account && profile) {
        const userInfo = profile as unknown as AuthUserInfo;

        token.id = userInfo.sub || "";
        token.email = userInfo.email || "";
        token.roles = userInfo.roles || [];
        token.permissions = userInfo.permissions || [];
        token.primaryOrganization = userInfo.primary_organization || null;

        // ユーザー名をトークンに設定
        if (userInfo.name || userInfo.nickname) {
          token.name = userInfo.name || userInfo.nickname;
        }
        if (userInfo.picture || userInfo.profile?.avatar_url) {
          token.picture = userInfo.picture || userInfo.profile?.avatar_url;
        }

        // ローカルDBに同期
        try {
          await syncUserToLocalDB(userInfo);
        } catch (error) {
          console.error("Failed to sync user to local DB:", error);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.roles = token.roles as string[];
        session.user.permissions = token.permissions as string[];
        session.user.primaryOrganization = token.primaryOrganization || null;

        if (token.name) {
          session.user.name = token.name as string;
        }
        if (token.picture) {
          session.user.image = token.picture as string;
        }
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
