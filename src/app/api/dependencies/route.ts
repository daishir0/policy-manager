import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requirePermission } from "@/lib/auth/permissions";
import { dependencyService } from "@/lib/services/dependency.service";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const dependencies = await dependencyService.listDependencies();
    return NextResponse.json(dependencies);
  } catch (error) {
    console.error("List dependencies error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "依存関係の取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    await requirePermission("document:update");

    const body = await request.json();
    const dependency = await dependencyService.createDependency(body);

    return NextResponse.json(dependency, { status: 201 });
  } catch (error) {
    console.error("Create dependency error:", error);
    if (error instanceof Error) {
      if (error.message.includes("権限")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "依存関係の作成に失敗しました" }, { status: 500 });
  }
}
