/**
 * @fileOverview Timed skill assessment framework for TalentOS candidate verification.
 * Copyright (c) 2026 TalentOS. All rights reserved.
 */

export interface ChallengeQuestion {
  prompt: string;
  type: 'multiple-choice' | 'code-snippet' | 'scenario' | 'free-response';
  options?: string[];
  correctAnswer?: string;
  scoringRubric: string;
}

export interface SkillChallenge {
  id: string;
  skill: string;
  difficulty: 'junior' | 'mid' | 'senior';
  timeLimit: number; // seconds
  questions: ChallengeQuestion[];
}

export interface ChallengeResult {
  challengeId: string;
  skill: string;
  difficulty: string;
  score: number; // 0-100
  completedAt: string; // ISO timestamp
  timeSpentSeconds: number;
  answers: { questionIndex: number; answer: string; correct: boolean; points: number }[];
}

// ─── Scoring ───

export function scoreChallengeAnswers(
  challenge: SkillChallenge,
  userAnswers: string[],
): ChallengeResult {
  const maxPointsPerQuestion = 100 / challenge.questions.length;
  const answers: ChallengeResult['answers'] = [];
  let totalScore = 0;

  challenge.questions.forEach((q, idx) => {
    const userAnswer = (userAnswers[idx] || '').trim();
    let correct = false;
    let points = 0;

    if (q.type === 'multiple-choice' || q.type === 'code-snippet') {
      // Exact match for MCQ and code-snippet
      correct = userAnswer.toLowerCase() === (q.correctAnswer || '').toLowerCase();
      points = correct ? maxPointsPerQuestion : 0;
    } else if (q.type === 'scenario') {
      // Scenario: match correct answer if provided, otherwise partial credit by length
      if (q.correctAnswer) {
        correct = userAnswer.toLowerCase() === q.correctAnswer.toLowerCase();
        points = correct ? maxPointsPerQuestion : 0;
      } else {
        // Free-form scenario: award partial credit based on response substance
        const wordCount = userAnswer.split(/\s+/).filter(Boolean).length;
        points = Math.min(maxPointsPerQuestion, (wordCount / 50) * maxPointsPerQuestion);
        correct = wordCount >= 20;
      }
    } else {
      // free-response: partial credit by word count
      const wordCount = userAnswer.split(/\s+/).filter(Boolean).length;
      points = Math.min(maxPointsPerQuestion, (wordCount / 50) * maxPointsPerQuestion);
      correct = wordCount >= 20;
    }

    totalScore += points;
    answers.push({ questionIndex: idx, answer: userAnswer, correct, points: Math.round(points) });
  });

  return {
    challengeId: challenge.id,
    skill: challenge.skill,
    difficulty: challenge.difficulty,
    score: Math.round(totalScore),
    completedAt: new Date().toISOString(),
    timeSpentSeconds: 0, // Caller should set this
    answers,
  };
}

// ─── Challenge Definitions ───

