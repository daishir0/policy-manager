import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { categoryService } from "@/lib/services/category.service";
import { auditService } from "@/lib/services/audit.service";
import { hasPermission, PERMISSIONS, type Role } from "@/lib/auth/permissions";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const category = await categoryService.getCategory(id);
    return NextResponse.json(category);
  } catch (error) {
    console.error("Failed to get category:", error);
    const message = error instanceof Error ? error.message : "カテゴリの取得に失敗しました";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.CATEGORY_MANAGE)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body = await request.json();
    const category = await categoryService.updateCategory(id, body);

    await auditService.log({
      userId: session.user.id,
      action: "category_update",
      entityType: "category",
      entityId: id,
      details: { name: category.name },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json(category);
  } catch (error) {
    console.error("Failed to update category:", error);
    const message = error instanceof Error ? error.message : "カテゴリの更新に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.CATEGORY_MANAGE)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const { id } = await params;
    await categoryService.deleteCategory(id);

    await auditService.log({
      userId: session.user.id,
      action: "category_delete",
      entityType: "category",
      entityId: id,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete category:", error);
    const message = error instanceof Error ? error.message : "カテゴリの削除に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
