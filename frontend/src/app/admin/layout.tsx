import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — Andrea Carrió Studio Admin",
  manifest: "/manifest-admin",
  appleWebApp: { capable: true, title: "Admin ACS", statusBarStyle: "default" },
  icons: { apple: "/logo-icon.png" },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // La fuente Material Symbols se carga globalmente en el layout raíz.
  return <>{children}</>;
}
