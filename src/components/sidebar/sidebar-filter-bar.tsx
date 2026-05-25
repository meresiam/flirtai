"use client";

import { FolderIcon, InboxIcon, PinIcon, ArchiveIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { FolderRecord } from "@/types/flirt";

interface SidebarFilterBarProps {
  folders: FolderRecord[];
  selectedFolderId: string | null;
  showArchived: boolean;
  pinnedCount: number;
  archivedCount: number;
  onSelectFolder: (folderId: string | null) => void;
  onToggleArchived: () => void;
  onOpenFolderManager: () => void;
}

// W8 — Faixa de filtros no topo da sidebar.
// "Tudo" (null + !showArchived) · "Fixados" badge (não navega, só conta) ·
// cada pasta · "Arquivados" toggle · "Gerenciar".
export function SidebarFilterBar({
  folders,
  selectedFolderId,
  showArchived,
  pinnedCount,
  archivedCount,
  onSelectFolder,
  onToggleArchived,
  onOpenFolderManager,
}: SidebarFilterBarProps) {
  return (
    <div className="border-b border-white/10 px-3 py-2.5">
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
        <FilterChip
          active={selectedFolderId === null && !showArchived}
          onClick={() => {
            if (showArchived) onToggleArchived();
            onSelectFolder(null);
          }}
          icon={<InboxIcon className="h-3.5 w-3.5" />}
        >
          Tudo
        </FilterChip>

        {pinnedCount > 0 ? (
          <div
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300/20 bg-amber-300/[0.06] px-2.5 py-1 text-[11px] text-amber-200/85"
            title={`${pinnedCount} conversa(s) fixada(s)`}
          >
            <PinIcon className="h-3 w-3" />
            <span className="tabular-nums">{pinnedCount}</span>
          </div>
        ) : null}

        {folders.map((folder) => (
          <FilterChip
            key={folder.id}
            active={selectedFolderId === folder.id && !showArchived}
            onClick={() => {
              if (showArchived) onToggleArchived();
              onSelectFolder(folder.id);
            }}
            icon={<FolderIcon className="h-3.5 w-3.5" />}
            color={folder.color}
          >
            {folder.name}
          </FilterChip>
        ))}

        <FilterChip
          active={showArchived}
          onClick={() => {
            if (!showArchived) onSelectFolder(null);
            onToggleArchived();
          }}
          icon={<ArchiveIcon className="h-3.5 w-3.5" />}
        >
          Arquivados{archivedCount > 0 ? ` (${archivedCount})` : ""}
        </FilterChip>

        <button
          type="button"
          onClick={onOpenFolderManager}
          className="ml-auto inline-flex shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-white/55 transition hover:border-white/20 hover:text-white"
          aria-label="Gerenciar pastas e tags"
        >
          Gerenciar
        </button>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  icon,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  color?: string | null;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition",
        active
          ? "border-[#ff355d]/40 bg-[#ff355d]/12 text-white"
          : "border-white/10 bg-white/[0.04] text-white/65 hover:border-white/20 hover:text-white",
      )}
      style={
        active && color
          ? {
              borderColor: `${color}66`,
              backgroundColor: `${color}1a`,
            }
          : color
            ? { borderColor: `${color}33` }
            : undefined
      }
    >
      <span style={color ? { color } : undefined}>{icon}</span>
      <span className="truncate max-w-[8rem]">{children}</span>
    </button>
  );
}
