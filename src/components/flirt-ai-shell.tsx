"use client";

import * as React from "react";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpIcon,
  BotIcon,
  CircleUserRound,
  Command,
  HeartIcon,
  LoaderIcon,
  MenuIcon,
  Paperclip,
  PlusIcon,
  SearchIcon,
  SendIcon,
  SettingsIcon,
  Sparkles,
  XIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { ContactAvatar } from "@/components/contact-avatar";
import { AnimatedGradientBorder } from "@/components/ui/animated-gradient-border";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useFlirtStore } from "@/store/use-flirt-store";
import {
  COACH_COMMANDS,
  parseCoachCommand,
  type CommandIconName,
} from "@/lib/flirt/commands";
import {
  fileToBase64Attachment,
  type ImageAttachmentPayload,
} from "@/lib/flirt/attachments";
import type {
  CoachChatResponse,
  ContactKind,
  ContactRecord,
  ConversationMessage,
  ReplySuggestion,
} from "@/types/flirt";

const COMMAND_ICONS: Record<CommandIconName, React.ReactNode> = {
  plus: <PlusIcon className="h-4 w-4" />,
  sparkles: <Sparkles className="h-4 w-4" />,
  user: <CircleUserRound className="h-4 w-4" />,
  "arrow-up": <ArrowUpIcon className="h-4 w-4" />,
};

interface UseAutoResizeTextareaProps {
  minHeight: number;
  maxHeight?: number;
}

function useAutoResizeTextarea({
  minHeight,
  maxHeight,
}: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      if (reset) {
        textarea.style.height = `${minHeight}px`;
        return;
      }

      textarea.style.height = `${minHeight}px`;
      const newHeight = Math.max(
        minHeight,
        Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY),
      );

      textarea.style.height = `${newHeight}px`;
    },
    [minHeight, maxHeight],
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = `${minHeight}px`;
    }
  }, [minHeight]);

  useEffect(() => {
    const handleResize = () => adjustHeight();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [adjustHeight]);

  return { textareaRef, adjustHeight };
}

interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  containerClassName?: string;
  showRing?: boolean;
}

