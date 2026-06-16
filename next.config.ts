import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Real ad images come from Meta's CDN and OpenAI; allow remote images.
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.fbcdn.net" },
      { protocol: "https", hostname: "**.facebook.com" },
      { protocol: "https", hostname: "scontent.**" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "oaidalleapiprodscus.blob.core.windows.net" },
      { protocol: "https", hostname: "**.blob.core.windows.net" },
    ],
  },
};

export default nextConfig;
