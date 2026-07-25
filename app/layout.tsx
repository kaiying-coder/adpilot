import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdPilot — AI Monetization Operations",
  description: "AI-powered advertising anomaly analysis and automated resolution.",
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
