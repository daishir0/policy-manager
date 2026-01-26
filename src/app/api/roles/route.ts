import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission, PERMISSIONS, type Role } from "@/lib/auth/permissions";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.USER_READ)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const roles = await prisma.role.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ roles });
  } catch (error) {
    console.error("Failed to list roles:", error);
    return NextResponse.json({ error: "ロール一覧の取得に失敗しました" }, { status: 500 });
  }
}
