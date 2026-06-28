import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Beam — send money by link",
    short_name: "Beam",
    description: "Send money by link. Any chain. They claim it with a tap.",
    start_url: "/",
    display: "standalone",
    background_color: "#f3f5f2",
    theme_color: "#f3f5f2",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
