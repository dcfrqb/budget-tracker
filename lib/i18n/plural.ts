/**
 * Russian plural picker — standard three-form rule.
 *
 * forms[0] — used when n ends in 1, but not 11           (1 счёт)
 * forms[1] — used when n ends in 2/3/4, but not 12/13/14 (2 счёта)
 * forms[2] — everything else                              (5 счетов)
 *
 * Returns the chosen word only. Composing with the number is the caller's job.
 * Example: `${n} ${pluralRu(n, ['счёт', 'счёта', 'счетов'])}`
 */
export function pluralRu(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(Math.floor(n));
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

/**
 * English plural picker — two-form rule.
 *
 * Returns singular when n === 1, plural otherwise.
 * Returns the chosen word only.
 * Example: `${n} ${pluralEn(n, 'account', 'accounts')}`
 */
export function pluralEn(n: number, singular: string, plural: string): string {
  return Math.abs(n) === 1 ? singular : plural;
}
