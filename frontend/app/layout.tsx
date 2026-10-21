import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nexus AI",
    template: "%s | Nexus AI",
  },
  description:
    "Nexus AI is your intelligent workspace for AI conversations, research, productivity, and automation.",
  applicationName: "Nexus AI",
  appleWebApp: {
    capable: true,
    title: "Nexus AI",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#101110",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
