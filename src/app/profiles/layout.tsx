import type { ReactNode } from "react";

// Layout wrapper pra /profiles/** — sem lógica extra no MVP.
// O TooltipProvider é adicionado em src/app/layout.tsx (raiz).
export default function ProfilesLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
