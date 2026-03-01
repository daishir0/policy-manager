import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { contradictionService } from "@/lib/services/contradiction.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id } = await params;
    await contradictionService.ignoreContradiction(id, session.user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Ignore contradiction error:", error);
    return NextResponse.json(
      { error: "矛盾の無視に失敗しました" },
      { status: 500 }
    );
  }
}
