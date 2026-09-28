import { HttpError } from './http.js';

type ContentPart = { type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user';
  content: string | ContentPart[];
}

export function isAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export async function chat(messages: ChatMessage[], options: { json?: boolean; maxTokens?: number } = {}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new HttpError(503, 'AI features are not configured on this server.', 'AI_NOT_CONFIGURED');

  let response: Response;
  try {
    const baseUrl = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages,
        max_tokens: options.maxTokens ?? 700,
        temperature: 0.3,
        ...(options.json ? { response_format: { type: 'json_object' } } : {}),
      }),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (err) {
    console.error('AI request failed', err);
    throw new HttpError(502, 'The AI service could not be reached. Please try again.', 'AI_UNAVAILABLE');
  }

  if (!response.ok) {
    console.error('AI service error', response.status, await response.text().catch(() => ''));
    throw new HttpError(502, 'The AI service is unavailable right now. Please try again.', 'AI_UNAVAILABLE');
  }

  const data = (await response.json()) as { choices?: { message?: { content?: string | null } }[] };
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new HttpError(502, 'The AI service returned an empty answer.', 'AI_UNAVAILABLE');
  return content;
}

export async function chatJson(messages: ChatMessage[], maxTokens?: number): Promise<Record<string, unknown>> {
  const text = await chat(messages, { json: true, maxTokens });
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new HttpError(502, 'The AI service returned an unreadable answer.', 'AI_UNAVAILABLE');
}

export function stringList(value: unknown, max = 20): string[] {
  if (!Array.isArray(value)) return typeof value === 'string' && value.trim() ? [value.trim()] : [];
  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, max);
}
