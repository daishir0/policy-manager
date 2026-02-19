import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { messageService } from "@/lib/services/message.service";
import { hasPermission, PERMISSIONS, type Role } from "@/lib/auth/permissions";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.MESSAGE_READ)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const messages = await messageService.getMessages(session.user.id);
    return NextResponse.json(messages);
  } catch (error) {
    console.error("Failed to get messages:", error);
    return NextResponse.json({ error: "メッセージの取得に失敗しました" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.MESSAGE_CREATE)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { userId, content, documentId } = body;

    if (!userId || !content) {
      return NextResponse.json({ error: "userId と content は必須です" }, { status: 400 });
    }

    const message = await messageService.createMessage({ userId, content, documentId });
    return NextResponse.json(message, { status: 201 });
  } catch (error) {
    console.error("Failed to create message:", error);
    return NextResponse.json({ error: "メッセージの作成に失敗しました" }, { status: 500 });
  }
}
