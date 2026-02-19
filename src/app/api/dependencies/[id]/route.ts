import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requirePermission } from "@/lib/auth/permissions";
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
    const dependency = await dependencyService.getDependency(id);

    if (!dependency) {
      return NextResponse.json({ error: "依存関係が見つかりません" }, { status: 404 });
    }

    return NextResponse.json(dependency);
  } catch (error) {
    console.error("Get dependency error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "依存関係の取得に失敗しました" }, { status: 500 });
  }
}


export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    await requirePermission("document:update");

    const { id } = await params;
    await dependencyService.deleteDependency(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete dependency error:", error);
    if (error instanceof Error) {
      if (error.message.includes("権限")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "依存関係の削除に失敗しました" }, { status: 500 });
  }
}
