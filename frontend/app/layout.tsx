
import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Nexus AI",
    template: "%s | Nexus AI",
  },
  description:
    "Your personal AI assistant for conversations, voice interaction, and productivity.",
  applicationName: "Nexus AI",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Nexus AI",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#090909",
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
