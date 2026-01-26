import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { dependencyService } from "@/lib/services/dependency.service";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get("documentId") || undefined;

    const graph = await dependencyService.getDependencyGraph(documentId);

    return NextResponse.json(graph);
  } catch (error) {
    console.error("Get dependency graph error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "依存関係グラフの取得に失敗しました" }, { status: 500 });
  }
}
