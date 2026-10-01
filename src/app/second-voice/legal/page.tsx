import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Legal — Second Voice AI",
  description: "Imprint, privacy information, and AI transparency notice for Second Voice AI.",
};

const operatorName = process.env.SECOND_VOICE_LEGAL_NAME?.trim() || "Miguel Almeida";
const operatorAddress = process.env.SECOND_VOICE_LEGAL_ADDRESS?.trim() || "";
const contactEmail = process.env.SECOND_VOICE_LEGAL_EMAIL?.trim() || "";
const configuredProvider =
  (process.env.GHOSTWRITER_PROVIDER?.trim().toLowerCase() || "groq") === "gemini"
    ? "Google Gemini"
    : "Groq";
const legalDetailsComplete = Boolean(operatorAddress && contactEmail);

function ExternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="underline decoration-[var(--gw-border)] underline-offset-4 transition-colors hover:text-[var(--ghost)]"
    >
      {children}
    </a>
  );
}

export default function SecondVoiceLegalPage() {
  const addressLines = operatorAddress
    ? operatorAddress.split(/\n|\|/).map((line) => line.trim()).filter(Boolean)
    : [];

  return (
    <main className="ghostwriter min-h-dvh bg-[var(--void)] text-[var(--ghost)]">
      <div className="mx-auto w-full max-w-[900px] px-5 py-10 sm:px-8 sm:py-14 lg:px-10">
        <header className="border-b border-[var(--gw-border-subtle)] pb-8">
          <Link
            href="/second-voice"
            className="text-sm text-[var(--mist)] transition-colors hover:text-[var(--ghost)]"
          >
            ← Back to Second Voice
          </Link>
          <p className="mt-8 text-[11px] uppercase tracking-[0.16em] text-[var(--whisper)]">
            Legal
          </p>
          <h1 className="mt-3 font-serif text-[clamp(2.5rem,8vw,5.5rem)] leading-[0.96] tracking-[-0.035em]">
            Imprint, privacy & AI notice
          </h1>
          <p className="mt-5 max-w-[62ch] text-[0.98rem] leading-7 text-[var(--mist)]">
            This page identifies the operator of Second Voice, explains how the service handles data,
            and makes clear that its literary rewrites are AI-generated style simulations.
          </p>
        </header>

        {!legalDetailsComplete && (
          <aside className="mt-8 border border-[var(--gw-border)] p-5 text-sm leading-6 text-[var(--mist)]">
            <strong className="font-medium text-[var(--ghost)]">Deployment configuration required.</strong>{" "}
            A legally complete public deployment must set{" "}
            <code>SECOND_VOICE_LEGAL_ADDRESS</code> to a serviceable postal address and{" "}
            <code>SECOND_VOICE_LEGAL_EMAIL</code> to a monitored contact address.
          </aside>
        )}

        <nav
          aria-label="Legal sections"
          className="mt-8 flex flex-wrap gap-x-6 gap-y-3 border-b border-[var(--gw-border-subtle)] pb-8 text-sm text-[var(--mist)]"
        >
          <a href="#imprint" className="transition-colors hover:text-[var(--ghost)]">
            Imprint / Impressum
          </a>
          <a href="#privacy" className="transition-colors hover:text-[var(--ghost)]">
            Privacy
          </a>
          <a href="#ai-notice" className="transition-colors hover:text-[var(--ghost)]">
            AI & author notice
          </a>
        </nav>

        <section id="imprint" className="scroll-mt-8 border-b border-[var(--gw-border-subtle)] py-12">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--whisper)]">01</p>
          <h2 className="mt-3 font-serif text-3xl tracking-[-0.02em]">Imprint / Impressum</h2>
          <div className="mt-6 space-y-5 text-[0.96rem] leading-7 text-[var(--mist)]">
            <div>
              <p className="font-medium text-[var(--ghost)]">Service provider</p>
              <p>{operatorName}</p>
              {addressLines.length > 0 ? (
                <address className="not-italic">
                  {addressLines.map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
                </address>
              ) : (
                <p>Serviceable postal address not configured.</p>
              )}
            </div>

            <div>
              <p className="font-medium text-[var(--ghost)]">Contact</p>
              {contactEmail ? (
                <a
                  href={`mailto:${contactEmail}`}
                  className="underline decoration-[var(--gw-border)] underline-offset-4 transition-colors hover:text-[var(--ghost)]"
                >
                  {contactEmail}
                </a>
              ) : (
                <p>Contact email not configured.</p>
              )}
            </div>

            <p>
              Provider information is supplied for the purposes of § 18(1) Medienstaatsvertrag
              (MStV) and, where applicable, § 5 Digitale-Dienste-Gesetz (DDG).
            </p>
          </div>
        </section>

        <section id="privacy" className="scroll-mt-8 border-b border-[var(--gw-border-subtle)] py-12">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--whisper)]">02</p>
          <h2 className="mt-3 font-serif text-3xl tracking-[-0.02em]">Privacy information</h2>
          <div className="mt-6 space-y-8 text-[0.96rem] leading-7 text-[var(--mist)]">
            <div>
              <h3 className="font-medium text-[var(--ghost)]">Controller</h3>
              <p>{operatorName}</p>
              {addressLines.map((line) => (
                <p key={line}>{line}</p>
              ))}
              {contactEmail && (
                <p>
                  <a
                    href={`mailto:${contactEmail}`}
                    className="underline decoration-[var(--gw-border)] underline-offset-4 transition-colors hover:text-[var(--ghost)]"
                  >
                    {contactEmail}
                  </a>
                </p>
              )}
            </div>

            <div>
              <h3 className="font-medium text-[var(--ghost)]">What Second Voice processes</h3>
              <p>
                When you use the service, technical request data can be processed for delivery and
                security, including IP address where available, user-agent information, timestamps,
                request identifiers, signed session identifiers, CSRF tokens, and rate-limit or
                abuse-prevention keys.
              </p>
              <p className="mt-3">
                Text you submit for a rewrite is sent to the configured AI provider ({configuredProvider})
                so the requested rewrite can be generated. Second Voice does not intentionally persist
                source text or generated text after a normal private rewrite.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-[var(--ghost)]">Security cookies</h3>
              <p>
                Second Voice sets two first-party security cookies, <code>gw_session</code> and{" "}
                <code>gw_csrf</code>, for session integrity, CSRF protection, and abuse prevention.
                They expire after seven days. They are not advertising or analytics cookies.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-[var(--ghost)]">Public sharing and feedback</h3>
              <p>
                A rewrite becomes public only when you explicitly choose the public-share action.
                Public shares store the generated rewrite, author/mood metadata, a short public ID,
                and provenance metadata in Supabase. Source text is hidden by default and is not
                stored for the public share flow currently used by the app.
              </p>
              <p className="mt-3">
                If you submit feedback, Second Voice stores feedback metadata such as rating, reason,
                author/mood metadata, request ID, and a one-way hash of the rewrite rather than the
                rewrite text itself.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-[var(--ghost)]">Purposes and legal bases</h3>
              <p>
                Processing needed to generate a rewrite is necessary to provide the functionality you
                requested. Depending on the legal relationship, this may rely on Art. 6(1)(b) GDPR or
                the legitimate interest in operating the free service under Art. 6(1)(f) GDPR.
                Security, fraud prevention, service integrity, and minimal operational logging rely on
                legitimate interests in operating and protecting the service under Art. 6(1)(f) GDPR.
                Optional public sharing is initiated by an explicit user action.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-[var(--ghost)]">Service providers</h3>
              <p>
                The deployment uses Vercel for application hosting, Supabase for durable security
                state and optional public/feedback records, and either Groq or Google Gemini for
                model inference depending on deployment configuration.
              </p>
              <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                <ExternalLink href="https://vercel.com/legal/privacy-notice">Vercel privacy</ExternalLink>
                <ExternalLink href="https://supabase.com/privacy">Supabase privacy</ExternalLink>
                <ExternalLink href="https://groq.com/privacy-policy">Groq privacy</ExternalLink>
                <ExternalLink href="https://policies.google.com/privacy">Google privacy</ExternalLink>
              </p>
              <p className="mt-3">
                Depending on the selected provider and infrastructure region, processing may occur
                outside the EEA. Where GDPR Chapter V applies, the relevant provider is responsible
                for the transfer mechanism it offers to customers, such as an adequacy mechanism or
                standard contractual clauses.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-[var(--ghost)]">Retention</h3>
              <p>
                Security cookies expire after seven days. The abuse store has time-bounded security
                windows and a database cleanup routine, but actual cleanup depends on the deployment
                running that routine. The current application does not implement an automatic expiry
                for public-share or feedback rows; those records remain until they are manually deleted
                or the service is cleaned up.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-[var(--ghost)]">Your rights</h3>
              <p>
                Subject to the GDPR, you may have rights of access, rectification, erasure,
                restriction, portability, and objection, and the right to withdraw consent where
                processing is based on consent. You may also lodge a complaint with a competent data
                protection supervisory authority.
              </p>
            </div>

            <div>
              <h3 className="font-medium text-[var(--ghost)]">Automated decision-making</h3>
              <p>
                Second Voice generates creative text. It does not make decisions about you that
                produce legal effects or similarly significant effects.
              </p>
            </div>

            <p className="text-sm text-[var(--whisper)]">Last updated: 1 October 2026.</p>
          </div>
        </section>

        <section id="ai-notice" className="scroll-mt-8 py-12">
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--whisper)]">03</p>
          <h2 className="mt-3 font-serif text-3xl tracking-[-0.02em]">AI & author notice</h2>
          <div className="mt-6 space-y-5 text-[0.96rem] leading-7 text-[var(--mist)]">
            <p>
              Second Voice uses generative AI to create new text inspired by broad stylistic traits
              associated with selected writers. The outputs are generated by an AI system. They are
              not written, approved, endorsed, or supplied by the named authors, their estates,
              publishers, or representatives.
            </p>
            <p>
              Author names are used as creative reference points for the rewrite controls. Second
              Voice is an independent project and is not affiliated with those authors or rights
              holders.
            </p>
            <p>
              AI output can be inaccurate, unexpected, or too close to existing phrasing. Do not
              treat a rewrite as factual, professional, legal, medical, financial, or other expert
              advice. You remain responsible for checking the result and for ensuring that you have
              the right to submit, publish, or share the source material and resulting text.
            </p>
            <p>
              Do not submit passwords, secrets, confidential material, or personal data you are not
              authorised to send to an AI provider.
            </p>
          </div>
        </section>

        <footer className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-[var(--gw-border-subtle)] pt-8 text-sm text-[var(--whisper)]">
          <Link href="/second-voice" className="transition-colors hover:text-[var(--ghost)]">
            Second Voice
          </Link>
          <a href="#imprint" className="transition-colors hover:text-[var(--ghost)]">
            Imprint
          </a>
          <a href="#privacy" className="transition-colors hover:text-[var(--ghost)]">
            Privacy
          </a>
          <a href="#ai-notice" className="transition-colors hover:text-[var(--ghost)]">
            AI notice
          </a>
        </footer>
      </div>
    </main>
  );
}
