"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type {
  CoachChatResponse,
  ContactKind,
  ContactRecord,
  ConversationMessage,
} from "@/types/flirt";

export interface CreateContactPayload {
  kind?: ContactKind;
  name?: string;
  source?: string;
  avatarUrl?: string;
  age?: number | null;
  instagramHandle?: string;
  ratingBeleza?: number | null;
  ratingInteligencia?: number | null;
  ratingLealdade?: number | null;
  ratingRespeito?: number | null;
  ratingVestimenta?: number | null;
  location?: string;
  metContext?: string;
  tags?: string[];
  notes?: string;
}

export type UpdateContactPayload = Partial<{
  name: string;
  source: string;
  avatarUrl: string | null;
  age: number | null;
  instagramHandle: string | null;
  tags: string[];
  status: ContactRecord["status"];
  attractionLevel: ContactRecord["attractionLevel"];
  personalityType: string;
  notes: string | null;
  ratingBeleza: number | null;
  ratingInteligencia: number | null;
  ratingLealdade: number | null;
  ratingRespeito: number | null;
  ratingVestimenta: number | null;
  location: string | null;
  metContext: string | null;
}>;

interface FlirtState {
  contacts: ContactRecord[];
  selectedContactId: string;
  hasHydrated: boolean;
  isBootstrapping: boolean;
  bootstrapError: string | null;
  bootstrap: () => Promise<void>;
  selectContact: (contactId: string) => void;
  createContact: (
    payload?: string | CreateContactPayload,
  ) => Promise<string | null>;
  updateContact: (
    contactId: string,
    patch: UpdateContactPayload,
  ) => Promise<ContactRecord | null>;
  appendMessage: (contactId: string, message: ConversationMessage) => void;
  applyCoachResponse: (contactId: string, response: CoachChatResponse) => void;
  removeContact: (contactId: string) => Promise<void>;
  setHasHydrated: (value: boolean) => void;
}

function moveContactToTop(contacts: ContactRecord[], contactId: string) {
  const selected = contacts.find((contact) => contact.id === contactId);
  const others = contacts.filter((contact) => contact.id !== contactId);
  return selected ? [selected, ...others] : contacts;
}

function resolveSelectedContactId(contacts: ContactRecord[], current?: string) {
  if (current && contacts.some((contact) => contact.id === current)) {
    return current;
  }
  return contacts[0]?.id ?? "";
}

export const useFlirtStore = create<FlirtState>()(
  persist(
    (set, get) => ({
      contacts: [],
      selectedContactId: "",
      hasHydrated: false,
      isBootstrapping: false,
      bootstrapError: null,

      bootstrap: async () => {
        if (get().isBootstrapping) return;
        set({ isBootstrapping: true, bootstrapError: null });
        try {
          const response = await fetch("/api/contacts", { cache: "no-store" });
          if (response.status === 401) {
            if (typeof window !== "undefined") {
              window.location.href = "/login";
            }
            set({ isBootstrapping: false });
            return;
          }
          if (!response.ok) {
            throw new Error("Não consegui carregar suas conversas.");
          }
          const data = (await response.json()) as { contacts: ContactRecord[] };
          set((state) => ({
            contacts: data.contacts,
            selectedContactId: resolveSelectedContactId(
              data.contacts,
              state.selectedContactId,
            ),
            isBootstrapping: false,
          }));
        } catch (error) {
          set({
            isBootstrapping: false,
            bootstrapError:
              error instanceof Error ? error.message : "Erro ao carregar conversas.",
          });
        }
      },

      selectContact: (contactId) => set({ selectedContactId: contactId }),

      createContact: async (payload) => {
        const body: CreateContactPayload =
          typeof payload === "string" || payload === undefined
            ? { name: payload }
            : payload;
        try {
          const response = await fetch("/api/contacts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
          if (!response.ok) return null;
          const { contact } = (await response.json()) as { contact: ContactRecord };
          set((state) => ({
            contacts: [contact, ...state.contacts],
            selectedContactId: contact.id,
          }));
          return contact.id;
        } catch {
          return null;
        }
      },

      updateContact: async (contactId, patch) => {
        try {
          const response = await fetch(`/api/contacts/${contactId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          });
          if (!response.ok) return null;
          const { contact } = (await response.json()) as { contact: ContactRecord };
          set((state) => ({
            contacts: state.contacts.map((c) =>
              c.id === contactId ? { ...c, ...contact } : c,
            ),
          }));
          return contact;
        } catch {
          return null;
        }
      },

      appendMessage: (contactId, message) =>
        set((state) => {
          const contacts = state.contacts.map((contact) =>
            contact.id === contactId
              ? {
                  ...contact,
                  conversationHistory: [...contact.conversationHistory, message],
                  updatedAt: message.timestamp,
                }
              : contact,
          );
          return {
            contacts: moveContactToTop(contacts, contactId),
            selectedContactId: contactId,
          };
        }),

      applyCoachResponse: (contactId, response) =>
        set((state) => {
          const assistantMessage: ConversationMessage = {
            id: crypto.randomUUID(),
            sender: "assistant",
            content: response.assistantMessage,
            timestamp: new Date().toISOString(),
            suggestions: response.suggestions,
            insight: response.insight,
          };

          const contacts = state.contacts.map((contact) =>
            contact.id === contactId
              ? {
                  ...contact,
                  ...response.contact,
                  tags: response.contact.tags.length
                    ? response.contact.tags
                    : contact.tags,
                  interests: response.contact.interests.length
                    ? response.contact.interests
                    : contact.interests,
                  conversationHistory: [...contact.conversationHistory, assistantMessage],
                  updatedAt: assistantMessage.timestamp,
                }
              : contact,
          );

          return {
            contacts: moveContactToTop(contacts, contactId),
            selectedContactId: contactId,
          };
        }),

      removeContact: async (contactId) => {
        const before = get().contacts;
        set((state) => ({
          contacts: state.contacts.filter((contact) => contact.id !== contactId),
          selectedContactId:
            state.selectedContactId === contactId
              ? state.contacts.find((c) => c.id !== contactId)?.id ?? ""
              : state.selectedContactId,
        }));
        try {
          const response = await fetch(`/api/contacts/${contactId}`, {
            method: "DELETE",
          });
          if (!response.ok) {
            set({ contacts: before });
          }
        } catch {
          set({ contacts: before });
        }
      },

      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "flirt-ai-store",
      version: 6,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        contacts: state.contacts,
        selectedContactId: state.selectedContactId,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
