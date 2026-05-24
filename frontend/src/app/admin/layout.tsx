import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dashboard — Andrea Carrió Studio Admin",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
      />
      {children}
    </>
  );
}
