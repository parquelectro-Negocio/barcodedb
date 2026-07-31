// Pure text-matching helpers for products whose identity is name + attributes
// (not a barcode) — cable, fichas, térmicas, etc. Deterministic: safe to run on
// both sides of a comparison without touching any stored data.

// Generic connector/noise tokens that carry no identifying signal.
const NOISE = new Set(['de', 'x', 'para', 'con', 'el', 'la', 'los', 'las', 'y', 'o', 'a']);

// Lowercase, strip accents, unify the decimal comma, split number/letter joins,
// drop non-decimal punctuation, collapse whitespace.
//   "Cable 2,5mm Sica" -> "cable 2.5 mm sica"
export function normalize(text: string): string {
  return (text ?? '')
    .normalize('NFD').replace(/\p{M}/gu, '')          // strip accents (combining marks)
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1.$2')                    // 2,5 -> 2.5
    .replace(/(?<!\d)\.(?!\d)/g, ' ')                  // drop dots that aren't decimals
    .replace(/([a-z])(\d)/g, '$1 $2')                  // sica16 -> sica 16
    .replace(/(\d)([a-z])/g, '$1 $2')                  // 2.5mm -> 2.5 mm
    .replace(/[^a-z0-9. ]+/g, ' ')                     // other punctuation -> space
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokenize(text: string): string[] {
  return normalize(text).split(' ').filter(t => t.length > 0 && !NOISE.has(t));
}

// Fraction of the query's tokens present in the candidate (0..1). Extra detail
// in the candidate (a longer, more specific name) is NOT penalized.
export function matchScore(query: string, candidate: string): number {
  const q = tokenize(query);
  if (q.length === 0) return 0;
  const c = new Set(tokenize(candidate));
  let hit = 0;
  for (const t of q) if (c.has(t)) hit++;
  return hit / q.length;
}

// Strict-ish equivalence, for deciding two entries are the SAME product.
export function isLikelyMatch(query: string, candidate: string, threshold = 0.8): boolean {
  return matchScore(query, candidate) >= threshold;
}

// Lenient search-as-you-type match: every query token is a prefix of some
// candidate token (so "cab 2.5 sic" finds "Cable 2,5mm Sica").
export function matchesQuery(query: string, candidate: string): boolean {
  const q = tokenize(query);
  if (q.length === 0) return false;
  const c = tokenize(candidate);
  return q.every(qt => c.some(ct => ct.startsWith(qt)));
}
