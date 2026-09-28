import { findPracticeQuestion } from '../shared/practiceBank.js';
import type { PracticeExplanation } from '../shared/types.js';
import { chat, isAiConfigured } from './_lib/ai.js';
import { HttpError, optionalIndex, postHandler, requireString } from './_lib/http.js';

const cache = new Map<string, string>();

// Practice-mode explanation (unlimited). Falls back to the built-in explanation without AI.
export default postHandler(async (body): Promise<PracticeExplanation> => {
  const question = findPracticeQuestion(requireString(body, 'questionId', 64));
  if (!question) throw new HttpError(404, 'Practice question not found.');
  const selected = optionalIndex(body, 'selectedOptionIndex');

  if (!isAiConfigured()) return { explanation: question.explanation, aiGenerated: false };

  const cacheKey = `${question.id}:${selected ?? 'none'}`;
  const cached = cache.get(cacheKey);
  if (cached) return { explanation: cached, aiGenerated: true };

  const letter = (i: number) => String.fromCharCode(65 + i);
  try {
    const explanation = await chat(
      [
        {
          role: 'system',
          content:
            'You are a patient tutor for visually impaired students. Explain in short spoken-style sentences that read well ' +
            'through a screen reader: the core concept, the reasoning step by step, why the correct option is right, and one common ' +
            'mistake to avoid. No markdown symbols, no tables, under 180 words.',
        },
        {
          role: 'user',
          content:
            `Subject: ${question.subject}. Topic: ${question.topic}.\n` +
            `Question: ${question.questionText}\n` +
            `Options: ${question.options.map((o, i) => `${letter(i)}. ${o}`).join('; ')}\n` +
            `Correct option: ${letter(question.correctOptionIndex)}.\n` +
            (selected !== null && question.options[selected] !== undefined
              ? `The student chose ${letter(selected)}.`
              : 'The student has not answered yet.'),
        },
      ],
      { maxTokens: 400 },
    );
    cache.set(cacheKey, explanation);
    return { explanation, aiGenerated: true };
  } catch (err) {
    console.error('Practice explanation fell back to built-in text', err);
    return { explanation: question.explanation, aiGenerated: false };
  }
});
