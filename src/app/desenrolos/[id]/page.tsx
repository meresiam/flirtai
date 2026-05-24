"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeftIcon,
  MessageSquareIcon,
  TrashIcon,
  StarIcon,
  MapPinIcon,
  ExternalLinkIcon,
  LoaderIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ContactAvatar } from "@/components/contact-avatar";
import {
  DesenroloForm,
  type DesenroloFormValues,
} from "@/components/desenrolo/desenrolo-form";
import { useFlirtStore } from "@/store/use-flirt-store";
import type { ContactRecord } from "@/types/flirt";

function labelStatus(status: ContactRecord["status"]) {
  if (status === "hot lead") return "Hot lead";
  if (status === "cold") return "Esfriou";
  return "Ativa";
}

function statusDot(status: ContactRecord["status"]) {
  if (status === "hot lead") return "bg-rose-300";
  if (status === "cold") return "bg-slate-300";
  return "bg-emerald-300";
}

export default function DesenroloDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const {
    contacts,
    hasHydrated,
    bootstrap,
    isBootstrapping,
    updateContact,
    removeContact,
    selectContact,
  } = useFlirtStore();

  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!useFlirtStore.persist.hasHydrated()) {
      void useFlirtStore.persist.rehydrate();
    }
  }, []);

  useEffect(() => {
    if (hasHydrated) {
      void bootstrap();
    }
  }, [hasHydrated, bootstrap]);

  const contact = useMemo(
    () => contacts.find((c) => c.id === id),
    [contacts, id],
  );

  const isLoading = !hasHydrated || isBootstrapping;

  if (isLoading && !contact) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoaderIcon className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-xl font-semibold text-white/90">Perfil não encontrado</h1>
        <p className="mt-2 text-sm text-white/45">
          Esse desenrolo pode ter sido removido.
        </p>
        <Link
          href="/desenrolos"
          className="mt-6 inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] px-4 py-2 text-sm text-white/80 transition hover:bg-white/[0.1]"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Voltar
        </Link>
      </div>
    );
  }

  async function handleSave(values: DesenroloFormValues) {
    const updated = await updateContact(id, {
      name: values.name,
      avatarUrl: values.avatarUrl || null,
      rating: values.rating,
      location: values.location || null,
      metContext: values.metContext || null,
      source: values.source || undefined,
      instagramHandle: values.instagramHandle || null,
      age: values.age,
      tags: values.tags,
      notes: values.notes || null,
    });
    if (!updated) {
      throw new Error("Não consegui salvar agora.");
    }
    setIsEditing(false);
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      await removeContact(id);
      router.push("/desenrolos");
    } catch {
      setIsDeleting(false);
    }
  }

  function openChat() {
    selectContact(id);
    router.push("/");
  }

  const initialValues: Partial<DesenroloFormValues> = {
    name: contact.name,
    avatarUrl: contact.avatar,
    rating: contact.rating,
    location: contact.location ?? "",
    metContext: contact.metContext ?? "",
    source: contact.source,
    instagramHandle: "",
    age: null,
    tags: contact.tags,
    notes: contact.notes ?? "",
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#070913]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link
            href="/desenrolos"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-white/55 transition hover:bg-white/[0.05] hover:text-white"
          >
            <ArrowLeftIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Desenrolos</span>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={openChat}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-sm text-white/75 transition hover:border-[#ff355d]/30 hover:bg-[#ff355d]/10 hover:text-white"
            >
              <MessageSquareIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Abrir chat</span>
            </button>
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#ff355d] px-3 py-1.5 text-sm font-medium text-white transition hover:bg-[#ff355d]/90"
              >
                Editar
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        {isEditing ? (
          <DesenroloForm
            initial={initialValues}
            submitLabel="Salvar alterações"
            busyLabel="Salvando..."
            onSubmit={handleSave}
            onCancel={() => setIsEditing(false)}
          />
        ) : (
          <DesenroloReadView
            contact={contact}
            labelStatus={labelStatus}
            statusDot={statusDot}
          />
        )}

        {/* Zona perigo */}
        {!isEditing ? (
          <div className="mt-12 rounded-2xl border border-red-500/15 bg-red-500/5 px-5 py-4">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-sm font-medium text-red-300/90">Remover desenrolo</h3>
                <p className="mt-1 text-xs text-red-300/55">
                  Apaga o perfil e todo o histórico de conversa. Sem volta.
                </p>
              </div>
              {confirmDelete ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    disabled={isDeleting}
                    className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-xs text-white/65 transition hover:bg-white/[0.08]"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600/90 px-3 py-2 text-xs font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <TrashIcon className="h-3.5 w-3.5" />
                    )}
                    Sim, apagar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-transparent px-3 py-2 text-xs text-red-300 transition hover:bg-red-500/10"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                  Remover
                </button>
              )}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function DesenroloReadView({
  contact,
  labelStatus,
  statusDot,
}: {
  contact: ContactRecord;
  labelStatus: (status: ContactRecord["status"]) => string;
  statusDot: (status: ContactRecord["status"]) => string;
}) {
  return (
    <>
      {/* Hero */}
      <div className="flex flex-col gap-6 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-6 sm:flex-row sm:items-center">
        <ContactAvatar
          name={contact.name}
          src={contact.avatar}
          className="h-32 w-32 ring-2 ring-white/10 sm:h-36 sm:w-36"
          sizes="144px"
        />
        <div className="flex-1">
          <div className="flex flex-wrap items-baseline gap-3">
            <h1 className="text-3xl font-semibold text-white">{contact.name}</h1>
            {contact.rating !== null ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-[#ff355d]/15 px-2.5 py-1 text-lg font-semibold text-[#ff8a9e] tabular-nums">
                <StarIcon className="h-4 w-4 fill-current" />
                {contact.rating.toFixed(1)}
              </span>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/55">
            {contact.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPinIcon className="h-3.5 w-3.5" />
                {contact.location}
              </span>
            ) : null}
            {contact.metContext ? (
              <span className="inline-flex items-center gap-1">
                <span className="text-white/30">·</span>
                conheci em <strong className="font-medium text-white/80">{contact.metContext}</strong>
              </span>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1",
              )}
            >
              <span className={cn("h-2 w-2 rounded-full", statusDot(contact.status))} />
              {labelStatus(contact.status)}
            </span>
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-white/55">
              IA lê: <strong className="font-semibold text-white/85">{contact.attractionLevel}</strong>
            </span>
            <span className="rounded-full border border-white/10 px-2.5 py-1 text-white/55">
              {contact.source}
            </span>
          </div>

          {contact.tags.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {contact.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[#ff355d]/15 px-2.5 py-1 text-[11px] text-[#ff8a9e]"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Insights da IA */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ReadBlock title="Perfil que a IA leu">
          <p className="text-sm text-white/70">{contact.personalityType}</p>
          {contact.interests.length ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {contact.interests.map((interest) => (
                <span
                  key={interest}
                  className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/55"
                >
                  {interest}
                </span>
              ))}
            </div>
          ) : null}
        </ReadBlock>

        <ReadBlock title="Última interação">
          <p className="text-sm text-white/70">{contact.lastInteractionSummary}</p>
        </ReadBlock>
      </div>

      {/* Notas */}
      {contact.notes ? (
        <div className="mt-6">
          <ReadBlock title="Suas notas">
            <p className="whitespace-pre-wrap text-sm text-white/75 leading-relaxed">
              {contact.notes}
            </p>
          </ReadBlock>
        </div>
      ) : null}

      {/* CTA chat */}
      <div className="mt-8">
        <Link
          href="/"
          onClick={() => useFlirtStore.getState().selectContact(contact.id)}
          className="inline-flex items-center gap-2 rounded-lg bg-white/[0.05] px-4 py-3 text-sm text-white/80 transition hover:bg-white/[0.08] hover:text-white"
        >
          <MessageSquareIcon className="h-4 w-4" />
          Abrir conversa com {contact.name.split(" ")[0]}
          <ExternalLinkIcon className="h-3.5 w-3.5 text-white/40" />
        </Link>
      </div>
    </>
  );
}

function ReadBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
      <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-white/45">
        {title}
      </h3>
      {children}
    </div>
  );
}
