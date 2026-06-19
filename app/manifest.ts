import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Demand Engine",
    short_name: "Demand Engine",
    description: "Find winning ads, decode why they work, and recreate them on-brand.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#10151B",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
