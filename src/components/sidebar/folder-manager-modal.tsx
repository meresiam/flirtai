"use client";

import * as React from "react";
import { FolderIcon, PencilIcon, TrashIcon, XIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  CreateFolderPayload,
  UpdateFolderPayload,
} from "@/store/use-flirt-store";
import type { FolderRecord } from "@/types/flirt";

// Palette baseada em tokens AILA + acentos pra leitura no dark BG.
// Não trocar pra hex de baixa luminância — cor sumiria contra liquid-panel.
const COLOR_PALETTE = [
  "#ff355d", // AILA primary
  "#ff8a9e", // soft pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#8b5cf6", // violet
  "#ec4899", // hot pink
  "#94a3b8", // slate
];

interface FolderManagerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folders: FolderRecord[];
  onCreate: (payload: CreateFolderPayload) => Promise<FolderRecord | null>;
  onUpdate: (
    folderId: string,
    patch: UpdateFolderPayload,
  ) => Promise<FolderRecord | null>;
  onDelete: (folderId: string) => Promise<void>;
}

export function FolderManagerModal({
  open,
  onOpenChange,
  folders,
  onCreate,
  onUpdate,
  onDelete,
}: FolderManagerModalProps) {
  const [newName, setNewName] = React.useState("");
  const [newColor, setNewColor] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function handleCreate() {
    setError(null);
    if (!newName.trim()) {
      setError("Dá um nome pra pasta.");
      return;
    }
    setCreating(true);
    const created = await onCreate({
      name: newName.trim(),
      color: newColor,
    });
    setCreating(false);
    if (created) {
      setNewName("");
      setNewColor(null);
    } else {
      setError("Não consegui criar. Talvez já exista uma pasta com esse nome.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl border-white/10 bg-[#0b0d18]/95 backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-white">Pastas</DialogTitle>
          <DialogDescription className="text-white/55">
            Agrupe conversas em pastas com cor. Drag-and-drop chega depois — por
            agora, crie, renomeie e pinte.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2.5">
          <label className="block text-xs uppercase tracking-[0.16em] text-white/45">
            Nova pasta
          </label>
          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
            <FolderIcon
              className="h-4 w-4"
              style={newColor ? { color: newColor } : { color: "#ffffff66" }}
            />
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder='Ex: "Hot leads", "Já saiu", "Pendente resposta"'
              maxLength={60}
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/30"
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreate();
              }}
            />
          </div>
          <ColorPicker selected={newColor} onPick={setNewColor} />
          {error ? <p className="text-xs text-rose-300/85">{error}</p> : null}
          <button
            type="button"
            onClick={() => void handleCreate()}
            disabled={creating || !newName.trim()}
            className="w-full rounded-2xl bg-[#ff355d] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#ff355d]/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating ? "Criando..." : "Criar pasta"}
          </button>
        </div>

        <div className="mt-5 space-y-2">
          <h3 className="text-xs uppercase tracking-[0.16em] text-white/45">
            Suas pastas ({folders.length})
          </h3>
          {folders.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/10 px-4 py-5 text-center text-xs text-white/40">
              Sem pastas ainda.
            </p>
          ) : (
            <div className="max-h-[40vh] space-y-1.5 overflow-y-auto pr-1">
              {folders.map((folder) => (
                <FolderRow
                  key={folder.id}
                  folder={folder}
                  editing={editingId === folder.id}
                  onStartEdit={() => setEditingId(folder.id)}
                  onCancelEdit={() => setEditingId(null)}
                  onUpdate={async (patch) => {
                    await onUpdate(folder.id, patch);
                    setEditingId(null);
                  }}
                  onDelete={() => void onDelete(folder.id)}
                />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ColorPicker({
  selected,
  onPick,
}: {
  selected: string | null;
  onPick: (color: string | null) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => onPick(null)}
        aria-label="Sem cor"
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-full border transition",
          selected === null
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
          onClick={() => onPick(c)}
          aria-label={`Cor ${c}`}
          className={cn(
            "h-7 w-7 rounded-full border-2 transition",
            selected === c ? "scale-110 border-white/80" : "border-transparent",
          )}
          style={{ backgroundColor: c }}
        />
      ))}
    </div>
  );
}

function FolderRow({
  folder,
  editing,
  onStartEdit,
  onCancelEdit,
  onUpdate,
  onDelete,
}: {
  folder: FolderRecord;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onUpdate: (patch: UpdateFolderPayload) => Promise<void>;
  onDelete: () => void;
}) {
  const [name, setName] = React.useState(folder.name);
  const [color, setColor] = React.useState<string | null>(folder.color);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  React.useEffect(() => {
    setName(folder.name);
    setColor(folder.color);
  }, [folder.name, folder.color, editing]);

  if (editing) {
    return (
      <div className="rounded-2xl border border-white/15 bg-white/[0.04] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <FolderIcon
            className="h-4 w-4"
            style={color ? { color } : { color: "#ffffff66" }}
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            className="w-full bg-transparent text-sm text-white outline-none"
          />
        </div>
        <div className="mt-2.5">
          <ColorPicker selected={color} onPick={setColor} />
        </div>
        <div className="mt-2.5 flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={onCancelEdit}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/65 transition hover:bg-white/[0.08]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() =>
              void onUpdate({ name: name.trim(), color })
            }
            disabled={!name.trim()}
            className="rounded-lg bg-[#ff355d] px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-[#ff355d]/90 disabled:opacity-50"
          >
            Salvar
          </button>
        </div>
      </div>
    );
  }

  if (confirmDelete) {
    return (
      <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[0.06] px-3 py-2.5">
        <p className="text-xs text-rose-100/90">
          Apagar pasta <strong>{folder.name}</strong>? Os contatos voltam pra
          &ldquo;sem pasta&rdquo; (não somem).
        </p>
        <div className="mt-2 flex items-center justify-end gap-1.5">
          <button
            type="button"
            onClick={() => setConfirmDelete(false)}
            className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/65 transition hover:bg-white/[0.08]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmDelete(false);
              onDelete();
            }}
            className="rounded-lg bg-rose-600/90 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-rose-600"
          >
            Apagar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
      <FolderIcon
        className="h-4 w-4 shrink-0"
        style={folder.color ? { color: folder.color } : { color: "#ffffff66" }}
      />
      <span className="flex-1 truncate text-sm text-white">{folder.name}</span>
      <button
        type="button"
        onClick={onStartEdit}
        aria-label="Renomear pasta"
        className="rounded-lg p-1.5 text-white/45 transition hover:bg-white/[0.06] hover:text-white"
      >
        <PencilIcon className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => setConfirmDelete(true)}
        aria-label="Apagar pasta"
        className="rounded-lg p-1.5 text-rose-300/65 transition hover:bg-rose-400/[0.08] hover:text-rose-200"
      >
        <TrashIcon className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
