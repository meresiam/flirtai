"use client";

import * as React from "react";
import { TagIcon, XIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { ContactRecord, TagPreferenceRecord } from "@/types/flirt";

// Mesma palette do FolderManager pra consistência (H4 Nielsen).
const COLOR_PALETTE = [
  "#ff355d",
  "#ff8a9e",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#8b5cf6",
  "#ec4899",
  "#94a3b8",
];

interface TagManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: ContactRecord[];
  tagPreferences: TagPreferenceRecord[];
  onSetTagPreference: (label: string, color: string) => Promise<void>;
  onRemoveTagPreference: (label: string) => Promise<void>;
}

// W8 — lista todas as tags em uso (vindas de Contact.tags[]) + permite
// associar uma cor a cada uma. Tags coloridas aparecem em ContactCard
// e no header do contato. Tags sem cor ficam neutras.
export function TagManagerModal({
  open,
  onOpenChange,
  contacts,
  tagPreferences,
  onSetTagPreference,
  onRemoveTagPreference,
}: TagManagerModalProps) {
  const tagsInUse = React.useMemo(() => {
    const usage = new Map<string, number>();
    for (const c of contacts) {
      if (c.archivedAt) continue;
      for (const tag of c.tags) {
        usage.set(tag, (usage.get(tag) ?? 0) + 1);
      }
    }
    return Array.from(usage.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [contacts]);

  const colorByLabel = React.useMemo(() => {
    const m = new Map<string, string>();
    for (const tp of tagPreferences) m.set(tp.label, tp.color);
    return m;
  }, [tagPreferences]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl border-white/10 bg-[#0b0d18]/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-white">Tags coloridas</DialogTitle>
          <DialogDescription className="text-white/55">
            O coach escreve as tags. Você pinta a cor. Tags sem cor ficam
            neutras.
          </DialogDescription>
        </DialogHeader>

        {tagsInUse.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-white/40">
            Sem tags ainda. Mande algumas mensagens; o coach vai criar tags com
            o tempo.
          </p>
        ) : (
          <div className="max-h-[55vh] space-y-1.5 overflow-y-auto pr-1">
            {tagsInUse.map(({ label, count }) => (
              <TagRow
                key={label}
                label={label}
                count={count}
                color={colorByLabel.get(label) ?? null}
                onSetColor={(c) => void onSetTagPreference(label, c)}
                onClearColor={() => void onRemoveTagPreference(label)}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TagRow({
  label,
  count,
  color,
  onSetColor,
  onClearColor,
}: {
  label: string;
  count: number;
  color: string | null;
  onSetColor: (color: string) => void;
  onClearColor: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
      <div className="flex items-center gap-2">
        <TagIcon
          className="h-3.5 w-3.5"
          style={color ? { color } : { color: "#ffffff66" }}
        />
        <span
          className="flex-1 truncate text-sm text-white"
          style={color ? { color } : undefined}
        >
          {label}
        </span>
        <span className="text-[10px] text-white/40 tabular-nums">
          {count} contato{count > 1 ? "s" : ""}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onClearColor}
          aria-label="Sem cor"
          className={cn(
            "inline-flex h-6 w-6 items-center justify-center rounded-full border transition",
            color === null
              ? "border-white/35 bg-white/[0.06]"
              : "border-white/10 bg-white/[0.02] hover:border-white/25",
          )}
        >
          <XIcon className="h-3 w-3 text-white/55" />
        </button>
        {COLOR_PALETTE.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onSetColor(c)}
            aria-label={`Cor ${c}`}
            className={cn(
              "h-6 w-6 rounded-full border-2 transition",
              color === c ? "scale-110 border-white/80" : "border-transparent",
            )}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}
