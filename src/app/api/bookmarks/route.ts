import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchService } from "@/lib/services/search.service";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const bookmarks = await searchService.listBookmarks(session.user.id);
    return NextResponse.json({ bookmarks });
  } catch (error) {
    console.error("Failed to list bookmarks:", error);
    return NextResponse.json({ error: "ブックマーク一覧の取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { documentId, note } = body;

    if (!documentId) {
      return NextResponse.json({ error: "documentId は必須です" }, { status: 400 });
    }

    const bookmark = await searchService.addBookmark(session.user.id, documentId, note);
    return NextResponse.json(bookmark, { status: 201 });
  } catch (error) {
    console.error("Failed to add bookmark:", error);
    return NextResponse.json({ error: "ブックマークの追加に失敗しました" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const documentId = searchParams.get("documentId");

    if (!documentId) {
      return NextResponse.json({ error: "documentId は必須です" }, { status: 400 });
    }

    await searchService.removeBookmark(session.user.id, documentId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove bookmark:", error);
    return NextResponse.json({ error: "ブックマークの削除に失敗しました" }, { status: 500 });
  }
}
