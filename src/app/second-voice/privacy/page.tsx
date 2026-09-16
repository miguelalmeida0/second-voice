import Link from "next/link";

export const metadata = { title: "Privacy & contact — Second Voice" };

export default function PrivacyPage() {
  return <main className="mx-auto max-w-2xl px-6 py-12 text-[#eeeae3] sm:py-16">
    <Link href="/second-voice" className="underline underline-offset-4">Back to Second Voice</Link>
    <h1 className="mt-10 text-3xl">Privacy &amp; contact</h1>
    <p className="mt-4 leading-relaxed">Second Voice is Miguel’s personal, non-commercial portfolio project. For support, privacy requests or a security report, contact <a href="mailto:miguelalmeida1592@gmail.com" className="break-words underline underline-offset-4">miguelalmeida1592@gmail.com</a>. Never send passwords, API keys or sign-in codes.</p>
    <section className="mt-8 space-y-4 leading-relaxed" aria-labelledby="data-heading">
      <h2 id="data-heading" className="text-xl">What happens to your words</h2>
      <p>Your draft stays in this browser tab until you request a rewrite. When live rewriting is available, that request sends your text and the selected writing instructions to Groq. The output is stored privately for replay, so retrying the same operation does not generate it again. Do not submit confidential information, sensitive personal data, or someone else’s private information.</p>
      <p>Drafts and outputs are not saved in browser local storage. Signing out or closing/reloading the tab clears the in-memory draft. A temporary session-check outage preserves it in the current tab. The app does not publish your text or provide end-to-end encryption.</p>
    </section>
    <section className="mt-8 space-y-4 leading-relaxed" aria-labelledby="account-heading">
      <h2 id="account-heading" className="text-xl">Account, security and service providers</h2>
      <p>GitHub and Supabase handle sign-in. Supabase stores your account identifier, verified email, session records, trial allowance and limited operation history. Vercel hosts the app and processes request information such as IP addresses. Security cookies protect sign-in and requests; this app adds no advertising analytics or session replay.</p>
      <p>We process account and rewrite data to provide the service you request (GDPR Article 6(1)(b)), and minimal abuse and recovery records to protect this limited service and its users (Article 6(1)(f)). Providing a GitHub account is necessary for live trial access; you can read the public pages without signing in. The writing model has no tools and does not make decisions about your eligibility.</p>
      <p>Providers may process data outside the European Economic Area. Their current terms, processing arrangements and applicable safeguards must be verified before this release is enabled; no EU-only processing or zero provider retention is promised. See <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement" className="underline">GitHub</a>, <a href="https://supabase.com/privacy" className="underline">Supabase</a>, <a href="https://vercel.com/legal/privacy-policy" className="underline">Vercel</a> and <a href="https://console.groq.com/docs/your-data" className="underline">Groq</a>.</p>
    </section>
    <section className="mt-8 space-y-4 leading-relaxed" aria-labelledby="retention-heading">
      <h2 id="retention-heading" className="text-xl">Retention and deletion</h2>
      <p>The approved release policy expires private rewrite content after seven days. A bounded scheduled cleanup removes expired copies; replay cannot return expired text even if cleanup is delayed. The finite trial closes permanently after 90 days. Account-linked trial records are then purged once they are 90 days old, without reopening access or replenishing allowance. Nonpersonal totals remain.</p>
      <p>Unresolved provider charges and incomplete deletion jobs require reconciliation before their recovery records can be erased. Active account/session records remain until expiration or account deletion; necessary revocation fences are not removed while they could restore access. Provider-held copies and backups follow the respective provider’s policies, not the browser’s lifetime.</p>
      <p><Link href="/second-voice/account" className="underline underline-offset-4">Delete your account</Link> to revoke app access and erase private stored results. Deletion can resume after a service interruption. Contact Miguel if you cannot complete it. Previously copied or externally held text cannot be recalled.</p>
    </section>
    <section className="mt-8 space-y-4 leading-relaxed" aria-labelledby="rights-heading">
      <h2 id="rights-heading" className="text-xl">Your choices and rights</h2>
      <p>You can request access, correction, deletion, restriction or portability where applicable, and object to processing based on legitimate interests. Contact the email above; we may need proportionate identity verification. You can also complain to your competent data-protection authority.</p>
      <p className="text-sm">Updated 8 September 2026. This page describes the approved release policy. Public launch remains gated on provider and operational verification.</p>
    </section>
  </main>;
}
