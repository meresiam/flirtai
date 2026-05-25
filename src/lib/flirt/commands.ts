import type { CoachInputMode } from "@/types/flirt";

export type CommandIconName = "plus" | "sparkles" | "user" | "arrow-up";

export interface CoachCommand {
  prefix: string;
  label: string;
  description: string;
  iconName: CommandIconName;
  modeOverride?: CoachInputMode;
  defaultPrompt?: string;
}

export const COACH_COMMANDS: CoachCommand[] = [
  {
    prefix: "/nova",
    label: "Nova aba",
    description: "Cria uma nova mulher no histórico",
    iconName: "plus",
  },
  {
    prefix: "/resposta",
    label: "Melhor resposta",
    description: "Gera respostas prontas para enviar",
    iconName: "sparkles",
    defaultPrompt: "Me dá a melhor resposta para isso.",
  },
  {
    prefix: "/perfil",
    label: "Extrair perfil",
    description: "Atualiza o perfil dela no histórico",
    iconName: "user",
    modeOverride: "strategy",
    defaultPrompt: "Atualiza o perfil dela com base no contexto.",
  },
  {
    prefix: "/encontro",
    label: "Puxar encontro",
    description: "Move a conversa para algo real",
    iconName: "arrow-up",
    modeOverride: "strategy",
    defaultPrompt: "Quero puxar a conversa para encontro sem parecer afobado.",
  },
];

export interface ParsedCommand {
  command: string | null;
  mode: CoachInputMode;
  cleanPrompt: string;
  displayPrompt: string;
}

export function parseCoachCommand(value: string): ParsedCommand {
  const known = COACH_COMMANDS.find((cmd) => value.startsWith(cmd.prefix));
  if (!known) {
    return {
      command: null,
      mode: "incoming",
      cleanPrompt: value,
      displayPrompt: value,
    };
  }
  const cleanPrompt = value.replace(known.prefix, "").trim();
  return {
    command: known.prefix,
    mode: known.modeOverride ?? "incoming",
    cleanPrompt,
    displayPrompt: cleanPrompt || known.defaultPrompt || value,
  };
}
