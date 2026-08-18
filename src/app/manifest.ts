import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PÚA",
    short_name: "PÚA",
    description:
      "Seguí cifras de guitarra mientras cantás, con micrófono y auto-scroll.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f1113",
    theme_color: "#0f1113",
    lang: "es",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
