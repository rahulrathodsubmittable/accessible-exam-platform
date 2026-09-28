// Candidate IDs look like EXM-2026-A7K92. Ambiguous characters (0/O, 1/I/L)
// are excluded so the ID is easy to read aloud and type with a screen reader.
export const CANDIDATE_CODE_PATTERN = /^EXM-\d{4}-[A-Z0-9]{5}$/;

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export function normalizeCandidateCode(input: string): string {
  const compact = input.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = compact.match(/^EXM(\d{4})([A-Z0-9]{5})$/);
  return match ? `EXM-${match[1]}-${match[2]}` : input.trim().toUpperCase();
}

export function generateCandidateCode(year: number, randomValues: Uint32Array): string {
  if (randomValues.length < 5) throw new Error('Need at least 5 random values.');
  let suffix = '';
  for (let i = 0; i < 5; i++) suffix += ALPHABET[randomValues[i] % ALPHABET.length];
  return `EXM-${year}-${suffix}`;
}
