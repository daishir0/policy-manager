import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { settingsService } from "@/lib/services/settings.service";
import { hasPermission, PERMISSIONS, type Role } from "@/lib/auth/permissions";

// マスク対象のキー
const MASKED_KEYS = ["ANTHROPIC_API_KEY"];

function maskValue(key: string, value: string): string {
  if (MASKED_KEYS.includes(key) && value.length > 8) {
    return value.slice(0, 4) + "..." + value.slice(-4);
  }
  return value;
}

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.SETTINGS_VIEW)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const dbSettings = await settingsService.getAll();

    // DB値があればそれを優先、なければ環境変数をフォールバック
    const apiKey = dbSettings["ANTHROPIC_API_KEY"] || process.env.ANTHROPIC_API_KEY || "";
    const model = dbSettings["CLAUDE_MODEL"] || process.env.CLAUDE_MODEL || "haiku";

    return NextResponse.json({
      ANTHROPIC_API_KEY: apiKey ? maskValue("ANTHROPIC_API_KEY", apiKey) : "",
      ANTHROPIC_API_KEY_SET: !!apiKey,
      CLAUDE_MODEL: model,
    });
  } catch (error) {
    console.error("Failed to get settings:", error);
    return NextResponse.json({ error: "設定の取得に失敗しました" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.SETTINGS_VIEW)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const body = await request.json();

    // APIキーの更新（空文字の場合はDB設定を削除して環境変数にフォールバック）
    if ("ANTHROPIC_API_KEY" in body) {
      const key = body.ANTHROPIC_API_KEY?.trim();
      if (key) {
        await settingsService.set("ANTHROPIC_API_KEY", key);
      } else {
        await settingsService.delete("ANTHROPIC_API_KEY");
      }
    }

    // モデルの更新
    if ("CLAUDE_MODEL" in body) {
      const model = body.CLAUDE_MODEL?.trim();
      if (model) {
        await settingsService.set("CLAUDE_MODEL", model);
      } else {
        await settingsService.delete("CLAUDE_MODEL");
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update settings:", error);
    return NextResponse.json({ error: "設定の更新に失敗しました" }, { status: 500 });
  }
}
