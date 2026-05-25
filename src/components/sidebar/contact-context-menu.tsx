"use client";

import * as React from "react";
import {
  PinIcon,
  PinOffIcon,
  ArchiveIcon,
  ArchiveRestoreIcon,
  FolderIcon,
  FolderMinusIcon,
  TrashIcon,
  MoreHorizontalIcon,
  CheckIcon,
} from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ContactRecord, FolderRecord } from "@/types/flirt";

interface ContactContextMenuProps {
  contact: ContactRecord;
  folders: FolderRecord[];
  onPin: (contactId: string) => void;
  onUnpin: (contactId: string) => void;
  onArchive: (contactId: string) => void;
  onRestore: (contactId: string) => void;
  onMoveToFolder: (contactId: string, folderId: string | null) => void;
  onDelete: (contactId: string) => void;
}

// W8 — Menu de contexto invocado por ⋯ no canto do ContactCard.
// Não usa right-click pra não conflitar com long-press mobile do sistema.
export function ContactContextMenu({
  contact,
  folders,
  onPin,
  onUnpin,
  onArchive,
  onRestore,
  onMoveToFolder,
  onDelete,
}: ContactContextMenuProps) {
  const [showFolderPicker, setShowFolderPicker] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [open, setOpen] = React.useState(false);

  // Reset state quando fecha
  React.useEffect(() => {
    if (!open) {
      setShowFolderPicker(false);
      setConfirmDelete(false);
    }
  }, [open]);

  const triggerElement = (
    <button
      type="button"
      aria-label="Mais ações"
      onClick={(e) => {
        e.stopPropagation();
      }}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white/40 transition hover:bg-white/[0.08] hover:text-white"
    >
      <MoreHorizontalIcon className="h-4 w-4" />
    </button>
  );

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger render={triggerElement} />
      <DropdownMenuContent
        align="end"
        className="min-w-[220px] rounded-2xl border-white/10 bg-[#0b0d18]/95 p-1.5 text-sm text-white/80 backdrop-blur-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {showFolderPicker ? (
          <FolderPickerPanel
            folders={folders}
            currentFolderId={contact.folderId}
            onPick={(folderId) => {
              onMoveToFolder(contact.id, folderId);
              setOpen(false);
            }}
            onBack={() => setShowFolderPicker(false)}
          />
        ) : confirmDelete ? (
          <ConfirmDeletePanel
            contactName={contact.name}
            onConfirm={() => {
              onDelete(contact.id);
              setOpen(false);
            }}
            onCancel={() => setConfirmDelete(false)}
          />
        ) : (
          <>
            {contact.archivedAt ? (
              <MenuItem
                icon={<ArchiveRestoreIcon className="h-4 w-4" />}
                label="Restaurar"
                onClick={() => {
                  onRestore(contact.id);
                  setOpen(false);
                }}
              />
            ) : (
              <>
                {contact.pinnedAt ? (
                  <MenuItem
                    icon={<PinOffIcon className="h-4 w-4" />}
                    label="Desfixar"
                    onClick={() => {
                      onUnpin(contact.id);
                      setOpen(false);
                    }}
                  />
                ) : (
                  <MenuItem
                    icon={<PinIcon className="h-4 w-4" />}
                    label="Fixar no topo"
                    onClick={() => {
                      onPin(contact.id);
                      setOpen(false);
                    }}
                  />
                )}
                <MenuItem
                  icon={<FolderIcon className="h-4 w-4" />}
                  label={
                    contact.folderId
                      ? "Mover de pasta..."
                      : "Adicionar a uma pasta..."
                  }
                  onClick={() => setShowFolderPicker(true)}
                  trailing="›"
                />
                <Divider />
                <MenuItem
                  icon={<ArchiveIcon className="h-4 w-4" />}
                  label="Arquivar"
                  onClick={() => {
                    onArchive(contact.id);
                    setOpen(false);
                  }}
                />
              </>
            )}
            <Divider />
            <MenuItem
              icon={<TrashIcon className="h-4 w-4" />}
              label="Apagar conversa..."
              onClick={() => setConfirmDelete(true)}
              destructive
            />
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  trailing,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  trailing?: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition",
        destructive
          ? "text-rose-300/90 hover:bg-rose-400/[0.08]"
          : "hover:bg-white/[0.06]",
      )}
    >
      <span className={cn(destructive ? "text-rose-300" : "text-white/55")}>
        {icon}
      </span>
      <span className="flex-1 text-sm">{label}</span>
      {trailing ? (
        <span className="text-white/35">{trailing}</span>
      ) : null}
    </button>
  );
}

function Divider() {
  return <div className="my-1 h-px bg-white/[0.06]" />;
}

function FolderPickerPanel({
  folders,
  currentFolderId,
  onPick,
  onBack,
}: {
  folders: FolderRecord[];
  currentFolderId: string | null;
  onPick: (folderId: string | null) => void;
  onBack: () => void;
}) {
  return (
    <>
      <div className="px-2.5 pb-1.5 pt-1 text-[10px] uppercase tracking-[0.16em] text-white/35">
        Pasta
      </div>
      <MenuItem
        icon={<FolderMinusIcon className="h-4 w-4" />}
        label="Sem pasta"
        onClick={() => onPick(null)}
        trailing={currentFolderId === null ? "✓" : undefined}
      />
      {folders.length === 0 ? (
        <div className="px-2.5 py-2 text-xs text-white/40">
          Você não tem pastas. Crie em &ldquo;Gerenciar&rdquo;.
        </div>
      ) : (
        folders.map((folder) => (
          <button
            key={folder.id}
            type="button"
            onClick={() => onPick(folder.id)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/[0.06]"
          >
            <FolderIcon
              className="h-4 w-4"
              style={folder.color ? { color: folder.color } : undefined}
            />
            <span className="flex-1 truncate text-sm">{folder.name}</span>
            {currentFolderId === folder.id ? (
              <CheckIcon className="h-4 w-4 text-emerald-300" />
            ) : null}
          </button>
        ))
      )}
      <Divider />
      <button
        type="button"
        onClick={onBack}
        className="w-full rounded-lg px-2.5 py-1.5 text-xs text-white/45 transition hover:bg-white/[0.04] hover:text-white/80"
      >
        ← Voltar
      </button>
    </>
  );
}

function ConfirmDeletePanel({
  contactName,
  onConfirm,
  onCancel,
}: {
  contactName: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="px-1 py-1">
      <p className="px-2 text-xs text-white/80">
        Apagar conversa com <strong className="text-white">{contactName}</strong>?
        Histórico inteiro vai junto. Sem volta.
      </p>
      <div className="mt-2 flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-xs text-white/65 transition hover:bg-white/[0.08]"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-lg bg-rose-600/90 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-rose-600"
        >
          Apagar
        </button>
      </div>
    </div>
  );
}
