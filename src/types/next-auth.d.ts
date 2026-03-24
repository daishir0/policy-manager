import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id: string;
    roles: string[];          // authサービスからのロール配列
    permissions: string[];    // authサービスからの権限配列
    name?: string | null;
    picture?: string | null;
    primaryOrganization?: {
      id: string;
      name: string;
      code: string;
    } | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      roles: string[];
      permissions: string[];
      primaryOrganization?: {
        id: string;
        name: string;
        code: string;
      } | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    roles: string[];
    permissions: string[];
    primaryOrganization?: {
      id: string;
      name: string;
      code: string;
    } | null;
  }
}
