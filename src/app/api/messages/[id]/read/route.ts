import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { messageService } from "@/lib/services/message.service";
import { auditService } from "@/lib/services/audit.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  try {
    const { id } = await params;
    const message = await messageService.markAsRead(id, session.user.id);

    await auditService.log({
      userId: session.user.id,
      action: "message_read",
      entityType: "message",
      entityId: id,
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error("Failed to mark message as read:", error);
    const message = error instanceof Error ? error.message : "既読処理に失敗しました";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
