const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

// "только что" / "4 мин" / "2 ч" / "вчера" / "3 д".
// Русский, без префикса "назад" — чтобы собирать в строки типа "обн 4 мин".
export function formatRelativeRu(date: Date, now: Date = new Date()): string {
  const diff = now.getTime() - date.getTime();
  if (diff < MIN) return "только что";
  if (diff < HOUR) return `${Math.floor(diff / MIN)} мин`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} ч`;
  if (diff < 2 * DAY) return "вчера";
  return `${Math.floor(diff / DAY)} д`;
}
