import { config } from 'dotenv';
config();

import '@/ai/flows/anonymize-profile.ts';
import '@/ai/flows/match-candidate-to-job.ts';
import '@/ai/flows/anonymize-job-description.ts';
import '@/ai/flows/verify-candidate-skills.ts';
