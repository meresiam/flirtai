"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArchiveIcon, UndoIcon } from "lucide-react";

interface ArchiveUndoToastProps {
  pending: { contactId: string; expiresAt: number } | null;
  contactName?: string;
  onUndo: () => void;
  onDismiss: () => void;
}

// W8 — Toast 10s flutuante após arquivar uma conversa. Padrão Gmail/Telegram.
// Timer e barra de progresso visual; clicar "Desfazer" restaura e some.
// Auto-dismiss quando expiresAt passou — não bloqueia outras ações.
export function ArchiveUndoToast({
  pending,
  contactName,
  onUndo,
  onDismiss,
}: ArchiveUndoToastProps) {
  const [progress, setProgress] = React.useState(1);

  React.useEffect(() => {
    if (!pending) return;
    const startedAt = Date.now();
    const total = Math.max(1, pending.expiresAt - startedAt);
    let frame: number;

    function tick() {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, 1 - elapsed / total);
      setProgress(remaining);
      if (remaining <= 0) {
        onDismiss();
        return;
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [pending, onDismiss]);

  return (
    <AnimatePresence>
      {pending ? (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d18]/95 shadow-2xl backdrop-blur-xl"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <ArchiveIcon className="h-4 w-4 text-white/65" />
            <span className="text-sm text-white">
              {contactName ? (
                <>
                  <strong className="font-medium">{contactName}</strong>{" "}
                  arquivado.
                </>
              ) : (
                "Conversa arquivada."
              )}
            </span>
            <button
              type="button"
              onClick={onUndo}
              className="inline-flex items-center gap-1 rounded-lg border border-[#ff355d]/35 bg-[#ff355d]/12 px-2.5 py-1 text-xs font-medium text-[#ffb6c4] transition hover:bg-[#ff355d]/20"
            >
              <UndoIcon className="h-3 w-3" />
              Desfazer
            </button>
          </div>
          <div className="h-0.5 bg-white/[0.04]">
            <div
              className="h-full bg-[#ff355d]/70 transition-[width] duration-100 ease-linear"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
