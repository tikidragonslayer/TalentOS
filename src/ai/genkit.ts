import { genkit, type Genkit } from 'genkit';
import { googleAI } from '@genkit-ai/googleai';

const apiKey = process.env.GOOGLE_GENAI_API_KEY;

/**
 * Whether real Genkit AI is available.
 * When false, flows must use deterministic fallbacks instead of calling ai.generate().
 */
export const isAIAvailable = !!apiKey;

/**
 * Lazy-initialized Genkit instance.
 * At module scope we create a stub that supports definePrompt/defineFlow/defineTool
 * so flow modules can register their schemas at import time without crashing.
 * The actual AI calls (generate, prompt execution) will only work when the API key is set.
 */
function createAI(): Genkit {
  if (apiKey) {
    return genkit({
      plugins: [googleAI({ apiKey })],
      model: 'googleai/gemini-2.0-flash',
    });
  }

  // No API key — create a real Genkit instance without the Google AI plugin.
  // definePrompt/defineFlow/defineTool will work for schema registration,
  // but any generate() call will fail (callers must check isAIAvailable first).
  return genkit({
    plugins: [],
  });
}

export const ai = createAI();
