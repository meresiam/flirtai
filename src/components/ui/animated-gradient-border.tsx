"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type AnimationMode =
  | "auto-rotate"
  | "rotate-on-hover"
  | "stop-rotate-on-hover"
  | "static";

interface GradientColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface AnimatedGradientBorderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "className"> {
  children: React.ReactNode;
  className?: string;
  animationMode?: AnimationMode;
  animationSpeed?: number;
  gradientColors?: GradientColors;
  backgroundColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  glow?: boolean;
  glowColor?: string;
  style?: React.CSSProperties;
}

const FLIRT_RED_PALETTE: GradientColors = {
  primary: "#5c0d24",
  secondary: "#ff355d",
  accent: "#ffb3c1",
};

export function AnimatedGradientBorder({
  children,
  className,
  animationMode = "auto-rotate",
  animationSpeed = 6,
  gradientColors = FLIRT_RED_PALETTE,
  backgroundColor = "#070a12",
  borderWidth = 2,
  borderRadius = 30,
  glow = true,
  glowColor = "rgba(255, 53, 93, 0.35)",
  style,
  ...props
}: AnimatedGradientBorderProps) {
  const animationClass =
    animationMode === "auto-rotate"
      ? "gradient-border-auto"
      : animationMode === "rotate-on-hover"
        ? "gradient-border-hover"
        : animationMode === "stop-rotate-on-hover"
          ? "gradient-border-stop-hover"
          : "";

  const combinedStyle: React.CSSProperties = {
    border: `${borderWidth}px solid transparent`,
    borderRadius: `${borderRadius}px`,
    backgroundImage: `linear-gradient(${backgroundColor}, ${backgroundColor}), conic-gradient(from var(--gradient-angle, 0deg), ${gradientColors.primary} 0%, ${gradientColors.secondary} 37%, ${gradientColors.accent} 30%, ${gradientColors.secondary} 33%, ${gradientColors.primary} 40%, ${gradientColors.primary} 50%, ${gradientColors.secondary} 77%, ${gradientColors.accent} 80%, ${gradientColors.secondary} 83%, ${gradientColors.primary} 90%)`,
    backgroundClip: "padding-box, border-box",
    backgroundOrigin: "padding-box, border-box",
    boxShadow: glow ? `0 0 60px ${glowColor}, 0 0 120px ${glowColor}` : undefined,
    ["--animation-duration" as string]: `${animationSpeed}s`,
    ...style,
  };

  return (
    <div
      className={cn("gradient-border-component", animationClass, className)}
      style={combinedStyle}
      {...props}
    >
      {children}
    </div>
  );
}
