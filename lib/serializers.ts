import type { Contact, Message } from "@prisma/client";

import type {
  ContactRecord,
  ContactStatus,
  ConversationMessage,
  MessageInsight,
  ReplySuggestion,
} from "@/types/flirt";

function statusFromDb(value: Contact["status"]): ContactStatus {
  return value === "hot_lead" ? "hot lead" : (value as ContactStatus);
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
    name: contact.name,
    source: contact.source,
    avatar: contact.avatarUrl ?? "",
    status: statusFromDb(contact.status),
    attractionLevel: contact.attractionLevel,
    personalityType: contact.personalityType ?? "Perfil em leitura",
    interests: contact.interests,
    tags: contact.tags,
    lastInteractionSummary: contact.lastInteractionSummary ?? "Sem mensagens ainda.",
    conversationHistory: contact.messages?.map(serializeMessage) ?? [],
    updatedAt: contact.updatedAt.toISOString(),
  };
}
