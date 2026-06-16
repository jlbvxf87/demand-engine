import {
  getTopAdvertisers,
  getWinningCreatives,
  getIdentityRollups,
  getVerticals,
} from "@/lib/data";
import SourceClient from "./SourceClient";

export const dynamic = "force-dynamic";

export default async function SourcePage() {
  const [advertisers, creatives, identity, verticals] = await Promise.all([
    getTopAdvertisers({ limit: 40 }),
    getWinningCreatives({ limit: 60 }),
    getIdentityRollups({ limit: 40 }),
    getVerticals(),
  ]);

  return (
    <SourceClient
      advertisers={advertisers}
      creatives={creatives}
      identity={identity}
      verticals={verticals}
    />
  );
}
