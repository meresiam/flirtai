"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  UserCircle2,
  MoreHorizontalIcon,
  PlayIcon,
  PauseIcon,
  Trash2Icon,
  RefreshCwIcon,
  ArrowLeftIcon,
  LoaderIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProfileBadge } from "./profile-badge";
import { StatusPill } from "./status-pill";
import { DeleteConfirmDialog } from "./delete-confirm-dialog";
import type { MonitoredProfileSummary } from "@/types/profile-watch";

interface ProfileHeaderProps {
  profile: MonitoredProfileSummary;
  onPauseToggle: () => Promise<void>;
  onDelete: () => Promise<void>;
  onScanNow: () => Promise<void>;
}

export function ProfileHeader({
  profile,
  onPauseToggle,
  onDelete,
  onScanNow,
}: ProfileHeaderProps) {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);
  const [isTogglingPause, setIsTogglingPause] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const snap = profile.latestSnapshot;

  async function handleScanNow() {
    setIsScanning(true);
    try {
      await onScanNow();
    } finally {
      setIsScanning(false);
    }
  }

  async function handlePauseToggle() {
    setIsTogglingPause(true);
    try {
      await onPauseToggle();
    } finally {
      setIsTogglingPause(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await onDelete();
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {/* Voltar */}
        <button
          type="button"
          onClick={() => router.push("/profiles")}
          className="flex w-fit items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
          aria-label="Voltar para lista de perfis"
        >
          <ArrowLeftIcon className="h-3.5 w-3.5" />
          Perfis monitorados
        </button>

        {/* Card do perfil */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Identidade */}
          <div className="flex items-center gap-4">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-full border border-white/10 bg-white/[0.06]">
              {snap?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={snap.avatarUrl}
                  alt={`Avatar de @${profile.handle}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserCircle2 className="h-full w-full p-2.5 text-white/25" />
              )}
              {snap?.isVerified && (
                <span
                  aria-label="Perfil verificado"
                  className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[10px] text-white"
                >
                  ✓
                </span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-semibold text-white/90">
                  {profile.displayName ?? `@${profile.handle}`}
                </h1>
                <ProfileBadge source={profile.source} />
                <StatusPill
                  status={profile.status}
                  errorMessage={profile.lastErrorMessage}
                />
              </div>
              <p className="mt-0.5 text-sm text-white/45">@{profile.handle}</p>
              {snap?.bio && (
                <p className="mt-1 text-xs text-white/40 max-w-sm line-clamp-2">
                  {snap.bio}
                </p>
              )}
            </div>
          </div>

          {/* Ações */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleScanNow}
              disabled={isScanning || profile.status === "paused"}
              aria-label="Iniciar scan manual"
              className={cn(
                "min-h-[44px] border-white/[0.1] bg-white/[0.04] text-white/70 hover:border-white/20 hover:bg-white/[0.07] hover:text-white",
                "disabled:opacity-40",
              )}
            >
              {isScanning ? (
                <LoaderIcon className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCwIcon className="h-4 w-4" />
              )}
              <span className="ml-1.5 hidden sm:inline">
                {isScanning ? "Scaneando…" : "Scan agora"}
              </span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Mais ações"
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] text-white/70 transition hover:border-white/20 hover:bg-white/[0.07] hover:text-white"
              >
                <MoreHorizontalIcon className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="border-white/[0.1] bg-[#0d1019] text-white/80"
              >
                <DropdownMenuItem
                  onClick={handlePauseToggle}
                  disabled={isTogglingPause}
                  className="gap-2 focus:bg-white/[0.06] focus:text-white"
                >
                  {isTogglingPause ? (
                    <LoaderIcon className="h-4 w-4 animate-spin" />
                  ) : profile.status === "paused" ? (
                    <PlayIcon className="h-4 w-4" />
                  ) : (
                    <PauseIcon className="h-4 w-4" />
                  )}
                  {profile.status === "paused" ? "Retomar" : "Pausar"}
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-white/[0.06]" />

                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="gap-2 text-red-400 focus:bg-red-500/10 focus:text-red-400"
                >
                  <Trash2Icon className="h-4 w-4" />
                  Remover perfil
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Confirmação de delete */}
      <DeleteConfirmDialog
        open={showDeleteDialog}
        handle={profile.handle}
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onClose={() => setShowDeleteDialog(false)}
      />
    </>
  );
}
