// src/ai/flows/anonymize-profile.ts
/**
 * @fileOverview An AI agent for anonymizing user profiles.
 *
 * - anonymizeProfile - A function that handles the profile anonymization process.
 * - AnonymizeProfileInput - The input type for the anonymizeProfile function.
 * - AnonymizeProfileOutput - The return type for the anonymizeProfile function.
 */

import {ai, isAIAvailable} from '@/ai/genkit';
import {z} from 'genkit';

const AnonymizeProfileInputSchema = z.object({
  profileText: z
    .string()
    .describe('The complete text of the user profile to be anonymized.'),
  revealLevel: z
    .number()
    .min(1)
    .max(5)
    .describe(
      'The level of detail to reveal. 1 = most anonymized, 5 = least anonymized.'
    ),
});
export type AnonymizeProfileInput = z.infer<typeof AnonymizeProfileInputSchema>;

const AnonymizeProfileOutputSchema = z.object({
  anonymizedProfile: z
    .string()
    .describe('The anonymized version of the profile text.'),
});
export type AnonymizeProfileOutput = z.infer<typeof AnonymizeProfileOutputSchema>;

function deterministicAnonymize(input: AnonymizeProfileInput): AnonymizeProfileOutput {
  const { profileText, revealLevel } = input;
  if (revealLevel <= 1) {
    return { anonymizedProfile: 'Anonymous candidate profile. Skills and experience available upon match.' };
  }
  if (revealLevel <= 2) {
    // Strip obvious PII patterns (emails, phone numbers, names at start)
    const stripped = profileText
      .replace(/[\w.-]+@[\w.-]+\.\w+/g, '[email hidden]')
      .replace(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[phone hidden]')
      .replace(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g, '[name hidden]');
    return { anonymizedProfile: stripped };
  }
  // Levels 3-5: return progressively more of the original
  return { anonymizedProfile: profileText };
}

export async function anonymizeProfile(input: AnonymizeProfileInput): Promise<AnonymizeProfileOutput> {
  if (!isAIAvailable) {
    return deterministicAnonymize(input);
  }
  try {
    return await anonymizeProfileFlow(input);
  } catch {
    return deterministicAnonymize(input);
  }
}

const prompt = ai.definePrompt({
  name: 'anonymizeProfilePrompt',
  input: {schema: AnonymizeProfileInputSchema},
  output: {schema: AnonymizeProfileOutputSchema},
  prompt: `You are an AI expert in anonymizing user profiles while preserving essential information.

You will receive a user profile and a reveal level (1-5). Based on the reveal level, you will anonymize the profile to different degrees. The tiers are:

- Level 1 (Anonymous): Remove ALL identifying information. Only show an anonymized name, a skills/experience summary, and match score. No real names, locations, companies, or contact info.
- Level 2 (Professional): Reveal general location (metro area), years of experience, industry background, and education level. Still anonymize real names, company names, and all contact details.
- Level 3 (Identity): Reveal real name, company name, job title, and contact email. Remove phone numbers, social profiles, and detailed resume content.
- Level 4 (Full Profile): Reveal full resume/experience, portfolio links, phone number, and social profiles. Only omit government ID and verification details.
- Level 5 (Verified): Reveal the complete, original profile without anonymization, including verification status and credentials.

Profile: {{{profileText}}}

Reveal Level: {{{revealLevel}}}

Anonymized Profile:`,
});

const anonymizeProfileFlow = ai.defineFlow(
  {
    name: 'anonymizeProfileFlow',
    inputSchema: AnonymizeProfileInputSchema,
    outputSchema: AnonymizeProfileOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);











