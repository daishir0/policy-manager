import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir, unlink, readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import crypto from "crypto";

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./uploads";
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
];

export const uploadAttachmentSchema = z.object({
  documentId: z.string().uuid(),
  fileName: z.string().min(1),
  mimeType: z.string().refine((val) => ALLOWED_MIME_TYPES.includes(val), {
    message: "許可されていないファイル形式です",
  }),
  fileSize: z.number().max(MAX_FILE_SIZE, "ファイルサイズが大きすぎます（最大50MB）"),
});

export type UploadAttachmentInput = z.infer<typeof uploadAttachmentSchema>;

export class AttachmentService {
  private async ensureUploadDir(): Promise<void> {
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }
  }

  private generateStoragePath(originalFileName: string): string {
    const ext = path.extname(originalFileName);
    const hash = crypto.randomBytes(16).toString("hex");
    const date = new Date().toISOString().split("T")[0].replace(/-/g, "/");
    return `${date}/${hash}${ext}`;
  }

  async uploadAttachment(
    input: UploadAttachmentInput,
    fileBuffer: Buffer
  ): Promise<{
    id: string;
    fileName: string;
    storagePath: string;
    mimeType: string;
    fileSize: number;
  }> {
    const validated = uploadAttachmentSchema.parse(input);

    // ファイルサイズ検証
    if (fileBuffer.length > MAX_FILE_SIZE) {
      throw new Error("ファイルサイズが大きすぎます（最大50MB）");
    }

    // 文書の存在確認
    const document = await prisma.document.findUnique({
      where: { id: validated.documentId },
    });
    if (!document) {
      throw new Error("文書が見つかりません");
    }

    await this.ensureUploadDir();

    const storagePath = this.generateStoragePath(validated.fileName);
    const fullPath = path.join(UPLOAD_DIR, storagePath);

    // ディレクトリ作成
    const dir = path.dirname(fullPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    // ファイル保存
    await writeFile(fullPath, fileBuffer);

    // DBに記録
    const attachment = await prisma.attachment.create({
      data: {
        documentId: validated.documentId,
        fileName: validated.fileName,
        storagePath,
        mimeType: validated.mimeType,
        fileSize: fileBuffer.length,
      },
    });

    return {
      id: attachment.id,
      fileName: attachment.fileName,
      storagePath: attachment.storagePath,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
    };
  }

  async getAttachment(id: string): Promise<{
    id: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    documentId: string;
    createdAt: Date;
  } | null> {
    return prisma.attachment.findUnique({
      where: { id },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        documentId: true,
        createdAt: true,
      },
    });
  }

  async getAttachmentFile(id: string): Promise<{
    buffer: Buffer;
    fileName: string;
    mimeType: string;
  } | null> {
    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      return null;
    }

    const fullPath = path.join(UPLOAD_DIR, attachment.storagePath);
    if (!existsSync(fullPath)) {
      throw new Error("ファイルが見つかりません");
    }

    const buffer = await readFile(fullPath);
    return {
      buffer,
      fileName: attachment.fileName,
      mimeType: attachment.mimeType,
    };
  }

  async listAttachmentsByDocument(documentId: string): Promise<
    Array<{
      id: string;
      fileName: string;
      mimeType: string;
      fileSize: number;
      createdAt: Date;
    }>
  > {
    return prisma.attachment.findMany({
      where: { documentId },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async deleteAttachment(id: string): Promise<void> {
    const attachment = await prisma.attachment.findUnique({
      where: { id },
    });

    if (!attachment) {
      throw new Error("添付ファイルが見つかりません");
    }

    // ファイル削除
    const fullPath = path.join(UPLOAD_DIR, attachment.storagePath);
    if (existsSync(fullPath)) {
      await unlink(fullPath);
    }

    // DB削除
    await prisma.attachment.delete({ where: { id } });
  }

  async deleteAllAttachmentsByDocument(documentId: string): Promise<number> {
    const attachments = await prisma.attachment.findMany({
      where: { documentId },
    });

    for (const attachment of attachments) {
      const fullPath = path.join(UPLOAD_DIR, attachment.storagePath);
      if (existsSync(fullPath)) {
        await unlink(fullPath);
      }
    }

    const result = await prisma.attachment.deleteMany({
      where: { documentId },
    });

    return result.count;
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}

export const attachmentService = new AttachmentService();
