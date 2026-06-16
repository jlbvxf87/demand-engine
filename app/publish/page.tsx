import { getGeneratedCreatives } from "@/lib/data";
import PublishClient from "./PublishClient";

export const dynamic = "force-dynamic";

export default async function PublishPage() {
  const creatives = await getGeneratedCreatives(12);
  return <PublishClient creatives={creatives} />;
}
