/**
 * Days as date chips hold them: `YYYY-MM-DD`, shown as "2 Oct 2026". The
 * words are English whatever the language, as written in the file, so a
 * page reads the same for everyone who opens it.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** True for a real day written `YYYY-MM-DD`. */
export function isDay(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** A day as a person reads it: "2 Oct 2026". */
export function formatDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number);
  return `${date} ${MONTHS[month - 1]} ${year}`;
}

/** A date chip's attributes for a day, in Bava's own words. */
export function dateAttrs(day: string): { date: string; text: string } {
  return { date: day, text: formatDay(day) };
}

/** A date chip as the file holds it. */
export function dateTag(date: string, text: string): string {
  return `<time datetime="${date}">${text}</time>`;
}

/** Words a date tag can hold as they are, and read back the same: some, with no Markdown marks. */
export function plainDateWords(text: string): boolean {
  return text !== '' && !/[<>&\n*_`~[\]\\$]/.test(text);
}

/** Today on this computer's calendar. */
export function todayDay(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** The day `by` days after `day`. */
export function addDays(day: string, by: number): string {
  const [year, month, date] = day.split('-').map(Number);
  const next = new Date(Date.UTC(year, month - 1, date + by));
  return next.toISOString().slice(0, 10);
}

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** A month named by at least its first three letters: 1 to 12, or 0. */
export function monthNamed(word: string): number {
  const w = word.toLowerCase();
  if (w.length < 3) return 0;
  return MONTH_NAMES.findIndex((name) => name.startsWith(w)) + 1;
}
