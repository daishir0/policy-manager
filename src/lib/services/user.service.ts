import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, validatePasswordStrength } from "@/lib/auth/password";

// バリデーションスキーマ
export const createUserSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください"),
  name: z.string().min(1, "名前を入力してください"),
  password: z.string().min(8, "パスワードは8文字以上必要です"),
  roleId: z.string().min(1, "ロールを選択してください"),
});

export const updateUserSchema = z.object({
  email: z.string().email("有効なメールアドレスを入力してください").optional(),
  name: z.string().min(1, "名前を入力してください").optional(),
  password: z.string().min(8, "パスワードは8文字以上必要です").optional(),
  roleId: z.string().min(1, "ロールを選択してください").optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export interface UserFilter {
  search?: string;
  roleId?: string;
  page?: number;
  limit?: number;
}

export class UserService {
  async createUser(input: CreateUserInput) {
    // バリデーション
    const validated = createUserSchema.parse(input);

    // パスワード強度チェック
    const passwordCheck = validatePasswordStrength(validated.password);
    if (!passwordCheck.isValid) {
      throw new Error(passwordCheck.errors.join(", "));
    }

    // メール重複チェック
    const existing = await prisma.user.findUnique({
      where: { email: validated.email },
    });
    if (existing) {
      throw new Error("このメールアドレスは既に登録されています");
    }

    // パスワードハッシュ化
    const hashedPassword = await hashPassword(validated.password);

    // ユーザー作成
    const user = await prisma.user.create({
      data: {
        email: validated.email,
        name: validated.name,
        password: hashedPassword,
        roleId: validated.roleId,
      },
      include: {
        role: true,
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

    // パスワード変更時は強度チェック
    let hashedPassword: string | undefined;
    if (validated.password) {
      const passwordCheck = validatePasswordStrength(validated.password);
      if (!passwordCheck.isValid) {
        throw new Error(passwordCheck.errors.join(", "));
      }
      hashedPassword = await hashPassword(validated.password);
    }

    // メール重複チェック（自分以外）
    if (validated.email) {
      const existing = await prisma.user.findFirst({
        where: {
          email: validated.email,
          NOT: { id },
        },
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
        ...(validated.roleId && { roleId: validated.roleId }),
      },
      include: {
        role: true,
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
    await prisma.user.delete({
      where: { id },
    });
  }

  async getUser(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        role: true,
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
    };
  }

  async listUsers(filter: UserFilter = {}) {
    const { search, roleId, page = 1, limit = 20 } = filter;
    const skip = (page - 1) * limit;

    const where = {
      ...(search && {
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { name: { contains: search, mode: "insensitive" as const } },
        ],
      }),
      ...(roleId && { roleId }),
    };

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          role: true,
        },
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
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  async changeRole(userId: string, roleId: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { roleId },
      include: { role: true },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }
}

export const userService = new UserService();
