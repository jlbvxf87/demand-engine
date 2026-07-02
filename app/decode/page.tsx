import { getAdDetail, getScaledWinners } from "@/lib/data";
import DecodeClient from "./DecodeClient";

export const dynamic = "force-dynamic";

export default async function DecodePage({
  searchParams,
}: {
  searchParams: Promise<{ ad?: string }>;
}) {
  const { ad: adId } = await searchParams;
  const { ad, patterns } = adId
    ? await getAdDetail(adId)
    : { ad: null, patterns: [] };

  // In standalone mode (no ad picked), offer proven winners to decode in one click.
  const winners = adId ? [] : await getScaledWinners(6);

  return <DecodeClient ad={ad} patterns={patterns} winners={winners} />;
}
