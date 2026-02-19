import { prisma } from "@/lib/prisma";

export class SettingsService {
  async get(key: string): Promise<string | null> {
    const setting = await prisma.systemSetting.findUnique({ where: { key } });
    return setting?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  async getAll(): Promise<Record<string, string>> {
    const settings = await prisma.systemSetting.findMany();
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  }

  async delete(key: string): Promise<void> {
    await prisma.systemSetting.deleteMany({ where: { key } });
  }
}

export const settingsService = new SettingsService();
