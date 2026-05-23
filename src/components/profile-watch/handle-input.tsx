"use client";

import { useState, useCallback } from "react";
import { CheckIcon, AlertCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const HANDLE_REGEX = /^[a-z0-9._]{1,30}$/;

function validateHandle(value: string): string | null {
  if (!value) return null;
  if (value.length < 1) return "Handle não pode ser vazio.";
  if (value.length > 30) return "Handle deve ter no máximo 30 caracteres.";
  if (!HANDLE_REGEX.test(value))
    return "Use apenas letras minúsculas, números, pontos e underscores.";
  return null;
}

interface HandleInputProps {
  value: string;
  onChange: (value: string, isValid: boolean) => void;
  disabled?: boolean;
}

export function HandleInput({ value, onChange, disabled }: HandleInputProps) {
  const [touched, setTouched] = useState(false);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
        .replace(/^@/, "")
        .toLowerCase()
        .replace(/[^a-z0-9._]/g, "");
      const error = validateHandle(raw);
      onChange(raw, !error && raw.length > 0);
    },
    [onChange],
  );

  const error = touched ? validateHandle(value) : null;
  const isValid = !validateHandle(value) && value.length > 0;

  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor="handle-input"
        className="text-sm font-medium text-white/70"
      >
        Handle do Instagram
      </label>

      <div className="relative flex items-center">
        {/* Prefix @ */}
        <span
          aria-hidden
          className={cn(
            "absolute left-3 text-sm font-medium select-none transition-colors",
            value ? "text-white/60" : "text-white/25",
          )}
        >
          @
        </span>

        <input
          id="handle-input"
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={() => setTouched(true)}
          disabled={disabled}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder="handle.do.perfil"
          aria-label="Handle do Instagram (sem @)"
          aria-describedby={error ? "handle-error" : undefined}
          aria-invalid={!!error}
          className={cn(
            "h-11 w-full rounded-xl border bg-white/[0.04] py-2 pl-8 pr-10",
            "text-sm text-white/85 placeholder:text-white/25",
            "transition-all duration-200 focus:outline-none",
            error
              ? "border-red-500/50 focus:border-red-500/70"
              : isValid
                ? "border-emerald-500/40 focus:border-emerald-500/60"
                : "border-white/[0.08] focus:border-white/20",
          )}
        />

        {/* Ícone de validação */}
        {value && (
          <div className="pointer-events-none absolute right-3">
            {isValid ? (
              <CheckIcon className="h-4 w-4 text-emerald-400" />
            ) : (
              <AlertCircleIcon className="h-4 w-4 text-red-400" />
            )}
          </div>
        )}
      </div>

      {/* Mensagem de erro (H9 — PT-BR, específico) */}
      {error && (
        <p
          id="handle-error"
          role="alert"
          className="flex items-center gap-1.5 text-xs text-red-400"
        >
          <AlertCircleIcon className="h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
