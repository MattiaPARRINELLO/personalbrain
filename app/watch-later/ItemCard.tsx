"use client";

import { Trash2, GripVertical, ExternalLink } from "lucide-react";
import { Pill } from "@/components/ui/Pill";
import type { WatchLaterItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/date";
import { categoryMeta } from "./meta";

export function ItemCard({
  item,
  isDragging,
  isDragOver,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  item: WatchLaterItem;
  isDragging: boolean;
  isDragOver: boolean;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const meta = categoryMeta[item.category];
  const Icon = meta.icon;
  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "group relative flex flex-col rounded-2xl border bg-[var(--surface-1)]/40 hover:bg-[var(--surface-2)]/60 transition-all duration-200 overflow-hidden cursor-grab active:cursor-grabbing",
        isDragging
          ? "opacity-40 border-[var(--accent)]/40"
          : isDragOver
            ? "border-[var(--accent)]/60 scale-[1.01]"
            : "border-[var(--border-1)] hover:border-[var(--border-2)]"
      )}
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <Pill tone={meta.tone} dot>
          <Icon className="w-2.5 h-2.5" />
          {meta.label}
        </Pill>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onDelete}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-4)] hover:text-[var(--danger)] hover:bg-[var(--surface-2)] transition-colors opacity-0 group-hover:opacity-100"
            title="Supprimer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          <span className="w-6 h-7 flex items-center justify-center text-[var(--text-4)] opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        className="px-4 pb-3 flex-1 flex flex-col"
      >
        {item.thumbnail ? (
          <div className="aspect-video rounded-lg overflow-hidden bg-[var(--surface-2)] mb-3 border border-[var(--border-1)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.thumbnail}
              alt=""
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
          </div>
        ) : (
          <div className="aspect-video rounded-lg bg-[var(--surface-2)] border border-[var(--border-1)] mb-3 flex items-center justify-center text-[var(--text-3)] group-hover:text-[var(--accent)] transition-colors duration-300">
            <Icon className="w-7 h-7" strokeWidth={1.5} />
          </div>
        )}
        <h3 className="text-[13.5px] font-medium text-[var(--text-1)] leading-snug line-clamp-2 group-hover:text-[var(--accent)] transition-colors">
          {item.title}
        </h3>
        {item.description && (
          <p className="text-[11.5px] text-[var(--text-3)] mt-1.5 line-clamp-2 leading-relaxed">
            {item.description}
          </p>
        )}
      </a>

      <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--border-1)] text-[10px] text-[var(--text-4)] font-mono">
        <span className="truncate">{item.source}</span>
        <span className="shrink-0 ml-2">{formatRelative(item.createdAt)}</span>
      </div>

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        draggable={false}
        onDragStart={(e) => e.preventDefault()}
        className="absolute top-3 right-12 w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-3)] hover:text-[var(--accent)] hover:bg-[var(--surface-2)] transition-colors opacity-0 group-hover:opacity-100"
        title="Ouvrir"
      >
        <ExternalLink className="w-3 h-3" />
      </a>
    </article>
  );
}
