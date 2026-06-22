import {
  getTopAdvertisers,
  getWinningCreatives,
  getIdentityRollups,
  getScaledWinners,
  getVerticals,
  getCreativesCount,
  getSearches,
} from "@/lib/data";
import SourceClient from "./SourceClient";

export const dynamic = "force-dynamic";

export default async function SourcePage() {
  const [advertisers, creatives, identity, scaled, verticals, creativesTotal, searches] =
    await Promise.all([
      getTopAdvertisers({ limit: 40 }),
      getWinningCreatives({ limit: 60 }),
      getIdentityRollups({ limit: 40 }),
      getScaledWinners(24),
      getVerticals(),
      getCreativesCount(),
      getSearches(40),
    ]);

  return (
    <SourceClient
      advertisers={advertisers}
      creatives={creatives}
      identity={identity}
      scaled={scaled}
      verticals={verticals}
      creativesTotal={creativesTotal}
      searches={searches}
    />
  );
}
