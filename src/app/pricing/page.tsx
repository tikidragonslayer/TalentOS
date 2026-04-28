import type { Metadata } from 'next';
import { PricingTable } from '@/components/PricingTable';

export const metadata: Metadata = {
  title: 'Pricing — TalentOS | Find Your Perfect Team Match',
  description: 'Choose a TalentOS plan. Anonymous matching, skill assessments, team analytics, and AI-powered hiring tools for candidates and employers.',
};

const faqItems = [
  {
    q: 'What is anonymous matching?',
    a: 'Pro members can match with employers based on skills and culture fit without revealing their identity until both sides express interest — eliminating bias and protecting your job search privacy.',
  },
  {
    q: 'How do skill assessments work?',
    a: 'TalentOS offers industry-standard assessments that verify your technical and soft skills. Results are shared with matched employers as verified credentials, giving you an edge over traditional resumes.',
  },
  {
    q: 'Is the Team plan for employers only?',
    a: 'Yes — the Team plan includes employer-specific tools like candidate pipelines, custom assessments, team analytics, and API access for ATS integration.',
  },
  {
    q: 'Can I try Pro before committing?',
    a: 'Every Pro subscription includes a 7-day free trial. Cancel anytime during the trial and you will not be charged.',
  },
];

export default function PricingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0f0f1a' }}>
      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '64px 16px 0', maxWidth: '720px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '40px', fontWeight: 800, color: '#e0e0e8', margin: '0 0 16px', lineHeight: 1.2 }}>
          Find Your Perfect Team Match
        </h1>
        <p style={{ fontSize: '18px', color: '#9ca3af', margin: '0 0 8px', lineHeight: 1.6 }}>
          Anonymous matching, verified skill assessments, and team analytics — connecting the right talent with the right opportunity.
        </p>
      </section>

      {/* Pricing Table */}
      <PricingTable appId="talent-os" theme="dark" />

      {/* FAQ */}
      <section style={{ maxWidth: '720px', margin: '0 auto', padding: '48px 16px 64px' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#e0e0e8', textAlign: 'center', marginBottom: '32px' }}>
          Frequently Asked Questions
        </h2>
        {faqItems.map((item, i) => (
          <details
            key={i}
            style={{ marginBottom: '16px', background: '#1a1a2e', border: '1px solid #2a2a3e', borderRadius: '12px', padding: '20px 24px' }}
          >
            <summary style={{ fontSize: '16px', fontWeight: 600, color: '#e0e0e8', cursor: 'pointer', listStyle: 'none' }}>
              {item.q}
            </summary>
            <p style={{ fontSize: '14px', color: '#9ca3af', marginTop: '12px', lineHeight: 1.6 }}>
              {item.a}
            </p>
          </details>
        ))}
      </section>

      {/* Bottom CTA */}
      <section style={{ textAlign: 'center', padding: '48px 16px 80px', background: '#1a1a2e' }}>
        <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#ffffff', marginBottom: '16px' }}>
          Your next great hire (or opportunity) is waiting
        </h2>
        <p style={{ fontSize: '16px', color: '#9ca3af', marginBottom: '24px' }}>
          Start free — upgrade to Pro for anonymous matching and unlimited applications.
        </p>
        <a
          href="/login"
          style={{ display: 'inline-block', padding: '14px 32px', background: '#8b5cf6', color: '#ffffff', borderRadius: '10px', fontSize: '16px', fontWeight: 700, textDecoration: 'none' }}
        >
          Get Started Free
        </a>
      </section>
    </div>
  );
}
