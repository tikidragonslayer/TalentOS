/**
 * Represents the result of an MBTI personality test.
 */
export interface MbtiResult {
  personalityType: string;
}

// MBTI dimensions: E/I, S/N, T/F, J/P
const DIMENSIONS = ['EI', 'SN', 'TF', 'JP'] as const;

export interface MbtiQuestion {
  id: number;
  dimension: typeof DIMENSIONS[number];
  text: string;
  optionA: string; // Favors first letter of dimension
  optionB: string; // Favors second letter of dimension
}

/**
 * 20-question MBTI assessment (5 questions per dimension).
 */
export const MBTI_QUESTIONS: MbtiQuestion[] = [
  // E/I — Extraversion vs Introversion (5 questions)
  { id: 1, dimension: 'EI', text: 'At a networking event, you typically:', optionA: 'Introduce yourself to as many people as possible', optionB: 'Have a few deep conversations with select individuals' },
  { id: 2, dimension: 'EI', text: 'After a long day of meetings, you recharge by:', optionA: 'Going out with friends or colleagues', optionB: 'Spending quiet time alone' },
  { id: 3, dimension: 'EI', text: 'When brainstorming ideas, you prefer to:', optionA: 'Talk through ideas with a group in real time', optionB: 'Reflect on your own before sharing with others' },
  { id: 4, dimension: 'EI', text: 'In your ideal work environment:', optionA: 'You are surrounded by people in an open-plan space', optionB: 'You have a private office or quiet workspace' },
  { id: 5, dimension: 'EI', text: 'When facing a difficult problem, you first:', optionA: 'Discuss it with others to get different perspectives', optionB: 'Think it through independently before seeking input' },

  // S/N — Sensing vs Intuition (5 questions)
  { id: 6, dimension: 'SN', text: 'When learning a new skill, you prefer:', optionA: 'Step-by-step instructions with concrete examples', optionB: 'Understanding the big picture and underlying theory first' },
  { id: 7, dimension: 'SN', text: 'When making decisions, you rely more on:', optionA: 'Facts, data, and past experience', optionB: 'Patterns, possibilities, and gut instinct' },
  { id: 8, dimension: 'SN', text: 'In a project, you are drawn to:', optionA: 'Practical, proven methods that deliver results', optionB: 'Innovative approaches and untested ideas' },
  { id: 9, dimension: 'SN', text: 'When reading a report, you focus on:', optionA: 'Specific details and concrete findings', optionB: 'Themes, implications, and what could be' },
  { id: 10, dimension: 'SN', text: 'You would describe yourself as more:', optionA: 'Realistic and grounded', optionB: 'Imaginative and visionary' },

  // T/F — Thinking vs Feeling (5 questions)
  { id: 11, dimension: 'TF', text: 'When giving feedback to a teammate, you prioritize:', optionA: 'Being direct and objective about what needs improvement', optionB: 'Being supportive and considering their feelings' },
  { id: 12, dimension: 'TF', text: 'In a disagreement, you tend to:', optionA: 'Focus on logical arguments and evidence', optionB: 'Consider how the outcome will affect everyone involved' },
  { id: 13, dimension: 'TF', text: 'When hiring, you weigh more heavily:', optionA: 'Skills, qualifications, and performance metrics', optionB: 'Cultural fit, values alignment, and interpersonal skills' },
  { id: 14, dimension: 'TF', text: 'A good leader should primarily be:', optionA: 'Fair, consistent, and analytically driven', optionB: 'Empathetic, inspiring, and people-oriented' },
  { id: 15, dimension: 'TF', text: 'When a colleague is struggling, your first instinct is to:', optionA: 'Help them identify the root cause and create a plan', optionB: 'Listen, empathize, and offer emotional support' },

  // J/P — Judging vs Perceiving (5 questions)
  { id: 16, dimension: 'JP', text: 'Your workspace is typically:', optionA: 'Organized, with everything in its place', optionB: 'A bit messy, but you know where things are' },
  { id: 17, dimension: 'JP', text: 'When planning a project, you prefer to:', optionA: 'Create a detailed timeline and stick to it', optionB: 'Keep things flexible and adapt as you go' },
  { id: 18, dimension: 'JP', text: 'Deadlines make you feel:', optionA: 'Focused and productive — you plan ahead', optionB: 'Energized at the last minute — you thrive under pressure' },
  { id: 19, dimension: 'JP', text: 'On vacation, you prefer to:', optionA: 'Have a well-planned itinerary', optionB: 'Explore spontaneously and see where the day takes you' },
  { id: 20, dimension: 'JP', text: 'At work, you are more comfortable when:', optionA: 'Decisions are made and tasks are clearly defined', optionB: 'Options remain open and there is room to explore' },
];

/**
 * Calculates MBTI personality type from questionnaire answers.
 * Each answer is 'A' or 'B' mapped to the question's dimension.
 * 'A' favors the first letter, 'B' favors the second.
 */
export async function getMbtiType(answers: string[]): Promise<MbtiResult> {
  if (answers.length === 0) {
    return { personalityType: 'INFP' }; // Default when no answers provided
  }

  const scores: Record<string, number> = { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };

  answers.forEach((answer, i) => {
    const question = MBTI_QUESTIONS[i];
    if (!question) return;
    const dim = question.dimension;
    const firstLetter = dim[0];
    const secondLetter = dim[1];

    if (answer.toUpperCase() === 'A') {
      scores[firstLetter]++;
    } else {
      scores[secondLetter]++;
    }
  });

  const type = [
    scores.E >= scores.I ? 'E' : 'I',
    scores.S >= scores.N ? 'S' : 'N',
    scores.T >= scores.F ? 'T' : 'F',
    scores.J >= scores.P ? 'J' : 'P',
  ].join('');

  return { personalityType: type };
}
