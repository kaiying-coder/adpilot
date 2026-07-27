import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdPilot — AI Monetization Operations",
  description: "AI-powered advertising anomaly analysis and automated resolution.",
  metadataBase: new URL("https://adpilot-ai-ops.pages.dev"),
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  openGraph: {
    title: "AdPilot",
    description: "AI Advertising Anomaly Investigation",
    type: "website",
    images: [{ url: "/og.png", width: 1731, height: 909, alt: "AdPilot product preview" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AdPilot",
    description: "AI Advertising Anomaly Investigation",
    images: ["/og.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
