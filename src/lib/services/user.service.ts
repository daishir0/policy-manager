import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";
import type { UserRole } from "@prisma/client";

// バリデーションスキーマ
export const createUserSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  name: z.string().min(1, "名前を入力してください"),
  password: z.string().min(8, "パスワードは8文字以上必要です"),
  role: z.enum(["ADMIN", "STAFF"]).default("STAFF"),
});

export const updateUserSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください").optional(),
  name: z.string().min(1, "名前を入力してください").optional(),
  password: z.string().min(8, "パスワードは8文字以上必要です").optional(),
  role: z.enum(["ADMIN", "STAFF"]).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export interface UserFilter {
  search?: string;
  role?: string;
  page?: number;
  limit?: number;
}

export class UserService {
  async createUser(input: CreateUserInput) {
    const validated = createUserSchema.parse(input);

    const passwordCheck = validatePasswordStrength(validated.password);
    if (!passwordCheck.isValid) {
      throw new Error(passwordCheck.errors.join(", "));
    }

    const existing = await prisma.user.findUnique({
      where: { email: validated.email },
    });
    if (existing) {
      throw new Error("このメールアドレスは既に登録されています");
    }

    const hashedPassword = await hashPassword(validated.password);

    const user = await prisma.user.create({
      data: {
        email: validated.email,
        name: validated.name,
        password: hashedPassword,
        role: validated.role as UserRole,
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  async updateUser(id: string, input: UpdateUserInput) {
    const validated = updateUserSchema.parse(input);

    let hashedPassword: string | undefined;
    if (validated.password) {
      const passwordCheck = validatePasswordStrength(validated.password);
      if (!passwordCheck.isValid) {
        throw new Error(passwordCheck.errors.join(", "));
      }
      hashedPassword = await hashPassword(validated.password);
    }

    if (validated.email) {
      const existing = await prisma.user.findFirst({
        where: { email: validated.email, NOT: { id } },
      });
      if (existing) {
        throw new Error("このメールアドレスは既に登録されています");
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(validated.email && { email: validated.email }),
        ...(validated.name && { name: validated.name }),
        ...(hashedPassword && { password: hashedPassword }),
        ...(validated.role && { role: validated.role as UserRole }),
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      updatedAt: user.updatedAt,
    };
  }

  async deleteUser(id: string) {
    await prisma.user.delete({ where: { id } });
  }

  async getUser(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        assignedDocs: {
          where: { deletedAt: null },
          select: { id: true, title: true, status: true },
        },
      },
    });

    if (!user) {
      throw new Error("ユーザーが見つかりません");
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      failedLoginAttempts: user.failedLoginAttempts,
      lockedUntil: user.lockedUntil,
      assignedDocuments: user.assignedDocs,
    };
  }

  async listUsers(filter: UserFilter = {}) {
    const { search, role, page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;

    const where = {
      ...(search && {
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(role && { role: role as UserRole }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        lockedUntil: user.lockedUntil,
        isLocked: user.lockedUntil ? new Date(user.lockedUntil) > new Date() : false,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async unlockUser(id: string) {
    await prisma.user.update({
      where: { id },
      data: { failedLoginAttempts: 0, lockedUntil: null },
    });
  }
}

export const userService = new UserService();
