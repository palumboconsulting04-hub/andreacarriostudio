import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Invita a una amiga — Andrea Carrió Studio",
  description: "Comparte tu código: cuando tu amiga se apunte al estudio, ganáis las dos.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
