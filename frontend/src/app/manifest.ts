import type { MetadataRoute } from "next";

// Manifest de la PWA: permite instalar "Mis clases" como app en el móvil.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mis clases — Andrea Carrió Studio",
    short_name: "Mis clases",
    description: "Tu área para ver y reservar tus clases en Andrea Carrió Studio.",
    start_url: "/mis-clases",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5ede8",
    theme_color: "#7d2b13",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
