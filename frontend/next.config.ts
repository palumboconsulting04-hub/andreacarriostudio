import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Permite optimizar imágenes servidas desde WordPress (fotos de las clases).
    remotePatterns: [
      { protocol: "https", hostname: "andreacarriostudio.es" },
      { protocol: "https", hostname: "www.andreacarriostudio.es" },
    ],
  },
  experimental: {
    serverActions: {
      // Permite que las Server Actions (p. ej. el login del admin) se invoquen
      // desde el dominio personalizado, no solo desde la URL *.vercel.app.
      allowedOrigins: [
        "reservas.andreacarriostudio.es",
        "andreacarriostudio.es",
        "www.andreacarriostudio.es",
      ],
    },
  },
};

export default nextConfig;
