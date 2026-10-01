import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/Nav";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-jb",
  display: "swap",
});

export const metadata: Metadata = {
    title: "PLAYERLAB — FC 26 Player Intelligence",
  description:
    "Attribute-level football analytics: compare players, model what drives an overall rating, and simulate upgrades.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <body>
        <Nav />
        <main className="mx-auto max-w-[1400px] px-5 pb-28 sm:px-8">{children}</main>
      </body>
    </html>
  );
}
