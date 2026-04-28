export type RevealTierKey = 1 | 2 | 3 | 4 | 5;

export interface RevealTierInfo {
  name: string;
  description: string;
  reveals: string[];
  cost: number; // OS Credits to upgrade TO this tier
}

export const REVEAL_TIERS: Record<RevealTierKey, RevealTierInfo> = {
  1: {
    name: 'Anonymous',
    description: 'Anonymized names only. No identifying information.',
    reveals: ['Anonymized name', 'Skills & experience summary', 'Match score'],
    cost: 0,
  },
  2: {
    name: 'Professional',
    description: 'General professional context revealed.',
    reveals: ['General location (metro area)', 'Years of experience', 'Industry background', 'Education level'],
    cost: 1,
  },
  3: {
    name: 'Identity',
    description: 'Real identities revealed to both parties.',
    reveals: ['Real name', 'Company name', 'Job title', 'Contact email'],
    cost: 2,
  },
  4: {
    name: 'Full Profile',
    description: 'Complete profile access.',
    reveals: ['Full resume/experience', 'Portfolio links', 'Phone number', 'Social profiles'],
    cost: 3,
  },
  5: {
    name: 'Verified',
    description: 'Verified identity with documentation.',
    reveals: ['Government ID verified', 'Background check status', 'Full credential verification'],
    cost: 5,
  },
} as const;

export const MAX_TIER: RevealTierKey = 5;

/** Get the tier info, defaulting to tier 1 for out-of-range values. */
export function getTierInfo(tier: number): RevealTierInfo {
  const key = (tier >= 1 && tier <= 5 ? tier : 1) as RevealTierKey;
  return REVEAL_TIERS[key];
}

/** Get the cost to upgrade from the current tier to the next tier. */
export function getUpgradeCost(currentTier: number): number {
  const nextTier = currentTier + 1;
  if (nextTier > 5) return 0;
  return REVEAL_TIERS[nextTier as RevealTierKey].cost;
}
