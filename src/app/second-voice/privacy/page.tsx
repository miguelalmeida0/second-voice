import Link from "next/link";
import { ArrowLeft, Feather } from "lucide-react";

export const metadata = { title: "Privacy & contact — Second Voice" };

const operatorName = process.env.SECOND_VOICE_LEGAL_NAME?.trim() || "Miguel Almeida";
const operatorAddress = process.env.SECOND_VOICE_LEGAL_ADDRESS?.trim() || "";
const contactEmail = process.env.SECOND_VOICE_LEGAL_EMAIL?.trim() || "miguelalmeida1592@gmail.com";

export default function PrivacyPage() {
  const addressLines = operatorAddress
    ? operatorAddress.split(/\n|\|/).map((line) => line.trim()).filter(Boolean)
    : [];

  return (
    <main className="ghostwriter sv-privacy-page">
      <div className="sv-privacy-shell">
        <header className="sv-legal-nav">
          <Link href="/second-voice" className="sv-legal-brand" aria-label="Second Voice home">
            <Feather aria-hidden="true" />
            <span>Second Voice</span>
          </Link>
          <Link href="/second-voice/legal" className="sv-legal-open">
            Legal
          </Link>
        </header>

        <section className="sv-privacy-hero">
          <Link href="/second-voice" className="sv-legal-back">
            <ArrowLeft aria-hidden="true" />
            Back to Second Voice
          </Link>
          <p className="sv-legal-kicker">Privacy & contact</p>
          <h1>Privacy & contact</h1>
          <p>
            How Second Voice handles rewrite data, account information, retention, and deletion.
          </p>
        </section>

        <div className="sv-legal-rule" aria-hidden="true" />

        <div className="sv-privacy-grid">
          <aside className="sv-privacy-controller">
            <p className="sv-legal-index">Controller</p>
            <h2>{operatorName}</h2>
            {addressLines.length > 0 ? (
              <address>
                {addressLines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
              </address>
            ) : null}
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
            <p className="sv-privacy-small">
              For support, privacy requests, or security reports. Never send passwords, API keys,
              or sign-in codes.
            </p>
          </aside>

          <div className="sv-privacy-content">
            <section aria-labelledby="data-heading">
              <p className="sv-legal-index">01</p>
              <h2 id="data-heading">What happens to your words</h2>
              <p>
                Your draft stays in this browser tab until you request a rewrite. When live
                rewriting is available, that request sends your text and the selected writing
                instructions to Groq. The output is stored privately for replay, so retrying the
                same operation does not generate it again. Do not submit confidential information,
                sensitive personal data, or someone else&apos;s private information.
              </p>
              <p>
                Drafts and outputs are not saved in browser local storage. Signing out or
                closing/reloading the tab clears the in-memory draft. A temporary session-check
                outage preserves it in the current tab. The app does not publish your text or
                provide end-to-end encryption.
              </p>
            </section>

            <section aria-labelledby="account-heading">
              <p className="sv-legal-index">02</p>
              <h2 id="account-heading">Account, security and service providers</h2>
              <p>
                GitHub and Supabase handle sign-in. Supabase stores your account identifier,
                verified email, session records, trial allowance and limited operation history.
                Vercel hosts the app and processes request information such as IP addresses.
                Security cookies protect sign-in and requests; this app adds no advertising
                analytics or session replay.
              </p>
              <p>
                We process account and rewrite data to provide the service you request (GDPR Article
                6(1)(b)), and minimal abuse and recovery records to protect this limited service and
                its users (Article 6(1)(f)). Providing a GitHub account is necessary for live trial
                access; you can read the public pages without signing in. The writing model has no
                tools and does not make decisions about your eligibility.
              </p>
              <p>
                Providers may process data outside the European Economic Area. Their current terms,
                processing arrangements and applicable safeguards must be verified before this
                release is enabled; no EU-only processing or zero provider retention is promised.
                See{" "}
                <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">
                  GitHub
                </a>
                , <a href="https://supabase.com/privacy">Supabase</a>,{" "}
                <a href="https://vercel.com/legal/privacy-policy">Vercel</a> and{" "}
                <a href="https://console.groq.com/docs/your-data">Groq</a>.
              </p>
            </section>

            <section aria-labelledby="retention-heading">
              <p className="sv-legal-index">03</p>
              <h2 id="retention-heading">Retention and deletion</h2>
              <p>
                The approved release policy expires private rewrite content after seven days. A
                bounded scheduled cleanup removes expired copies; replay cannot return expired text
                even if cleanup is delayed. The finite trial closes permanently after 90 days.
                Account-linked trial records are then purged once they are 90 days old, without
                reopening access or replenishing allowance. Nonpersonal totals remain.
              </p>
              <p>
                Unresolved provider charges and incomplete deletion jobs require reconciliation
                before their recovery records can be erased. Active account/session records remain
                until expiration or account deletion; necessary revocation fences are not removed
                while they could restore access. Provider-held copies and backups follow the
                respective provider&apos;s policies, not the browser&apos;s lifetime.
              </p>
              <p>
                <Link href="/second-voice/account">Delete your account</Link> to revoke app access
                and erase private stored results. Deletion can resume after a service interruption.
                Contact Miguel if you cannot complete it. Previously copied or externally held text
                cannot be recalled.
              </p>
            </section>

            <section aria-labelledby="rights-heading">
              <p className="sv-legal-index">04</p>
              <h2 id="rights-heading">Your choices and rights</h2>
              <p>
                You can request access, correction, deletion, restriction or portability where
                applicable, and object to processing based on legitimate interests. Contact the
                email above; we may need proportionate identity verification. You can also complain
                to your competent data-protection authority.
              </p>
              <p className="sv-privacy-small">Updated 1 October 2026.</p>
            </section>
          </div>
        </div>

        <footer className="sv-legal-footer">
          <Link href="/second-voice" className="sv-legal-footer-brand">
            <Feather aria-hidden="true" />
            <span>Second Voice</span>
          </Link>
          <nav aria-label="Legal">
            <Link href="/second-voice/legal#imprint">Imprint</Link>
            <span aria-current="page">Privacy</span>
            <Link href="/second-voice/legal#ai-notice">AI notice</Link>
          </nav>
        </footer>
      </div>
    </main>
  );
}
