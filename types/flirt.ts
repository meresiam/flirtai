export type ContactStatus = "active" | "cold" | "hot lead";

export type AttractionLevel = "Low" | "Medium" | "High";

export type MessageSender = "user" | "assistant" | "contact";

export type CoachInputMode = "incoming" | "strategy";

export type RiskLevel = "Safe" | "Risky" | "High-risk";

export type ReplyTone = "playful" | "confident" | "intriguing" | "direct";

export interface ReplySuggestion {
  tone: ReplyTone;
  text: string;
  why: string;
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

export interface ContactRecord {
  id: string;
  name: string;
  source: string;
  avatar: string;
  status: ContactStatus;
  attractionLevel: AttractionLevel;
  personalityType: string;
  interests: string[];
  tags: string[];
  lastInteractionSummary: string;
  conversationHistory: ConversationMessage[];
  updatedAt: string;
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
    | "name"
    | "source"
    | "status"
    | "attractionLevel"
    | "personalityType"
    | "interests"
    | "tags"
    | "lastInteractionSummary"
  >;
}
