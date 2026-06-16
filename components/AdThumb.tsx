import { initials } from "@/lib/format";

/**
 * Real ad imagery: shows the crawled destination-page screenshot when present,
 * otherwise a branded initials tile. (Meta's ad_snapshot_url is a library page,
 * not an embeddable image, so it's surfaced as a "View ad" link elsewhere.)
 */
export default function AdThumb({
  src,
  name,
  size = 56,
  rounded = "rounded-xl",
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  rounded?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name || "ad creative"}
        width={size}
        height={size}
        className={`${rounded} object-cover`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className={`${rounded} grid place-items-center bg-[var(--color-surface-2)] text-[var(--color-ink-muted)]`}
      style={{ width: size, height: size }}
    >
      <span className="text-[14px] font-bold">{initials(name)}</span>
    </div>
  );
}
