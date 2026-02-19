import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const createDependencySchema = z.object({
  dependentDocId: z.string().uuid("依存する文書IDが不正です"),
  dependencyDocId: z.string().uuid("依存される文書IDが不正です"),
});

export type CreateDependencyInput = z.infer<typeof createDependencySchema>;

export interface DependencyNode {
  id: string;
  title: string;
  status: string;
}

export interface DependencyEdge {
  id: string;
  from: string;
  to: string;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
}

export interface ImpactedDocument {
  id: string;
  title: string;
  status: string;
}

export class DependencyService {
  async createDependency(input: CreateDependencyInput) {
    const validated = createDependencySchema.parse(input);

    if (validated.dependentDocId === validated.dependencyDocId) {
      throw new Error("文書は自身に依存できません");
    }

    const [dependent, dependency] = await Promise.all([
      prisma.document.findUnique({ where: { id: validated.dependentDocId } }),
      prisma.document.findUnique({ where: { id: validated.dependencyDocId } }),
    ]);

    if (!dependent) throw new Error("依存する文書が見つかりません");
    if (!dependency) throw new Error("依存される文書が見つかりません");

    const wouldCreateCycle = await this.checkCycle(validated.dependencyDocId, validated.dependentDocId);
    if (wouldCreateCycle) throw new Error("循環参照が発生します");

    const existing = await prisma.documentDependency.findUnique({
      where: {
        dependentDocId_dependencyDocId: {
          dependentDocId: validated.dependentDocId,
          dependencyDocId: validated.dependencyDocId,
        },
      },
    });
    if (existing) throw new Error("この依存関係は既に存在します");

    return prisma.documentDependency.create({
      data: {
        dependentDocId: validated.dependentDocId,
        dependencyDocId: validated.dependencyDocId,
      },
      include: {
        dependentDoc: { select: { id: true, title: true, status: true } },
        dependencyDoc: { select: { id: true, title: true, status: true } },
      },
    });
  }

  async deleteDependency(id: string): Promise<void> {
    const existing = await prisma.documentDependency.findUnique({ where: { id } });
    if (!existing) throw new Error("依存関係が見つかりません");
    await prisma.documentDependency.delete({ where: { id } });
  }

  async getDependency(id: string) {
    return prisma.documentDependency.findUnique({
      where: { id },
      include: {
        dependentDoc: { select: { id: true, title: true, status: true } },
        dependencyDoc: { select: { id: true, title: true, status: true } },
      },
    });
  }

