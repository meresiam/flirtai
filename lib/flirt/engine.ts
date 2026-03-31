import type {
  AttractionLevel,
  CoachGuidance,
  CoachInputMode,
  CoachRequest,
  InstagramSimulation,
  ReplySuggestion,
  ReplyTone,
  RiskLevel,
} from "@/types/flirt";

const archetypes = [
  "Warm social curator",
  "Grounded creative",
  "Playful adventurer",
  "Quiet high-achiever",
  "Romantic minimalist",
  "Magnetic extrovert",
];

const lifestyleSignals = [
  ["boutique coffee spots", "weekend city escapes", "well-composed photos"],
  ["pilates energy", "healthy routines", "intentional downtime"],
  ["gallery nights", "curated playlists", "thoughtful aesthetics"],
  ["group dinners", "celebration moments", "social confidence"],
  ["fitness rhythm", "travel curiosity", "friends-first warmth"],
  ["fashion-forward choices", "high standards", "selective availability"],
];

const communicationStyles = [
  "Responds best to concise, self-assured energy with room for play.",
  "Likes warmth and specifics more than vague flirting.",
  "Engages when the tone feels effortless, observant, and socially aware.",
  "Prefers calm confidence over hype or over-texting.",
  "Rewards grounded humor and emotional presence.",
  "Leans toward directness when attraction feels safe and mutual.",
];

const valueSignals = [
  ["clarity", "taste", "consistency"],
  ["humor", "confidence", "presence"],
  ["ambition", "emotional steadiness", "initiative"],
  ["curiosity", "lightness", "good timing"],
  ["self-respect", "intentionality", "chemistry"],
  ["authenticity", "adventure", "social intuition"],
];

const bestApproaches = [
  "Lead with calm confidence, mirror her tempo, and offer one concrete next step.",
  "Use light teasing, then anchor it with a clear plan instead of long texting loops.",
  "Show taste and attention to detail without sounding overly rehearsed.",
  "Keep your replies shorter than your instinct when the energy feels uncertain.",
  "Match warmth with warmth, but avoid trying to win her over with volume.",
  "Let curiosity breathe. Good pacing is more attractive than constant availability.",
];

const toneLabels: ReplyTone[] = ["playful", "confident", "intriguing", "direct"];

function hashSeed(input: string) {
  return Array.from(input).reduce((acc, char) => acc + char.charCodeAt(0), 0);
}

function detectTopic(prompt: string, interests: string[]) {
  const lowered = prompt.toLowerCase();
  const knownTopics = [
    "coffee",
    "drinks",
    "dinner",
    "music",
    "travel",
    "weekend",
    "gym",
    "dog",
    "movie",
    "work",
    "plans",
  ];

  const fromPrompt = knownTopics.find((topic) => lowered.includes(topic));
  if (fromPrompt) {
    return fromPrompt;
  }

  return interests[0]?.toLowerCase() ?? "plans";
}

