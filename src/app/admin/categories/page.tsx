import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FolderTree, Plus, ChevronRight, FileText } from "lucide-react";

interface CategoryNode {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  _count: { documents: number };
  children: CategoryNode[];
}

async function getCategoryTree(): Promise<CategoryNode[]> {
  const categories = await prisma.category.findMany({
    include: {
      _count: { select: { documents: true } },
    },
    orderBy: { sortOrder: "asc" },
  });

  // ツリー構造に変換
  const map = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];

  categories.forEach((cat) => {
    map.set(cat.id, { ...cat, children: [] } as CategoryNode);
  });

  categories.forEach((cat) => {
    const node = map.get(cat.id)!;
    if (cat.parentId && map.has(cat.parentId)) {
      map.get(cat.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function CategoryItem({ category, depth = 0 }: { category: CategoryNode; depth?: number }) {
  const hasChildren = category.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center justify-between p-3 hover:bg-accent rounded-lg transition-colors"
        style={{ paddingLeft: `${depth * 24 + 12}px` }}
      >
        <div className="flex items-center gap-2">
          {hasChildren ? (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          ) : (
            <div className="w-4" />
          )}
          <FolderTree className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{category.name}</span>
          {category.description && (
            <span className="text-sm text-muted-foreground hidden md:inline">
              - {category.description}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            {category._count.documents}
          </Badge>
        </div>
      </div>
      {hasChildren && (
        <div>
          {category.children.map((child) => (
            <CategoryItem key={child.id} category={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default async function CategoriesPage() {
  const categoryTree = await getCategoryTree();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">カテゴリ管理</h1>
          <p className="text-muted-foreground">
            文書のカテゴリを階層構造で管理します
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          新規作成
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderTree className="h-5 w-5" />
            カテゴリツリー
          </CardTitle>
        </CardHeader>
        <CardContent>
          {categoryTree.length > 0 ? (
            <div className="space-y-1">
              {categoryTree.map((category) => (
                <CategoryItem key={category.id} category={category} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <FolderTree className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>カテゴリがまだ登録されていません</p>
              <p className="text-sm">「新規作成」からカテゴリを追加してください</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
