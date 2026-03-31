"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { createBlankContact, defaultContactId, seedContacts } from "@/lib/flirt/seed";
import type {
  CoachChatResponse,
  ContactRecord,
  ConversationMessage,
} from "@/types/flirt";

interface FlirtState {
  contacts: ContactRecord[];
  selectedContactId: string;
  hasHydrated: boolean;
  selectContact: (contactId: string) => void;
  createContact: (name?: string) => string;
  appendMessage: (contactId: string, message: ConversationMessage) => void;
  applyCoachResponse: (contactId: string, response: CoachChatResponse) => void;
  setHasHydrated: (value: boolean) => void;
}

function moveContactToTop(contacts: ContactRecord[], contactId: string) {
  const selected = contacts.find((contact) => contact.id === contactId);
  const others = contacts.filter((contact) => contact.id !== contactId);
  return selected ? [selected, ...others] : contacts;
}

const LEGACY_PLACEHOLDER_IDS = new Set([
  "contact-sofia",
  "contact-maya",
  "contact-new",
]);

function isLegacyPlaceholderContact(contact: ContactRecord) {
  const hasGenericName =
    !contact.name.trim() ||
    contact.name === "Nova conversa" ||
    contact.name === "Sem nome";
  const hasGenericSource =
    !contact.source.trim() || contact.source === "Origem indefinida";
  const hasSeedProfile =
    contact.personalityType === "Perfil sendo montado" ||
    contact.personalityType === "Perfil em leitura";
  const hasNoSignals = !contact.tags.length && !contact.interests.length;
  const hasSyntheticSummary = contact.lastInteractionSummary === "Sem mensagens ainda.";
  const hasNoHistory = contact.conversationHistory.length === 0;
  const hasOnlyAssistantSeed =
    contact.conversationHistory.length === 1 &&
    contact.conversationHistory[0]?.sender === "assistant";

  return (
    LEGACY_PLACEHOLDER_IDS.has(contact.id) ||
    (hasGenericName &&
      hasGenericSource &&
      hasSeedProfile &&
      hasNoSignals &&
      hasSyntheticSummary &&
      (hasNoHistory || hasOnlyAssistantSeed))
  );
}

function sanitizeContacts(contacts: ContactRecord[] | undefined) {
  if (!Array.isArray(contacts)) {
    return [];
  }

  return contacts.filter((contact) => !isLegacyPlaceholderContact(contact));
}

function resolveSelectedContactId(contacts: ContactRecord[], selectedContactId?: string) {
  if (selectedContactId && contacts.some((contact) => contact.id === selectedContactId)) {
    return selectedContactId;
  }

  return contacts[0]?.id ?? "";
}

export const useFlirtStore = create<FlirtState>()(
  persist(
    (set) => ({
      contacts: seedContacts,
      selectedContactId: defaultContactId,
      hasHydrated: false,
      selectContact: (contactId) => set({ selectedContactId: contactId }),
      createContact: (name) => {
        let createdContactId = "";

        set((state) => {
          const nextContact = createBlankContact(
            state.contacts.length,
            name?.trim() || undefined,
          );
          createdContactId = nextContact.id;

          return {
            contacts: [nextContact, ...state.contacts],
            selectedContactId: nextContact.id,
          };
        });

        return createdContactId;
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
                  tags: response.contact.tags.length ? response.contact.tags : contact.tags,
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
      setHasHydrated: (value) => set({ hasHydrated: value }),
    }),
    {
      name: "flirt-ai-store",
      version: 3,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        contacts: state.contacts,
        selectedContactId: state.selectedContactId,
      }),
      merge: (persistedState, currentState) => {
        const nextState = persistedState as Partial<FlirtState> | undefined;
        const contacts = sanitizeContacts(nextState?.contacts);

        return {
          ...currentState,
          ...nextState,
          contacts,
          selectedContactId: resolveSelectedContactId(
            contacts,
            nextState?.selectedContactId,
          ),
        };
      },
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
