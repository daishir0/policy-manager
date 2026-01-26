import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { dependencyService } from "@/lib/services/dependency.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id } = await params;
    const warnings = await dependencyService.getImpactWarnings(id);

    return NextResponse.json(warnings);
  } catch (error) {
    console.error("Get impact warnings error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "影響分析の取得に失敗しました" }, { status: 500 });
  }
}
