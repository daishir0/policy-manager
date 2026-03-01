import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { aiService } from "@/lib/services/ai.service";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const body = await request.json();
    const { documentId, currentContent, instruction } = body;

    if (!currentContent || !instruction) {
      return NextResponse.json(
        { error: "本文と編集指示が必要です" },
        { status: 400 }
      );
    }

    const result = await aiService.suggestEdit(
      documentId,
      currentContent,
      instruction
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Suggest edit error:", error);
    return NextResponse.json(
      { error: "編集提案の生成に失敗しました" },
      { status: 500 }
    );
  }
}
