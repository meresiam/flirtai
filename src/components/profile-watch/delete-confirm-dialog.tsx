"use client";

import { useEffect, useState } from "react";
import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface DeleteConfirmDialogProps {
  open: boolean;
  handle: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

function DeleteBody({
  isLoading,
  onConfirm,
  onClose,
}: {
  isLoading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
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
    </div>
  );
}

export function DeleteConfirmDialog({
  open,
  handle,
  isLoading,
  onConfirm,
  onClose,
}: DeleteConfirmDialogProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const title = `Remover @${handle}?`;
  const description =
    "Snapshots, posts e relatórios deste perfil serão removidos permanentemente. Esta ação não pode ser desfeita.";

  function handleOpenChange(v: boolean) {
    if (!v) onClose();
  }

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="liquid-panel max-h-[90vh] rounded-t-2xl border-t border-white/[0.08] bg-[#070913] px-5 pb-8 pt-6"
        >
          <SheetHeader className="mb-4 text-left">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
              <AlertTriangleIcon className="h-5 w-5 text-red-400" />
            </div>
            <SheetTitle className="text-base font-semibold text-white/90">
              {title}
            </SheetTitle>
            <SheetDescription className="text-sm text-white/50 leading-relaxed">
              {description}
            </SheetDescription>
          </SheetHeader>
          <DeleteBody isLoading={isLoading} onConfirm={onConfirm} onClose={onClose} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="liquid-panel max-w-sm border border-white/[0.08] bg-[#070913]">
        <DialogHeader>
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/10">
            <AlertTriangleIcon className="h-5 w-5 text-red-400" />
          </div>
          <DialogTitle className="text-base font-semibold text-white/90">
            {title}
          </DialogTitle>
          <DialogDescription className="text-sm text-white/50 leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>
        <DeleteBody isLoading={isLoading} onConfirm={onConfirm} onClose={onClose} />
      </DialogContent>
    </Dialog>
  );
}
