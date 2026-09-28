import type { IncomingMessage, ServerResponse } from 'node:http';

// Vercel Node.js functions receive Node's req/res (with req.body pre-parsed).
// The local Vite dev server passes the raw stream, so readBody handles both.
export type ApiRequest = IncomingMessage & { body?: unknown };
export type ApiResponse = ServerResponse;
export type JsonBody = Record<string, unknown>;

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message);
  }
}

export function sendJson(res: ApiResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

async function readBody(req: ApiRequest): Promise<JsonBody> {
  let body: unknown;
  try {
    body = req.body;
  } catch {
    throw new HttpError(400, 'Request body is not valid JSON.');
  }

  if (body === undefined) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    body = Buffer.concat(chunks).toString('utf8');
  } else if (Buffer.isBuffer(body)) {
    body = body.toString('utf8');
  }

  if (typeof body === 'string') {
    try {
      body = body.trim() ? JSON.parse(body) : {};
    } catch {
      throw new HttpError(400, 'Request body is not valid JSON.');
    }
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'Request body must be a JSON object.');
  }
  return body as JsonBody;
}

/** Wraps a POST-only JSON endpoint with body parsing and consistent errors. */
export function postHandler(fn: (body: JsonBody, req: ApiRequest) => Promise<unknown>) {
  return async (req: ApiRequest, res: ApiResponse): Promise<void> => {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      sendJson(res, 405, { error: 'Method not allowed.' });
      return;
    }
    try {
      const body = await readBody(req);
      sendJson(res, 200, await fn(body, req));
    } catch (err) {
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message, code: err.code });
        return;
      }
      console.error(err);
      sendJson(res, 500, { error: 'Something went wrong on the server. Please try again.' });
    }
  };
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireString(body: JsonBody, key: string, maxLength: number): string {
  const value = body[key];
  if (typeof value !== 'string' || !value.trim()) throw new HttpError(400, `"${key}" is required.`);
  if (value.length > maxLength) throw new HttpError(413, `"${key}" is too long.`);
  return value;
}

export function requireUuid(body: JsonBody, key: string): string {
  const value = body[key];
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) throw new HttpError(400, `"${key}" must be a valid id.`);
  return value;
}

export function optionalIndex(body: JsonBody, key: string): number | null {
  const value = body[key];
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > 10) {
    throw new HttpError(400, `"${key}" must be a small whole number or null.`);
  }
  return value;
}

export function optionalBoolean(body: JsonBody, key: string): boolean {
  return body[key] === true;
}

/** Throws a PostgREST error so postHandler logs it and returns a 500. */
export function check<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw new Error(`Database error: ${result.error.message}`);
  return result.data;
}
