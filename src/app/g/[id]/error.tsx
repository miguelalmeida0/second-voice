"use client";

import Link from "next/link";
import { AlertCircle, ArrowLeft, RotateCcw } from "lucide-react";

export default function PublicRewriteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="ghostwriter relative min-h-dvh overflow-x-clip">
      <div className="relative z-10 mx-auto flex min-h-dvh max-w-5xl items-center px-5 py-16 sm:px-8">
        <section className="gw-card-strong w-full max-w-2xl p-6 sm:p-8" role="alert">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-1 h-5 w-5 shrink-0 text-[var(--ghost)]" aria-hidden />
            <div>
              <h1 className="font-playfair text-3xl font-medium text-[var(--ghost)]">
                Shared rewrite could not load.
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-[var(--mist)]">
                The permalink request failed before the rewrite could render.
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
                <Link href="/second-voice" className="gw-chip">
                  <ArrowLeft className="h-4 w-4" aria-hidden />
                  Back to Second Voice AI
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
