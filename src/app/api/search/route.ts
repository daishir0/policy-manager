import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchService } from "@/lib/services/search.service";
import { analyticsService } from "@/lib/services/analytics.service";
import { hasPermission, PERMISSIONS } from "@/lib/auth/permissions";
import { DocumentStatus } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.roles, session.user.permissions, PERMISSIONS.DOCUMENT_READ)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const filter = {
    query: searchParams.get("q") || "",
    categoryId: searchParams.get("categoryId") || undefined,
    organizationId: searchParams.get("organizationId") || undefined,
    status: (searchParams.get("status") as DocumentStatus) || undefined,
    page: parseInt(searchParams.get("page") || "1"),
    limit: parseInt(searchParams.get("limit") || "20"),
    sortBy: (searchParams.get("sortBy") as "relevance" | "updatedAt" | "title") || "relevance",
    sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") || "desc",
  };

  try {
    const result = await searchService.search(filter);

    // 検索ログを記録
    if (filter.query) {
      await analyticsService.logAccess(
        session.user.id,
        "search",
        undefined,
        { query: filter.query, resultCount: result.pagination.total },
        request.headers.get("x-forwarded-for") || undefined,
        request.headers.get("user-agent") || undefined
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to search documents:", error);
    return NextResponse.json({ error: "検索に失敗しました" }, { status: 500 });
  }
}
