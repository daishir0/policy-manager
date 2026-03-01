"use client";

import { diffLines, Change } from "diff";
import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface DiffViewerProps {
  oldText: string;
  newText: string;
  className?: string;
}

export function DiffViewer({ oldText, newText, className }: DiffViewerProps) {
  const diffResult = useMemo(() => {
    return diffLines(oldText, newText);
  }, [oldText, newText]);

  if (oldText === newText) {
    return (
      <div className={cn("text-sm text-muted-foreground p-4 text-center", className)}>
        変更はありません
      </div>
    );
  }

  return (
    <div className={cn("font-mono text-sm overflow-auto", className)}>
      {diffResult.map((part: Change, index: number) => {
        const lines = part.value.split("\n").filter((line, i, arr) => {
          // 最後の空行は除外（split による余分な空要素）
          return !(i === arr.length - 1 && line === "");
        });

        return lines.map((line, lineIndex) => (
          <div
            key={`${index}-${lineIndex}`}
            className={cn(
              "px-3 py-0.5 whitespace-pre-wrap border-l-4",
              part.added && "bg-green-50 dark:bg-green-950/30 border-green-500 text-green-800 dark:text-green-200",
              part.removed && "bg-red-50 dark:bg-red-950/30 border-red-500 text-red-800 dark:text-red-200 line-through",
              !part.added && !part.removed && "border-transparent text-muted-foreground"
            )}
          >
            <span className="mr-2 select-none text-xs opacity-50">
              {part.added ? "+" : part.removed ? "-" : " "}
            </span>
            {line || " "}
          </div>
        ));
      })}
    </div>
  );
}
