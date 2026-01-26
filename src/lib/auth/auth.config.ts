import type { NextAuthConfig } from "next-auth";

/**
 * Edge Runtime互換の認証設定（ミドルウェア用）
 * Node.js依存のモジュール（bcrypt, prisma等）は含めない
 */
export const authConfig: NextAuthConfig = {
  providers: [], // Full providers are added in config.ts
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith("/dashboard");
      const isOnAdmin = nextUrl.pathname.startsWith("/admin");
      const isOnLogin = nextUrl.pathname === "/login";

      // ログインページは未認証でもアクセス可能
      if (isOnLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/admin", nextUrl));
        }
        return true;
      }

      // ダッシュボードと管理画面は認証必須
      if (isOnDashboard || isOnAdmin) {
        if (isLoggedIn) {
          // 管理画面は管理者ロールのみ
          if (isOnAdmin) {
            const role = auth?.user?.role;
            if (role !== "system_admin" && role !== "document_admin") {
              return Response.redirect(new URL("/admin", nextUrl));
            }
          }
          return true;
        }
        return false; // リダイレクト to login
      }

      return true;
    },
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8時間
  },
  trustHost: true,
};
