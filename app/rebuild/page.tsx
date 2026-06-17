import { redirect } from "next/navigation";

// Rebuild was merged into Publish (the unified "Create" surface).
export default function RebuildRedirect() {
  redirect("/publish");
}
