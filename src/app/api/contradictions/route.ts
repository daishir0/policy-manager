import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { contradictionService } from "@/lib/services/contradiction.service";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const contradictions = await contradictionService.getAllContradictions();

    return NextResponse.json({ contradictions });
  } catch (error) {
    console.error("Get contradictions error:", error);
    return NextResponse.json(
      { error: "矛盾検出一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}
