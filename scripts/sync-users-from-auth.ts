/**
 * auth サービスからユーザーを同期するスクリプト
 *
 * auth サービスの全ユーザーを policy-manager のローカルDBに同期します。
 *
 * 使用方法:
 *   npx ts-node scripts/sync-users-from-auth.ts
 *
 * 環境変数:
 *   DATABASE_URL - policy-manager のPostgreSQL接続文字列
 *   AUTH_SERVICE_URL - auth サービスのURL (デフォルト: http://localhost:3019)
 *   AUTH_SERVICE_TOKEN - auth サービスのAPIトークン（内部API用）
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || "http://localhost:3019";

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  profile?: {
    displayName?: string;
    avatarUrl?: string;
  };
  roles: string[];
}

interface SyncResult {
  email: string;
  userId: string;
  action: "created" | "updated" | "skipped";
  error?: string;
}

async function fetchAuthUsers(): Promise<AuthUser[]> {
  try {
    // auth サービスの内部APIからユーザー一覧を取得
    // 注: 実際の運用では適切な認証が必要
    const response = await fetch(`${AUTH_SERVICE_URL}/api/users?limit=1000`, {
      headers: {
        Authorization: `Bearer ${process.env.AUTH_SERVICE_TOKEN || ""}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Auth service error: ${response.status}`);
    }

    const data = await response.json();
    return data.users || [];
  } catch (error) {
    console.error("Failed to fetch users from auth service:", error);
    throw error;
  }
}

async function syncUsers(): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  console.log("=".repeat(50));
  console.log("ユーザー同期スクリプト (auth → policy-manager)");
  console.log("=".repeat(50));

  try {
    // auth サービスからユーザーを取得
    console.log("\n[1/3] auth サービスからユーザーを取得中...");
    const authUsers = await fetchAuthUsers();
    console.log(`  → ${authUsers.length} 件のユーザーを取得`);

    if (authUsers.length === 0) {
      console.log("\n同期するユーザーがありません");
      return results;
    }

    // ユーザーを同期
    console.log("\n[2/3] ユーザーを同期中...");

    for (const authUser of authUsers) {
      const result: SyncResult = {
        email: authUser.email,
        userId: authUser.id,
        action: "skipped",
      };

      try {
        const existingUser = await prisma.user.findUnique({
          where: { id: authUser.id },
        });

        const displayName =
          authUser.profile?.displayName || authUser.name || authUser.email.split("@")[0];
        const avatarUrl = authUser.profile?.avatarUrl;

        if (existingUser) {
          // 既存ユーザーを更新
          await prisma.user.update({
            where: { id: authUser.id },
            data: {
              email: authUser.email,
              name: displayName,
              image: avatarUrl,
              authRoles: authUser.roles,
              syncedAt: new Date(),
            },
          });
          result.action = "updated";
          console.log(`  ✓ ${authUser.email}: 更新`);
        } else {
          // 新規ユーザーを作成
          await prisma.user.create({
            data: {
              id: authUser.id,
              email: authUser.email,
              name: displayName,
              image: avatarUrl,
              authRoles: authUser.roles,
              syncedAt: new Date(),
            },
          });
          result.action = "created";
          console.log(`  ✓ ${authUser.email}: 新規作成`);
        }
      } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        console.error(`  ✗ ${authUser.email}: エラー - ${result.error}`);
      }

      results.push(result);
    }

    // サマリーを表示
    console.log("\n[3/3] 同期完了");
    console.log("=".repeat(50));
    const created = results.filter((r) => r.action === "created").length;
    const updated = results.filter((r) => r.action === "updated").length;
    const failed = results.filter((r) => r.error).length;
    console.log(`  新規作成: ${created} 件`);
    console.log(`  更新: ${updated} 件`);
    console.log(`  失敗: ${failed} 件`);
    console.log("=".repeat(50));

    return results;
  } catch (error) {
    console.error("\n同期エラー:", error);
    throw error;
  }
}

async function main() {
  try {
    const results = await syncUsers();

    // 結果をJSONで出力
    const outputPath = `./sync-results-${new Date().toISOString().split("T")[0]}.json`;
    const fs = await import("fs");
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n結果を ${outputPath} に保存しました`);
  } catch (error) {
    console.error("同期に失敗しました:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
