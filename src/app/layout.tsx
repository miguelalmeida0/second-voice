import type { Metadata } from "next";
import { headers } from "next/headers";
import { Instrument_Serif, Inter, JetBrains_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const inter = Inter({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["300", "400", "500", "600"],
});

const instrumentSerif = Instrument_Serif({
  display: "swap",
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
  weight: "400",
});

const jetbrainsMono = JetBrains_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500"],
});

const sourceSerif = Source_Serif_4({
  display: "swap",
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-source-serif",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Second Voice AI",
  description: "Rewrite anything with a great author.",
  robots: {
    index: false,
    follow: false,
    noarchive: true,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await headers();

  return (
    <html
      lang="en"
      className={`${inter.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} ${sourceSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
