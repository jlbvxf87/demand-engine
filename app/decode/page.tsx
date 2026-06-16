import { getAdDetail } from "@/lib/data";
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

  return <DecodeClient ad={ad} patterns={patterns} />;
}
