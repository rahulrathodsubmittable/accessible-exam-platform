import type { Difficulty } from './types.js';

// Practice Mode questions. Kept in code (not the database) so Practice Mode
// works with no login and no exam assignment. The /api/practice-explain
// function looks questions up here by id, so it can't be used as an open AI proxy.

export interface PracticeQuestion {
  id: string;
  subject: string;
  topic: string;
  difficulty: Difficulty;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  visualDescription?: string;
}

export const PRACTICE_BANK: PracticeQuestion[] = [
  {
    id: 'cs-stack-lifo',
    subject: 'Computer Science',
    topic: 'Stacks',
    difficulty: 'easy',
    questionText: 'Which data structure is best suited for Last-In, First-Out (LIFO) behaviour?',
    options: ['Stack', 'Queue', 'Binary search tree', 'Graph'],
    correctOptionIndex: 0,
    explanation:
      'A stack only lets you add (push) and remove (pop) at the top, so the most recently added item is always the first one removed. That is exactly Last-In, First-Out.',
  },
  {
    id: 'cs-queue-fifo',
    subject: 'Computer Science',
    topic: 'Queues',
    difficulty: 'easy',
    questionText: 'In a queue, where are new elements added?',
    options: ['At the front', 'At the rear', 'In the middle', 'At a random position'],
    correctOptionIndex: 1,
    explanation:
      'A queue is First-In, First-Out. New elements join at the rear and leave from the front, like people waiting in a line.',
    visualDescription: 'A horizontal line of boxes. An arrow enters the right end, labelled rear, and another arrow leaves the left end, labelled front.',
  },
  {
    id: 'cs-binary-search',
    subject: 'Computer Science',
    topic: 'Searching',
    difficulty: 'medium',
    questionText: 'Binary search on a sorted array of n elements takes how many comparisons in the worst case, roughly?',
    options: ['n', 'n divided by 2', 'log base 2 of n', 'n squared'],
    correctOptionIndex: 2,
    explanation:
      'Each comparison halves the part of the array still being searched. Halving n repeatedly until one element is left takes about log base 2 of n steps.',
  },
  {
    id: 'cs-hash-lookup',
    subject: 'Computer Science',
    topic: 'Hash Tables',
    difficulty: 'medium',
    questionText: 'What is the average time complexity of looking up a key in a well-designed hash table?',
    options: ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'],
    correctOptionIndex: 0,
    explanation:
      'A hash function turns the key directly into an array position, so on average a lookup takes constant time, O(1), no matter how many keys are stored.',
  },
  {
    id: 'math-fraction-add',
    subject: 'Mathematics',
    topic: 'Fractions',
    difficulty: 'easy',
    questionText: 'What is one half plus one quarter?',
    options: ['Two sixths', 'Three quarters', 'One third', 'Two quarters'],
    correctOptionIndex: 1,
    explanation:
      'Write one half as two quarters so both fractions have the same denominator. Two quarters plus one quarter equals three quarters.',
  },
  {
    id: 'math-percent',
    subject: 'Mathematics',
    topic: 'Percentages',
    difficulty: 'easy',
    questionText: 'What is 20 percent of 150?',
    options: ['15', '20', '30', '75'],
    correctOptionIndex: 2,
    explanation: '20 percent means 20 out of 100, or one fifth. One fifth of 150 is 150 divided by 5, which is 30.',
  },
  {
    id: 'math-linear-eq',
    subject: 'Mathematics',
    topic: 'Algebra',
    difficulty: 'medium',
    questionText: 'Solve for x: 3x plus 5 equals 20.',
    options: ['x equals 3', 'x equals 5', 'x equals 15', 'x equals 25 over 3'],
    correctOptionIndex: 1,
    explanation: 'Subtract 5 from both sides to get 3x equals 15. Then divide both sides by 3 to get x equals 5.',
  },
  {
    id: 'math-triangle-angles',
    subject: 'Mathematics',
    topic: 'Geometry',
    difficulty: 'easy',
    questionText: 'The three interior angles of any triangle add up to how many degrees?',
    options: ['90', '180', '270', '360'],
    correctOptionIndex: 1,
    explanation: 'The interior angles of every flat triangle always add up to 180 degrees.',
    visualDescription: 'A triangle with its three corners labelled A, B and C, each marked with a small arc showing the angle.',
  },
  {
    id: 'sci-photosynthesis',
    subject: 'General Science',
    topic: 'Biology',
    difficulty: 'easy',
    questionText: 'Which gas do plants absorb from the air for photosynthesis?',
    options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'],
    correctOptionIndex: 2,
    explanation:
      'Plants take in carbon dioxide through tiny pores in their leaves and, using sunlight and water, turn it into sugar, releasing oxygen as a by-product.',
  },
  {
    id: 'sci-water-boil',
    subject: 'General Science',
    topic: 'Physics',
    difficulty: 'easy',
    questionText: 'At sea level, water boils at what temperature in degrees Celsius?',
    options: ['50', '90', '100', '120'],
    correctOptionIndex: 2,
    explanation: 'At normal atmospheric pressure at sea level, pure water boils at 100 degrees Celsius.',
  },
  {
    id: 'sci-planet-largest',
    subject: 'General Science',
    topic: 'Astronomy',
    difficulty: 'easy',
    questionText: 'Which is the largest planet in our solar system?',
    options: ['Earth', 'Saturn', 'Jupiter', 'Neptune'],
    correctOptionIndex: 2,
    explanation: 'Jupiter is the largest planet. It is a gas giant, more than eleven times wider than Earth.',
  },
  {
    id: 'sci-newton-first',
    subject: 'General Science',
    topic: 'Physics',
    difficulty: 'medium',
    questionText: "Newton's first law says an object keeps moving at a constant velocity unless what happens?",
    options: ['It gets heavier', 'An unbalanced force acts on it', 'It reaches the ground', 'Time passes'],
    correctOptionIndex: 1,
    explanation:
      "Newton's first law, the law of inertia, says motion only changes when an unbalanced, or net, force acts on the object.",
  },
];

export const PRACTICE_SUBJECTS = [...new Set(PRACTICE_BANK.map((q) => q.subject))];

export function findPracticeQuestion(id: string): PracticeQuestion | undefined {
  return PRACTICE_BANK.find((q) => q.id === id);
}
