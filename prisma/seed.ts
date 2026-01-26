import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // ロールの作成
  const roles = [
    {
      name: "system_admin",
      displayName: "システム管理者",
      description: "システム全体の管理権限を持つ",
      permissions: [
        "user:create", "user:read", "user:update", "user:delete", "role:manage",
        "document:create", "document:read", "document:update", "document:delete", "document:publish",
        "category:manage", "organization:manage",
        "ai:contradiction_check", "ai:draft_generate", "ai:qa",
        "analytics:view", "proposal:manage", "audit:view",
      ],
    },
    {
      name: "document_admin",
      displayName: "文書管理者",
      description: "文書の作成・編集・公開権限を持つ",
      permissions: [
        "user:read",
        "document:create", "document:read", "document:update", "document:delete", "document:publish",
        "category:manage", "organization:manage",
        "ai:contradiction_check", "ai:draft_generate", "ai:qa",
        "analytics:view", "proposal:manage",
      ],
    },
    {
      name: "employee",
      displayName: "一般従業員",
      description: "文書の閲覧とQ&A利用が可能",
      permissions: ["document:read", "ai:qa"],
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { name: role.name },
      update: {
        displayName: role.displayName,
        description: role.description,
        permissions: role.permissions,
      },
      create: role,
    });
    console.log(`Role created/updated: ${role.name}`);
  }

  // 管理者ユーザーの作成（初期ユーザー）
  const adminRole = await prisma.role.findUnique({
    where: { name: "system_admin" },
  });

  if (adminRole) {
    const adminPassword = await bcrypt.hash("password123", 12);
    await prisma.user.upsert({
      where: { email: "admin@example.com" },
      update: { password: adminPassword },
      create: {
        email: "admin@example.com",
        name: "システム管理者",
        password: adminPassword,
        roleId: adminRole.id,
      },
    });
    console.log("Admin user created/updated: admin@example.com");
  }

  // ロックテスト用ユーザーの作成
  const employeeRole = await prisma.role.findUnique({
    where: { name: "employee" },
  });

  if (employeeRole) {
    const lockTestPassword = await bcrypt.hash("testpassword", 12);
    await prisma.user.upsert({
      where: { email: "locktest@example.com" },
      update: { password: lockTestPassword },
      create: {
        email: "locktest@example.com",
        name: "ロックテストユーザー",
        password: lockTestPassword,
        roleId: employeeRole.id,
      },
    });
    console.log("Lock test user created/updated: locktest@example.com");
  }

  // デフォルトカテゴリの作成
  const categories = [
    { name: "通達", description: "社内通達文書" },
    { name: "方針書", description: "会社方針に関する文書" },
    { name: "事業計画書", description: "事業計画に関する文書" },
    { name: "ハンドブック", description: "業務ハンドブック" },
    { name: "マニュアル", description: "業務マニュアル" },
    { name: "規程", description: "社内規程" },
  ];

  for (const [index, category] of categories.entries()) {
    await prisma.category.upsert({
      where: { id: `default-category-${index + 1}` },
      update: category,
      create: {
        id: `default-category-${index + 1}`,
        ...category,
        sortOrder: index,
      },
    });
    console.log(`Category created/updated: ${category.name}`);
  }

  // デフォルト組織の作成
  const organizations = [
    { id: "org-1", code: "HQ", name: "本社", parentId: null },
    { id: "org-2", code: "HR", name: "人事部", parentId: "org-1" },
    { id: "org-3", code: "DEV", name: "開発部", parentId: "org-1" },
    { id: "org-4", code: "SALES", name: "営業部", parentId: "org-1" },
    { id: "org-5", code: "ADMIN", name: "総務部", parentId: "org-1" },
  ];

  for (const [index, org] of organizations.entries()) {
    await prisma.organization.upsert({
      where: { id: org.id },
      update: { name: org.name, code: org.code, parentId: org.parentId },
      create: {
        ...org,
        sortOrder: index,
      },
    });
    console.log(`Organization created/updated: ${org.name}`);
  }

  // サンプル文書の作成
  const adminUser = await prisma.user.findUnique({
    where: { email: "admin@example.com" },
  });

  if (adminUser) {
    const sampleDocuments = [
      {
        id: "doc-1",
        title: "情報セキュリティポリシー",
        content: "# 情報セキュリティポリシー\n\n## 目的\n本ポリシーは、当社における情報セキュリティの基本方針を定めるものです。\n\n## 適用範囲\n本ポリシーは、当社の全従業員に適用されます。\n\n## 基本方針\n1. 情報資産の適切な管理\n2. アクセス権限の管理\n3. セキュリティインシデントへの対応",
        summary: "当社の情報セキュリティに関する基本方針を定めた文書です。",
        status: "PUBLISHED" as const,
        categoryId: "default-category-6", // 規程
        organizationId: "org-1",
      },
      {
        id: "doc-2",
        title: "テレワーク勤務規程",
        content: "# テレワーク勤務規程\n\n## 目的\n本規程は、テレワーク勤務に関する取り扱いを定めるものです。\n\n## 対象者\n会社が認めた従業員\n\n## 勤務時間\n通常勤務と同様の時間帯とする\n\n## 費用負担\n通信費は会社が負担する",
        summary: "テレワーク勤務に関する規程です。",
        status: "PUBLISHED" as const,
        categoryId: "default-category-6", // 規程
        organizationId: "org-2",
      },
      {
        id: "doc-3",
        title: "新入社員向けハンドブック",
        content: "# 新入社員向けハンドブック\n\n## はじめに\n入社おめでとうございます。このハンドブックでは、当社で働く上で知っておくべき基本事項を説明します。\n\n## 勤務時間\n9:00〜18:00（休憩1時間）\n\n## 休暇制度\n- 年次有給休暇\n- 特別休暇\n- 産前産後休暇",
        summary: "新入社員向けの基本事項をまとめたハンドブックです。",
        status: "PUBLISHED" as const,
        categoryId: "default-category-4", // ハンドブック
        organizationId: "org-2",
      },
      {
        id: "doc-4",
        title: "経費精算マニュアル",
        content: "# 経費精算マニュアル\n\n## 概要\n本マニュアルは、経費精算の手続きを説明します。\n\n## 対象経費\n- 交通費\n- 出張費\n- 消耗品費\n\n## 精算手順\n1. 経費精算システムにログイン\n2. 必要事項を入力\n3. 領収書を添付\n4. 上長承認を依頼",
        summary: "経費精算の手続きを説明したマニュアルです。",
        status: "PUBLISHED" as const,
        categoryId: "default-category-5", // マニュアル
        organizationId: "org-5",
      },
      {
        id: "doc-5",
        title: "2024年度事業計画",
        content: "# 2024年度事業計画\n\n## 事業目標\n売上高：前年比120%\n\n## 重点施策\n1. 新規顧客開拓\n2. 既存顧客深耕\n3. 新製品開発\n\n## 投資計画\n- システム投資：5000万円\n- 人材投資：3000万円",
        summary: "2024年度の事業計画書です。",
        status: "DRAFT" as const,
        categoryId: "default-category-3", // 事業計画書
        organizationId: "org-1",
      },
    ];

    for (const doc of sampleDocuments) {
      const existing = await prisma.document.findUnique({ where: { id: doc.id } });
      if (!existing) {
        await prisma.document.create({
          data: {
            id: doc.id,
            title: doc.title,
            content: doc.content,
            summary: doc.summary,
            status: doc.status,
            currentVersion: "1.0",
            effectiveDate: doc.status === "PUBLISHED" ? new Date() : null,
            createdById: adminUser.id,
          },
        });

        // カテゴリとの関連付け
        await prisma.documentCategory.create({
          data: {
            documentId: doc.id,
            categoryId: doc.categoryId,
          },
        });

        // 組織との関連付け
        await prisma.documentOrganization.create({
          data: {
            documentId: doc.id,
            organizationId: doc.organizationId,
          },
        });

        console.log(`Document created: ${doc.title}`);
      } else {
        console.log(`Document already exists: ${doc.title}`);
      }
    }
  }

  console.log("Seeding completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
