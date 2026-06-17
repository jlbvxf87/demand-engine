"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Loader2 } from "lucide-react";
import { Card } from "@/components/ui";
import { generateFromBrief } from "@/app/actions";

const ACCENT = "var(--color-publish)";

export default function CopyPanel() {
  const router = useRouter();
  const [brief, setBrief] = useState("");
  const [variants, setVariants] = useState(3);
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState<string | null>(null);

  // Pick up a brief handed over from Decode.
  useEffect(() => {
    try {
      const s = sessionStorage.getItem("brief:scratch");
      if (s) setBrief(s);
    } catch {}
  }, []);

  function generate() {
    if (!brief.trim()) {
      setNote("Write a brief first");
      return;
    }
    setNote(null);
    startTransition(async () => {
      const r = await generateFromBrief({ brief, variants });
      if (!r.ok) {
        setNote(r.error || "Generation failed");
        return;
      }
      try {
        sessionStorage.removeItem("brief:scratch");
      } catch {}
      router.refresh();
    });
  }

  return (
    <Card className="mb-5 p-4" accent={ACCENT}>
      <p className="text-[15px] font-bold">Generate copy</p>
      <p className="mb-3 text-[12.5px] text-[var(--color-ink-muted)]">
        Write a brief (or arrive from Decode) → original hook / bridge / CTA variations.
      </p>
      <textarea
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        rows={4}
        placeholder="Brief — angle, promise, audience, tone, offer…"
        className="w-full resize-none rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3 text-[13px] outline-none focus:border-[var(--color-publish)]"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={variants}
          onChange={(e) => setVariants(Number(e.target.value))}
          className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-2 text-[13px] font-bold outline-none"
        >
          {[2, 3, 4, 5, 6].map((n) => (
            <option key={n} value={n}>
              {n} variations
            </option>
          ))}
        </select>
        <button
          onClick={generate}
          disabled={pending}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-60"
          style={{ background: ACCENT }}
        >
          {pending ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          Generate {variants}
        </button>
      </div>
      {note && (
        <p className="mt-2 rounded-lg bg-[var(--color-warn-soft)] px-3 py-2 text-[12.5px] text-[var(--color-warn)]">
          {note}
        </p>
      )}
    </Card>
  );
}
