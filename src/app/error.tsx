"use client";

import { AlertCircle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="ghostwriter relative min-h-dvh overflow-x-clip">
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-3xl items-center px-5 py-16">
        <section className="gw-card-strong w-full p-6 sm:p-8" role="alert">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-1 h-5 w-5 shrink-0 text-[var(--ghost)]" aria-hidden />
            <div>
              <h1 className="font-playfair text-3xl font-medium text-[var(--ghost)]">
                Something failed to load.
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-[var(--mist)]">
                The app hit an unexpected render error. Try again, and include this digest if it keeps happening.
              </p>
              {error.digest ? (
                <p className="mt-3 text-xs text-[var(--whisper)]">Digest {error.digest}</p>
              ) : null}
              <button
                type="button"
                onClick={reset}
                className="gw-primary-cta mt-6 inline-flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Try again
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
