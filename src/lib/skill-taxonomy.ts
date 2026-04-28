export const SKILL_TAXONOMY: Record<string, string[]> = {
  'Frontend': [
    'React', 'Angular', 'Vue.js', 'Next.js', 'TypeScript', 'JavaScript',
    'HTML/CSS', 'Svelte', 'Tailwind CSS', 'Redux', 'Remix', 'Astro',
    'jQuery', 'Sass/SCSS', 'Bootstrap', 'Material UI', 'Storybook',
  ],
  'Backend': [
    'Node.js', 'Python', 'Go', 'Java', 'C#', 'Ruby', 'Rust', 'PHP',
    'Django', 'Spring Boot', 'Express.js', 'FastAPI', 'Flask', 'Rails',
    'ASP.NET', 'NestJS', 'Elixir', 'Scala', 'Haskell',
  ],
  'Data & AI': [
    'Machine Learning', 'Data Science', 'SQL', 'PostgreSQL', 'MongoDB',
    'TensorFlow', 'PyTorch', 'Data Engineering', 'ETL', 'Spark',
    'Pandas', 'R', 'Tableau', 'Power BI', 'dbt', 'Snowflake',
    'Natural Language Processing', 'Computer Vision', 'LLMs',
    'Prompt Engineering', 'RAG', 'MLOps',
  ],
  'DevOps & Cloud': [
    'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'CI/CD', 'Terraform',
    'Linux', 'Networking', 'Ansible', 'Jenkins', 'GitHub Actions',
    'CloudFormation', 'Pulumi', 'Helm', 'ArgoCD', 'Datadog',
    'Prometheus', 'Grafana', 'Nginx',
  ],
  'Mobile': [
    'React Native', 'Flutter', 'Swift', 'Kotlin', 'iOS Development',
    'Android Development', 'Dart', 'Xamarin', 'SwiftUI', 'Jetpack Compose',
  ],
  'Design': [
    'UI/UX Design', 'Figma', 'Product Design', 'User Research',
    'Accessibility', 'Design Systems', 'Wireframing', 'Prototyping',
    'Adobe XD', 'Sketch', 'Information Architecture',
  ],
  'Management': [
    'Product Management', 'Project Management', 'Agile/Scrum',
    'Technical Leadership', 'Engineering Management', 'Kanban',
    'Stakeholder Management', 'OKRs', 'Roadmapping',
  ],
  'Security': [
    'Cybersecurity', 'Penetration Testing', 'Security Architecture',
    'Compliance', 'Identity Management', 'SIEM', 'SOC',
    'Cloud Security', 'Application Security', 'Zero Trust',
  ],
  'Other': [
    'Technical Writing', 'System Design', 'API Design', 'GraphQL',
    'Blockchain', 'Web3', 'Game Development', 'Embedded Systems',
    'IoT', 'QA/Testing', 'Selenium', 'Cypress', 'Playwright',
    'Performance Optimization', 'Microservices', 'Event-Driven Architecture',
  ],
} as const;

export const ALL_SKILLS: string[] = Object.values(SKILL_TAXONOMY).flat();

/** Case-insensitive exact match against the taxonomy */
export function isValidSkill(skill: string): boolean {
  const normalized = skill.trim().toLowerCase();
  return ALL_SKILLS.some(s => s.toLowerCase() === normalized);
}

/** Return the canonical (properly-cased) name if it matches */
export function canonicalSkillName(skill: string): string | null {
  const normalized = skill.trim().toLowerCase();
  return ALL_SKILLS.find(s => s.toLowerCase() === normalized) ?? null;
}

/**
 * Find the closest skill in the taxonomy using simple substring + Levenshtein distance.
 * Returns null if nothing is reasonably close.
 */
export function findClosestSkill(input: string): string | null {
  const normalized = input.trim().toLowerCase();
  if (!normalized) return null;

  // First try: substring match (input contained in a skill name or vice-versa)
  const substringMatch = ALL_SKILLS.find(
    s => s.toLowerCase().includes(normalized) || normalized.includes(s.toLowerCase())
  );
  if (substringMatch) return substringMatch;

  // Second try: Levenshtein distance
  let bestMatch: string | null = null;
  let bestDistance = Infinity;

  for (const skill of ALL_SKILLS) {
    const dist = levenshtein(normalized, skill.toLowerCase());
    if (dist < bestDistance) {
      bestDistance = dist;
      bestMatch = skill;
    }
  }

  // Only suggest if the distance is reasonably small relative to the input length
  const threshold = Math.max(3, Math.floor(normalized.length * 0.4));
  if (bestDistance <= threshold && bestMatch) {
    return bestMatch;
  }

  return null;
}

/** Simple Levenshtein distance implementation */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}
