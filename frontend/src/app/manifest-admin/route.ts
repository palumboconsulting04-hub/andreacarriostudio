// Manifiesto propio del admin: al instalarlo en el móvil abre directo /admin
// (distinto del manifest de las alumnas, que abre /mis-clases).
export function GET() {
  const manifest = {
    name: "Admin — Andrea Carrió Studio",
    short_name: "Admin ACS",
    description: "Panel de gestión de Andrea Carrió Studio.",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5ede8",
    theme_color: "#7d2b13",
    lang: "es",
    icons: [
      { src: "/logo-icon.png", sizes: "256x256", type: "image/png", purpose: "any" },
      { src: "/logo.png", sizes: "667x667", type: "image/png", purpose: "any" },
      { src: "/logo-icon.png", sizes: "256x256", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json", "Cache-Control": "public, max-age=3600" },
  });
}
