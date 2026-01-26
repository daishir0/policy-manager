import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { attachmentService } from "@/lib/services/attachment.service";

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
    const attachments = await attachmentService.listAttachmentsByDocument(id);

    return NextResponse.json(attachments);
  } catch (error) {
    console.error("List attachments error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "添付ファイル一覧の取得に失敗しました" }, { status: 500 });
  }
}
