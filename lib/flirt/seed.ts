import type { ContactRecord } from "@/types/flirt";

const avatarPool = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=640&q=80",
  "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?auto=format&fit=crop&w=640&q=80",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=640&q=80",
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=640&q=80",
];

export function getAvatarForIndex(index: number) {
  return avatarPool[index % avatarPool.length];
}

export function createBlankContact(index = 0, name = "Nova conversa"): ContactRecord {
  const now = new Date().toISOString();

  return {
    id: `contact-${crypto.randomUUID()}`,
    name: name === "Nova conversa" ? "Sem nome" : name,
    source: "Origem indefinida",
    avatar: getAvatarForIndex(index),
    status: "active",
    attractionLevel: "Medium",
    personalityType: "Perfil sendo montado",
    interests: [],
    tags: [],
    lastInteractionSummary: "Sem mensagens ainda.",
    conversationHistory: [],
    updatedAt: now,
  };
}

export const seedContacts: ContactRecord[] = [];

export const defaultContactId = "";
