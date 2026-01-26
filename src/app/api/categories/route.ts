import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { categoryService } from "@/lib/services/category.service";
import { auditService } from "@/lib/services/audit.service";
import { hasPermission, PERMISSIONS, type Role } from "@/lib/auth/permissions";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.DOCUMENT_READ)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const tree = searchParams.get("tree") === "true";

  try {
    if (tree) {
      const categoryTree = await categoryService.getCategoryTree();
      return NextResponse.json({ categories: categoryTree });
    }

    const categories = await categoryService.listCategories();
    return NextResponse.json({ categories });
  } catch (error) {
    console.error("Failed to list categories:", error);
    return NextResponse.json({ error: "カテゴリ一覧の取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.CATEGORY_MANAGE)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const category = await categoryService.createCategory(body);

    await auditService.log({
      userId: session.user.id,
      action: "category_create",
      entityType: "category",
      entityId: category.id,
      details: { name: category.name },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    console.error("Failed to create category:", error);
    const message = error instanceof Error ? error.message : "カテゴリの作成に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
