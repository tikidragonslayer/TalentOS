/**
 * Represents the results of a Big Five personality test.
 */
export interface BigFiveResult {
  openness: number;
  conscientiousness: number;
  extraversion: number;
  agreeableness: number;
  neuroticism: number;
}

const TRAITS = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'] as const;

export interface BigFiveQuestion {
  id: number;
  trait: typeof TRAITS[number];
  text: string;
  reversed: boolean; // If true, scoring is inverted (6 - value)
}

/**
 * 25-question Big Five assessment (5 questions per trait).
 * Each question is rated on a 1-5 Likert scale:
 * 1 = Strongly Disagree, 2 = Disagree, 3 = Neutral, 4 = Agree, 5 = Strongly Agree
 */
export const BIG_FIVE_QUESTIONS: BigFiveQuestion[] = [
  // Openness to Experience (5 questions)
  { id: 1, trait: 'openness', text: 'I enjoy exploring new ideas and concepts.', reversed: false },
  { id: 2, trait: 'openness', text: 'I have a vivid imagination.', reversed: false },
  { id: 3, trait: 'openness', text: 'I prefer routine over variety in my daily work.', reversed: true },
  { id: 4, trait: 'openness', text: 'I am curious about many different things.', reversed: false },
  { id: 5, trait: 'openness', text: 'I prefer straightforward, practical solutions over creative ones.', reversed: true },

  // Conscientiousness (5 questions)
  { id: 6, trait: 'conscientiousness', text: 'I am always prepared and organized for meetings.', reversed: false },
  { id: 7, trait: 'conscientiousness', text: 'I pay close attention to details in my work.', reversed: false },
  { id: 8, trait: 'conscientiousness', text: 'I sometimes leave tasks unfinished when I lose interest.', reversed: true },
  { id: 9, trait: 'conscientiousness', text: 'I follow through on my commitments reliably.', reversed: false },
  { id: 10, trait: 'conscientiousness', text: 'I tend to procrastinate on difficult tasks.', reversed: true },

  // Extraversion (5 questions)
  { id: 11, trait: 'extraversion', text: 'I feel energized when working with a team.', reversed: false },
  { id: 12, trait: 'extraversion', text: 'I am comfortable being the center of attention.', reversed: false },
  { id: 13, trait: 'extraversion', text: 'I prefer to work quietly on my own.', reversed: true },
  { id: 14, trait: 'extraversion', text: 'I enjoy meeting new people at professional events.', reversed: false },
  { id: 15, trait: 'extraversion', text: 'I find small talk with strangers draining.', reversed: true },

  // Agreeableness (5 questions)
  { id: 16, trait: 'agreeableness', text: 'I try to see things from other people\'s perspectives.', reversed: false },
  { id: 17, trait: 'agreeableness', text: 'I go out of my way to help colleagues, even when it is not required.', reversed: false },
  { id: 18, trait: 'agreeableness', text: 'I can be blunt and direct, even if it upsets others.', reversed: true },
  { id: 19, trait: 'agreeableness', text: 'I value cooperation over competition in the workplace.', reversed: false },
  { id: 20, trait: 'agreeableness', text: 'I find it hard to trust people I have just met.', reversed: true },

  // Neuroticism (5 questions)
  { id: 21, trait: 'neuroticism', text: 'I often worry about things that might go wrong.', reversed: false },
  { id: 22, trait: 'neuroticism', text: 'I get stressed easily under pressure.', reversed: false },
  { id: 23, trait: 'neuroticism', text: 'I remain calm and composed in difficult situations.', reversed: true },
  { id: 24, trait: 'neuroticism', text: 'My mood can change quickly throughout the day.', reversed: false },
  { id: 25, trait: 'neuroticism', text: 'I bounce back quickly from setbacks.', reversed: true },
];

/**
 * Calculates Big Five personality traits from questionnaire answers.
 * Answers are expected as numeric strings "1"-"5" (Likert scale).
 * Each answer maps to the corresponding question by index.
 */
export async function getBigFiveTraits(answers: string[]): Promise<BigFiveResult> {
  if (answers.length === 0) {
    return { openness: 0.5, conscientiousness: 0.5, extraversion: 0.5, agreeableness: 0.5, neuroticism: 0.5 };
  }

  const sums: Record<string, number> = { openness: 0, conscientiousness: 0, extraversion: 0, agreeableness: 0, neuroticism: 0 };
  const counts: Record<string, number> = { openness: 0, conscientiousness: 0, extraversion: 0, agreeableness: 0, neuroticism: 0 };

  answers.forEach((answer, i) => {
    const question = BIG_FIVE_QUESTIONS[i];
    if (!question) return;
    const trait = question.trait;
    let value = parseInt(answer, 10);
    if (isNaN(value) || value < 1 || value > 5) return;

    // Reverse-scored items: flip the scale
    if (question.reversed) {
      value = 6 - value;
    }

    sums[trait] += value;
    counts[trait]++;
  });

  const normalize = (trait: string) => {
    if (counts[trait] === 0) return 0.5;
    return Math.round((sums[trait] / (counts[trait] * 5)) * 100) / 100;
  };

  return {
    openness: normalize('openness'),
    conscientiousness: normalize('conscientiousness'),
    extraversion: normalize('extraversion'),
    agreeableness: normalize('agreeableness'),
    neuroticism: normalize('neuroticism'),
  };
}
