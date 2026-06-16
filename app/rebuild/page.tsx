import { getAdDetail, getBrands, getGeneratedCreatives } from "@/lib/data";
import RebuildClient from "./RebuildClient";

export const dynamic = "force-dynamic";

export default async function RebuildPage({
  searchParams,
}: {
  searchParams: Promise<{ ad?: string }>;
}) {
  const { ad: adId } = await searchParams;
  const [{ ad }, brands, creatives] = await Promise.all([
    adId ? getAdDetail(adId) : Promise.resolve({ ad: null, patterns: [] }),
    getBrands(),
    getGeneratedCreatives(12),
  ]);

  return <RebuildClient ad={ad} brands={brands} creatives={creatives} />;
}
