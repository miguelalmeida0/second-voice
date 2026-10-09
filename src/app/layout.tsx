import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./ghostwriter-overflow-guard.css";
import "./duet.css";
import "./font-subsets.css";

// Keep the original font versions, explicit weights and fallback metrics.
// Full variable ranges can change weight matching and optical sizing.
const inter = localFont({
  src: [
    { path: "../../public/fonts/InterVariable.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/InterVariable.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/InterVariable.woff2", weight: "600", style: "normal" },
  ],
  display: "swap",
  variable: "--font-inter",
  adjustFontFallback: false,
  fallback: ["inter Fallback"],
  declarations: [
    { prop: "unicode-range", value: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
  ],
});

const jetbrainsMono = localFont({
  src: [
    { path: "../../public/fonts/JetBrainsMono-Variable.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/JetBrainsMono-Variable.woff2", weight: "500", style: "normal" },
  ],
  display: "swap",
  preload: false,
  variable: "--font-jetbrains-mono",
  adjustFontFallback: false,
  fallback: ["jetbrainsMono Fallback"],
  declarations: [
    { prop: "unicode-range", value: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
  ],
});

const sourceSerif = localFont({
  src: [
    { path: "../../public/fonts/SourceSerif4Variable-Roman.woff2", weight: "400", style: "normal" },
    { path: "../../public/fonts/SourceSerif4Variable-Roman.woff2", weight: "500", style: "normal" },
    { path: "../../public/fonts/SourceSerif4Variable-Roman.woff2", weight: "600", style: "normal" },
    { path: "../../public/fonts/SourceSerif4Variable-Roman.woff2", weight: "700", style: "normal" },
    { path: "../../public/fonts/SourceSerif4Variable-Italic.woff2", weight: "400", style: "italic" },
    { path: "../../public/fonts/SourceSerif4Variable-Italic.woff2", weight: "500", style: "italic" },
    { path: "../../public/fonts/SourceSerif4Variable-Italic.woff2", weight: "600", style: "italic" },
    { path: "../../public/fonts/SourceSerif4Variable-Italic.woff2", weight: "700", style: "italic" },
  ],
  display: "swap",
  variable: "--font-source-serif",
  adjustFontFallback: false,
  fallback: ["sourceSerif Fallback"],
  declarations: [
    { prop: "unicode-range", value: "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD" },
  ],
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