function detectInterestLevel(prompt: string): AttractionLevel {
  const lowered = prompt.toLowerCase();
  let score = 0;

  if (/[?]/.test(prompt)) score += 2;
  if (/(haha|lol|lmao|😂|😄|😉|can't wait|sounds fun|would love|when are you free)/.test(lowered)) {
    score += 2;
  }
  if (/(busy|maybe|not sure|later|can't|tired|sorry|another time|rain check)/.test(lowered)) {
    score -= 2;
  }
  if (prompt.trim().length > 60) score += 1;

  if (score >= 3) return "High";
  if (score >= 1) return "Medium";
  return "Low";
}

function detectRisk(prompt: string, mode: CoachInputMode): RiskLevel {
  const lowered = prompt.toLowerCase();

  if (/(stop|leave me alone|not interested|busy|another time|maybe later|can't talk)/.test(lowered)) {
    return "High-risk";
  }

  if (mode === "strategy" || prompt.trim().length < 18 || /(k|ok|sure|maybe)/.test(lowered)) {
    return "Risky";
  }

  return "Safe";
}

function buildSuggestion(
  tone: ReplyTone,
  topic: string,
  risk: RiskLevel,
  interestLevel: AttractionLevel,
  name: string,
): ReplySuggestion {
  const subject = topic === "plans" ? "something fun" : topic;

  if (risk === "High-risk") {
    const texts: Record<ReplyTone, string> = {
      playful: `No stress, ${name.split(" ")[0]}. Go handle your world and we can pick this back up when it feels easy.`,
      confident: "All good. I like keeping this low-pressure, so I’ll give you space and let the energy come back naturally.",
      intriguing: "You seem busy, so I’m not going to crowd your phone. Come find me when you’ve got bandwidth again.",
      direct: "No pressure at all. If you want to keep talking later, I’m open.",
    };

    return {
      tone,
      text: texts[tone],
      why: "This protects your self-respect and keeps the interaction pressure-free.",
    };
  }

  const openings: Record<ReplyTone, string> = {
    playful: `You only bring this energy when you want to cause a little trouble around ${subject}.`,
    confident:
      interestLevel === "High"
        ? `I like this vibe. Let’s stop circling ${subject} and make a real plan this week.`
        : `I’m into the energy. Let’s keep it simple and see where ${subject} takes us.`,
    intriguing: `You’ve got just enough mystery in that message to make ${subject} more interesting.`,
    direct:
      interestLevel === "High"
        ? `Let’s turn this into something real. I’m free later this week if you are.`
        : `We can keep texting, but I’d rather make this feel real with one easy plan.`,
  };

  return {
    tone,
    text: openings[tone],
    why:
      tone === "playful"
        ? "Keeps the mood light while showing social confidence."
        : tone === "confident"
          ? "Moves things forward without sounding needy."
          : tone === "intriguing"
            ? "Creates curiosity and invites her to invest more."
            : "Shows clear intent and leadership while staying respectful.",
  };
}

export function simulateInstagramAnalysis(
  handle: string,
  fallbackName: string,
): InstagramSimulation {
  const seed = hashSeed(`${handle}-${fallbackName}`);
  const index = seed % archetypes.length;

  return {
    archetype: archetypes[index],
    lifestyleIndicators: lifestyleSignals[index],
    communicationStyle: communicationStyles[index],
    values: valueSignals[index],
    bestApproach: bestApproaches[index],
  };
}

export function generateCoachGuidance({
  contact,
  prompt,
  mode,
}: CoachRequest): CoachGuidance {
  const topic = detectTopic(prompt, contact.interests);
  const risk = detectRisk(prompt, mode);
  const interestLevel = detectInterestLevel(prompt);
  const suggestions = toneLabels.map((tone) =>
    buildSuggestion(tone, topic, risk, interestLevel, contact.name),
  );

  const strategyExplanation =
    risk === "High-risk"
      ? `Her message reads lower-investment right now, so the smartest move is to reduce pressure. Respectful restraint is more attractive than trying harder when the window is closed.`
      : `She is giving you enough signal to keep things moving, but the strongest play is still calibrated. Mirror her energy, reference ${topic}, and guide the conversation toward one easy next step.`;

  const psychologicalTrigger =
    risk === "High-risk"
      ? "Self-respect and emotional safety"
      : interestLevel === "High"
        ? "Calibrated confidence with specific intent"
        : "Curiosity plus low-pressure leadership";

  const avoid =
    risk === "High-risk"
      ? "Avoid double-texting, over-explaining, or asking for reassurance."
      : "Avoid paragraphs, over-chasing, or stacking multiple plans in one message.";

  const nextMove =
    risk === "High-risk"
      ? "Send one grounded message at most, then let her re-initiate."
      : interestLevel === "High"
        ? "Choose one concise reply and transition toward a real plan."
        : "Send one light reply, then pause and let her invest back.";

  return {
    suggestions,
    strategyExplanation,
    psychologicalTrigger,
    avoid,
    nextMove,
    risk,
    interestLevel,
    coachNotes: [
      "Lead with the same emotional temperature she is already giving you.",
      "Specificity beats intensity. One clear idea is better than three vague ones.",
      "If attraction looks uncertain, lower pressure instead of increasing performance.",
    ],
  };
}
