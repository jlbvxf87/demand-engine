import { Home, Search, Diamond, PenLine, Play } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type Stage = "home" | "source" | "decode" | "rebuild" | "publish";

export type NavItem = {
  stage: Stage;
  label: string;
  href: string;
  icon: LucideIcon;
  /** CSS var name for this stage's accent */
  accent: string;
  accentSoft: string;
};

export const NAV: NavItem[] = [
  {
    stage: "home",
    label: "Home",
    href: "/",
    icon: Home,
    accent: "var(--color-source)",
    accentSoft: "var(--color-source-soft)",
  },
  {
    stage: "source",
    label: "Source",
    href: "/source",
    icon: Search,
    accent: "var(--color-source)",
    accentSoft: "var(--color-source-soft)",
  },
  {
    stage: "decode",
    label: "Decode",
    href: "/decode",
    icon: Diamond,
    accent: "var(--color-decode)",
    accentSoft: "var(--color-decode-soft)",
  },
  {
    stage: "rebuild",
    label: "Rebuild",
    href: "/rebuild",
    icon: PenLine,
    accent: "var(--color-rebuild)",
    accentSoft: "var(--color-rebuild-soft)",
  },
  {
    stage: "publish",
    label: "Publish",
    href: "/publish",
    icon: Play,
    accent: "var(--color-publish)",
    accentSoft: "var(--color-publish-soft)",
  },
];

export const STAGE_ACCENT: Record<Stage, { accent: string; soft: string }> = {
  home: { accent: "var(--color-source)", soft: "var(--color-source-soft)" },
  source: { accent: "var(--color-source)", soft: "var(--color-source-soft)" },
  decode: { accent: "var(--color-decode)", soft: "var(--color-decode-soft)" },
  rebuild: { accent: "var(--color-rebuild)", soft: "var(--color-rebuild-soft)" },
  publish: { accent: "var(--color-publish)", soft: "var(--color-publish-soft)" },
};
