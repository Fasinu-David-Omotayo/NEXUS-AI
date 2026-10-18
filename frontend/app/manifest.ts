
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Nexus AI",
    short_name: "Nexus AI",
    description:
      "Your personal AI assistant for conversations, voice interaction, and productivity.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#090909",
    theme_color: "#090909",
    orientation: "any",
    icons: [
      {
        src: "/icons/nexus-icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/nexus-icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
