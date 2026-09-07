"use client";

import Link from "next/link";
import { AlertCircle, BookOpen, RotateCcw } from "lucide-react";

export default function SecondVoiceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="ghostwriter gw-overflow-guard relative min-h-dvh overflow-x-clip">
      <div className="gw-overflow-guard relative z-10 mx-auto flex min-h-dvh w-full max-w-[1460px] items-center px-4 py-16 sm:px-8 lg:px-10 xl:px-12">
        <section className="gw-card-strong w-full max-w-2xl p-6 sm:p-8" role="alert">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-1 h-5 w-5 shrink-0 text-[var(--ghost)]" aria-hidden />
            <div>
              <h1 className="font-playfair text-3xl font-medium text-[var(--ghost)]">
                Second Voice AI could not load.
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-[var(--mist)]">
                The page failed before the rewrite controls were ready. Retry the render, or read the case study while the issue is checked.
              </p>
              {error.digest ? (
                <p className="mt-3 text-xs text-[var(--whisper)]">Digest {error.digest}</p>
              ) : null}
              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={reset}
                  className="gw-primary-cta inline-flex items-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" aria-hidden />
                  Try again
                </button>
                <Link href="/second-voice/case-study" className="gw-chip">
                  <BookOpen className="h-4 w-4" aria-hidden />
                  Read the case study
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
