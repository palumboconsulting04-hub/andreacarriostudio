import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — Andrea Carrió Studio Admin",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // La fuente Material Symbols se carga globalmente en el layout raíz.
  return <>{children}</>;
}
