"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, LoaderIcon, CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ProfileTypePicker } from "@/components/profile-watch/profile-type-picker";
import { HandleInput } from "@/components/profile-watch/handle-input";
import { CadencePicker } from "@/components/profile-watch/cadence-picker";
import { ConsentDialog } from "@/components/profile-watch/consent-dialog";
import { useProfilesStore } from "@/store/use-profiles-store";
import type { ProfileSource } from "@/lib/profile-watch/types";
import type { MonitoredProfileSummary } from "@/types/profile-watch";

type Step = "type" | "handle" | "cadence" | "done";

const STEPS: Array<{ key: Step; label: string }> = [
  { key: "type", label: "Tipo" },
  { key: "handle", label: "Handle" },
  { key: "cadence", label: "Cadência" },
];

const STEP_INDEX: Record<Step, number> = {
  type: 0,
  handle: 1,
  cadence: 2,
  done: 3,
};

type CadenceHours = 12 | 24 | 48 | 168;

const ERROR_MESSAGES: Record<string, string> = {
  "400": "Dados inválidos. Verifique o handle e tente novamente.",
  "403": "Limite de perfis atingido — pause um antes de adicionar outro.",
  "409": "Você já monitora esse perfil.",
  "501": "Monitoramento do próprio perfil ainda não está disponível (Wave 4).",
  private: "Perfil privado — não é possível monitorar perfis privados.",
  default: "Não foi possível cadastrar o perfil. Tente novamente.",
};

function getErrorMessage(status: number, body?: { message?: string }): string {
  if (body?.message?.toLowerCase().includes("private")) return ERROR_MESSAGES.private;
  return ERROR_MESSAGES[String(status)] ?? ERROR_MESSAGES.default;
}

