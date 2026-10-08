import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { mn } from "@/lib/i18n/mn";
import "./globals.css";

const sans = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: mn.meta.title,
    template: "%s · Ayan",
  },
  description:
    mn.meta.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="studio-bg min-h-dvh overflow-x-hidden font-sans text-paper antialiased">{children}</body>
    </html>
  );
}
