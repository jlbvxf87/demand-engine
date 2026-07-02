"use client";

import { useState } from "react";
import { Zap, Sparkles, Wand2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import DraftPanel from "./DraftPanel";
import ReplicatePanel from "./ReplicatePanel";

const ACCENT = "var(--color-publish)";

type Budget = "draft" | "motion" | "cinematic";

const BUDGETS: {
  id: Budget;
  label: string;
  cost: string;
  blurb: string;
  icon: LucideIcon;
  disabled?: boolean;
}[] = [
  { id: "draft", label: "Draft", cost: "$0.05–0.25", blurb: "Templates + captions, no AI credits", icon: Zap },
  { id: "motion", label: "Motion", cost: "$0.40–1.00", blurb: "AI motion on key scenes only", icon: Wand2 },
  { id: "cinematic", label: "Cinematic", cost: "$3–10", blurb: "Full AI video — upgrade winners", icon: Sparkles },
];

/** Video tab: pick a render budget (how cheap), not a model. */
export default function VideoPanel() {
  const [budget, setBudget] = useState<Budget>("draft");

  return (
    <div>
      <p className="mb-2 text-[13px] font-bold text-[var(--color-ink-muted)]">Render budget</p>
      <div className="mb-4 grid grid-cols-3 gap-1.5 sm:gap-2">
        {BUDGETS.map((b) => {
          const on = b.id === budget;
          return (
            <button
              key={b.id}
              onClick={() => !b.disabled && setBudget(b.id)}
              disabled={b.disabled}
              className="flex min-w-0 flex-col items-start gap-1 overflow-hidden rounded-2xl border p-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55 sm:p-3"
              style={{
                borderColor: on ? ACCENT : "var(--color-line)",
                background: on ? "var(--color-publish-soft)" : "var(--color-surface)",
              }}
            >
              {/* Selection is shown by the border + tint + accent color — no radio
                  needed, which frees room so the longest label ("Cinematic") fits. */}
              <span className="flex w-full min-w-0 items-center gap-1">
                <b.icon size={14} className="shrink-0" style={{ color: on ? ACCENT : "var(--color-ink-muted)" }} />
                <span
                  className="min-w-0 truncate text-[12px] font-bold leading-tight sm:text-[13.5px]"
                  style={{ color: on ? ACCENT : "var(--color-ink)" }}
                >
                  {b.label}
                </span>
              </span>
              <span className="text-[11px] font-bold tabular-nums text-[var(--color-ink-muted)]">{b.cost}</span>
              <span className="text-[10px] leading-tight text-[var(--color-ink-muted)] sm:text-[10.5px]">{b.blurb}</span>
            </button>
          );
        })}
      </div>

      {budget === "draft" ? (
        <DraftPanel tier="draft" />
      ) : budget === "motion" ? (
        <DraftPanel tier="motion" />
      ) : budget === "cinematic" ? (
        <ReplicatePanel />
      ) : null}
    </div>
  );
}
