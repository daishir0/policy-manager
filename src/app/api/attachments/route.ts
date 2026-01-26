import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/config";
import { requirePermission } from "@/lib/auth/permissions";
import { attachmentService } from "@/lib/services/attachment.service";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    await requirePermission("document:create");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const documentId = formData.get("documentId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "ファイルが必要です" }, { status: 400 });
    }

    if (!documentId) {
      return NextResponse.json({ error: "文書IDが必要です" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const attachment = await attachmentService.uploadAttachment(
      {
        documentId,
        fileName: file.name,
        mimeType: file.type,
        fileSize: file.size,
      },
      buffer
    );

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    console.error("Attachment upload error:", error);
    if (error instanceof Error) {
      if (error.message.includes("権限")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: "添付ファイルのアップロードに失敗しました" }, { status: 500 });
  }
}
