"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useMeProfile } from "@/lib/use-me-profile";

// Tour guiado de UI (coachmarks). Auto-inicia no primeiro login (tourSeenAt
// null), DEPOIS do modal de onboarding do /me (espera onboardingDone ou o
// dismiss da sessão). Replay via localStorage flag setada em /settings.
// Alvos são elementos com [data-tour="..."]; passos sem alvo visível
// (ex: sidebar no mobile) são pulados automaticamente.

export const TOUR_REPLAY_KEY = "flirtai-tour-replay";
const MODAL_DISMISS_KEY = "me-onboarding-modal-dismissed";

interface TourStep {
  /** null = passo centralizado, sem destaque (boas-vindas). */
  selector: string | null;
  title: string;
  body: string;
}

const STEPS: TourStep[] = [
  {
    selector: null,
    title: "Bem-vindo ao FlirtAI",
    body: "Seu wingman com IA. Em menos de um minuto te mostro onde fica cada coisa — pode pular quando quiser.",
  },
  {
    selector: '[data-tour="sidebar"]',
    title: "Suas conversas",
    body: "Cada mulher vira uma conversa aqui. Dá pra fixar, arquivar, organizar em pastas e buscar. Clique numa conversa pra continuar de onde parou.",
  },
  {
    selector: '[data-tour="new-conversation"]',
    title: "Nova conversa",
    body: "Comece por aqui: crie um desenrolo (perfil completo dela) ou um chat livre com o agente.",
  },
  {
    selector: '[data-tour="composer"]',
    title: "Fale com o coach",
    body: "Cole a mensagem dela ou descreva a situação e aperte Enter. O FLIRT responde com leitura da situação + sugestões prontas de resposta.",
  },
  {
    selector: '[data-tour="attach"]',
    title: "Print da conversa",
    body: "Anexe prints do WhatsApp/Instagram — a IA lê a imagem e responde com base no que está na tela.",
  },
  {
    selector: '[data-tour="commands"]',
    title: "Comandos rápidos",
    body: "Digite / na caixa de mensagem pra ver os comandos: estratégia, puxar encontro, nova conversa e mais.",
  },
  {
    selector: '[data-tour="desenrolos-link"]',
    title: "Desenrolos",
    body: "A página com todas as suas pretendentes: notas, sinais (green/red flags), diário de encontros e avaliações.",
  },
  {
    selector: '[data-tour="profiles-link"]',
    title: "Perfis",
    body: "Monitoramento de perfis públicos do Instagram. Módulo em evolução — explore com calma depois.",
  },
  {
    selector: '[data-tour="account-menu"]',
    title: "Sua conta",
    body: "Aqui ficam seu perfil (a IA usa pra personalizar conselhos), o dashboard de KPIs e as configurações. Pra rever este tutorial: Configurações → Ver tutorial novamente.",
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function isTargetVisible(selector: string): boolean {
  const el = document.querySelector(selector) as HTMLElement | null;
  if (!el) return false;
  if (el.offsetParent === null) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function OnboardingTour() {
  const { profile, refetch } = useMeProfile();
  const [steps, setSteps] = useState<TourStep[] | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const startedRef = useRef(false);

  const active = steps !== null;
  const step = steps?.[stepIndex] ?? null;

  const start = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    // Filtra passos cujo alvo não existe/não está visível neste viewport.
    const available = STEPS.filter(
      (candidate) => candidate.selector === null || isTargetVisible(candidate.selector),
    );
    setStepIndex(0);
    setSteps(available.length > 1 ? available : STEPS.filter((s) => s.selector === null));
  }, []);

  // Gatilhos de início: replay explícito, ou primeiro login com o modal de
  // onboarding já resolvido. Poll leve cobre o caso do modal ser fechado no X
  // (sessionStorage muda sem re-render do profile).
  useEffect(() => {
    if (startedRef.current) return;

    if (window.localStorage.getItem(TOUR_REPLAY_KEY)) {
      window.localStorage.removeItem(TOUR_REPLAY_KEY);
      const timer = window.setTimeout(start, 500);
      return () => window.clearTimeout(timer);
    }

    if (!profile || profile.tourSeenAt) return;

    const tryStart = () => {
      const modalResolved =
        profile.onboardingDone ||
        Boolean(window.sessionStorage.getItem(MODAL_DISMISS_KEY));
      if (modalResolved) start();
    };

    tryStart();
    const interval = window.setInterval(() => {
      if (startedRef.current) {
        window.clearInterval(interval);
        return;
      }
      tryStart();
    }, 1200);
    return () => window.clearInterval(interval);
  }, [profile, start]);

  // Mede o alvo do passo atual e re-mede em resize/scroll. Toda escrita de
  // estado acontece dentro do rAF (react-hooks/set-state-in-effect).
  useEffect(() => {
    if (!active || !step) return;
    const el = step.selector
      ? (document.querySelector(step.selector) as HTMLElement | null)
      : null;
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });

    const measure = () => {
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    const raf = window.requestAnimationFrame(measure);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [active, step]);

  const finish = useCallback(() => {
    setSteps(null);
    // Persiste "visto" — falha silenciosa, replay disponível em /settings.
    void fetch("/api/me/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tourSeen: true }),
    })
      .then(() => refetch())
      .catch(() => {});
  }, [refetch]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") finish();
      if (event.key === "ArrowRight" || event.key === "Enter") {
        setStepIndex((current) =>
          steps && current < steps.length - 1 ? current + 1 : current,
        );
      }
      if (event.key === "ArrowLeft") {
        setStepIndex((current) => (current > 0 ? current - 1 : current));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, steps, finish]);

  if (!active || !step || !steps) return null;

  const isLast = stepIndex === steps.length - 1;
  const padding = 8;
  const highlight =
    step.selector && rect
      ? {
          top: rect.top - padding,
          left: rect.left - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        }
      : null;

  // Posição do balão: abaixo do alvo se couber, senão acima; centralizado no
  // passo de boas-vindas. Clamp horizontal pra não sair do viewport.
  const vw = typeof window !== "undefined" ? window.innerWidth : 1024;
  const vh = typeof window !== "undefined" ? window.innerHeight : 768;
  const balloonWidth = Math.min(340, vw - 24);
  const estimatedHeight = 190;

  let balloonStyle: React.CSSProperties;
  if (!highlight) {
    balloonStyle = {
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      width: balloonWidth,
    };
  } else {
    const below = highlight.top + highlight.height + 12;
    const top =
      below + estimatedHeight < vh
        ? below
        : Math.max(12, highlight.top - estimatedHeight - 12);
    const left = Math.min(
      Math.max(12, highlight.left + highlight.width / 2 - balloonWidth / 2),
      vw - balloonWidth - 12,
    );
    balloonStyle = { top, left, width: balloonWidth };
  }

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-label="Tutorial do FlirtAI">
      {/* Bloqueia interação com a página durante o tour */}
      <div className="absolute inset-0" onClick={finish} aria-hidden="true" />

      {highlight ? (
        <div
          className="pointer-events-none absolute rounded-2xl border-2 border-[#ff5a63]/80 transition-all duration-300"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
            boxShadow: "0 0 0 9999px rgba(3, 6, 15, 0.78)",
          }}
        />
      ) : (
        <div className="pointer-events-none absolute inset-0 bg-[#03060f]/80" />
      )}

      <div
        className="absolute rounded-3xl border border-white/12 bg-[#0c0f1a] p-5 text-white shadow-2xl"
        style={balloonStyle}
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-[10px] uppercase tracking-[0.18em] text-[#ff8a9e]">
          Tutorial · {stepIndex + 1}/{steps.length}
        </p>
        <h3 className="mt-2 font-heading text-lg">{step.title}</h3>
        <p className="mt-1.5 text-sm leading-6 text-white/65">{step.body}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={finish}
            className="text-xs text-white/40 underline decoration-dotted underline-offset-4 transition hover:text-white/70"
          >
            Pular tour
          </button>
          <div className="flex items-center gap-2">
            {stepIndex > 0 ? (
              <button
                type="button"
                onClick={() => setStepIndex((current) => current - 1)}
                className="min-h-[38px] rounded-full border border-white/10 px-3.5 py-1.5 text-sm text-white/65 transition hover:border-white/25 hover:text-white"
              >
                Voltar
              </button>
            ) : null}
            <button
              type="button"
              onClick={() =>
                isLast ? finish() : setStepIndex((current) => current + 1)
              }
              className="min-h-[38px] rounded-full bg-white px-4 py-1.5 text-sm font-medium text-[#0A0A0B] transition hover:bg-white/90"
            >
              {isLast ? "Concluir" : "Próximo"}
            </button>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-1.5">
          {steps.map((_, index) => (
            <span
              key={index}
              className={
                index === stepIndex
                  ? "h-1.5 w-4 rounded-full bg-[#ff5a63]"
                  : "h-1.5 w-1.5 rounded-full bg-white/20"
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
