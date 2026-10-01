import Link from "next/link";
import { ArrowLeft, Feather, Mail, MapPin, UserRound } from "lucide-react";

export const metadata = {
  title: "Legal information — Second Voice",
  description: "Provider information, privacy summary, and AI transparency for Second Voice.",
};

const operatorName = process.env.SECOND_VOICE_LEGAL_NAME?.trim() || "Miguel Almeida";
const operatorAddress = process.env.SECOND_VOICE_LEGAL_ADDRESS?.trim() || "";
const contactEmail = process.env.SECOND_VOICE_LEGAL_EMAIL?.trim() || "";

export default function LegalPage() {
  const addressLines = operatorAddress
    ? operatorAddress.split(/\n|\|/).map((line) => line.trim()).filter(Boolean)
    : [];

  return (
    <main className="ghostwriter sv-legal-page">
      <div className="sv-legal-shell">
        <header className="sv-legal-nav">
          <Link href="/second-voice" className="sv-legal-brand" aria-label="Second Voice home">
            <Feather aria-hidden="true" />
            <span>Second Voice</span>
          </Link>

          <Link href="/second-voice" className="sv-legal-open">
            Open app
          </Link>
        </header>

        <section className="sv-legal-hero" aria-labelledby="legal-title">
          <Link href="/second-voice" className="sv-legal-back">
            <ArrowLeft aria-hidden="true" />
            Back to Second Voice
          </Link>

          <p className="sv-legal-kicker">Legal information</p>
          <h1 id="legal-title">Legal information</h1>
          <p className="sv-legal-deck">
            Provider information, a privacy summary, and AI transparency for Second Voice.
          </p>
        </section>

        <div className="sv-legal-rule" aria-hidden="true" />

        <section className="sv-legal-grid">
          <article id="imprint" className="sv-legal-column">
            <p className="sv-legal-index">01</p>
            <h2>Imprint / Impressum</h2>
            <p className="sv-legal-summary">
              Information about the service provider for this publicly accessible online service.
            </p>

            <div className="sv-legal-mini-rule" aria-hidden="true" />

            <div className="sv-legal-detail">
              <UserRound aria-hidden="true" />
              <div>
                <p>{operatorName}</p>
              </div>
            </div>

            <div className="sv-legal-detail">
              <MapPin aria-hidden="true" />
              <div>
                {addressLines.length > 0 ? (
                  <address>
                    {addressLines.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                  </address>
                ) : (
                  <p>Serviceable postal address not configured.</p>
                )}
              </div>
            </div>

            <div className="sv-legal-detail">
              <Mail aria-hidden="true" />
              <div>
                {contactEmail ? (
                  <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
                ) : (
                  <p>Contact email not configured.</p>
                )}
              </div>
            </div>
          </article>

          <article id="privacy" className="sv-legal-column">
            <p className="sv-legal-index">02</p>
            <h2>Privacy</h2>
            <p className="sv-legal-summary">
              What is processed when you use the live rewrite experience.
            </p>

            <div className="sv-legal-mini-rule" aria-hidden="true" />

            <div className="sv-legal-copy">
              <p>
                Your draft stays in this browser tab until you request a rewrite. When live
                rewriting is available, your text and selected writing instructions are sent to
                Groq. Private rewrite content may be retained for replay under the current release
                policy and expires after seven days.
              </p>
              <p>
                GitHub and Supabase handle sign-in and account state, while Vercel hosts the app.
                Second Voice adds no advertising analytics or session replay.
              </p>
            </div>

            <Link href="/second-voice/privacy" className="sv-legal-link">
              Read the full privacy notice
              <span aria-hidden="true">→</span>
            </Link>

            {contactEmail ? (
              <div className="sv-legal-contact-note">
                <Mail aria-hidden="true" />
                <span>
                  Privacy questions?{" "}
                  <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
                </span>
              </div>
            ) : null}
          </article>

          <article id="ai-notice" className="sv-legal-column">
            <p className="sv-legal-index">03</p>
            <h2>AI notice</h2>
            <p className="sv-legal-summary">
              How generated rewrites and named author references should be understood.
            </p>

            <div className="sv-legal-mini-rule" aria-hidden="true" />

            <div className="sv-legal-copy">
              <p>
                Second Voice uses generative AI to create new text using broad stylistic traits
                associated with selected writers and writing outcomes. Outputs are generated by an
                AI system and can be inaccurate or unexpected.
              </p>
              <p>
                Named authors are creative reference points only. Second Voice is independent and
                is not affiliated with, endorsed by, or approved by those authors, their estates,
                publishers, or representatives.
              </p>
              <p>
                Review generated text before relying on or publishing it. You are responsible for
                having the right to submit the source material and for how you use the result.
              </p>
            </div>
          </article>
        </section>

        <footer className="sv-legal-footer">
          <Link href="/second-voice" className="sv-legal-footer-brand">
            <Feather aria-hidden="true" />
            <span>Second Voice</span>
          </Link>

          <nav aria-label="Legal">
            <a href="#imprint">Imprint</a>
            <Link href="/second-voice/privacy">Privacy</Link>
            <a href="#ai-notice">AI notice</a>
          </nav>
        </footer>
      </div>
    </main>
  );
}
