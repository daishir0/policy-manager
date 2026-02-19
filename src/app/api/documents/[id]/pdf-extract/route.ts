import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pdfService } from "@/lib/services/pdf.service";
import { hasPermission, PERMISSIONS, type Role } from "@/lib/auth/permissions";
import { auditService } from "@/lib/services/audit.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  if (!hasPermission(session.user.role as Role, PERMISSIONS.DOCUMENT_UPDATE)) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "ファイルが必要です" }, { status: 400 });
    }

    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: "PDFファイルのみ対応しています" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const extractedText = await pdfService.extractText(buffer);

    await auditService.log({
      userId: session.user.id,
      action: "pdf_extract",
      entityType: "document",
      entityId: id,
      details: { fileName: file.name, fileSize: file.size },
      ipAddress: request.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      text: extractedText,
      fileName: file.name,
      fileSize: file.size,
    });
  } catch (error) {
    console.error("Failed to extract PDF text:", error);
    const message = error instanceof Error ? error.message : "PDF抽出に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
