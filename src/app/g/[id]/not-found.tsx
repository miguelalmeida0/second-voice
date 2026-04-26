import Link from "next/link";
import { BlurOrbs } from "@/components/ghostwriter/BlurOrbs";

export default function GhostwriterNotFound() {
  return (
    <div className="ghostwriter relative min-h-dvh overflow-x-clip">
      <BlurOrbs />

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-3xl flex-col items-center justify-center px-6 text-center">
        <div className="gw-chip">Second Voice AI permalink</div>
        <h1 className="mt-6 font-playfair text-5xl italic text-[var(--ghost)] sm:text-6xl">
          Lost in the draft.
        </h1>
        <p className="mt-4 max-w-xl text-[16px] leading-relaxed text-[var(--mist)] sm:text-[18px]">
          That rewrite does not exist, or storage is not configured in this environment yet.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          <Link href="/second-voice" className="gw-chip">
            Back to Second Voice AI
          </Link>
          <Link href="/second-voice/case-study" className="gw-chip">
            Read the case study
          </Link>
        </div>
      </div>
    </div>
  );
}
