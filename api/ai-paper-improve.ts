import type { PaperAnalysis } from '../shared/types.js';
import { chatJson, stringList } from './_lib/ai.js';
import { requireTeacher } from './_lib/auth.js';
import { postHandler, requireString } from './_lib/http.js';

// Teacher tool: audits exam text for clarity and accessibility.
export default postHandler(async (body, req): Promise<PaperAnalysis> => {
  await requireTeacher(req);
  const text = requireString(body, 'text', 20_000);

  const result = await chatJson(
    [
      {
        role: 'system',
        content:
          'You are an accessibility reviewer for exam papers taken by visually impaired students using screen readers and voice. ' +
          'Respond as JSON with four arrays of short strings: "claritySuggestions" (ambiguous or confusing wording and fixes), ' +
          '"visualDescriptionFixes" (diagrams, tables, symbols or formatting that need a spoken description, with a suggested description), ' +
          '"difficultyNotes" (questions whose difficulty comes from presentation rather than content), and ' +
          '"rewrittenQuestions" (improved versions of the questions that need it most).',
      },
      { role: 'user', content: text },
    ],
    1500,
  );

  return {
    claritySuggestions: stringList(result.claritySuggestions),
    visualDescriptionFixes: stringList(result.visualDescriptionFixes),
    difficultyNotes: stringList(result.difficultyNotes),
    rewrittenQuestions: stringList(result.rewrittenQuestions),
  };
});