const emptyStatePrompts = [
  {
    icon: <Sparkles className="h-4 w-4" />,
    label: "Ler a situacao",
    helper: "Cole a ultima mensagem dela",
    value: "Ela me respondeu 'haha talvez'. O que eu mando agora?",
  },
  {
    icon: <CircleUserRound className="h-4 w-4" />,
    label: "Abrir conversa",
    helper: "Instagram, Tinder ou vida real",
    value: "Conheci ela no Instagram e ela me seguiu de volta. Como eu abro?",
  },
  {
    icon: <ArrowUpIcon className="h-4 w-4" />,
    label: "Puxar encontro",
    helper: "Sem parecer afobado",
    value: "/encontro ela topou sair mas esta enrolando o dia",
  },
] as const;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, containerClassName, showRing = true, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false);

    return (
      <div className={cn("relative", containerClassName)}>
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "transition-all duration-200 ease-in-out",
            "placeholder:text-muted-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
            showRing
              ? "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0"
              : "",
            className,
          )}
          ref={ref}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {showRing && isFocused ? (
          <motion.span
            className="pointer-events-none absolute inset-0 rounded-md ring-2 ring-violet-500/30 ring-offset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        ) : null}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";

export function FlirtAiShell() {
  const {
    contacts,
    selectedContactId,
    hasHydrated,
    bootstrapError,
    bootstrap,
    selectContact,
    createContact,
    appendMessage,
    applyCoachResponse,
  } = useFlirtStore();
  const router = useRouter();

  const handleCreate = useCallback(
    (kind: ContactKind) => {
      if (kind === "desenrolo") {
        router.push("/desenrolos/new");
      } else {
        void createContact({ kind: "agent_chat" });
      }
    },
    [createContact, router],
  );

  const [value, setValue] = useState("");
  interface ImageAttachmentState {
    id: string;
    name: string;
    size: number;
    status: "encoding" | "ready" | "error";
    payload?: ImageAttachmentPayload;
    previewUrl?: string;
    error?: string;
  }
  const [attachments, setAttachments] = useState<ImageAttachmentState[]>([]);
  // WR-01 — ref espelha o array atual pra cleanup no unmount sem reanexar
  // o effect a cada mudança (e sem capturar o array inicial vazio via closure).
  const attachmentsRef = useRef<ImageAttachmentState[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [activeSuggestion, setActiveSuggestion] = useState<number>(-1);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [recentCommand, setRecentCommand] = useState<string | null>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [inputFocused, setInputFocused] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [streamingText, setStreamingText] = useState<{
    contactId: string;
    text: string;
  } | null>(null);
  const commandPaletteRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 60,
    maxHeight: 220,
  });

  const selectedContact =
    contacts.find((contact) => contact.id === selectedContactId) ?? contacts[0] ?? null;
  const conversationHistory = selectedContact?.conversationHistory ?? [];
  const deferredSearch = useDeferredValue(searchValue);
  const visibleContacts = contacts.filter((contact) => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return true;

    return [
      contact.name,
      contact.source,
      contact.personalityType,
      contact.tags.join(" "),
      contact.lastInteractionSummary,
    ]
      .join(" ")
      .toLowerCase()
      .includes(query);
  });
  const showEmptyConversationState =
    !selectedContact || conversationHistory.length === 0;

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

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      setMousePosition({ x: event.clientX, y: event.clientY });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [
    selectedContact?.conversationHistory.length,
    selectedContactId,
    isTyping,
    streamingText?.text.length,
  ]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [selectedContactId]);

  useEffect(() => {
    if (hasHydrated && !selectedContactId && contacts[0]) {
      selectContact(contacts[0].id);
    }
  }, [contacts, hasHydrated, selectContact, selectedContactId]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const commandButton = document.querySelector("[data-command-button]");

      if (
        commandPaletteRef.current &&
        !commandPaletteRef.current.contains(target) &&
        !commandButton?.contains(target)
      ) {
        setShowCommandPalette(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const isBusy = isTyping || isPending;

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCommandPalette) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveSuggestion((previous) =>
          previous < COACH_COMMANDS.length - 1 ? previous + 1 : 0,
        );
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveSuggestion((previous) =>
          previous > 0 ? previous - 1 : COACH_COMMANDS.length - 1,
        );
      } else if (event.key === "Tab" || event.key === "Enter") {
        event.preventDefault();
        if (activeSuggestion >= 0) {
          const selectedCommand = COACH_COMMANDS[activeSuggestion];
          setValue(`${selectedCommand.prefix} `);
          setShowCommandPalette(false);
          setRecentCommand(selectedCommand.label);
          window.setTimeout(() => setRecentCommand(null), 2200);
        }
      } else if (event.key === "Escape") {
        event.preventDefault();
        setShowCommandPalette(false);
      }
      return;
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  const handleAttachFile = () => {
    fileInputRef.current?.click();
  };

  const handleAttachChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) return;
    event.target.value = "";

    for (const file of files) {
      const id = crypto.randomUUID();
      const previewUrl = URL.createObjectURL(file);
      setAttachments((previous) => [
        ...previous,
        { id, name: file.name, size: file.size, status: "encoding", previewUrl },
      ]);

      fileToBase64Attachment(file)
        .then((payload) => {
          setAttachments((previous) =>
            previous.map((attachment) =>
              attachment.id === id
                ? { ...attachment, status: "ready", payload }
                : attachment,
            ),
          );
        })
        .catch((cause) => {
          URL.revokeObjectURL(previewUrl);
          setAttachments((previous) =>
            previous.map((attachment) =>
              attachment.id === id
                ? {
                    ...attachment,
                    status: "error",
                    previewUrl: undefined,
                    error:
                      cause instanceof Error
                        ? cause.message
                        : "Não consegui processar a imagem.",
                  }
                : attachment,
            ),
          );
        });
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((previous) => {
      const target = previous.find((attachment) => attachment.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return previous.filter((attachment) => attachment.id !== id);
    });
  };

  // WR-01 — mantém ref em dia com o array atual.
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => {
    return () => {
      for (const attachment of attachmentsRef.current) {
        if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectCommandSuggestion = (index: number) => {
    const selectedCommand = COACH_COMMANDS[index];
    setValue(`${selectedCommand.prefix} `);
    setShowCommandPalette(false);
    setRecentCommand(selectedCommand.label);
    window.setTimeout(() => setRecentCommand(null), 2000);
  };

  const fillSuggestion = (suggestion: ReplySuggestion) => {
    setValue(suggestion.text);
    requestAnimationFrame(() => adjustHeight());
  };

  async function handleSendMessage() {
    const trimmed = value.trim();
    if (attachments.some((attachment) => attachment.status === "encoding")) {
      setErrorMessage("Aguarde os anexos terminarem de carregar.");
      return;
    }
    const readyAttachments = attachments.filter(
      (attachment) => attachment.status === "ready" && attachment.payload,
    );
    if (!trimmed && !readyAttachments.length) {
      return;
    }

    const commandMeta = parseCoachCommand(trimmed);

    if (commandMeta.command === "/nova") {
      const name = commandMeta.cleanPrompt;
      await createContact(name || undefined);
      setValue("");
      setAttachments([]);
      adjustHeight(true);
      setShowCommandPalette(false);
      setRecentCommand("Nova aba");
      window.setTimeout(() => setRecentCommand(null), 1800);
      return;
    }

    let activeContact: ContactRecord | null = selectedContact;

    if (!activeContact) {
      const nextContactId = await createContact();
      if (nextContactId) {
        activeContact =
          useFlirtStore.getState().contacts.find((contact) => contact.id === nextContactId) ??
          null;
      }
    }

    if (!activeContact) {
      setErrorMessage("Não consegui abrir uma nova conversa agora. Tenta de novo.");
      return;
    }

    const contactId = activeContact.id;
    const attachmentPayloads = readyAttachments.map((attachment) => attachment.payload!);
    const fallbackPromptForImageOnly = "Lê esse print e me orienta.";
    const messageContent =
      commandMeta.displayPrompt ||
      trimmed ||
      (attachmentPayloads.length ? fallbackPromptForImageOnly : "");
    const outgoingMessage: ConversationMessage = {
      id: crypto.randomUUID(),
      sender: "user",
      content: messageContent,
      timestamp: new Date().toISOString(),
    };

    appendMessage(contactId, outgoingMessage);
    setErrorMessage(null);
    setValue("");
    for (const attachment of attachments) {
      if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    }
    setAttachments([]);
    adjustHeight(true);
    setShowCommandPalette(false);
    setIsTyping(true);
    setStreamingText({ contactId, text: "" });

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          contactId,
          prompt: messageContent,
          mode: commandMeta.mode,
          attachments: attachmentPayloads,
        }),
      });

      if (!response.ok || !response.body) {
        let errMessage = "O FLIRT A.I não conseguiu responder.";
        try {
          const errPayload = (await response.json()) as { error?: string };
          if (errPayload.error) errMessage = errPayload.error;
        } catch {
          // body might not be JSON — fall through with default message
        }
        throw new Error(errMessage);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let donePayload: (CoachChatResponse & { messageId: string }) | null = null;
      let streamError: { message: string; status?: number } | null = null;

      readLoop: while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          if (!part.trim()) continue;
          let event = "message";
          let dataRaw = "";
          for (const line of part.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) dataRaw += line.slice(5).trimStart();
          }
          if (!dataRaw) continue;
          let data: unknown;
          try {
            data = JSON.parse(dataRaw);
          } catch {
            continue;
          }
          if (event === "delta") {
            const chunk = (data as { text?: string })?.text ?? "";
            if (chunk) {
              setStreamingText((prev) =>
                prev && prev.contactId === contactId
                  ? { contactId, text: prev.text + chunk }
                  : { contactId, text: chunk },
              );
            }
          } else if (event === "done") {
            donePayload = data as CoachChatResponse & { messageId: string };
            break readLoop;
          } else if (event === "error") {
            streamError = data as { message: string; status?: number };
            break readLoop;
          }
        }
      }

      if (streamError) {
        throw new Error(streamError.message || "O FLIRT A.I não conseguiu responder.");
      }
      if (!donePayload) {
        throw new Error("Stream terminou sem resposta. Tenta de novo.");
      }

      startTransition(() => {
        applyCoachResponse(contactId, donePayload!);
      });
    } catch (error) {
      const fallbackMessage: ConversationMessage = {
        id: crypto.randomUUID(),
        sender: "assistant",
        content:
          error instanceof Error
            ? error.message
            : "Não consegui responder agora. Tenta de novo em instantes.",
        timestamp: new Date().toISOString(),
      };

      appendMessage(contactId, fallbackMessage);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não consegui responder agora. Tenta de novo em instantes.",
      );
    } finally {
      setIsTyping(false);
      setStreamingText(null);
    }
  }

  const inputPlaceholder = selectedContact
    ? "Cole a mensagem dela ou diga o contexto..."
    : "Manda a primeira mensagem dela e eu abro a conversa...";

  return (
    <div className="relative flex min-h-screen w-full overflow-hidden bg-transparent p-3 text-white sm:p-4">
      <div className="absolute inset-0 h-full w-full overflow-hidden">
        <div className="absolute -left-[18rem] top-[-10rem] h-[58rem] w-[58rem] rounded-full border-[10px] border-[#ff355d]/55 opacity-65 blur-[1px]" />
        <div className="absolute -left-[16rem] top-[-8rem] h-[58rem] w-[58rem] rounded-full border-[8px] border-[#ff7a66]/24 opacity-85 blur-[1px]" />
        <div className="absolute -right-[18rem] top-[-10rem] h-[58rem] w-[58rem] rounded-full border-[10px] border-[#ff355d]/55 opacity-65 blur-[1px]" />
        <div className="absolute -right-[16rem] top-[-8rem] h-[58rem] w-[58rem] rounded-full border-[8px] border-[#ff7a66]/24 opacity-85 blur-[1px]" />
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[#ff355d]/7 to-transparent" />
      </div>

      <div className="relative z-10 mx-auto grid w-full max-w-[1440px] gap-3 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="hidden lg:block">
          <ConversationSidebar
            contacts={visibleContacts}
            selectedContactId={selectedContact?.id ?? ""}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            onCreateContact={() => { void createContact(); }}
            onSelectContact={selectContact}
          />
        </div>

        <AnimatePresence>
          {sidebarOpen ? (
            <>
              <motion.button
                type="button"
                className="fixed inset-0 z-20 bg-black/50 lg:hidden"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
              />
              <motion.div
                initial={{ x: -24, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -24, opacity: 0 }}
                className="fixed left-3 top-3 z-30 h-[calc(100vh-1.5rem)] w-[19rem] lg:hidden"
              >
                <ConversationSidebar
                  contacts={visibleContacts}
                  selectedContactId={selectedContact?.id ?? ""}
                  searchValue={searchValue}
                  onSearchChange={setSearchValue}
                  onCreateContact={handleCreate}
                  onSelectContact={selectContact}
                  onClose={() => setSidebarOpen(false)}
                />
              </motion.div>
            </>
          ) : null}
        </AnimatePresence>

        <AnimatedGradientBorder
          borderRadius={30}
          borderWidth={2}
          animationMode="static"
          glow={false}
          className="relative min-h-[calc(100vh-2rem)]"
        >
        <section className="liquid-panel relative flex min-h-[calc(100vh-2.4rem)] flex-col overflow-hidden rounded-[28px]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4 sm:px-6">
            <div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/70 transition hover:bg-white/[0.1] hover:text-white lg:hidden"
                >
                  <MenuIcon className="h-4 w-4" />
                </button>
                {selectedContact ? (
                  <>
                    <ContactAvatar
                      name={selectedContact.name}
                      src={selectedContact.avatar}
                      className="h-11 w-11"
                      sizes="44px"
                    />
                    <div>
                      <h2 className="font-heading text-2xl text-white">
                        {selectedContact.name}
                      </h2>
                      <p className="text-sm text-white/48">
                        {selectedContact.source} • {selectedContact.personalityType}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className={cn("h-2 w-2 rounded-full", statusDot(selectedContact.status))} />
                        <span className="text-xs text-white/42">
                          {selectedContact.attractionLevel} • {labelStatus(selectedContact.status)}
                        </span>
                        {selectedContact.tags.slice(0, 2).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-white/52"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                      <FlirtIcon className="h-5 w-5" />
                    </div>
                    <h2 className="font-heading text-xl text-white">Flirt.ai</h2>
                  </div>
                )}
              </div>
              {recentCommand ? (
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1 text-xs text-white/58">
                  <Sparkles className="h-3.5 w-3.5 text-[#ff5a63]" />
                  Comando carregado: {recentCommand}
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <NewConversationPicker
                onCreate={handleCreate}
                trigger={
                  <button
                    type="button"
                    className="hidden rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/65 transition hover:border-[#ff355d]/24 hover:bg-[#ff355d]/8 hover:text-white sm:inline-flex"
                  >
                    Nova conversa
                  </button>
                }
              />
              <Link
                href="/desenrolos"
                aria-label="Meus desenrolos"
                className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/65 transition hover:border-[#ff355d]/24 hover:bg-[#ff355d]/8 hover:text-white sm:inline-flex"
              >
                <HeartIcon className="h-3.5 w-3.5" />
                Desenrolos
              </Link>
              <Link
                href="/profiles"
                aria-label="Perfis monitorados"
                className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/65 transition hover:border-[#ff355d]/24 hover:bg-[#ff355d]/8 hover:text-white sm:inline-flex"
              >
                Perfis
              </Link>
              <Link
                href="/settings"
                aria-label="Configurações"
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/65 transition hover:border-[#ff355d]/24 hover:bg-[#ff355d]/8 hover:text-white"
              >
                <SettingsIcon className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="relative flex-1 overflow-hidden">
            <div className="absolute inset-0 overflow-y-auto px-5 py-6 sm:px-6">
              {showEmptyConversationState ? (
                <div className="mx-auto flex h-full max-w-2xl flex-col items-center justify-center text-center">
                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="space-y-6"
                  >
                    <h3 className="text-2xl font-medium tracking-tight text-white/90">
                      Por onde começamos?
                    </h3>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-center">
                      {emptyStatePrompts.map((prompt) => (
                        <button
                          key={prompt.label}
                          type="button"
                          onClick={() => {
                            setValue(prompt.value);
                            requestAnimationFrame(() => adjustHeight());
                          }}
                          className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-[#ff355d]/24 hover:bg-white/[0.06]"
                        >
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/72">
                              {prompt.icon}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-white">{prompt.label}</p>
                              <p className="mt-0.5 text-xs text-white/42">{prompt.helper}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                </div>
              ) : null}

              <div className="mx-auto flex max-w-3xl flex-col gap-4 pb-10">
                {conversationHistory.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "max-w-[88%] rounded-[28px] border px-4 py-4",
                      message.sender === "user"
                        ? "ml-auto border-white/12 bg-white text-slate-950"
                        : "border-white/10 bg-white/[0.04] text-white/86 backdrop-blur-xl",
                    )}
                  >
                    <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em]">
                      <span
                        className={cn(
                          message.sender === "user"
                            ? "text-slate-500"
                            : "text-white/38",
                        )}
                      >
                        {message.sender === "user" ? "Você" : "FLIRT"}
                      </span>
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6">
                      {message.content}
                    </p>
                    {message.insight ? (
                      <div className="mt-4 grid gap-2 sm:grid-cols-[auto_1fr_1fr_1fr]">
                        <div className="rounded-2xl border border-white/10 bg-white/[0.05] px-3 py-2 text-left">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                            Interesse
                          </div>
                          <div className="mt-1 text-xs font-medium text-white">
                            {message.insight.interestLevel}
                          </div>
                        </div>
                        <InsightChip label="Leitura" value={message.insight.read} />
                        <InsightChip label="Mover" value={message.insight.move} />
                        <InsightChip label="Evitar" value={message.insight.avoid} />
                      </div>
                    ) : null}
                    {message.suggestions?.length ? (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {message.suggestions.map((suggestion) => (
                          <button
                            key={suggestion.text}
                            type="button"
                            onClick={() => fillSuggestion(suggestion)}
                            title={
                              suggestion.likelyResponse
                                ? `Resposta provável: ${suggestion.likelyResponse}`
                                : undefined
                            }
                            className="rounded-[22px] border border-white/10 bg-white/[0.05] px-3 py-3 text-left transition hover:bg-white/[0.08] hover:text-white"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] uppercase tracking-[0.18em] text-white/35">
                                  {labelTone(suggestion.tone)}
                                </span>
                                {suggestion.risk ? (
                                  <span
                                    className={cn(
                                      "rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]",
                                      riskBadgeClass(suggestion.risk),
                                    )}
                                  >
                                    {labelRisk(suggestion.risk)}
                                  </span>
                                ) : null}
                              </div>
                              <span className="text-[11px] text-white/35">Usar</span>
                            </div>
                            <p className="mt-2 text-sm text-white/88">{suggestion.text}</p>
                            <p className="mt-2 text-xs text-white/45">{suggestion.why}</p>
                            {suggestion.likelyResponse ? (
                              <p className="mt-2 text-[11px] italic text-white/55">
                                Provável resposta dela: {suggestion.likelyResponse}
                              </p>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    ) : null}
                    <p
                      className={cn(
                        "mt-3 text-[11px]",
                        message.sender === "user" ? "text-slate-500" : "text-white/30",
                      )}
                    >
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                ))}

                <AnimatePresence>
                  {streamingText &&
                  streamingText.contactId === selectedContact?.id ? (
                    <motion.div
                      key="streaming-bubble"
                      className="rounded-[28px] border border-white/[0.08] bg-white/[0.04] px-5 py-5 backdrop-blur-2xl"
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 14 }}
                    >
                      <div className="flex items-center gap-3">
                        <FlirtMonogram />
                        <span className="text-[11px] uppercase tracking-[0.18em] text-white/38">
                          FLIRT
                        </span>
                      </div>
                      <p
                        aria-live="polite"
                        className="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/92"
                      >
                        {streamingText.text}
                        <span className="ml-1 inline-block h-3 w-[2px] translate-y-[2px] animate-pulse bg-white/70" />
                      </p>
                    </motion.div>
                  ) : isTyping ? (
                    <motion.div
                      key="typing-indicator"
                      className="w-fit rounded-full border border-white/[0.06] bg-white/[0.03] px-4 py-2 backdrop-blur-2xl"
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 14 }}
                    >
                      <div className="flex items-center gap-3">
                        <FlirtMonogram />
                        <div className="flex items-center gap-2 text-sm text-white/70">
                          <span>Pensando</span>
                          <TypingDots />
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <div ref={messagesEndRef} />
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 px-5 py-5 sm:px-6">
            <div className="mx-auto w-full max-w-3xl">
              <AnimatedGradientBorder
                borderRadius={26}
                borderWidth={1.5}
                animationSpeed={9}
                glow={false}
                backgroundColor="#0b0e16"
                className="relative overflow-visible"
              >
              <motion.div
                className="relative overflow-visible rounded-[24px] shadow-xl backdrop-blur-xl"
                initial={{ scale: 0.98 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1 }}
              >
                <AnimatePresence>
                  {showCommandPalette ? (
                    <motion.div
                      ref={commandPaletteRef}
                      className="absolute bottom-full left-4 right-4 z-50 mb-2 overflow-hidden rounded-2xl border border-white/10 bg-black/90 shadow-lg backdrop-blur-xl"
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 5 }}
                      transition={{ duration: 0.15 }}
                    >
                      <div className="bg-black/95 py-1">
                        {COACH_COMMANDS.map((suggestion, index) => (
                          <motion.div
                            key={suggestion.prefix}
                            className={cn(
                              "cursor-pointer px-3 py-2 text-xs transition-colors",
                              activeSuggestion === index
                                ? "bg-white/10 text-white"
                                : "text-white/70 hover:bg-white/5",
                            )}
                            onClick={() => selectCommandSuggestion(index)}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.03 }}
                          >
                            <div className="flex items-center gap-2">
                              <div className="flex h-5 w-5 items-center justify-center text-white/60">
                                {COMMAND_ICONS[suggestion.iconName]}
                              </div>
                              <div className="font-medium">{suggestion.label}</div>
                              <div className="ml-1 text-xs text-white/40">
                                {suggestion.prefix}
                              </div>
                            </div>
                            <div className="mt-1 pl-7 text-[11px] text-white/45">
                              {suggestion.description}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <div className="p-4">
                  <Textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setValue(nextValue);
                      adjustHeight();

                      if (nextValue.startsWith("/") && !nextValue.includes(" ")) {
                        setShowCommandPalette(true);
                        const matchingSuggestionIndex = COACH_COMMANDS.findIndex((cmd) =>
                          cmd.prefix.startsWith(nextValue),
                        );
                        setActiveSuggestion(
                          matchingSuggestionIndex >= 0 ? matchingSuggestionIndex : -1,
                        );
                      } else {
                        setShowCommandPalette(false);
                        setActiveSuggestion(-1);
                      }
                    }}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setInputFocused(true)}
                    onBlur={() => setInputFocused(false)}
                    placeholder={inputPlaceholder}
                    containerClassName="w-full"
                    className={cn(
                      "min-h-[72px] w-full resize-none bg-transparent px-4 py-3 text-[15px] leading-7 text-white/92",
                      "border-none focus:outline-none placeholder:text-white/22",
                    )}
                    style={{ overflow: "hidden" }}
                    showRing={false}
                  />
                </div>

                <AnimatePresence>
                  {attachments.length > 0 ? (
                    <motion.div
                      className="flex flex-wrap gap-2 px-4 pb-3"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      {attachments.map((file) => (
                        <motion.div
                          key={file.id}
                          className={cn(
                            "flex items-center gap-2 rounded-full border px-2 py-1 text-xs",
                            file.status === "ready" &&
                              "border-white/10 bg-white/[0.04] text-white/70",
                            file.status === "encoding" &&
                              "border-white/10 bg-white/[0.04] text-white/55",
                            file.status === "error" &&
                              "border-rose-400/30 bg-rose-500/10 text-rose-200",
                          )}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          title={file.status === "error" ? file.error : file.name}
                        >
                          {file.previewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={file.previewUrl}
                              alt={file.name}
                              className="h-6 w-6 rounded object-cover"
                            />
                          ) : file.status === "encoding" ? (
                            <LoaderIcon className="h-3 w-3 animate-spin" />
                          ) : null}
                          <span className="max-w-[12rem] truncate">{file.name}</span>
                          <span className="text-[10px] text-white/35">
                            {file.status === "encoding"
                              ? "preparando..."
                              : file.status === "ready"
                                ? `${(file.size / 1024).toFixed(0)} KB`
                                : "erro"}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(file.id)}
                            className="text-white/40 transition-colors hover:text-white"
                          >
                            <XIcon className="h-3 w-3" />
                          </button>
                        </motion.div>
                      ))}
                    </motion.div>
                  ) : null}
                </AnimatePresence>

                <div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/[0.05] p-4">
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={handleAttachChange}
                    />
                    <motion.button
                      type="button"
                      onClick={handleAttachFile}
                      whileTap={{ scale: 0.94 }}
                      className="group relative inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white/90"
                    >
                      <Paperclip className="h-4 w-4" />
                      <span className="hidden text-xs sm:inline">Anexar</span>
                      <motion.span
                        className="absolute inset-0 rounded-full bg-white/[0.05] opacity-0 transition-opacity group-hover:opacity-100"
                        layoutId="button-highlight"
                      />
                    </motion.button>
                    <motion.button
                      type="button"
                      data-command-button
                      onClick={(event) => {
                        event.stopPropagation();
                        setShowCommandPalette((previous) => !previous);
                        setActiveSuggestion((previous) =>
                          previous >= 0 ? previous : 0,
                        );
                      }}
                      whileTap={{ scale: 0.94 }}
                      className={cn(
                        "group relative inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white/90",
                        showCommandPalette && "border-white/16 bg-white/10 text-white/90",
                      )}
                    >
                      <Command className="h-4 w-4" />
                      <span className="hidden text-xs sm:inline">Comandos</span>
                      <motion.span
                        className="absolute inset-0 rounded-full bg-white/[0.05] opacity-0 transition-opacity group-hover:opacity-100"
                        layoutId="command-highlight"
                      />
                    </motion.button>
                  </div>

                  <motion.button
                    type="button"
                    onClick={() => void handleSendMessage()}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={isBusy || (!value.trim() && attachments.length === 0)}
                    className={cn(
                      "flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all",
                      value.trim() || attachments.length
                        ? "bg-white text-[#0A0A0B] shadow-lg shadow-white/10"
                        : "bg-white/[0.05] text-white/40",
                    )}
                  >
                    {isBusy ? (
                      <LoaderIcon className="h-4 w-4 animate-[spin_2s_linear_infinite]" />
                    ) : (
                      <SendIcon className="h-4 w-4" />
                    )}
                    <span>Enviar</span>
                  </motion.button>
                </div>
              </motion.div>
              </AnimatedGradientBorder>

              {errorMessage || bootstrapError ? (
                <p className="mt-3 text-sm text-rose-200">{errorMessage ?? bootstrapError}</p>
              ) : null}
            </div>
          </div>
        </section>
        </AnimatedGradientBorder>
      </div>

      {inputFocused ? (
        <motion.div
          className="pointer-events-none fixed z-0 h-[50rem] w-[50rem] rounded-full bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 opacity-[0.02] blur-[96px]"
          animate={{
            x: mousePosition.x - 400,
            y: mousePosition.y - 400,
          }}
          transition={{
            type: "spring",
            damping: 25,
            stiffness: 150,
            mass: 0.5,
          }}
        />
      ) : null}
    </div>
  );
}

function TypingDots() {
  return (
    <div className="ml-1 flex items-center">
      {[1, 2, 3].map((dot) => (
        <motion.div
          key={dot}
          className="mx-0.5 h-1.5 w-1.5 rounded-full bg-white/90"
          initial={{ opacity: 0.3 }}
          animate={{
            opacity: [0.3, 0.9, 0.3],
            scale: [0.85, 1.1, 0.85],
          }}
          transition={{
            duration: 1.2,
            repeat: Number.POSITIVE_INFINITY,
            delay: dot * 0.15,
            ease: "easeInOut",
          }}
          style={{
            boxShadow: "0 0 4px rgba(255, 255, 255, 0.3)",
          }}
        />
      ))}
    </div>
  );
}

function getPreview(contact: ContactRecord) {
  const lastMessage = contact.conversationHistory[contact.conversationHistory.length - 1];
  return lastMessage?.content ?? contact.lastInteractionSummary;
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function labelTone(tone: ReplySuggestion["tone"]) {
  if (tone === "playful") return "Provocativa";
  if (tone === "confident") return "Confiante";
  if (tone === "intriguing") return "Intrigante";
  return "Direta";
}

function labelRisk(risk: ReplySuggestion["risk"]) {
  if (risk === "Safe") return "Segura";
  if (risk === "Risky") return "Arriscada";
  return "Faca afiada";
}

function riskBadgeClass(risk: ReplySuggestion["risk"]) {
  if (risk === "Safe") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-300";
  if (risk === "Risky") return "border-amber-400/30 bg-amber-400/10 text-amber-200";
  return "border-rose-400/30 bg-rose-400/10 text-rose-200";
}

function labelStatus(status: ContactRecord["status"]) {
  if (status === "hot_lead") return "Quente";
  if (status === "cold") return "Fria";
  return "Ativa";
}

function InsightChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-left">
      <div className="text-[10px] uppercase tracking-[0.18em] text-white/35">
        {label}
      </div>
      <div className="mt-1 text-xs leading-5 text-white/72">{value}</div>
    </div>
  );
}

function FlirtMonogram() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
      <FlirtIcon className="h-4 w-4" />
    </div>
  );
}

