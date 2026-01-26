import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type AuditAction =
  | "login"
  | "logout"
  | "login_failed"
  | "user_create"
  | "user_update"
  | "user_delete"
  | "role_change"
  | "document_create"
  | "document_update"
  | "document_delete"
  | "document_publish"
  | "document_retire"
  | "category_create"
  | "category_update"
  | "category_delete"
  | "organization_create"
  | "organization_update"
  | "organization_delete";

export interface AuditLogInput {
  userId?: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  details?: Prisma.InputJsonValue;
  ipAddress?: string;
}

export interface AuditLogFilter {
  userId?: string;
  action?: AuditAction;
  entityType?: string;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export class AuditService {
  async log(input: AuditLogInput) {
    return prisma.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        details: input.details,
        ipAddress: input.ipAddress,
      },
    });
  }

  async listLogs(filter: AuditLogFilter = {}) {
    const { userId, action, entityType, startDate, endDate, page = 1, limit = 50 } = filter;
    const skip = (page - 1) * limit;

    const where = {
      ...(userId && { userId }),
      ...(action && { action }),
      ...(entityType && { entityType }),
      ...(startDate || endDate
        ? {
            createdAt: {
              ...(startDate && { gte: startDate }),
              ...(endDate && { lte: endDate }),
            },
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getLogsByEntity(entityType: string, entityId: string) {
    return prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: "desc" },
    });
  }

  async getLogsByUser(userId: string, limit = 100) {
    return prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  async getRecentActivity(hours = 24) {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    return prisma.auditLog.findMany({
      where: {
        createdAt: { gte: since },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getActionStats(startDate: Date, endDate: Date) {
    const logs = await prisma.auditLog.groupBy({
      by: ["action"],
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      _count: { action: true },
    });

    return logs.map((log) => ({
      action: log.action,
      count: log._count.action,
    }));
  }
}

export const auditService = new AuditService();
