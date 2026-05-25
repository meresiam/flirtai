"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type {
  CoachChatResponse,
  ContactKind,
  ContactRecord,
  ConversationMessage,
  FolderRecord,
  TagPreferenceRecord,
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

export interface CreateFolderPayload {
  name: string;
  color?: string | null;
  icon?: string | null;
  order?: number;
}

export type UpdateFolderPayload = Partial<{
  name: string;
  color: string | null;
  icon: string | null;
  order: number;
}>;

interface FlirtState {
  contacts: ContactRecord[];
  selectedContactId: string;
  hasHydrated: boolean;
  isBootstrapping: boolean;
  bootstrapError: string | null;
  // W8 — Org & Hygiene
  folders: FolderRecord[];
  tagPreferences: TagPreferenceRecord[];
  selectedFolderId: string | null;
  showArchived: boolean;
  pendingArchiveUndo: { contactId: string; expiresAt: number } | null;

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
  // CR-01 — exige messageId do server pro <SuggestionFeedback> referenciar o
  // cuid real da Message no banco. Antes o store gerava UUID local e todo
  // POST de feedback respondia 404.
  applyCoachResponse: (
    contactId: string,
    response: CoachChatResponse & { messageId: string },
  ) => void;
  removeContact: (contactId: string) => Promise<void>;
  setHasHydrated: (value: boolean) => void;

  // W8 actions
  pinContact: (contactId: string) => Promise<void>;
  unpinContact: (contactId: string) => Promise<void>;
  archiveContact: (contactId: string) => Promise<void>;
  restoreContact: (contactId: string) => Promise<void>;
  moveContactToFolder: (
    contactId: string,
    folderId: string | null,
  ) => Promise<void>;
  createFolder: (payload: CreateFolderPayload) => Promise<FolderRecord | null>;
  updateFolder: (
    folderId: string,
    patch: UpdateFolderPayload,
  ) => Promise<FolderRecord | null>;
  deleteFolder: (folderId: string) => Promise<void>;
  selectFolder: (folderId: string | null) => void;
  toggleArchivedView: () => void;
  setTagPreference: (label: string, color: string) => Promise<void>;
  removeTagPreference: (label: string) => Promise<void>;
  markMessageSentIrl: (messageId: string, sent: boolean) => Promise<void>;
  clearArchiveUndo: () => void;
}

function moveContactToTop(contacts: ContactRecord[], contactId: string) {
  const selected = contacts.find((contact) => contact.id === contactId);
  const others = contacts.filter((contact) => contact.id !== contactId);
  return selected ? [selected, ...others] : contacts;
}

function resolveSelectedContactId(contacts: ContactRecord[], current?: string) {
  // W8 — só seleciona contato não arquivado.
  const active = contacts.filter((c) => !c.archivedAt);
  if (current && active.some((contact) => contact.id === current)) {
    return current;
  }
  return active[0]?.id ?? "";
}

function replaceContactInList(
  contacts: ContactRecord[],
  contactId: string,
  updater: (c: ContactRecord) => ContactRecord,
): ContactRecord[] {
  return contacts.map((c) => (c.id === contactId ? updater(c) : c));
}

