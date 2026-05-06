import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import "./fnl-presentation.css";

/** Goed leesbaar op laptop/projector; niet de F&L-corporate font. */
const presentatieSans = Source_Sans_3({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-presentatie-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Presentatie — Historisch Nieuwsblad | F&L Media",
  description:
    "Paywall, piekartikelen en nieuwsbriefblokken. Presentatie in huisstijl F&L Media.",
};

export default function HistorischPresentatieLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div lang="nl" className={`fnl-presentation min-h-screen ${presentatieSans.variable}`}>
      {children}
    </div>
  );
}
