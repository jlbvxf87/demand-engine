import Link from "next/link";
import { Search, ArrowRight, Sparkles } from "lucide-react";
import { Card, WinnerBadge } from "@/components/ui";
import { getHomeStats, getWinningCreatives, getGeneratedCreatives } from "@/lib/data";
import { compact, money, initials } from "@/lib/format";
import LatestVideos from "./LatestVideos";

export const dynamic = "force-dynamic";

const STAT_ACCENT = [
  "var(--color-source)",
  "var(--color-rebuild)",
  "var(--color-publish)",
  "var(--color-decode)",
];

export default async function HomePage() {
  const [stats, winners, creatives] = await Promise.all([
    getHomeStats(),
    getWinningCreatives({ limit: 6 }),
    getGeneratedCreatives(12),
  ]);
  const videos = creatives.filter((c) => c.video_url).slice(0, 6);

  const tiles = [
    { label: "Winners", value: stats.winners, href: "/source" },
    { label: "Creatives", value: stats.creatives, href: "/publish" },
    { label: "Videos", value: stats.videos, href: "/publish" },
    { label: "Stories", value: stats.stories, href: "/publish" },
  ];

  return (
    <div>
      <h1 className="text-[26px] font-extrabold leading-tight tracking-tight md:text-[30px]">
        Creative Factory
      </h1>
      <p className="mb-5 mt-1 text-[14px] text-[var(--color-ink-muted)]">
        Find winners → decode why → create → publish to test.
      </p>

      {/* Live stats */}
      <div className="mb-5 grid grid-cols-4 divide-x divide-[var(--color-line)] overflow-hidden rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[0_1px_2px_rgba(16,27,22,0.04)]">
        {tiles.map((t, i) => (
          <Link
            key={t.label}
            href={t.href}
            className="px-2 py-3.5 text-center transition-colors hover:bg-[var(--color-surface-2)]"
          >
            <p className="text-[23px] font-extrabold leading-none tabular-nums" style={{ color: STAT_ACCENT[i] }}>
              {compact(t.value)}
            </p>
            <p className="mt-1 text-[10.5px] font-semibold uppercase tracking-wide text-[var(--color-ink-muted)]">
              {t.label}
            </p>
          </Link>
        ))}
      </div>

      {/* Primary action */}
      <Link
        href="/source"
        className="mb-6 flex items-center gap-2 rounded-2xl px-4 py-3.5 text-[15px] font-bold text-white active:scale-[0.99]"
        style={{ background: "var(--color-source)" }}
      >
        <Search size={18} strokeWidth={2.4} />
        Search winning ads
        <ArrowRight size={18} strokeWidth={2.4} className="ml-auto" />
      </Link>

      {/* Top winning ads */}
      <SectionHeader title="Top winning ads" href="/source" cta="Source" />
      {winners.length === 0 ? (
        <Empty
          icon={<Search size={22} className="text-[var(--color-ink-muted)]" />}
          title="No winners yet"
          hint="Run a search in Source to surface high-performing ads."
        />
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {winners.map((w) => (
            <Link key={w.id} href={`/decode?ad=${w.id}`}>
              <Card className="overflow-hidden p-0 transition-shadow hover:shadow-[0_4px_16px_rgba(16,27,22,0.08)]">
                <div className="aspect-[4/3] w-full overflow-hidden">
                  {w.page_screenshot_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={w.page_screenshot_url}
                      alt={w.page_name || "ad"}
                      className="h-full w-full object-cover object-top"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-[var(--color-accent-soft)] to-[var(--color-surface-2)]">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-[16px] font-extrabold text-[var(--color-accent)] shadow-sm">
                        {initials(w.page_name)}
                      </span>
                      <span className="text-[10px] font-semibold text-[var(--color-ink-muted)]">
                        Decode for preview
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="truncate text-[12.5px] font-bold">{w.page_name || "Unknown"}</p>
                  <div className="mt-1 flex items-center justify-between gap-1">
                    <WinnerBadge badge={w.badge} />
                    <span className="text-[11px] font-bold tabular-nums" style={{ color: "var(--color-source)" }}>
                      {Math.round(w.winner_score)}
                    </span>
                  </div>
                  <p className="mt-1 text-[10.5px] text-[var(--color-ink-muted)]">
                    {w.days_running}d running
                    {money(w.spend_lower, w.spend_upper) !== "—" ? ` · ${money(w.spend_lower, w.spend_upper)}` : ""}
                  </p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Latest videos — open a player in place */}
      <SectionHeader title="Latest videos" href="/publish" cta="Create" />
      {videos.length === 0 ? (
        <Empty
          icon={<Sparkles size={22} className="text-[var(--color-ink-muted)]" />}
          title="No videos yet"
          hint="Generate creatives in Create (Replicate or Multi-scene)."
        />
      ) : (
        <LatestVideos
          videos={videos.map((v) => ({
            id: v.id,
            video_url: v.video_url,
            video_provider: v.video_provider,
            hook_text: v.hook_text,
          }))}
        />
      )}
    </div>
  );
}

function SectionHeader({ title, href, cta }: { title: string; href: string; cta: string }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <h2 className="text-[16px] font-bold tracking-tight">{title}</h2>
      <Link href={href} className="text-[12.5px] font-semibold text-[var(--color-ink-muted)]">
        {cta} →
      </Link>
    </div>
  );
}

function Empty({ icon, title, hint }: { icon: React.ReactNode; title: string; hint: string }) {
  return (
    <div className="mb-6 flex flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-10 text-center">
      {icon}
      <p className="text-[14px] font-semibold">{title}</p>
      <p className="max-w-xs text-[12.5px] text-[var(--color-ink-muted)]">{hint}</p>
    </div>
  );
}
