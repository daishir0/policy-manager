"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronRight, ChevronDown, FileText, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface DocumentNode {
  id: string;
  title: string;
  status: string;
  children: DocumentNode[];
}

interface SelectedDependency {
  id: string;
  title: string;
  isMain: boolean;
}

interface DependencyTreeSelectorProps {
  selectedDeps: SelectedDependency[];
  onChange: (deps: SelectedDependency[]) => void;
  excludeDocId?: string;  // 自分自身を除外
}

interface TreeNodeProps {
  node: DocumentNode;
  level: number;
  selectedDeps: SelectedDependency[];
  onSelect: (id: string, title: string, isMulti: boolean) => void;
  expandedNodes: Set<string>;
  toggleExpand: (id: string) => void;
}

function TreeNode({ node, level, selectedDeps, onSelect, expandedNodes, toggleExpand }: TreeNodeProps) {
  const isExpanded = expandedNodes.has(node.id);
  const hasChildren = node.children.length > 0;
  const selected = selectedDeps.find(d => d.id === node.id);
  const isSelected = !!selected;
  const isMain = selected?.isMain ?? false;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(node.id, node.title, e.ctrlKey || e.metaKey);
  };

  const handleExpandClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    toggleExpand(node.id);
  };

  return (
    <div>
      <div
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer transition-colors",
          isMain && "bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700",
          isSelected && !isMain && "bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600",
          !isSelected && "hover:bg-accent"
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
      >
        {hasChildren ? (
          <button onClick={handleExpandClick} className="p-0.5 -ml-1">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm truncate flex-1">{node.title}</span>
        {isSelected && (
          <div className="flex items-center gap-1">
            {isMain && (
              <span className="text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded">
                メイン
              </span>
            )}
            <Check className={cn("h-4 w-4", isMain ? "text-blue-600" : "text-muted-foreground")} />
          </div>
        )}
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedDeps={selectedDeps}
              onSelect={onSelect}
              expandedNodes={expandedNodes}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function DependencyTreeSelector({
  selectedDeps,
  onChange,
  excludeDocId,
}: DependencyTreeSelectorProps) {
  const [treeData, setTreeData] = useState<DocumentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  // ツリーデータの構築
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch("/api/dependencies/graph");
        const graph = await response.json();

        // 全文書を取得（ツリーにない文書も含める）
        const docsResponse = await fetch("/api/documents?limit=1000");
        const docsData = await docsResponse.json();
        const allDocs = docsData.documents || [];

        // ノードマップを構築
        const nodeMap = new Map<string, DocumentNode>();
        for (const doc of allDocs) {
          if (doc.id !== excludeDocId) {
            nodeMap.set(doc.id, {
              id: doc.id,
              title: doc.title,
              status: doc.status,
              children: [],
            });
          }
        }

        // メイン依存関係のエッジのみで親子関係を構築
        const childSet = new Set<string>();
        for (const edge of graph.edges || []) {
          if (edge.isMain && nodeMap.has(edge.from) && nodeMap.has(edge.to)) {
            const parent = nodeMap.get(edge.to)!;
            const child = nodeMap.get(edge.from)!;
            parent.children.push(child);
            childSet.add(edge.from);
          }
        }

        // ルートノード（親を持たないノード）を抽出
        const roots: DocumentNode[] = [];
        for (const [id, node] of nodeMap) {
          if (!childSet.has(id)) {
            roots.push(node);
          }
        }

        // タイトルでソート
        const sortNodes = (nodes: DocumentNode[]) => {
          nodes.sort((a, b) => a.title.localeCompare(b.title, 'ja'));
          for (const node of nodes) {
            if (node.children.length > 0) {
              sortNodes(node.children);
            }
          }
        };
        sortNodes(roots);

        setTreeData(roots);
      } catch (error) {
        console.error("Failed to fetch dependency tree:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [excludeDocId]);

  // 初期展開
  useEffect(() => {
    if (selectedDeps.length > 0) {
      // 選択されているノードの親を展開
      const expand = new Set<string>();
      const findParents = (nodes: DocumentNode[], targetIds: Set<string>, parents: string[] = []) => {
        for (const node of nodes) {
          if (targetIds.has(node.id)) {
            parents.forEach(p => expand.add(p));
          }
          if (node.children.length > 0) {
            findParents(node.children, targetIds, [...parents, node.id]);
          }
        }
      };
      findParents(treeData, new Set(selectedDeps.map(d => d.id)));
      setExpandedNodes(expand);
    }
  }, [treeData, selectedDeps]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleSelect = useCallback((id: string, title: string, isMulti: boolean) => {
    const existing = selectedDeps.find(d => d.id === id);

    if (existing) {
      // 既に選択されている場合は解除
      const newDeps = selectedDeps.filter(d => d.id !== id);
      // メインが解除された場合、次の選択をメインに
      if (existing.isMain && newDeps.length > 0) {
        newDeps[0].isMain = true;
      }
      onChange(newDeps);
    } else if (isMulti) {
      // Ctrl+クリックで追加選択（サブとして）
      onChange([...selectedDeps, { id, title, isMain: selectedDeps.length === 0 }]);
    } else {
      // 通常クリックで単一選択（メインとして）
      onChange([{ id, title, isMain: true }]);
    }
  }, [selectedDeps, onChange]);

  if (loading) {
    return <div className="p-4 text-center text-muted-foreground">読み込み中...</div>;
  }

  if (treeData.length === 0) {
    return <div className="p-4 text-center text-muted-foreground">文書がありません</div>;
  }

  return (
    <div className="border rounded-lg max-h-[400px] overflow-y-auto p-2">
      <div className="text-xs text-muted-foreground mb-2 px-2">
        クリックで選択、Ctrl+クリックで複数選択（最初の選択がメイン依存先）
      </div>
      {treeData.map((node) => (
        <TreeNode
          key={node.id}
          node={node}
          level={0}
          selectedDeps={selectedDeps}
          onSelect={handleSelect}
          expandedNodes={expandedNodes}
          toggleExpand={toggleExpand}
        />
      ))}
    </div>
  );
}
