import { prisma } from "@/lib/prisma";

interface CreateMessageInput {
  userId: string;
  content: string;
  documentId?: string;
}

export class MessageService {
  // メッセージ一覧取得（受信者のみ）
  async getMessages(userId: string) {
    return prisma.message.findMany({
      where: { userId },
      include: {
        document: {
          select: { id: true, title: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // メッセージ作成
  async createMessage(input: CreateMessageInput) {
    return prisma.message.create({
      data: {
        userId: input.userId,
        content: input.content,
        documentId: input.documentId,
      },
      include: {
        document: {
          select: { id: true, title: true },
        },
      },
    });
  }

  // 既読処理（自分のメッセージのみ）
  async markAsRead(messageId: string, userId: string) {
    const message = await prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new Error("メッセージが見つかりません");
    }

    if (message.userId !== userId) {
      throw new Error("他のユーザーのメッセージは既読にできません");
    }

    if (message.readAt) {
      return message; // 既に既読
    }

    return prisma.message.update({
      where: { id: messageId },
      data: { readAt: new Date() },
      include: {
        document: {
          select: { id: true, title: true },
        },
      },
    });
  }

  // 未読件数取得
  async getUnreadCount(userId: string): Promise<number> {
    return prisma.message.count({
      where: { userId, readAt: null },
    });
  }
}

export const messageService = new MessageService();