export const useFlirtStore = create<FlirtState>()(
  persist(
    (set, get) => ({
      contacts: [],
      selectedContactId: "",
      hasHydrated: false,
      isBootstrapping: false,
      bootstrapError: null,
      folders: [],
      tagPreferences: [],
      selectedFolderId: null,
      showArchived: false,
      pendingArchiveUndo: null,

      bootstrap: async () => {
        if (get().isBootstrapping) return;
        set({ isBootstrapping: true, bootstrapError: null });
        try {
          // W8 — carrega contacts + folders + tagPreferences em paralelo.
          // /api/contacts?include=messages mantém shape pré-W8 + novos campos.
          const [contactsRes, foldersRes, tagPrefsRes] = await Promise.all([
            fetch("/api/contacts?include=messages", { cache: "no-store" }),
            fetch("/api/folders", { cache: "no-store" }),
            fetch("/api/tag-preferences", { cache: "no-store" }),
          ]);

          if (contactsRes.status === 401) {
            if (typeof window !== "undefined") {
              window.location.href = "/login";
            }
            set({ isBootstrapping: false });
            return;
          }
          if (!contactsRes.ok) {
            throw new Error("Não consegui carregar suas conversas.");
          }

          const contactsData = (await contactsRes.json()) as {
            contacts: ContactRecord[];
          };
          const foldersData = foldersRes.ok
            ? ((await foldersRes.json()) as { folders: FolderRecord[] })
            : { folders: [] };
          const tagPrefsData = tagPrefsRes.ok
            ? ((await tagPrefsRes.json()) as {
                tagPreferences: TagPreferenceRecord[];
              })
            : { tagPreferences: [] };

          set((state) => ({
            contacts: contactsData.contacts,
            folders: foldersData.folders,
            tagPreferences: tagPrefsData.tagPreferences,
            selectedContactId: resolveSelectedContactId(
              contactsData.contacts,
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
            // CR-01 — usa o cuid real do DB (vem no evento "done" do SSE).
            // Sem isso, o POST de /api/me/profile/feedback respondia 404
            // pois o id local não casava com Message.id no banco.
            id: response.messageId,
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
                  tags: response.contact.tags?.length
                    ? response.contact.tags
                    : contact.tags,
                  interests: response.contact.interests?.length
                    ? response.contact.interests
                    : contact.interests,
                  personalityType:
                    response.contact.personalityType ?? contact.personalityType,
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

      // ────────────────────────────────────────────────
      // W8 — Org & Hygiene
      // ────────────────────────────────────────────────

      pinContact: async (contactId) => {
        const before = get().contacts;
        const nowIso = new Date().toISOString();
        set((state) => ({
          contacts: replaceContactInList(state.contacts, contactId, (c) => ({
            ...c,
            pinnedAt: nowIso,
          })),
        }));
        try {
          const res = await fetch(`/api/contacts/${contactId}/pin`, {
            method: "POST",
          });
          if (!res.ok) {
            // Rollback no client; UI decide se mostra toast (ex: PINNED_CAP).
            set({ contacts: before });
          } else {
            const { contact } = (await res.json()) as { contact: ContactRecord };
            set((state) => ({
              contacts: replaceContactInList(state.contacts, contactId, (c) => ({
                ...c,
                ...contact,
              })),
            }));
          }
        } catch {
          set({ contacts: before });
        }
      },

      unpinContact: async (contactId) => {
        const before = get().contacts;
        set((state) => ({
          contacts: replaceContactInList(state.contacts, contactId, (c) => ({
            ...c,
            pinnedAt: null,
          })),
        }));
        try {
          const res = await fetch(`/api/contacts/${contactId}/pin`, {
            method: "DELETE",
          });
          if (!res.ok) {
            set({ contacts: before });
          }
        } catch {
          set({ contacts: before });
        }
      },

      archiveContact: async (contactId) => {
        const before = get().contacts;
        const nowIso = new Date().toISOString();
        set((state) => {
          const nextContacts = replaceContactInList(state.contacts, contactId, (c) => ({
            ...c,
            archivedAt: nowIso,
            pinnedAt: null,
          }));
          const nextSelectedId =
            state.selectedContactId === contactId
              ? resolveSelectedContactId(nextContacts)
              : state.selectedContactId;
          return {
            contacts: nextContacts,
            selectedContactId: nextSelectedId,
            pendingArchiveUndo: {
              contactId,
              expiresAt: Date.now() + 10_000,
            },
          };
        });
        try {
          const res = await fetch(`/api/contacts/${contactId}/archive`, {
            method: "POST",
          });
          if (!res.ok) {
            set({ contacts: before, pendingArchiveUndo: null });
          }
        } catch {
          set({ contacts: before, pendingArchiveUndo: null });
        }
      },

      restoreContact: async (contactId) => {
        const before = get().contacts;
        set((state) => ({
          contacts: replaceContactInList(state.contacts, contactId, (c) => ({
            ...c,
            archivedAt: null,
          })),
          pendingArchiveUndo:
            state.pendingArchiveUndo?.contactId === contactId
              ? null
              : state.pendingArchiveUndo,
        }));
        try {
          const res = await fetch(`/api/contacts/${contactId}/archive`, {
            method: "DELETE",
          });
          if (!res.ok) {
            set({ contacts: before });
          }
        } catch {
          set({ contacts: before });
        }
      },

      moveContactToFolder: async (contactId, folderId) => {
        const before = get().contacts;
        set((state) => ({
          contacts: replaceContactInList(state.contacts, contactId, (c) => ({
            ...c,
            folderId,
          })),
        }));
        try {
          const res = await fetch(`/api/contacts/${contactId}/folder`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folderId }),
          });
          if (!res.ok) {
            set({ contacts: before });
          }
        } catch {
          set({ contacts: before });
        }
      },

      createFolder: async (payload) => {
        try {
          const res = await fetch("/api/folders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) return null;
          const { folder } = (await res.json()) as { folder: FolderRecord };
          set((state) => ({ folders: [...state.folders, folder] }));
          return folder;
        } catch {
          return null;
        }
      },

      updateFolder: async (folderId, patch) => {
        const before = get().folders;
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === folderId ? { ...f, ...patch } : f,
          ),
        }));
        try {
          const res = await fetch(`/api/folders/${folderId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          });
          if (!res.ok) {
            set({ folders: before });
            return null;
          }
          const { folder } = (await res.json()) as { folder: FolderRecord };
          set((state) => ({
            folders: state.folders.map((f) => (f.id === folderId ? folder : f)),
          }));
          return folder;
        } catch {
          set({ folders: before });
          return null;
        }
      },

      deleteFolder: async (folderId) => {
        const before = get().folders;
        const beforeContacts = get().contacts;
        set((state) => ({
          folders: state.folders.filter((f) => f.id !== folderId),
          contacts: state.contacts.map((c) =>
            c.folderId === folderId ? { ...c, folderId: null } : c,
          ),
          selectedFolderId:
            state.selectedFolderId === folderId ? null : state.selectedFolderId,
        }));
        try {
          const res = await fetch(`/api/folders/${folderId}`, {
            method: "DELETE",
          });
          if (!res.ok) {
            set({ folders: before, contacts: beforeContacts });
          }
        } catch {
          set({ folders: before, contacts: beforeContacts });
        }
      },

      selectFolder: (folderId) => set({ selectedFolderId: folderId }),

      toggleArchivedView: () =>
        set((state) => ({ showArchived: !state.showArchived })),

      setTagPreference: async (label, color) => {
        const before = get().tagPreferences;
        set((state) => {
          const existing = state.tagPreferences.find((tp) => tp.label === label);
          return {
            tagPreferences: existing
              ? state.tagPreferences.map((tp) =>
                  tp.label === label ? { label, color } : tp,
                )
              : [...state.tagPreferences, { label, color }],
          };
        });
        try {
          const res = await fetch("/api/tag-preferences", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label, color }),
          });
          if (!res.ok) {
            set({ tagPreferences: before });
          }
        } catch {
          set({ tagPreferences: before });
        }
      },

      removeTagPreference: async (label) => {
        const before = get().tagPreferences;
        set((state) => ({
          tagPreferences: state.tagPreferences.filter((tp) => tp.label !== label),
        }));
        try {
          const res = await fetch(
            `/api/tag-preferences/${encodeURIComponent(label)}`,
            { method: "DELETE" },
          );
          if (!res.ok) {
            set({ tagPreferences: before });
          }
        } catch {
          set({ tagPreferences: before });
        }
      },

      markMessageSentIrl: async (messageId, sent) => {
        const before = get().contacts;
        const nowIso = new Date().toISOString();
        // Optimistic — atualiza msg em qualquer contato que contenha o id.
        set((state) => ({
          contacts: state.contacts.map((c) => ({
            ...c,
            conversationHistory: c.conversationHistory.map((m) =>
              m.id === messageId
                ? { ...m, sentIrlAt: sent ? nowIso : null }
                : m,
            ),
          })),
        }));
        try {
          const res = await fetch(`/api/messages/${messageId}/sent-irl`, {
            method: sent ? "POST" : "DELETE",
          });
          if (!res.ok) {
            set({ contacts: before });
          }
        } catch {
          set({ contacts: before });
        }
      },

      clearArchiveUndo: () => set({ pendingArchiveUndo: null }),
    }),
    {
      name: "flirt-ai-store",
      version: 8,
      skipHydration: true,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        contacts: state.contacts,
        selectedContactId: state.selectedContactId,
        folders: state.folders,
        tagPreferences: state.tagPreferences,
        selectedFolderId: state.selectedFolderId,
        showArchived: state.showArchived,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);
