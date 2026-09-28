import { describe, expect, it } from 'vitest';
import { classifyTopics, scoreAttempt } from '../../shared/scoring';

const questions = [
  { id: 'q1', correctOptionIndex: 2, marks: 2, topic: 'Trees' },
  { id: 'q2', correctOptionIndex: 1, marks: 1, topic: 'Queues' },
  { id: 'q3', correctOptionIndex: 0, marks: 1, topic: 'Trees' },
  { id: 'q4', correctOptionIndex: 3, marks: 1, topic: null },
];

describe('scoreAttempt', () => {
  it('awards marks only for correct answers and counts unanswered as skipped', () => {
    const result = scoreAttempt(questions, [
      { questionId: 'q1', selectedOptionIndex: 2, isSkipped: false, isMarked: true },
      { questionId: 'q2', selectedOptionIndex: 0, isSkipped: false, isMarked: false },
      { questionId: 'q3', selectedOptionIndex: null, isSkipped: true, isMarked: true },
    ]);

    expect(result).toMatchObject({
      score: 2,
      totalMarks: 5,
      totalQuestions: 4,
      correctCount: 1,
      answeredCount: 2,
      skippedCount: 2,
      markedCount: 2,
    });
    expect(result.topics).toEqual([
      { topic: 'Trees', correct: 1, total: 2 },
      { topic: 'Queues', correct: 0, total: 1 },
      { topic: 'General', correct: 0, total: 1 },
    ]);
  });

  it('ignores answers to questions outside the exam', () => {
    const result = scoreAttempt(questions.slice(0, 1), [
      { questionId: 'other', selectedOptionIndex: 2, isSkipped: false, isMarked: false },
    ]);
    expect(result.score).toBe(0);
    expect(result.skippedCount).toBe(1);
  });

  it('handles an exam with no answers', () => {
    expect(scoreAttempt(questions, []).score).toBe(0);
  });
});

describe('classifyTopics', () => {
  it('splits topics into weak (<60%) and strong (>=80%)', () => {
    expect(
      classifyTopics([
        { topic: 'A', correct: 1, total: 2 },
        { topic: 'B', correct: 4, total: 5 },
        { topic: 'C', correct: 7, total: 10 },
      ]),
    ).toEqual({ weak: ['A'], strong: ['B'] });
  });
});
