import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Card, Badge, StatusChip, type StationStatus } from "@/components/ui";

type Station = {
  n: number;
  stage: string;
  href: string;
  title: string;
  desc: string;
  status: StationStatus;
  accent: string;
  soft: string;
};

const STATIONS: Station[] = [
  {
    n: 1,
    stage: "source",
    href: "/source",
    title: "Source",
    desc: "Find proven ads by advertiser, creative, or identity.",
    status: "ready",
    accent: "var(--color-source)",
    soft: "var(--color-source-soft)",
  },
  {
    n: 2,
    stage: "decode",
    href: "/decode",
    title: "Decode",
    desc: "Extract hook, trigger, visual mechanic, offer, CTA.",
    status: "ready",
    accent: "var(--color-decode)",
    soft: "var(--color-decode-soft)",
  },
  {
    n: 3,
    stage: "rebuild",
    href: "/rebuild",
    title: "Rebuild",
    desc: "Generate on-brand hook/bridge/CTA and T2V variants.",
    status: "built",
    accent: "var(--color-rebuild)",
    soft: "var(--color-rebuild-soft)",
  },
  {
    n: 4,
    stage: "publish",
    href: "/publish",
    title: "Publish",
    desc: "Export or push live, capture performance, rank winners.",
    status: "review",
    accent: "var(--color-publish)",
    soft: "var(--color-publish-soft)",
  },
];

function Stepper() {
  return (
    <div className="mb-6 flex items-center justify-between px-1">
      {STATIONS.map((s, i) => (
        <div key={s.stage} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <span
              className="grid h-7 w-7 place-items-center rounded-full text-[12px] font-bold"
              style={{
                background: i === 0 ? s.accent : s.soft,
                color: i === 0 ? "#fff" : s.accent,
              }}
            >
              {s.n}
            </span>
            <span
              className="text-[12px] font-semibold"
              style={{ color: i === 0 ? s.accent : "var(--color-ink-muted)" }}
            >
              {s.title}
            </span>
          </div>
          {i < STATIONS.length - 1 && (
            <span className="mx-1 mb-5 h-px flex-1 bg-[var(--color-line)]" />
          )}
        </div>
      ))}
    </div>
  );
}

export default function HomePage() {
  return (
    <div>
      <h1 className="text-[28px] font-extrabold leading-tight tracking-tight md:text-[34px]">
        Creative Factory
      </h1>
      <p className="mb-6 mt-1 text-[14px] text-[var(--color-ink-muted)]">
        Find winners. Decode why. Rebuild. Publish to test.
      </p>

      <Stepper />

      {/* Factory line summary */}
      <Card className="mb-5 p-5" accent="var(--color-source)">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-source-soft)] text-[var(--color-source)]">
            <ArrowRight size={18} strokeWidth={2.5} />
          </div>
          <p className="text-[15px] font-bold">Factory Line</p>
        </div>
        <p className="mt-2 text-[13.5px] text-[var(--color-ink-muted)]">
          One clean path: winning ads in → tested creative out.
        </p>
        <p className="mt-3 text-[15px] font-bold tracking-tight">
          Source <span className="text-[var(--color-ink-muted)]">→</span> Decode{" "}
          <span className="text-[var(--color-ink-muted)]">→</span> Rebuild{" "}
          <span className="text-[var(--color-ink-muted)]">→</span> Publish
        </p>
        <div className="mt-3 flex gap-2">
          <Badge tone="source">KISS mode</Badge>
          <Badge tone="rebuild">4 stations</Badge>
        </div>
      </Card>

      {/* Station cards */}
      <div className="flex flex-col gap-3">
        {STATIONS.map((s) => (
          <Link key={s.stage} href={s.href} className="block">
            <Card className="flex items-center gap-3 p-4 transition-shadow hover:shadow-[0_4px_16px_rgba(16,27,22,0.08)]">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[15px] font-extrabold"
                style={{ background: s.soft, color: s.accent }}
              >
                {s.n}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[15.5px] font-bold">{s.title}</p>
                  <StatusChip status={s.status} />
                </div>
                <p className="mt-0.5 truncate text-[13px] text-[var(--color-ink-muted)]">
                  {s.desc}
                </p>
              </div>
              <ArrowRight
                size={18}
                className="shrink-0"
                style={{ color: s.accent }}
              />
            </Card>
          </Link>
        ))}
      </div>

      {/* Optional lane */}
      <Card className="mt-5 border-dashed p-5">
        <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--color-ink-muted)]">
          Optional lane
        </p>
        <p className="mt-1 text-[18px] font-extrabold tracking-tight">
          Landing Page Intel
        </p>
        <p className="mt-1 text-[13.5px] text-[var(--color-ink-muted)]">
          Use the destination page for research or build a buy page separately.
        </p>
        <Badge tone="neutral" className="mt-3">
          Not required to test creative
        </Badge>
      </Card>

      {/* Primary CTA */}
      <Link
        href="/source"
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-source)] px-5 py-4 text-[16px] font-bold text-white active:scale-[0.99]"
      >
        Start at Source
        <ArrowRight size={18} strokeWidth={2.5} />
      </Link>
    </div>
  );
}
