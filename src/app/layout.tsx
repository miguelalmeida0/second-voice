import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./ghostwriter-overflow-guard.css";
import "./duet.css";

const inter = localFont({
  src: "../../public/fonts/InterVariable.woff2",
  display: "swap",
  variable: "--font-inter",
  weight: "100 900",
});

const jetbrainsMono = localFont({
  src: "../../public/fonts/JetBrainsMono-Variable.woff2",
  display: "swap",
  preload: false,
  variable: "--font-jetbrains-mono",
  weight: "100 800",
});

const sourceSerif = localFont({
  src: [
    { path: "../../public/fonts/SourceSerif4Variable-Roman.woff2", weight: "200 900", style: "normal" },
    { path: "../../public/fonts/SourceSerif4Variable-Italic.woff2", weight: "200 900", style: "italic" },
  ],
  display: "swap",
  variable: "--font-source-serif",
});

export const metadata: Metadata = {
  title: "Second Voice AI",
  description: "Rewrite anything with a great author.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
