import { classifyTopics, scoreAttempt } from '../shared/scoring.js';
import type { PerformanceAnalysis } from '../shared/types.js';
import { chatJson, isAiConfigured, stringList } from './_lib/ai.js';
import { loadAnswers, loadAttempt, loadQuestions } from './_lib/exam.js';
import { check, HttpError, postHandler, requireUuid } from './_lib/http.js';
import { getAdmin } from './_lib/supabaseAdmin.js';

const BARRIER_LABELS: Record<string, string> = {
  repeated_read: 'Some questions needed to be read aloud several times; clearer or shorter wording may help.',
  nav_delay: 'Long pauses on some questions suggest they were hard to follow by audio.',
  voice_error: 'Voice commands were sometimes not recognised; keyboard shortcuts are a reliable alternative.',
  skip_spike: 'Several questions were skipped in a row; revisiting skipped questions before submitting can help.',
};

interface AnalysisRow {
  weak_topics: unknown;
  strong_topics: unknown;
  learning_barriers: unknown;
  recommended_practice: unknown;
  overall_summary: string;
  ai_generated: boolean;
}

function fromRow(row: AnalysisRow): PerformanceAnalysis {
  return {
    weakTopics: stringList(row.weak_topics),
    strongTopics: stringList(row.strong_topics),
    learningBarriers: stringList(row.learning_barriers),
    recommendedPractice: stringList(row.recommended_practice),
    overallSummary: row.overall_summary,
    aiGenerated: row.ai_generated,
  };
}

// Builds (once) and returns the post-exam performance and barrier report.
export default postHandler(async (body): Promise<PerformanceAnalysis> => {
  const { attempt, exam } = await loadAttempt(requireUuid(body, 'attemptId'));
  if (attempt.status !== 'submitted') throw new HttpError(409, 'The report is available after the exam is submitted.');

  const admin = getAdmin();
  const existing = check(
    await admin.from('ai_analysis').select('*').eq('attempt_id', attempt.id).maybeSingle(),
  ) as AnalysisRow | null;
  if (existing) return fromRow(existing);

  const questions = await loadQuestions(exam.id);
  const score = scoreAttempt(
    questions.map((q) => ({ id: q.id, correctOptionIndex: q.correct_option_index, marks: q.marks, topic: q.topic })),
    await loadAnswers(attempt.id),
  );
  const { weak, strong } = classifyTopics(score.topics);

  const events = check(
    await admin.from('barrier_events').select('event_type').eq('attempt_id', attempt.id),
  ) as { event_type: string }[];
  const barrierCounts = events.reduce<Record<string, number>>((acc, e) => {
    acc[e.event_type] = (acc[e.event_type] ?? 0) + 1;
    return acc;
  }, {});

  const analysis: PerformanceAnalysis = {
    weakTopics: weak,
    strongTopics: strong,
    learningBarriers: Object.keys(barrierCounts).map((type) => BARRIER_LABELS[type]).filter(Boolean),
    recommendedPractice: weak.length
      ? weak.map((t) => `Practise more questions on ${t} in Practice Mode.`)
      : ['Keep practising mixed questions to stay sharp.'],
    overallSummary:
      `You answered ${score.correctCount} of ${score.totalQuestions} questions correctly, scoring ${score.score} out of ${score.totalMarks}. ` +
      (strong.length ? `You did well in ${strong.join(', ')}. ` : '') +
      (weak.length ? `Focus your next practice on ${weak.join(', ')}.` : 'Great work across all topics.'),
    aiGenerated: false,
  };

  if (isAiConfigured()) {
    try {
      const ai = await chatJson(
        [
          {
            role: 'system',
            content:
              'You write supportive, specific feedback for visually impaired students after an exam. Respond as JSON with keys ' +
              '"overall_summary" (string, under 90 words, plain spoken language) and "recommended_practice" (array of up to 4 short strings).',
          },
          {
            role: 'user',
            content: JSON.stringify({
              exam: exam.title,
              score: `${score.score}/${score.totalMarks}`,
              correct: `${score.correctCount}/${score.totalQuestions}`,
              topics: score.topics,
              accessibilityBarrierEvents: barrierCounts,
            }),
          },
        ],
        500,
      );
      const summary = typeof ai.overall_summary === 'string' ? ai.overall_summary.trim() : '';
      const practice = stringList(ai.recommended_practice, 4);
      if (summary) {
        analysis.overallSummary = summary;
        if (practice.length) analysis.recommendedPractice = practice;
        analysis.aiGenerated = true;
      }
    } catch (err) {
      console.error('AI summary failed; using rule-based summary', err);
    }
  }

  // Ignore a duplicate insert from a concurrent request.
  await admin.from('ai_analysis').upsert(
    {
      attempt_id: attempt.id,
      weak_topics: analysis.weakTopics,
      strong_topics: analysis.strongTopics,
      learning_barriers: analysis.learningBarriers,
      recommended_practice: analysis.recommendedPractice,
      overall_summary: analysis.overallSummary,
      ai_generated: analysis.aiGenerated,
    },
    { onConflict: 'attempt_id', ignoreDuplicates: true },
  );
  return analysis;
});
