import type { AnswerInput } from './types.js';

export interface ScorableQuestion {
  id: string;
  correctOptionIndex: number;
  marks: number;
  topic: string | null;
}

export interface TopicStat {
  topic: string;
  correct: number;
  total: number;
}

export interface AttemptScore {
  score: number;
  totalMarks: number;
  totalQuestions: number;
  correctCount: number;
  answeredCount: number;
  skippedCount: number;
  markedCount: number;
  topics: TopicStat[];
}

/** Scores an attempt. Unanswered questions count as skipped and earn no marks. */
export function scoreAttempt(questions: ScorableQuestion[], answers: AnswerInput[]): AttemptScore {
  const answersByQuestion = new Map(answers.map((a) => [a.questionId, a]));
  const topics = new Map<string, TopicStat>();
  const result: AttemptScore = {
    score: 0,
    totalMarks: 0,
    totalQuestions: questions.length,
    correctCount: 0,
    answeredCount: 0,
    skippedCount: 0,
    markedCount: 0,
    topics: [],
  };

  for (const question of questions) {
    const answer = answersByQuestion.get(question.id);
    const isAnswered = answer?.selectedOptionIndex !== null && answer?.selectedOptionIndex !== undefined;
    const isCorrect = isAnswered && answer.selectedOptionIndex === question.correctOptionIndex;

    result.totalMarks += question.marks;
    if (isAnswered) result.answeredCount += 1;
    else result.skippedCount += 1;
    if (answer?.isMarked) result.markedCount += 1;
    if (isCorrect) {
      result.correctCount += 1;
      result.score += question.marks;
    }

    const topicName = question.topic?.trim() || 'General';
    const stat = topics.get(topicName) ?? { topic: topicName, correct: 0, total: 0 };
    stat.total += 1;
    if (isCorrect) stat.correct += 1;
    topics.set(topicName, stat);
  }

  result.topics = [...topics.values()];
  return result;
}

/** Topics answered below 60% are weak; 80% or better are strong. */
export function classifyTopics(topics: TopicStat[]): { weak: string[]; strong: string[] } {
  const weak: string[] = [];
  const strong: string[] = [];
  for (const t of topics) {
    const accuracy = t.total === 0 ? 0 : t.correct / t.total;
    if (accuracy < 0.6) weak.push(t.topic);
    else if (accuracy >= 0.8) strong.push(t.topic);
  }
  return { weak, strong };
}
