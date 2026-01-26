import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requirePermission } from "@/lib/auth/permissions";
import { documentPermissionService } from "@/lib/services/document-permission.service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; permissionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { permissionId } = await params;
    const permission = await documentPermissionService.getPermission(permissionId);

    if (!permission) {
      return NextResponse.json({ error: "権限設定が見つかりません" }, { status: 404 });
    }

    return NextResponse.json(permission);
  } catch (error) {
    console.error("Get document permission error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "権限の取得に失敗しました" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; permissionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    await requirePermission("document:update");

    const { permissionId } = await params;
    const body = await request.json();
    const permission = await documentPermissionService.updatePermission(permissionId, body);

    return NextResponse.json(permission);
  } catch (error) {
    console.error("Update document permission error:", error);
    if (error instanceof Error) {
      if (error.message.includes("権限")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "権限の更新に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; permissionId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    await requirePermission("document:update");

    const { permissionId } = await params;
    await documentPermissionService.deletePermission(permissionId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete document permission error:", error);
    if (error instanceof Error) {
      if (error.message.includes("権限")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "権限の削除に失敗しました" }, { status: 500 });
  }
}