export const SKILL_CHALLENGES: SkillChallenge[] = [
  // 1. JavaScript Challenge
  {
    id: 'js-mid-001',
    skill: 'JavaScript',
    difficulty: 'mid',
    timeLimit: 300, // 5 minutes
    questions: [
      {
        prompt: `What is the output of the following code?\n\nconsole.log(typeof null);\nconsole.log(typeof undefined);\nconsole.log(null === undefined);\nconsole.log(null == undefined);`,
        type: 'multiple-choice',
        options: [
          'object, undefined, false, true',
          'null, undefined, true, true',
          'object, undefined, true, false',
          'null, undefined, false, false',
        ],
        correctAnswer: 'object, undefined, false, true',
        scoringRubric: 'Tests understanding of JavaScript type coercion and the infamous typeof null bug. Correct answer demonstrates knowledge of loose vs strict equality.',
      },
      {
        prompt: `The following function is supposed to debounce API calls but has a bug. Identify the issue.\n\nfunction debounce(fn, delay) {\n  let timer;\n  return function(...args) {\n    clearTimeout(timer);\n    timer = setTimeout(fn(...args), delay);\n  }\n}`,
        type: 'multiple-choice',
        options: [
          'fn(...args) is invoked immediately instead of being passed as a callback to setTimeout',
          'clearTimeout should come after setTimeout',
          'The timer variable is not properly scoped',
          'The spread operator should not be used with args',
        ],
        correctAnswer: 'fn(...args) is invoked immediately instead of being passed as a callback to setTimeout',
        scoringRubric: 'Tests ability to spot common closure/callback bugs. The fix is: setTimeout(() => fn(...args), delay). Candidate must understand that fn(...args) executes immediately and its return value is passed to setTimeout.',
      },
      {
        prompt: 'You need to process 10,000 items from an API without blocking the UI thread. Which approach is most appropriate and why? Choose the best option.',
        type: 'multiple-choice',
        options: [
          'Use a simple for loop for maximum performance',
          'Use Web Workers to move processing off the main thread',
          'Use Array.forEach with async/await on each item',
          'Use requestAnimationFrame to process items in batches',
        ],
        correctAnswer: 'Use Web Workers to move processing off the main thread',
        scoringRubric: 'Tests understanding of browser event loop and concurrency. Web Workers are the correct choice for CPU-intensive processing. requestAnimationFrame batching is acceptable but less optimal. A simple for loop would block the UI.',
      },
    ],
  },

  // 2. Project Management Challenge
  {
    id: 'pm-mid-001',
    skill: 'Project Management',
    difficulty: 'mid',
    timeLimit: 300,
    questions: [
      {
        prompt: 'Your team has 3 sprints left before a hard launch deadline. The product owner just added a critical security feature that was not in the original scope. Your velocity is 40 points/sprint and you have 130 points of committed work remaining. The security feature is estimated at 25 points. What is your recommended course of action?',
        type: 'multiple-choice',
        options: [
          'Add the security feature and ask the team to work overtime to absorb the extra 35 points',
          'Add the security feature and negotiate removing 25+ points of lower-priority items with the product owner',
          'Reject the security feature as out-of-scope and defer it to a post-launch patch',
          'Split the security feature across all 3 sprints at ~8 points each without changing anything else',
        ],
        correctAnswer: 'Add the security feature and negotiate removing 25+ points of lower-priority items with the product owner',
        scoringRubric: 'Tests scope management and trade-off negotiation. The correct approach preserves velocity while acknowledging the security need. Overtime is unsustainable. Rejecting security outright is risky. Splitting without adjustment ignores capacity constraints.',
      },
      {
        prompt: 'A key dependency (third-party API integration) is 2 weeks behind schedule, and it blocks 3 downstream features. Your stakeholders expect a demo in 10 days. Which risk response strategy is most appropriate?',
        type: 'multiple-choice',
        options: [
          'Accept the risk and push the demo back 2 weeks',
          'Mitigate by building a mock API layer so downstream work can proceed, and demo with the mock',
          'Transfer the risk by escalating to the third-party vendor and making it their problem',
          'Avoid the risk by removing the API-dependent features from the project scope entirely',
        ],
        correctAnswer: 'Mitigate by building a mock API layer so downstream work can proceed, and demo with the mock',
        scoringRubric: 'Tests risk response strategy. Mitigation with a mock layer unblocks parallel work and enables a meaningful demo. Acceptance delays everything. Transfer alone does not solve the timeline. Avoidance removes potentially critical features.',
      },
      {
        prompt: 'Two senior engineers on your team disagree publicly about the architecture for a new microservice. One wants event-driven (Kafka), the other wants REST with polling. The argument is slowing down sprint progress. How do you handle this as the PM?',
        type: 'multiple-choice',
        options: [
          'Make the architecture decision yourself to end the debate quickly',
          'Let them argue it out until one convinces the other',
          'Facilitate a time-boxed technical design review where both present trade-offs, then drive a decision with clear criteria',
          'Escalate to the CTO and let leadership decide',
        ],
        correctAnswer: 'Facilitate a time-boxed technical design review where both present trade-offs, then drive a decision with clear criteria',
        scoringRubric: 'Tests stakeholder communication and conflict resolution. A structured review respects both perspectives and drives a data-informed decision. Making it yourself oversteps PM boundaries. Letting it fester wastes time. Escalation signals inability to manage the team.',
      },
    ],
  },

  // 3. Data Analysis Challenge
  {
    id: 'da-mid-001',
    skill: 'Data Analysis',
    difficulty: 'mid',
    timeLimit: 300,
    questions: [
      {
        prompt: 'Your e-commerce dashboard shows: Last month revenue was $500K with 10,000 orders (AOV $50). This month revenue is $480K with 12,000 orders. What happened and what metric should you investigate first?',
        type: 'multiple-choice',
        options: [
          'Revenue dropped 4% — investigate marketing spend changes',
          'AOV dropped from $50 to $40 despite 20% more orders — investigate product mix and discount usage',
          'Order volume increased 20% — the business is growing and revenue will follow',
          'Revenue is roughly flat — no action needed',
        ],
        correctAnswer: 'AOV dropped from $50 to $40 despite 20% more orders — investigate product mix and discount usage',
        scoringRubric: 'Tests metric decomposition. Revenue = Orders x AOV. Orders grew 20% but AOV dropped 20% ($50 to $40), netting a 4% revenue decline. The candidate must decompose revenue into its components and identify the AOV drop as the driver.',
      },
      {
        prompt: 'You ran an A/B test on a checkout page redesign. Group A (control): 5,000 visitors, 150 conversions (3.0%). Group B (variant): 5,000 visitors, 175 conversions (3.5%). The p-value is 0.12. What is your recommendation?',
        type: 'multiple-choice',
        options: [
          'Ship the variant — 3.5% vs 3.0% is a meaningful improvement',
          'Do not ship yet — the result is not statistically significant at p < 0.05; extend the test with more traffic',
          'The test failed — revert to the control permanently',
          'Ship the variant to 50% of users as a compromise',
        ],
        correctAnswer: 'Do not ship yet — the result is not statistically significant at p < 0.05; extend the test with more traffic',
        scoringRubric: 'Tests understanding of statistical significance. p=0.12 means there is a 12% chance the difference is due to randomness, which exceeds the standard 5% threshold. The correct action is to gather more data, not to ship or permanently kill the test.',
      },
      {
        prompt: 'A manager asks you to build a dashboard showing "customer satisfaction over time." You have NPS survey data, support ticket volume, churn rate, and app store ratings. Which combination of metrics best represents the full picture?',
        type: 'multiple-choice',
        options: [
          'NPS score alone — it directly measures satisfaction',
          'NPS trend + churn rate trend + support ticket volume per active user, with app store rating as a supplementary signal',
          'Churn rate only — if customers leave, they are unsatisfied',
          'App store ratings — they are public and represent real customer voices',
        ],
        correctAnswer: 'NPS trend + churn rate trend + support ticket volume per active user, with app store rating as a supplementary signal',
        scoringRubric: 'Tests ability to construct a composite metric view. No single metric captures satisfaction. NPS measures stated sentiment, churn measures behavior, ticket volume measures friction, and app ratings provide external validation. The best answer combines leading and lagging indicators.',
      },
    ],
  },
];

/** Look up a challenge by ID */
export function getChallengeById(id: string): SkillChallenge | undefined {
  return SKILL_CHALLENGES.find(c => c.id === id);
}

/** Get all challenges for a specific skill */
export function getChallengesForSkill(skill: string): SkillChallenge[] {
  return SKILL_CHALLENGES.filter(c => c.skill.toLowerCase() === skill.toLowerCase());
}

/** Get available skill names that have challenges */
export function getAvailableChallengeSkills(): string[] {
  return [...new Set(SKILL_CHALLENGES.map(c => c.skill))];
}
