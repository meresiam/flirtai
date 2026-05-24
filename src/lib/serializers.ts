import type { Contact, Message } from "@prisma/client";

import type {
  ContactKind,
  ContactRecord,
  ContactStatus,
  ConversationMessage,
  MessageInsight,
  ReplySuggestion,
} from "@/types/flirt";

function statusFromDb(value: Contact["status"]): ContactStatus {
  return value === "hot_lead" ? "hot lead" : (value as ContactStatus);
}

function kindFromDb(value: Contact["kind"]): ContactKind {
  return value === "agent_chat" ? "agent_chat" : "desenrolo";
}

function ratingFromDb(value: Contact["rating"]): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function serializeMessage(message: Message): ConversationMessage {
  return {
    id: message.id,
    sender: message.sender,
    content: message.content,
    timestamp: message.createdAt.toISOString(),
    suggestions: (message.suggestions as ReplySuggestion[] | null) ?? undefined,
    insight: (message.insight as MessageInsight | null) ?? undefined,
  };
}

export function serializeContact(
  contact: Contact & { messages?: Message[] },
): ContactRecord {
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
    lastInteractionSummary: contact.lastInteractionSummary ?? "Sem mensagens ainda.",
    rating: ratingFromDb(contact.rating),
    location: contact.location ?? null,
    metContext: contact.metContext ?? null,
    notes: contact.notes ?? null,
    conversationHistory: contact.messages?.map(serializeMessage) ?? [],
    updatedAt: contact.updatedAt.toISOString(),
  };
}
