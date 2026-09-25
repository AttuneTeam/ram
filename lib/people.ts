/**
 * Two-letter initials for an avatar: first letters of the first and last
 * words ("Raul Felix Carrizo" → "RC"), or the first two letters of a single
 * word ("Raul" → "RA"). Works for non-Latin scripts and emoji-free names.
 */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = [...words[0]];
  if (words.length === 1) return first.slice(0, 2).join("").toUpperCase();
  const last = [...words[words.length - 1]];
  return (first[0] + last[0]).toUpperCase();
}
