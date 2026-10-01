import { Feather } from "lucide-react";

export default function SecondVoiceLoading() {
  return (
    <main className="ghostwriter sv-loading-page">
      <section className="sv-loading-shell" role="status" aria-live="polite">
        <div className="sv-loading-brand">
          <Feather aria-hidden="true" />
          <span>Second Voice</span>
        </div>

        <div className="sv-loading-mark" aria-hidden="true">
          <div className="sv-loading-wave">
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className="sv-loading-copy">
          <p className="sv-loading-kicker">Preparing your workspace</p>
          <h1>Loading Second Voice AI</h1>
          <p>Preparing writing controls and request protection.</p>
        </div>

        <div className="sv-loading-progress" aria-hidden="true">
          <span />
        </div>

        <div className="sv-loading-meta" aria-hidden="true">
          <span>Writing controls</span>
          <span>Session protection</span>
          <span>AI safeguards</span>
        </div>
      </section>
    </main>
  );
}
