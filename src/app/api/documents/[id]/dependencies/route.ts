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
    const { searchParams } = new URL(request.url);
    const direction = searchParams.get("direction") || "both";

    type DependencyResult = Awaited<ReturnType<typeof dependencyService.getDependenciesOfDocument>>;
    let dependencies: DependencyResult = [];
    let dependents: Awaited<ReturnType<typeof dependencyService.getDependentsOfDocument>> = [];

    if (direction === "both" || direction === "dependencies") {
      dependencies = await dependencyService.getDependenciesOfDocument(id);
    }

    if (direction === "both" || direction === "dependents") {
      dependents = await dependencyService.getDependentsOfDocument(id);
    }

    return NextResponse.json({ dependencies, dependents });
  } catch (error) {
    console.error("Get document dependencies error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "依存関係の取得に失敗しました" }, { status: 500 });
  }
}
