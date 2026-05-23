"use client";

import { useEffect, useState } from "react";
import { CheckIcon, AlertCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";
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

interface ConsentData {
  version: string;
  publishedAt: string;
  body: string;
}

interface ConsentDialogProps {
  open: boolean;
  onClose: () => void;
  onAccept: (consentVersion: string) => void;
}

function ConsentBody({
  consent,
  checked,
  onCheckedChange,
  onAccept,
  onClose,
  isLoading,
  error,
}: {
  consent: ConsentData | null;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  onAccept: () => void;
  onClose: () => void;
  isLoading: boolean;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Termo rolável */}
      <div
        className={cn(
          "max-h-[50vh] overflow-y-auto rounded-xl border border-white/[0.08] bg-white/[0.03] p-4",
          "text-xs leading-relaxed text-white/60 scrollbar-thin",
        )}
        role="document"
        aria-label="Termos de uso do módulo Profile Watch"
      >
        {isLoading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-2.5 animate-pulse rounded bg-white/[0.08]"
                style={{ width: `${60 + (i % 3) * 15}%` }}
              />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircleIcon className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-white/60">
            {consent?.body}
          </pre>
        )}
      </div>

      {/* Checkbox aceite */}
      <label className="flex cursor-pointer items-start gap-3">
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          onClick={() => onCheckedChange(!checked)}
          className={cn(
            "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-all duration-150",
            checked
              ? "border-[#ff355d] bg-[#ff355d]"
              : "border-white/20 bg-white/[0.05] hover:border-white/35",
          )}
        >
          {checked && <CheckIcon className="h-3 w-3 text-white" />}
        </button>
        <span className="text-sm text-white/70 leading-relaxed">
          Li e aceito os termos de uso versão{" "}
          <span className="font-medium text-white/85">
            {consent?.version ?? "…"}
          </span>
          . Entendo que apenas dados públicos serão coletados.
        </span>
      </label>

      {/* Ações */}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="ghost"
          onClick={onClose}
          className="min-h-[44px] text-white/60 hover:text-white/85"
        >
          Cancelar
        </Button>
        <Button
          onClick={onAccept}
          disabled={!checked || isLoading || !consent}
          className="min-h-[44px] bg-[#ff355d] text-white hover:bg-[#ff355d]/90 disabled:opacity-40"
        >
          Aceitar e continuar
        </Button>
      </div>
    </div>
  );
}

export function ConsentDialog({ open, onClose, onAccept }: ConsentDialogProps) {
  const [consent, setConsent] = useState<ConsentData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadConsent() {
      setIsLoading(true);
      try {
        const r = await fetch("/api/profiles/consent");
        if (!r.ok) throw new Error("Não foi possível carregar os termos.");
        const data = (await r.json()) as ConsentData;
        if (!cancelled) setConsent(data);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Erro ao carregar os termos.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadConsent();
    return () => { cancelled = true; };
  }, [open]);

  function handleAccept() {
    if (consent) onAccept(consent.version);
  }

  const bodyProps = {
    consent,
    checked,
    onCheckedChange: setChecked,
    onAccept: handleAccept,
    onClose,
    isLoading,
    error,
  };

  function handleOpenChange(v: boolean) {
    if (!v) {
      setChecked(false);
      setError(null);
      onClose();
    }
  }

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="liquid-panel max-h-[90vh] rounded-t-2xl border-t border-white/[0.08] bg-[#070913] px-5 pb-8 pt-6"
        >
          <SheetHeader className="mb-4 text-left">
            <SheetTitle className="text-base font-semibold text-white/90">
              Termo de uso — Profile Watch
            </SheetTitle>
            <SheetDescription className="text-xs text-white/45">
              Leia e aceite antes de monitorar um perfil
            </SheetDescription>
          </SheetHeader>
          <ConsentBody {...bodyProps} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="liquid-panel max-w-lg border border-white/[0.08] bg-[#070913]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-white/90">
            Termo de uso — Profile Watch
          </DialogTitle>
          <DialogDescription className="text-xs text-white/45">
            Leia e aceite antes de monitorar um perfil
          </DialogDescription>
        </DialogHeader>
        <ConsentBody {...bodyProps} />
      </DialogContent>
    </Dialog>
  );
}