export default function ProfileNewPage() {
  const router = useRouter();
  const { addProfile } = useProfilesStore();

  const [step, setStep] = useState<Step>("type");
  const [selectedType, setSelectedType] = useState<Exclude<ProfileSource, "self"> | null>(null);
  const [handle, setHandle] = useState("");
  const [handleValid, setHandleValid] = useState(false);
  const [cadenceHours, setCadenceHours] = useState<CadenceHours>(24);
  const [showConsent, setShowConsent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const currentStepIndex = STEP_INDEX[step];

  function goBack() {
    if (step === "handle") setStep("type");
    else if (step === "cadence") setStep("handle");
    else router.push("/profiles");
  }

  function canAdvanceFromCurrent(): boolean {
    if (step === "type") return selectedType !== null;
    if (step === "handle") return handleValid;
    if (step === "cadence") return true;
    return false;
  }

  function handleAdvance() {
    if (step === "type" && selectedType) setStep("handle");
    else if (step === "handle" && handleValid) setStep("cadence");
    else if (step === "cadence") setShowConsent(true);
  }

  async function handleConsentAccept(consentVersion: string) {
    if (!selectedType || !handle) return;
    setShowConsent(false);
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: selectedType,
          handle,
          cadenceHours,
          consentVersion,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string };
        setSubmitError(getErrorMessage(res.status, body));
        setIsSubmitting(false);
        return;
      }

      const data = (await res.json()) as { profile: MonitoredProfileSummary };
      addProfile(data.profile);
      setStep("done");
      router.push(`/profiles/${data.profile.id}`);
    } catch {
      setSubmitError(ERROR_MESSAGES.default);
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      {/* Topbar */}
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#070913]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-4 px-4 sm:px-6">
          <button
            type="button"
            onClick={goBack}
            aria-label="Voltar"
            className="flex items-center gap-1.5 text-sm text-white/50 hover:text-white/80 transition-colors"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            Voltar
          </button>
          <span className="text-sm font-medium text-white/70">
            Monitorar novo perfil
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        {/* Stepper vertical */}
        <nav
          aria-label="Etapas do cadastro"
          className="mb-8 flex items-center gap-0"
        >
          {STEPS.map((s, idx) => {
            const isDone = currentStepIndex > idx;
            const isActive = currentStepIndex === idx;
            return (
              <div key={s.key} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold transition-all",
                      isDone
                        ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-400"
                        : isActive
                          ? "border-[#ff355d]/50 bg-[#ff355d]/15 text-[#ff7a66]"
                          : "border-white/[0.1] bg-white/[0.03] text-white/30",
                    )}
                  >
                    {isDone ? <CheckIcon className="h-3.5 w-3.5" /> : idx + 1}
                  </div>
                  <span
                    className={cn(
                      "mt-1 text-[10px]",
                      isActive ? "text-white/70" : "text-white/30",
                    )}
                  >
                    {s.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "mb-5 mx-2 h-px w-8 sm:w-12 transition-colors",
                      currentStepIndex > idx ? "bg-emerald-500/30" : "bg-white/[0.07]",
                    )}
                  />
                )}
              </div>
            );
          })}
        </nav>

        {/* Erro de submit */}
        {submitError && (
          <div
            role="alert"
            className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400"
          >
            {submitError}
          </div>
        )}

        {/* Step: Tipo */}
        {step === "type" && (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-xl font-semibold text-white/90">Qual tipo de perfil?</h1>
              <p className="mt-1 text-sm text-white/45">
                Escolha como você quer monitorar esse perfil.
              </p>
            </div>
            <ProfileTypePicker value={selectedType} onChange={setSelectedType} />
          </div>
        )}

        {/* Step: Handle */}
        {step === "handle" && (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-xl font-semibold text-white/90">
                Qual o handle do Instagram?
              </h1>
              <p className="mt-1 text-sm text-white/45">
                O perfil precisa ser público para poder ser monitorado.
              </p>
            </div>
            <HandleInput
              value={handle}
              onChange={(v, valid) => {
                setHandle(v);
                setHandleValid(valid);
              }}
            />
            <p className="text-xs text-white/35">
              Apenas perfis públicos podem ser monitorados. Perfis privados serão bloqueados no primeiro scan.
            </p>
          </div>
        )}

        {/* Step: Cadência */}
        {step === "cadence" && (
          <div className="flex flex-col gap-6">
            <div>
              <h1 className="text-xl font-semibold text-white/90">
                Com que frequência monitorar?
              </h1>
              <p className="mt-1 text-sm text-white/45">
                Mais frequente usa mais cota de API. 24h é o padrão.
              </p>
            </div>
            <CadencePicker value={cadenceHours} onChange={setCadenceHours} />

            {/* Resumo do que vai ser criado */}
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4">
              <p className="text-xs text-white/40 mb-2 uppercase tracking-[0.12em]">Resumo</p>
              <div className="flex flex-col gap-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/55">Tipo</span>
                  <span className="text-white/80 capitalize">{selectedType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/55">Handle</span>
                  <span className="text-white/80">@{handle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/55">Frequência</span>
                  <span className="text-white/80">
                    {cadenceHours === 168 ? "7 dias" : `${cadenceHours}h`}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navegação entre steps */}
        {step !== "done" && (
          <div className="mt-8 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={goBack}
              className="min-h-[44px] text-white/55 hover:text-white/80"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-1.5" />
              {step === "type" ? "Cancelar" : "Voltar"}
            </Button>

            <Button
              onClick={handleAdvance}
              disabled={!canAdvanceFromCurrent() || isSubmitting}
              className="min-h-[44px] gap-2 bg-[#ff355d] text-white hover:bg-[#ff355d]/90 disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <LoaderIcon className="h-4 w-4 animate-spin" />
                  Cadastrando…
                </>
              ) : step === "cadence" ? (
                <>
                  Ver termos e confirmar
                  <ArrowRightIcon className="h-4 w-4" />
                </>
              ) : (
                <>
                  Continuar
                  <ArrowRightIcon className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}
      </main>

      {/* Consent Dialog */}
      <ConsentDialog
        open={showConsent}
        onClose={() => setShowConsent(false)}
        onAccept={handleConsentAccept}
      />
    </div>
  );
}
