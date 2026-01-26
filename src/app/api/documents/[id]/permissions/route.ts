import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requirePermission } from "@/lib/auth/permissions";
import { documentPermissionService } from "@/lib/services/document-permission.service";

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
    const permissions = await documentPermissionService.listPermissionsByDocument(id);

    return NextResponse.json(permissions);
  } catch (error) {
    console.error("List document permissions error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "権限の取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(
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
    const body = await request.json();
    const permission = await documentPermissionService.createPermission({
      ...body,
      documentId: id,
    });

    return NextResponse.json(permission, { status: 201 });
  } catch (error) {
    console.error("Create document permission error:", error);
    if (error instanceof Error) {
      if (error.message.includes("権限")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "権限の設定に失敗しました" }, { status: 500 });
  }
}
