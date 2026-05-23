"use client";

import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface DeleteConfirmDialogProps {
  open: boolean;
  handle: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function DeleteConfirmDialog({
  open,
  handle,
  isLoading,
  onConfirm,
  onClose,
}: DeleteConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="liquid-panel max-w-sm border border-white/[0.08] bg-[#070913]">
        <DialogHeader>
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
            <AlertTriangleIcon className="h-5 w-5 text-red-400" />
          </div>
          <DialogTitle className="text-base font-semibold text-white/90">
            Remover @{handle}?
          </DialogTitle>
          <DialogDescription className="text-sm text-white/50 leading-relaxed">
            Snapshots, posts e relatórios deste perfil serão removidos permanentemente.
            Esta ação não pode ser desfeita.
          </DialogDescription>
        </DialogHeader>

        <p className="text-xs text-white/35">
          Dica: se quiser parar temporariamente, use <strong className="text-white/50">Pausar</strong> em vez de remover.
        </p>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
            className="min-h-[44px] text-white/60 hover:text-white/85"
          >
            Cancelar
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="min-h-[44px] bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? "Removendo…" : "Sim, remover"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
