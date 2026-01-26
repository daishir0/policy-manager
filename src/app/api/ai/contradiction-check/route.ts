import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { aiService } from "@/lib/services/ai.service";
import { hasPermission, PERMISSIONS, type Role } from "@/lib/auth/permissions";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.AI_CONTRADICTION_CHECK)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { content, title } = body;

    if (!content || !title) {
      return NextResponse.json(
        { error: "content と title は必須です" },
        { status: 400 }
      );
    }

    const result = await aiService.checkContradictions(content, title);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to check contradictions:", error);
    const message = error instanceof Error ? error.message : "矛盾チェックに失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
