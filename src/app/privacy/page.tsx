import Link from 'next/link';

/**
 * Template privacy policy for self-hosted TalentOS deployments.
 *
 * IMPORTANT: This is a starting point, NOT legal advice. Each deploying
 * organization must customize this page with their own legal entity,
 * contact information, jurisdictional notes, and any sector-specific
 * compliance language (e.g. GDPR for EU, CCPA for California). Have a
 * lawyer review before going live.
 *
 * Operator-specific values are read from public env vars:
 *   NEXT_PUBLIC_TALENTOS_OPERATOR_NAME
 *   NEXT_PUBLIC_TALENTOS_OPERATOR_CONTACT
 *   NEXT_PUBLIC_SITE_URL
 */
export default function PrivacyPage() {
  const operatorName =
    process.env.NEXT_PUBLIC_TALENTOS_OPERATOR_NAME ?? 'the deploying organization';
  const operatorContact =
    process.env.NEXT_PUBLIC_TALENTOS_OPERATOR_CONTACT ?? 'privacy@example.com';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Link href="/" className="text-blue-600 hover:underline mb-8 inline-block">&larr; Back to Home</Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-gray-500 mb-8">Template — operators must customize before deployment</p>
        <div className="space-y-6 text-gray-700 leading-relaxed">
          <p>
            This Privacy Policy describes how <strong>{operatorName}</strong> collects, uses, and
            protects your information when you use <strong>TalentOS</strong>, accessible at{' '}
            <a href={siteUrl} className="text-blue-600 hover:underline">{siteUrl}</a>.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">1. Information We Collect</h2>
          <p><strong>Account Information:</strong> When you create an account, we collect your email address, display name, and role (employer or candidate) via Firebase Authentication.</p>
          <p><strong>Profile Data:</strong> Candidates may provide skills, experience summaries, and verification data. Employers may provide company information and job listings.</p>
          <p><strong>Messages:</strong> Communications between matched users are stored in Firebase Firestore.</p>
          <p><strong>Payment Information (optional):</strong> If the operator has enabled payments, those are processed by <strong>Stripe</strong>. We do not store credit card numbers. Stripe collects billing details per their <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Privacy Policy</a>.</p>
          <p><strong>Usage Data:</strong> Anonymous data including pages visited, features used, and device type.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">2. AI Data Processing</h2>
          <p>TalentOS uses AI-powered matching to connect candidates with job opportunities. Only anonymized profile data is used for AI matching — your full name, email address, and detailed work history are NEVER sent to AI systems. AI matching uses only anonymized names, anonymized experience summaries, skills lists, and verified skills. The specific LLM provider is configured by the operator (defaults to Google Gemini via Genkit; can be swapped for any OpenAI-compatible API).</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">3. How We Use Your Information</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>Operate the talent matching platform</li>
            <li>Process AI-powered candidate-job matching (anonymized data only)</li>
            <li>Process payments via Stripe (if enabled by the operator)</li>
            <li>Facilitate messaging between matched users</li>
            <li>Improve the Service</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">4. Third-Party Services</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Firebase:</strong> Auth, Firestore, Storage, Hosting. <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Firebase Privacy</a>.</li>
            <li><strong>Stripe (optional):</strong> Payment processing. <a href="https://stripe.com/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Stripe Privacy</a>.</li>
            <li><strong>LLM provider:</strong> AI matching with anonymized data only. Provider is operator-configured.</li>
          </ul>
          <p>We do not sell your personal information.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">5. Data Retention</h2>
          <p>Account data retained while active. Messages retained 12 months after last activity. Payment records retained per legal requirements. Request deletion anytime by contacting the operator.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">6. Your Rights</h2>
          <p>You may request access, correction, deletion, or portability of your data by emailing <a href={`mailto:${operatorContact}`} className="text-blue-600 hover:underline">{operatorContact}</a>. The operator commits to responding within 30 days. If you are in the EU/EEA, UK, or California, you have additional rights under GDPR/UK-GDPR/CCPA — operators outside the US should add jurisdiction-specific language here.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">7. Children&apos;s Privacy</h2>
          <p>The Service is not directed to individuals under 13.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">8. Open Source</h2>
          <p>TalentOS is open-source software released under the AGPL-3.0 license. The source code for this deployment is available at the operator's source repository (see contact). The operator may run a modified version, but they are required by the AGPL to publish their modifications.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">9. Contact</h2>
          <p><strong>{operatorName}</strong> &middot; <a href={`mailto:${operatorContact}`} className="text-blue-600 hover:underline">{operatorContact}</a> &middot; <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{siteUrl}</a></p>
        </div>
      </div>
    </div>
  );
}
