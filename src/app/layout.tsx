import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "S.H.I.E.L.D. // Capture The Flag",
    template: "%s // S.H.I.E.L.D. CTF",
  },
  description:
    "Clearance Level 7 — Agents Only. The S.H.I.E.L.D. Capture The Flag secure terminal.",
  openGraph: {
    title: "S.H.I.E.L.D. // Capture The Flag",
    description: "Clearance Level 7 — Agents Only.",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#050a12",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
