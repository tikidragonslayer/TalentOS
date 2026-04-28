import Link from 'next/link';

/**
 * Template Terms of Service for self-hosted TalentOS deployments.
 *
 * IMPORTANT: This is a starting point, NOT legal advice. Each deploying
 * organization must customize this with their own legal entity, choice
 * of law, dispute resolution, and any sector-specific terms. Have a
 * lawyer review before going live.
 *
 * Operator-specific values are read from public env vars:
 *   NEXT_PUBLIC_TALENTOS_OPERATOR_NAME
 *   NEXT_PUBLIC_TALENTOS_OPERATOR_CONTACT
 *   NEXT_PUBLIC_TALENTOS_OPERATOR_JURISDICTION
 *   NEXT_PUBLIC_SITE_URL
 */
export default function TermsPage() {
  const operatorName =
    process.env.NEXT_PUBLIC_TALENTOS_OPERATOR_NAME ?? 'the deploying organization';
  const operatorContact =
    process.env.NEXT_PUBLIC_TALENTOS_OPERATOR_CONTACT ?? 'legal@example.com';
  const operatorJurisdiction =
    process.env.NEXT_PUBLIC_TALENTOS_OPERATOR_JURISDICTION ?? "the operator's jurisdiction";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://example.com';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <Link href="/" className="text-blue-600 hover:underline mb-8 inline-block">&larr; Back to Home</Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-gray-500 mb-8">Template — operators must customize before deployment</p>
        <div className="space-y-6 text-gray-700 leading-relaxed">
          <p>
            These Terms govern your use of <strong>TalentOS</strong>, operated by{' '}
            <strong>{operatorName}</strong>, at{' '}
            <a href={siteUrl} className="text-blue-600 hover:underline">{siteUrl}</a>.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">1. Description of Service</h2>
          <p>TalentOS is a talent management platform connecting employers with candidates through AI-powered anonymous matching, skill verification, and secure messaging.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">2. User Accounts</h2>
          <p>You must create an account and select a role (employer or candidate). You are responsible for maintaining account confidentiality and all activities under your account. Provide accurate information.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">3. Payment Terms</h2>
          <p>Paid features (if enabled by the operator) are processed through Stripe. Subscription plans renew automatically. You may cancel at any time — access continues through the end of the billing period. Refunds are at the operator's discretion. Operators running TalentOS without Stripe configured do not collect payment, in which case this section does not apply.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">4. AI-Generated Content</h2>
          <p><strong>Match scores, compatibility ratings, and recommendations are AI-assisted and should not be the sole basis for hiring decisions.</strong> AI matching uses only anonymized profile data. We do not guarantee the accuracy of AI-generated results. Employers remain solely responsible for their hiring decisions.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">5. Acceptable Use</h2>
          <p>You agree not to: provide false profile information; use the Service for discrimination or unlawful hiring practices; harass other users; attempt to de-anonymize matched profiles outside the platform's reveal flow; or scrape or harvest data. Use of AI-generated personas to misrepresent yourself is prohibited.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">6. Intellectual Property</h2>
          <p>The TalentOS platform code is open-source software released under the AGPL-3.0 license. The deployed instance is operated by {operatorName}. User-submitted content (profiles, job listings) remains yours, but you grant the operator a license to display it on the platform and to derive anonymized representations for the matching engine.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">7. Disclaimer of Warranties</h2>
          <p className="font-semibold">THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND. WE DO NOT GUARANTEE THAT YOU WILL FIND EMPLOYMENT OR CANDIDATES THROUGH THE SERVICE.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">8. Limitation of Liability</h2>
          <p className="font-semibold">THE OPERATOR SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS OR HIRING COSTS. TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID THE OPERATOR IN THE 12 MONTHS PRECEDING THE CLAIM, OR $100, WHICHEVER IS GREATER.</p>
          <p className="text-sm text-gray-500">Operators in certain jurisdictions may not be able to disclaim or cap liability to this extent. Localize accordingly.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">9. Termination</h2>
          <p>The operator may suspend or terminate accounts for Terms violations. You may delete your account anytime by contacting the operator. Upon termination, your data will be deleted within 30 days, except where retention is required by law.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">10. Governing Law &amp; Dispute Resolution</h2>
          <p>Governed by the laws of {operatorJurisdiction}. Disputes resolved per the operator's standard dispute resolution clause. Operators must localize this section before deployment.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">11. Open Source</h2>
          <p>TalentOS is open-source software released under the AGPL-3.0 license. The platform code itself comes with no warranty (see the LICENSE file). These Terms govern your use of this deployment, not your right to fork the code under AGPL terms.</p>

          <h2 className="text-xl font-semibold text-gray-900 mt-8">12. Contact</h2>
          <p><strong>{operatorName}</strong> &middot; <a href={`mailto:${operatorContact}`} className="text-blue-600 hover:underline">{operatorContact}</a> &middot; <a href={siteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{siteUrl}</a></p>
        </div>
      </div>
    </div>
  );
}
