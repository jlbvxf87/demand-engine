import type { Metadata, Viewport } from "next";
import "./globals.css";
import AppShell from "@/components/shell/AppShell";

export const metadata: Metadata = {
  metadataBase: new URL("https://demand-engine-2.vercel.app"),
  title: {
    default: "Demand Engine — Creative Factory",
    template: "%s · Demand Engine",
  },
  description:
    "Find winning ads, decode why they work, rebuild as on-brand creative, publish to test.",
  applicationName: "Demand Engine",
  openGraph: {
    type: "website",
    siteName: "Demand Engine",
    url: "/",
    title: "Demand Engine — Creative Factory",
    description:
      "Find winning ads, decode why they work, and recreate them on-brand. The creative factory for paid ads.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Demand Engine — Creative Factory",
    description:
      "Find winning ads, decode why they work, and recreate them on-brand.",
  },
  appleWebApp: {
    capable: true,
    title: "Demand Engine",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f3f5ef",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