  async listDependencies() {
    return prisma.documentDependency.findMany({
      include: {
        dependentDoc: { select: { id: true, title: true, status: true } },
        dependencyDoc: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getDependenciesOfDocument(documentId: string) {
    return prisma.documentDependency.findMany({
      where: { dependentDocId: documentId },
      include: {
        dependencyDoc: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getDependentsOfDocument(documentId: string) {
    return prisma.documentDependency.findMany({
      where: { dependencyDocId: documentId },
      include: {
        dependentDoc: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getDependencyGraph(rootDocumentId?: string): Promise<DependencyGraph> {
    let dependencies;

    if (rootDocumentId) {
      const visited = new Set<string>();
      const nodeIds = new Set<string>();
      await this.collectRelatedDocuments(rootDocumentId, visited, nodeIds);

      dependencies = await prisma.documentDependency.findMany({
        where: {
          OR: [
            { dependentDocId: { in: Array.from(nodeIds) } },
            { dependencyDocId: { in: Array.from(nodeIds) } },
          ],
        },
        include: {
          dependentDoc: { select: { id: true, title: true, status: true } },
          dependencyDoc: { select: { id: true, title: true, status: true } },
        },
      });
    } else {
      dependencies = await prisma.documentDependency.findMany({
        include: {
          dependentDoc: { select: { id: true, title: true, status: true } },
          dependencyDoc: { select: { id: true, title: true, status: true } },
        },
      });
    }

    const nodeMap = new Map<string, DependencyNode>();
    const edges: DependencyEdge[] = [];

    for (const dep of dependencies) {
      if (!nodeMap.has(dep.dependentDocId)) {
        nodeMap.set(dep.dependentDocId, {
          id: dep.dependentDoc.id,
          title: dep.dependentDoc.title,
          status: dep.dependentDoc.status,
        });
      }
      if (!nodeMap.has(dep.dependencyDocId)) {
        nodeMap.set(dep.dependencyDocId, {
          id: dep.dependencyDoc.id,
          title: dep.dependencyDoc.title,
          status: dep.dependencyDoc.status,
        });
      }
      edges.push({
        id: dep.id,
        from: dep.dependentDocId,
        to: dep.dependencyDocId,
      });
    }

    return {
      nodes: Array.from(nodeMap.values()),
      edges,
    };
  }

  async getImpactedDocuments(documentId: string): Promise<ImpactedDocument[]> {
    const impacted: ImpactedDocument[] = [];
    const visited = new Set<string>();
    await this.collectDependentsRecursive(documentId, impacted, visited);
    return impacted;
  }

  async getImpactWarnings(documentId: string) {
    const impactedDocuments = await this.getImpactedDocuments(documentId);
    if (impactedDocuments.length === 0) {
      return {
        hasImpact: false,
        impactedDocuments: [],
        message: "この文書を変更しても影響を受ける文書はありません",
      };
    }
    const publishedCount = impactedDocuments.filter((d) => d.status === "PUBLISHED").length;
    return {
      hasImpact: true,
      impactedDocuments,
      message: `この文書に依存している文書が${impactedDocuments.length}件あります（公開中: ${publishedCount}件）。変更前に影響を確認してください。`,
    };
  }

  private async collectRelatedDocuments(
    documentId: string,
    visited: Set<string>,
    nodeIds: Set<string>
  ): Promise<void> {
    if (visited.has(documentId)) return;
    visited.add(documentId);
    nodeIds.add(documentId);

    const [dependencies, dependents] = await Promise.all([
      prisma.documentDependency.findMany({
        where: { dependentDocId: documentId },
        select: { dependencyDocId: true },
      }),
      prisma.documentDependency.findMany({
        where: { dependencyDocId: documentId },
        select: { dependentDocId: true },
      }),
    ]);

    for (const dep of dependencies) {
      await this.collectRelatedDocuments(dep.dependencyDocId, visited, nodeIds);
    }
    for (const dep of dependents) {
      await this.collectRelatedDocuments(dep.dependentDocId, visited, nodeIds);
    }
  }

  private async collectDependentsRecursive(
    documentId: string,
    result: ImpactedDocument[],
    visited: Set<string>
  ): Promise<void> {
    if (visited.has(documentId)) return;
    visited.add(documentId);

    const dependents = await prisma.documentDependency.findMany({
      where: { dependencyDocId: documentId },
      include: {
        dependentDoc: { select: { id: true, title: true, status: true } },
      },
    });

    for (const dep of dependents) {
      result.push({
        id: dep.dependentDoc.id,
        title: dep.dependentDoc.title,
        status: dep.dependentDoc.status,
      });
      await this.collectDependentsRecursive(dep.dependentDocId, result, visited);
    }
  }

  private async checkCycle(fromDocId: string, toDocId: string): Promise<boolean> {
    const visited = new Set<string>();
    return this.dfsCheckCycle(fromDocId, toDocId, visited);
  }

  private async dfsCheckCycle(
    currentDocId: string,
    targetDocId: string,
    visited: Set<string>
  ): Promise<boolean> {
    if (currentDocId === targetDocId) return true;
    if (visited.has(currentDocId)) return false;
    visited.add(currentDocId);

    const dependencies = await prisma.documentDependency.findMany({
      where: { dependentDocId: currentDocId },
      select: { dependencyDocId: true },
    });

    for (const dep of dependencies) {
      if (await this.dfsCheckCycle(dep.dependencyDocId, targetDocId, visited)) return true;
    }
    return false;
  }
}

export const dependencyService = new DependencyService();
