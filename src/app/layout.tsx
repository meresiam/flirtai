import type { Metadata } from "next";
import { Space_Grotesk, Sora } from "next/font/google";

import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sans",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "Flirt.ai",
  description:
    "Wingman de IA premium para estratégia de conversa, leitura de atração e comunicação ética em relacionamentos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={cn("dark font-sans", sora.variable, spaceGrotesk.variable)}
    >
      <body>
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  );
}
