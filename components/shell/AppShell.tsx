"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import Logo from "./Logo";
import { NAV } from "./nav";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/";

  return (
    <div className="min-h-dvh w-full md:flex">
      {/* ── Desktop side rail ───────────────────────────────────────────── */}
      <aside className="hidden md:flex md:w-[240px] md:flex-col md:fixed md:inset-y-0 md:border-r md:border-[var(--color-line)] md:bg-[var(--color-surface)] md:px-4 md:py-5">
        <div className="flex items-center gap-2 px-2 pb-6">
          <Logo size={24} />
          <span className="text-[17px] font-extrabold tracking-tight">
            Demand Engine
          </span>
        </div>

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.stage}
                href={item.href}
                className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors"
                style={{
                  background: active ? item.accentSoft : "transparent",
                  color: active ? item.accent : "var(--color-ink-muted)",
                }}
              >
                <Icon size={19} strokeWidth={active ? 2.4 : 2} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex items-center justify-between rounded-xl border border-[var(--color-line)] px-3 py-2">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[var(--color-ink-muted)]">
            <span className="inline-block h-2 w-2 rounded-full bg-[var(--color-source)]" />
            Creative Factory
          </div>
          <span className="grid h-7 w-7 place-items-center rounded-full bg-[var(--color-source-soft)] text-[12px] font-bold text-[var(--color-source)]">
            JB
          </span>
        </div>
      </aside>

      {/* ── Main column ─────────────────────────────────────────────────── */}
      <div className="flex min-h-dvh w-full flex-col md:pl-[240px]">
        {/* Mobile header */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[var(--color-line)] bg-[var(--color-canvas)]/90 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center gap-2">
            <Logo size={22} />
            <span className="text-[16px] font-extrabold tracking-tight">
              Demand Engine
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1 rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-1.5 text-[12px] font-semibold text-[var(--color-ink)]">
              Creative Factory
              <ChevronDown size={13} className="text-[var(--color-ink-muted)]" />
            </button>
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--color-source-soft)] text-[12px] font-bold text-[var(--color-source)]">
              JB
            </span>
          </div>
        </header>

        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pb-28 pt-4 md:max-w-3xl md:px-8 md:pb-12 md:pt-8">
          {children}
        </main>
      </div>

      {/* ── Mobile bottom nav ───────────────────────────────────────────── */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-[var(--color-line)] bg-[var(--color-surface)]/95 pb-[max(0.4rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.stage}
              href={item.href}
              className="flex flex-1 flex-col items-center gap-1 py-1"
              style={{ color: active ? item.accent : "var(--color-ink-muted)" }}
            >
              <Icon size={21} strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10.5px] font-semibold">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