function FlirtIcon({ className }: { className?: string }) {
  const gradientId = React.useId();

  return (
    <svg
      viewBox="0 0 72 72"
      aria-hidden="true"
      className={cn("h-5 w-5", className)}
    >
      <defs>
        <linearGradient id={gradientId} x1="12" y1="10" x2="58" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff6f69" />
          <stop offset="1" stopColor="#ff355d" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        fillRule="evenodd"
        d="M22 12h40v15c0 11.046-8.954 20-20 20H30L11 60V23c0-6.075 4.925-11 11-11Zm8 12c-1.105 0-2 .895-2 2v15.42L39.66 34H47c1.105 0 2-.895 2-2V26c0-1.105-.895-2-2-2H30Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function NewConversationPicker({
  onCreate,
  trigger,
}: {
  onCreate: (kind: ContactKind) => void;
  trigger: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={trigger as React.ReactElement} />
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-64 border-white/10 bg-[#0c0f1a] p-1.5 text-white"
      >
        <DropdownMenuItem
          onClick={() => onCreate("desenrolo")}
          className="group flex cursor-pointer items-start gap-3 rounded-md px-2.5 py-2.5 text-left transition focus-visible:bg-white/[0.07] data-[highlighted]:bg-white/[0.07]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#ff355d]/15">
            <HeartIcon className="h-4 w-4 text-[#ff355d]" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white">Adicionar desenrolo</p>
            <p className="mt-0.5 text-[11px] text-white/45">
              Perfil completo de uma mulher
            </p>
          </div>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onCreate("agent_chat")}
          className="group flex cursor-pointer items-start gap-3 rounded-md px-2.5 py-2.5 text-left transition focus-visible:bg-white/[0.07] data-[highlighted]:bg-white/[0.07]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/[0.07]">
            <BotIcon className="h-4 w-4 text-white/75" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-white">Chat com agente</p>
            <p className="mt-0.5 text-[11px] text-white/45">
              Conversa livre sem perfil
            </p>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ConversationSidebar({
  contacts,
  selectedContactId,
  searchValue,
  onSearchChange,
  onCreateContact,
  onSelectContact,
  onClose,
}: {
  contacts: ContactRecord[];
  selectedContactId: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  onCreateContact: (kind: ContactKind) => void;
  onSelectContact: (contactId: string) => void;
  onClose?: () => void;
}) {
  return (
    <aside className="liquid-panel flex h-full min-h-[14rem] flex-col overflow-hidden rounded-[28px] border border-white/10">
      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <FlirtIcon className="h-5 w-5" />
              <span className="font-heading text-lg text-white">Flirt.ai</span>
            </div>
            <h1 className="mt-3 font-heading text-2xl text-white">Conversas</h1>
            <p className="mt-1 text-xs text-white/38">
              {contacts.length ? `${contacts.length} conversa(s)` : "Sem conversas ainda"}
            </p>
          </div>
          <div className="flex items-center gap-2">
              <NewConversationPicker
                onCreate={onCreateContact}
                trigger={
                  <button
                    type="button"
                    aria-label="Nova conversa"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/70 transition hover:border-[#ff355d]/24 hover:bg-[#ff355d]/8 hover:text-white"
                  >
                    <PlusIcon className="h-4 w-4" />
                  </button>
                }
              />
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-white/70 transition hover:bg-white/[0.1] hover:text-white lg:hidden"
              >
                <XIcon className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3">
          <SearchIcon className="h-4 w-4 text-white/35" />
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar conversa..."
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/28"
          />
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {contacts.length ? (
          contacts.map((contact) => (
            <button
              key={contact.id}
              type="button"
              onClick={() => onSelectContact(contact.id)}
              className={cn(
                "w-full rounded-[24px] border p-3 text-left transition",
                contact.id === selectedContactId
                  ? "border-[#ff355d]/24 bg-[#ff355d]/8"
                  : "border-white/[0.06] bg-white/[0.04] hover:bg-white/[0.08]",
              )}
            >
              <div className="flex items-center gap-3">
                {contact.kind === "agent_chat" ? (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05]">
                    <BotIcon className="h-5 w-5 text-white/65" />
                  </div>
                ) : (
                  <ContactAvatar
                    name={contact.name}
                    src={contact.avatar}
                    className="h-12 w-12"
                    sizes="48px"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-white">
                      {contact.name}
                    </p>
                    <span className="text-[11px] text-white/32">
                      {formatTime(contact.updatedAt)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-white/45">
                    {contact.kind === "agent_chat" ? "Agente" : `${contact.source} • ${contact.personalityType}`}
                  </p>
                </div>
              </div>
              {contact.kind === "desenrolo" ? (
                <div className="mt-3 flex items-center gap-2 text-[11px] text-white/42">
                  <span className={cn("h-2 w-2 rounded-full", statusDot(contact.status))} />
                  <span>{labelStatus(contact.status)}</span>
                  {contact.padrao !== null ? (
                    <>
                      <span className="text-white/20">·</span>
                      <span className="font-mono tabular-nums text-[#ff8a9e]">
                        Padrão {contact.padrao.toFixed(1)}
                      </span>
                    </>
                  ) : null}
                </div>
              ) : null}
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/55">
                {getPreview(contact)}
              </p>
            </button>
          ))
        ) : (
          <div className="rounded-[26px] border border-dashed border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-white/45">
            <p>
              {searchValue.trim()
                ? "Nenhuma conversa encontrada para essa busca."
                : "Nenhuma conversa ainda. Crie uma nova aba ou mande a primeira mensagem."}
            </p>
            {!searchValue.trim() ? (
              <NewConversationPicker
                onCreate={onCreateContact}
                trigger={
                  <button
                    type="button"
                    className="mt-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs text-white/68 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                    Abrir primeira conversa
                  </button>
                }
              />
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}

function statusDot(status: ContactRecord["status"]) {
  if (status === "hot_lead") return "bg-rose-300";
  if (status === "cold") return "bg-slate-300";
  return "bg-emerald-300";
}
