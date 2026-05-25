export type ContactStatus = "active" | "cold" | "hot_lead";

export type ContactKind = "desenrolo" | "agent_chat";

export type AttractionLevel = "Low" | "Medium" | "High";

export type MessageSender = "user" | "assistant" | "contact";

export type CoachInputMode = "incoming" | "strategy";

export type RiskLevel = "Safe" | "Risky" | "High-risk";

export type ReplyTone = "playful" | "confident" | "intriguing" | "direct";

export interface ReplySuggestion {
  tone: ReplyTone;
  text: string;
  why: string;
  risk: RiskLevel;
  likelyResponse: string;
}

export interface MessageInsight {
  interestLevel: AttractionLevel;
  read: string;
  move: string;
  avoid: string;
}

export interface ConversationMessage {
  id: string;
  sender: MessageSender;
  content: string;
  timestamp: string;
  suggestions?: ReplySuggestion[];
  insight?: MessageInsight;
  // W8 — ISO date string quando o user marca "enviei essa no IG/WA real".
  // null/undefined = não enviado IRL ainda. Só faz sentido pra sender === "user".
  sentIrlAt?: string | null;
}

// W8 — Pastas de organização de contatos na sidebar.
export interface FolderRecord {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

// W8 — Mapa user-curado label→cor pra tags. Tags continuam em Contact.tags[];
// esta tabela só define a cor de exibição (sem entrada = chip neutro).
export interface TagPreferenceRecord {
  label: string;
  color: string;
}

export interface CoachGuidance {
  suggestions: ReplySuggestion[];
  strategyExplanation: string;
  psychologicalTrigger: string;
  avoid: string;
  nextMove: string;
  risk: RiskLevel;
  interestLevel: AttractionLevel;
  coachNotes: string[];
}

export interface InstagramSimulation {
  archetype: string;
  lifestyleIndicators: string[];
  communicationStyle: string;
  values: string[];
  bestApproach: string;
}

export type RatingDimension =
  | "beleza"
  | "inteligencia"
  | "lealdade"
  | "respeito"
  | "vestimenta";

export const RATING_DIMENSIONS: RatingDimension[] = [
  "beleza",
  "inteligencia",
  "lealdade",
  "respeito",
  "vestimenta",
];

export const RATING_LABELS: Record<RatingDimension, string> = {
  beleza: "Beleza",
  inteligencia: "Inteligência",
  lealdade: "Lealdade",
  respeito: "Respeito",
  vestimenta: "Vestimenta",
};

export type ContactRatings = Record<RatingDimension, number | null>;

export interface ContactRecord {
  id: string;
  kind: ContactKind;
  name: string;
  source: string;
  avatar: string;
  status: ContactStatus;
  attractionLevel: AttractionLevel;
  personalityType: string;
  interests: string[];
  tags: string[];
  greenFlags: string[];
  redFlags: string[];
  lastInteractionSummary: string;
  ratings: ContactRatings;
  padrao: number | null;
  location: string | null;
  metContext: string | null;
  notes: string | null;
  conversationHistory: ConversationMessage[];
  updatedAt: string;
  // W8 — Org & Hygiene
  pinnedAt: string | null;
  archivedAt: string | null;
  folderId: string | null;
}

export interface CoachRequest {
  contact: Pick<
    ContactRecord,
    | "name"
    | "source"
    | "status"
    | "attractionLevel"
    | "personalityType"
    | "interests"
    | "tags"
    | "lastInteractionSummary"
  >;
  prompt: string;
  mode: CoachInputMode;
  conversationHistory: ConversationMessage[];
}

export interface CoachChatResponse {
  assistantMessage: string;
  suggestions: ReplySuggestion[];
  insight: MessageInsight;
  contact: Pick<
    ContactRecord,
    "name" | "source" | "status" | "attractionLevel" | "lastInteractionSummary"
  > &
    Partial<Pick<ContactRecord, "personalityType" | "interests" | "tags">>;
}

// W7 — Diário de Campo (EncounterLog).
// Shape do extracted Json + record serializado pro front.
export type EncounterEscalation =
  | "regrediu"
  | "estagnou"
  | "avancou"
  | "indefinido";

export type EncounterMood =
  | "leve"
  | "tenso"
  | "intenso"
  | "frustrante"
  | "neutro";

export type EncounterAttractionDelta = "down" | "same" | "up";

export interface EncounterExtractPayload {
  summary: string;
  escalation: EncounterEscalation;
  mood: EncounterMood;
  nextMove: string;
  attractionDelta: EncounterAttractionDelta;
  greenFlags: string[];
  redFlags: string[];
  userRedPatterns: string[];
  degraded?: boolean;
}

export interface EncounterRecord {
  id: string;
  contactId: string;
  happenedAt: string; // ISO
  createdAt: string;  // ISO
  rawText: string;
  extracted: EncounterExtractPayload;
}
