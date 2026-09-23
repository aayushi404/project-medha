import type { MetadataRoute } from "next";

// Web app manifest. This is what makes Medha installable, and it is also the
// input PWABuilder / Bubblewrap read when packaging the app for the Microsoft
// Store (MSIX) and Google Play (Trusted Web Activity). Changing name, icons or
// start_url later means re-packaging and re-submitting to both stores.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Medha — AI Teaching Co-pilot",
    short_name: "Medha",
    description:
      "Lesson plans, quizzes, attendance and report cards for Bihar's teachers, in Hindi and English.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#fcf2e6",
    theme_color: "#f8f4ea",
    lang: "en",
    dir: "ltr",
    categories: ["education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
