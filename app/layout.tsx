import type { Metadata } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-display",
});
const sans = Figtree({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans-brand",
});

// Trikorporation master tile (lime T on forest) for the tab icon.
const FAVICON =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 120'%3E%3Crect width='120' height='120' rx='22' fill='%230B3D2E'/%3E%3Cpath d='M30 30H98L92 54H74L66 98H42L50 54H24Z' fill='%23C6F432'/%3E%3C/svg%3E";

export const metadata: Metadata = {
  title: "Letterboxd Compare",
  description:
    "Compare two Letterboxd profiles to find films you've both watched, films you both want to watch, and how your ratings stack up.",
  icons: { icon: FAVICON },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${display.variable} ${sans.variable}`}>
      <body className="min-h-full flex flex-col">
        {children}
        <Script src="https://odtriki.com/shell/tk.js?v=3" data-name="Letterboxd Compare" strategy="afterInteractive" />
      </body>
    </html>
  );
}
