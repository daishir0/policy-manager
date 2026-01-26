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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { id: documentId } = await params;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "ファイルが選択されていません" }, { status: 400 });
    }

    // ファイルをバッファに読み込み
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // attachmentServiceを使用してアップロード
    const attachment = await attachmentService.uploadAttachment(
      {
        documentId,
        fileName: file.name,
        mimeType: file.type,
        fileSize: buffer.length,
      },
      buffer
    );

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    console.error("Upload attachment error:", error);
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "ファイルのアップロードに失敗しました" }, { status: 500 });
  }
}
