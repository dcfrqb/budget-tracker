/**
 * Normalize a Russian phone number to canonical +7XXXXXXXXXX format.
 *
 * Accepted inputs (after stripping whitespace/dashes/parens/dots):
 *   +7XXXXXXXXXX  — already canonical
 *    7XXXXXXXXXX  — alternate form starting with 7
 *    8XXXXXXXXXX  — Russian domestic form starting with 8
 *
 * Returns canonical +7XXXXXXXXXX (12 chars) or null if invalid.
 */
export function normalizeRuPhone(input: string): string | null {
  // Strip all whitespace, dashes, parentheses, dots
  const stripped = input.replace(/[\s\-().]/g, "");

  // Match the three accepted forms
  const match = stripped.match(/^(?:\+7|7|8)(\d{10})$/);
  if (!match) return null;

  return `+7${match[1]}`;
}
