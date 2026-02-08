"use client";

import { useState, useMemo, type ReactNode } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";

export interface Column<T> {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  sticky?: boolean;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  rowKey: (row: T) => string;
  defaultSortKey?: string;
  defaultSortDirection?: "asc" | "desc";
  sortable?: boolean;
  maxHeight?: string;
  emptyMessage?: string;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  defaultSortKey,
  defaultSortDirection = "desc",
  sortable = true,
  maxHeight = "85vh",
  emptyMessage = "No data found.",
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState(defaultSortKey ?? columns[0]?.key ?? "");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(defaultSortDirection);

  const handleSort = (key: string) => {
    if (!sortable) return;
    if (sortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortValue) return data;

    return [...data].sort((a, b) => {
      const aVal = col.sortValue!(a);
      const bVal = col.sortValue!(b);

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDirection === "asc"
        ? aStr.localeCompare(bStr)
        : bStr.localeCompare(aStr);
    });
  }, [data, columns, sortKey, sortDirection]);

  const alignClass = (align?: string) =>
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";

  const alignFlex = (align?: string) =>
    align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";

  if (data.length === 0) {
    return (
      <div className="text-center py-24 bg-black/5 dark:bg-white/5 rounded-2xl border border-dashed border-[var(--border)]">
        <p className="text-[var(--text-secondary)] font-medium">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <div className={`overflow-x-auto overflow-y-auto`} style={{ maxHeight }}>
        <table className="w-full">
          <thead className="sticky top-0 z-30">
            <tr className="bg-[var(--bg)]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`${sortable && col.sortValue ? "cursor-pointer" : ""} select-none transition-colors group ${
                    col.sticky ? "sticky left-0 z-40 bg-inherit" : ""
                  } ${alignClass(col.align)}`}
                  onClick={() => col.sortValue && handleSort(col.key)}
                >
                  <div className={`flex items-center gap-1 ${alignFlex(col.align)}`}>
                    <span className="group-hover:text-[var(--text)] transition-colors">{col.label}</span>
                    {sortable && col.sortValue && (
                      <div className="w-3 h-3 flex items-center justify-center">
                        {sortKey === col.key ? (
                          sortDirection === "asc" ? (
                            <ChevronUp className="w-3 h-3 text-accent" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-accent" />
                          )
                        ) : (
                          <div className="w-3 h-3 opacity-0 group-hover:opacity-30 transition-opacity" />
                        )}
                      </div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={rowKey(row)} className="group border-none transition-colors">
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`whitespace-nowrap ${alignClass(col.align)} ${
                      col.sticky ? "sticky left-0 z-10 bg-inherit group-hover:bg-inherit" : ""
                    }`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
