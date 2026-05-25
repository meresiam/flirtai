import type { Contact, Folder, Message, TagPreference } from "@prisma/client";

import type {
  ContactKind,
  ContactRatings,
  ContactRecord,
  ContactStatus,
  ConversationMessage,
  FolderRecord,
  MessageInsight,
  ReplySuggestion,
  TagPreferenceRecord,
} from "@/types/flirt";

function statusFromDb(value: Contact["status"]): ContactStatus {
  return value as ContactStatus;
}

export function statusToDb(value: ContactStatus): Contact["status"] {
  return value;
}

function kindFromDb(value: Contact["kind"]): ContactKind {
  return value === "agent_chat" ? "agent_chat" : "desenrolo";
}

function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function computePadrao(ratings: ContactRatings): number | null {
  const values = Object.values(ratings).filter(
    (v): v is number => v !== null && Number.isFinite(v),
  );
  if (values.length === 0) return null;
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return Math.round(avg * 10) / 10;
}

export function serializeMessage(message: Message): ConversationMessage {
  return {
    id: message.id,
    sender: message.sender,
    content: message.content,
    timestamp: message.createdAt.toISOString(),
    suggestions: (message.suggestions as ReplySuggestion[] | null) ?? undefined,
    insight: (message.insight as MessageInsight | null) ?? undefined,
    sentIrlAt: message.sentIrlAt ? message.sentIrlAt.toISOString() : null,
  };
}

export function serializeContact(
  contact: Contact & { messages?: Message[] },
): ContactRecord {
  const ratings: ContactRatings = {
    beleza: decimalToNumber(contact.ratingBeleza),
    inteligencia: decimalToNumber(contact.ratingInteligencia),
    lealdade: decimalToNumber(contact.ratingLealdade),
    respeito: decimalToNumber(contact.ratingRespeito),
    vestimenta: decimalToNumber(contact.ratingVestimenta),
  };

  return {
    id: contact.id,
    kind: kindFromDb(contact.kind),
    name: contact.name,
    source: contact.source,
    avatar: contact.avatarUrl ?? "",
    status: statusFromDb(contact.status),
    attractionLevel: contact.attractionLevel,
    personalityType: contact.personalityType ?? "Perfil em leitura",
    interests: contact.interests,
    tags: contact.tags,
    greenFlags: contact.greenFlags ?? [],
    redFlags: contact.redFlags ?? [],
    lastInteractionSummary: contact.lastInteractionSummary ?? "Sem mensagens ainda.",
    ratings,
    padrao: computePadrao(ratings),
    location: contact.location ?? null,
    metContext: contact.metContext ?? null,
    notes: contact.notes ?? null,
    conversationHistory: contact.messages?.map(serializeMessage) ?? [],
    updatedAt: contact.updatedAt.toISOString(),
    pinnedAt: contact.pinnedAt ? contact.pinnedAt.toISOString() : null,
    archivedAt: contact.archivedAt ? contact.archivedAt.toISOString() : null,
    folderId: contact.folderId ?? null,
  };
}

export function serializeFolder(folder: Folder): FolderRecord {
  return {
    id: folder.id,
    name: folder.name,
    color: folder.color ?? null,
    icon: folder.icon ?? null,
    order: folder.order,
    createdAt: folder.createdAt.toISOString(),
    updatedAt: folder.updatedAt.toISOString(),
  };
}

export function serializeTagPreference(tp: TagPreference): TagPreferenceRecord {
  return {
    label: tp.label,
    color: tp.color,
  };
}
