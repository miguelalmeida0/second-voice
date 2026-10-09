# Self-hosted typefaces

These are the exact WOFF2 subsets emitted by the approved production build at `1de89d6f07cf780a4aa2c4a43565b0a6db0bac95`. `manifest.json` records every original build filename, SHA-256, size and Unicode range. No font binaries are modified.

The four Latin subsets keep their established local filenames and load through `next/font/local` in `src/app/layout.tsx`. `src/app/font-subsets.css` retains the remaining language subsets and original fallback metrics. Inter supports weights 400/500/600, JetBrains Mono 400/500, and Source Serif 4 normal/italic 400/500/600/700, exactly as the approved layout did. Inter and Source Serif Latin files are preloaded; JetBrains Mono is not.

All files are OFL-licensed. Keep `LICENSE-Inter.txt`, `LICENSE-JetBrainsMono.txt` and `LICENSE-SourceSerif4.md` with the corresponding fonts.

Do not substitute upstream variable fonts simply because the family name matches. New versions, optical-size axes, broader weight declarations or different fallback metrics can change text wrapping. Build-time requests to Google Fonts remain unnecessary.
