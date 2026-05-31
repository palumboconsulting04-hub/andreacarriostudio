import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
