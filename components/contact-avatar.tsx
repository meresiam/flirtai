"use client";

import * as React from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

interface ContactAvatarProps {
  name: string;
  src?: string | null;
  className?: string;
  sizes?: string;
}

const PALETTE = [
  ["#ff355d", "#ff7a66"],
  ["#7c3aed", "#a855f7"],
  ["#0ea5e9", "#06b6d4"],
  ["#f59e0b", "#ef4444"],
  ["#10b981", "#22d3ee"],
  ["#ec4899", "#8b5cf6"],
] as const;

function hashIndex(input: string, modulo: number) {
  let sum = 0;
  for (const char of input) {
    sum = (sum + char.charCodeAt(0)) % (modulo * 1000);
  }
  return sum % modulo;
}

function initials(name: string) {
  const cleaned = name.trim();
  if (!cleaned) return "?";
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

export function ContactAvatar({ name, src, className, sizes }: ContactAvatarProps) {
  const [errored, setErrored] = React.useState(false);
  const showImage = Boolean(src) && !errored;
  const [from, to] = PALETTE[hashIndex(name || "x", PALETTE.length)]!;

  return (
    <div
      className={cn("relative overflow-hidden rounded-2xl border border-white/10", className)}
      aria-label={name}
    >
      {showImage ? (
        <Image
          src={src!}
          alt={name}
          fill
          className="object-cover"
          sizes={sizes}
          onError={() => setErrored(true)}
        />
      ) : (
        <div
          className="flex h-full w-full items-center justify-center text-sm font-semibold text-white"
          style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
        >
          {initials(name)}
        </div>
      )}
    </div>
  );
}
