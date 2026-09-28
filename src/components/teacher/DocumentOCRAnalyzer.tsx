import React, { useState } from 'react';
import { useAccessibility } from '../../contexts/AccessibilityContext';
import { ApiError, serverApi } from '../../services/serverApi';
import type { OcrResult } from '../../types';
import { inputClass, labelClass, primaryButton, secondaryButton } from './useTeacherExams';

const MAX_BYTES = 3 * 1024 * 1024;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export const DocumentOCRAnalyzer: React.FC = () => {
  const { speakText } = useAccessibility();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [result, setResult] = useState<OcrResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const onFile = async (f: File | undefined) => {
    setResult(null);
    setError(null);
    if (!f) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(f.type)) {
      setError('Please choose a PNG, JPEG, WebP or GIF image. For PDFs, take a screenshot of each page.');
      return;
    }
    if (f.size > MAX_BYTES) {
      setError('That image is larger than 3 MB. Please use a smaller or compressed image.');
      return;
    }
    setFile(f);
    setTitle((t) => t || f.name.replace(/\.[^.]+$/, ''));
    setPreview(await readAsDataUrl(f));
  };

  const analyze = async () => {
    if (!file || !preview) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await serverApi.processOcr(title.trim() || file.name, preview));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The document could not be processed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 p-6 rounded-xl space-y-5">
      <h2 className="text-2xl font-bold">Vision & OCR Accessibility</h2>
      <p className="text-lg text-slate-300">
        Upload a photo or scan of an exam page. The AI extracts the text and writes a screen-reader description of diagrams, charts
        and tables.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="ocr-file" className={labelClass}>Image</label>
          <input
            id="ocr-file"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={(e) => void onFile(e.target.files?.[0])}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="ocr-title" className={labelClass}>Title</label>
          <input id="ocr-title" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>
      </div>
      {preview && <img src={preview} alt="Preview of the uploaded document" className="max-h-72 rounded-lg border-2 border-slate-600" />}
      <button onClick={() => void analyze()} disabled={!file || loading} className={primaryButton}>
        {loading ? 'Processing…' : 'Extract text & describe'}
      </button>
      {error && (
        <p role="alert" className="text-lg text-red-300">
          {error}
        </p>
      )}

      {result && (
        <section className="space-y-4 border-t border-slate-700 pt-4" aria-labelledby="ocr-results">
          <h3 id="ocr-results" className="text-xl font-bold text-yellow-400">
            Results {result.documentId ? '(saved)' : ''}
          </h3>
          <div className="bg-slate-800 p-4 rounded-lg space-y-2">
            <h4 className="font-bold text-purple-300">Screen-reader description</h4>
            <p className="whitespace-pre-line">{result.accessibleDescription || 'No visual content detected.'}</p>
            <button onClick={() => speakText(result.accessibleDescription)} className={secondaryButton}>
              Read aloud
            </button>
          </div>
          <div className="bg-slate-800 p-4 rounded-lg space-y-2">
            <h4 className="font-bold text-green-400">Extracted text</h4>
            <p className="whitespace-pre-line">{result.extractedText || 'No text found.'}</p>
          </div>
          {result.detectedQuestions.length > 0 && (
            <div className="bg-slate-800 p-4 rounded-lg">
              <h4 className="font-bold text-blue-300 mb-2">Detected questions</h4>
              <ol className="list-decimal pl-6 space-y-1">
                {result.detectedQuestions.map((q) => (
                  <li key={q}>{q}</li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
