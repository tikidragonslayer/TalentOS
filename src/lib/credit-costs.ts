export const CREDIT_COSTS = {
  ANONYMIZE_JOB: 1,
  SKILL_VERIFICATION: 2,
  JOB_CONTEXT_EXTRACTION: 1,
  MATCH_SCAN: 1,
  REVEAL_TIER_UPGRADE: 'per-tier', // costs defined in src/lib/reveal-tiers.ts (0, 1, 2, 3, 5)
} as const;
