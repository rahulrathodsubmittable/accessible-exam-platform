import type { OcrResult } from '../shared/types.js';
import { chatJson, stringList } from './_lib/ai.js';
import { requireTeacher } from './_lib/auth.js';
import { HttpError, postHandler, requireString } from './_lib/http.js';
import { getAdmin } from './_lib/supabaseAdmin.js';

// Vercel limits request bodies to 4.5 MB; base64 adds ~33%, so images must be under ~3 MB.
const MAX_DATA_URL_LENGTH = 4_200_000;
const DATA_URL_PATTERN = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

// Teacher tool: turns a photo or scan of an exam page into text plus a screen-reader description.
export default postHandler(async (body, req): Promise<OcrResult> => {
  const teacher = await requireTeacher(req);
  const title = requireString(body, 'title', 200).trim();
  const imageDataUrl = requireString(body, 'imageDataUrl', MAX_DATA_URL_LENGTH);
  if (!DATA_URL_PATTERN.test(imageDataUrl)) throw new HttpError(400, 'Please upload a PNG, JPEG, WebP or GIF image.');

  const result = await chatJson(
    [
      {
        role: 'system',
        content:
          'You convert exam material into accessible text for blind students. Respond as JSON with keys ' +
          '"extractedText" (all readable text, in reading order), "accessibleDescription" (a clear spoken description of every ' +
          'diagram, chart, table or image, as a screen reader should announce it), and "detectedQuestions" (array of each exam question found, as plain text).',
      },
      {
        role: 'user',
        content: [
          { type: 'text', text: `Document title: ${title}` },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      },
    ],
    2000,
  );

  const extractedText = typeof result.extractedText === 'string' ? result.extractedText : '';
  const accessibleDescription = typeof result.accessibleDescription === 'string' ? result.accessibleDescription : '';
  const detectedQuestions = stringList(result.detectedQuestions, 100);

  const saved = await getAdmin()
    .from('documents')
    .insert({
      title,
      uploaded_by: teacher.id,
      raw_ocr_text: extractedText,
      accessible_description: accessibleDescription,
      structured_questions: detectedQuestions,
    })
    .select('id')
    .single();
  if (saved.error) console.error('Could not save OCR document', saved.error);

  return { documentId: saved.data?.id ?? null, extractedText, accessibleDescription, detectedQuestions };
});
