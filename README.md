# TalentOS

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![AI: Genkit](https://img.shields.io/badge/AI-Genkit-orange)](https://firebase.google.com/docs/genkit)

**Anonymous-by-default talent matching, with personality-pair compatibility and progressive reveal.**

TalentOS is open-source software for skills-first hiring without unconscious bias. It anonymizes both candidates and employers, scores compatibility using validated personality science (Big Five), and reveals identity progressively as both parties commit. AI takes the noise out; humans make the call.

> **Why this exists:** keyword-matching ATSs throw away signal, recruiter pipelines optimize for credentials over capability, and bias creeps into every step of traditional hiring. TalentOS treats anonymity as a strategic primitive — not a checkbox feature — and lets matches happen on what people can actually do, with whom they can actually work.

---

## What's in the box

- **Anonymized profiles & job listings** — AI strips identifying signals from raw text and exposes a structured, scored representation. The candidate ↔ employer information channel is one-way until the platform's progressive-reveal flow opens it.
- **Personality-pair compatibility** — Big Five (validated) and optional MBTI (popular) personality measurement for both candidates *and* hiring managers. Match scores combine skill fit with manager-candidate compatibility.
- **AI skill verification** — Genkit-driven challenges that verify claimed skills under realistic constraints, not multiple-choice trivia.
- **Progressive reveal** — Identity, location, and detailed work history are released in stages keyed on mutual engagement, not on profile completeness.
- **Optional Stripe monetization** — operators can enable subscription tiers and per-message pricing, or run TalentOS completely free. Stripe is feature-flagged, not required.
- **AI flows** built on Genkit + Google Gemini by default; can be swapped for any OpenAI-compatible provider via the `genkit` config.

## Architecture

```
┌──────────────┐    ┌──────────────────┐    ┌──────────────────┐
│ Candidate /  │───▶│  Anonymizer      │───▶│  Matching engine │
│ Employer     │    │  (Genkit flow)   │    │  (Big-5 + MBTI   │
│ raw input    │    │                  │    │   + skill score) │
└──────────────┘    └──────────────────┘    └──────────────────┘
                                                     │
                                                     ▼
                                             ┌────────────────┐
                                             │  Reveal flow   │
                                             │  (staged       │
                                             │   disclosure)  │
                                             └────────────────┘
```

Major modules:

| Path | Role |
|---|---|
| `src/ai/flows/anonymize-profile.ts` | LLM-driven profile anonymization with reveal levels 1–5 |
| `src/ai/flows/anonymize-job-description.ts` | Same for job descriptions (employer side) |
| `src/ai/flows/match-candidate-to-job.ts` | Match scoring (skills × personality × location) |
| `src/ai/flows/verify-candidate-skills.ts` | Skill challenge verification |
| `src/ai/flows/generate-interview-followup.ts` | Post-screen action items |
| `src/app/candidate/` | Candidate portal (profile, tests, challenges, matches) |
| `src/app/employer/` | Employer portal (jobs, candidates, deposits) |
| `src/app/admin/` | Admin dashboard (env-gated allowlist) |
| `src/app/api/stripe/` | Optional Stripe checkout + billing portal |

---

## License

GNU Affero General Public License v3.0 or later. See [`LICENSE`](LICENSE) and [`NOTICE`](NOTICE).

The AGPL is a strong copyleft license. Anyone running a modified version of TalentOS as a network service is required to publish their modified source under the same license. This is intentional — bias-mitigating hiring tooling should not be enclosed by closed commercial forks.

If you have a use case that requires different terms (e.g. embedding TalentOS into a closed commercial product), open an issue to discuss commercial dual-licensing.

---

## Status

This is a v0.1 open-source release of a previously private codebase. The core flows (anonymization, matching, skill verification, progressive reveal) are implemented and run end-to-end. **It is not, however, ready for production at scale** — there are no anonymization eval suites yet, the matching algorithm has not been benchmarked against held-out hiring outcomes, and the codebase has not been independently security-audited.

Adopt it now if you want to: study the architecture, contribute to the eval/benchmark gaps, run an internal pilot under appropriate oversight, or fork it for research purposes.

---

## Setup

```bash
git clone https://github.com/tikidragonslayer/TalentOS.git
cd TalentOS
npm install
cp .env.example .env  # fill in Firebase + (optional) Stripe + (optional) Genkit keys
npm run dev
```

Required env vars (Firebase):

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

Optional env vars:

```bash
# Branding (used in privacy/terms templates and SEO metadata)
NEXT_PUBLIC_SITE_URL=https://talent.example.com
NEXT_PUBLIC_TALENTOS_OPERATOR_NAME="Acme Inc."
NEXT_PUBLIC_TALENTOS_OPERATOR_CONTACT=privacy@acme.example
NEXT_PUBLIC_TALENTOS_OPERATOR_JURISDICTION="State of California, United States"

# Admin override (comma-separated emails)
NEXT_PUBLIC_TALENTOS_ADMIN_EMAILS=alice@acme.example,bob@acme.example

# Stripe (leave unset to disable monetization)
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# AI provider (defaults to Google Gemini via Genkit)
GOOGLE_GENAI_API_KEY=...

# Cross-deployment cookie consent sharing (optional)
NEXT_PUBLIC_COOKIE_DOMAIN=.example.com
```

---

## Ethics & lawful use

TalentOS is a tool for *fairer* hiring. It can also be used to enable hiring discrimination if operated in bad faith. Operators must agree to:

- **Not use TalentOS to discriminate.** Anonymization is a tool to reduce *unconscious* bias; it does not absolve the operator of legal responsibility for *conscious* hiring discrimination.
- **Be transparent with users.** Tell candidates when they are being matched against a real role vs. a research study. Tell candidates which information is revealed at each stage. Don't deanonymize people outside the reveal flow.
- **Comply with local hiring law.** EU GDPR Article 22 (automated decision-making), US EEOC guidance on AI in hiring, OECD AI Principles, etc. The matching score must be one input into a human decision, not the decision itself.
- **Get consent for AI processing.** The privacy template explicitly tells candidates that anonymized profile data goes to an AI matching system. Operators must keep this disclosure visible.

Contributions whose primary purpose is to enable surveillance, deanonymization, or bias amplification will not be merged.

---

## Roadmap

Things this repo *will* welcome PRs for:

- **Eval suite for the anonymization flows** — held-out test profiles + assertions that PII is reliably stripped at each reveal level.
- **Matching benchmark** — held-out hire/no-hire outcomes from a real dataset (anonymized) so we can score the matching algorithm against a baseline.
- **LLM provider abstraction** — first-class adapter for OpenAI / Anthropic / local Ollama in addition to Google Gemini.
- **MBTI optionality** — the personality flow defaults to Big Five; a follow-up should make MBTI fully optional (it's popular but not scientifically validated to the same degree).
- **Independent security review** — particularly of the reveal-flow state machine and the Stripe webhook signature validation.
- **i18n** — English only today.

---

## Contributing

By contributing, you agree to license your contribution under AGPL-3.0-or-later. We do not currently require a CLA but follow the [Developer Certificate of Origin](https://developercertificate.org); please sign your commits (`git commit -s`).

Open an issue before sending a large PR. We're particularly interested in security review and eval/benchmark contributions.

---

## Acknowledgements

- The Genkit team for the Gemini-on-rails AI framework.
- The personality psychology community for decades of work that makes Big Five matching credible.
- Researchers and practitioners working on anonymous and skills-first hiring (Applied, GapJumpers, GitHub's "blind PR" experiments) for proving the thesis is sound.
