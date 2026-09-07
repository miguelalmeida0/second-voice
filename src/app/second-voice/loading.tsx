import { LoaderCircle } from "lucide-react";

export default function SecondVoiceLoading() {
  return (
    <main className="ghostwriter gw-overflow-guard relative min-h-dvh overflow-x-clip">
      <div className="gw-overflow-guard relative z-10 mx-auto flex min-h-dvh w-full max-w-[1460px] items-center px-4 py-16 sm:px-8 lg:px-10 xl:px-12">
        <section className="gw-card-strong w-full max-w-2xl p-6 sm:p-8" role="status" aria-live="polite">
          <LoaderCircle className="h-5 w-5 animate-spin text-[var(--ghost)]" aria-hidden />
          <h1 className="mt-5 font-playfair text-3xl font-medium text-[var(--ghost)]">
            Loading Second Voice AI
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[var(--mist)]">
            Preparing the writing controls and request protection.
          </p>
        </section>
      </div>
    </main>
  );
}
