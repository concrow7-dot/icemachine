import { WEEKDAYS, weekdayOf } from './Residents';
import type { Resident } from './Residents';

/**
 * SCREAM-247 (PO, November 10; decision 064): now and then a customer leaving the window says
 * something true about their own week ("See you Thursday!"), so the weekly schedules (057) are
 * easier to notice. The lines are in the "Schedule lines" tab of the Residents sheet
 * (src/config/scheduleLines.ts). Story only.
 */
export interface ScheduleLine {
  id: string;
  /** Who the line suits: anyone, adults only, or kids only. */
  who: 'any' | 'adult' | 'kid';
  /** The line, with at most one kind of tag: [Next], [Back], [Home] or [Away]. */
  text: string;
}

/**
 * What a line says, from its tag:
 * - next: [Next] is the next day they're home ("See you [Next]!")
 * - back: [Back] is the same day, but the line only fits when they're away tomorrow ("I have soccer until [Back].")
 * - home: [Home] lists the days they're home ("The best days to visit are [Home].")
 * - away: [Away] lists the days they're out ("Nobody is home on [Away].")
 * - every: no tag; for people home all seven days
 * - from: [From] is the time they get home (SCREAM-249; "I'm never home before [From].")
 * - until: [Until] is the time they stop coming out ("I have to be in bed by [Until].")
 * - window: both [From] and [Until], for people with both (SCREAM-250's hard-to-find customers)
 */
export type ScheduleKind = 'next' | 'back' | 'home' | 'away' | 'every' | 'from' | 'until' | 'window';

export const SCHEDULE_TAGS: Record<Exclude<ScheduleKind, 'every' | 'window'>, string> = {
  next: '[Next]',
  back: '[Back]',
  home: '[Home]',
  away: '[Away]',
  from: '[From]',
  until: '[Until]',
};

/**
 * PO (November 10, testing): the regulars are who the player meets most, and they're home every
 * day, so they'd all say the same thing. People home all seven days get this many "every day"
 * lines each; everyone else keeps one line per kind (one excuse).
 */
export const EVERY_DAY_LINES_EACH = 3;

/** A list of days is only said out loud when it's this short (longer ones are said the other way round). */
export const SCHEDULE_LIST_MAX = 3;

export function kindOfLine(text: string): ScheduleKind {
  if (text.includes(SCHEDULE_TAGS.from) && text.includes(SCHEDULE_TAGS.until)) return 'window';
  for (const kind of ['next', 'back', 'home', 'away', 'from', 'until'] as const) if (text.includes(SCHEDULE_TAGS[kind])) return kind;
  return 'every';
}

/** "Monday", "Monday and Thursday", "Monday, Wednesday and Friday" (in the week's order). */
export function dayList(days: readonly number[]): string {
  const names = [...days].sort((a, b) => a - b).map((d) => WEEKDAYS[d]!);
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** How many days from this Story day until they're next home (1 = tomorrow, up to 7), or null with no ticks. */
export function daysUntilHome(days: readonly number[], day: number): number | null {
  const today = weekdayOf(day);
  for (let n = 1; n <= 7; n++) if (days.includes((today + n) % 7)) return n;
  return null;
}

/**
 * Whether a kind of line is true, and useful, for this resident on this Story day. Engineering's
 * calls: [Next] and [Back] only name a day that's still to come in this run (`lastDay`), so the
 * player can act on it; lists stop at three days.
 */
export function kindFits(kind: ScheduleKind, resident: Pick<Resident, 'days' | 'hours' | 'hardToFind'>, day: number, lastDay: number): boolean {
  const days = resident.days;
  if (!days || days.length === 0) return false;
  // SCREAM-249: a time of the evening, for the few people who have one (true on any day).
  const from = resident.hours?.[0] != null;
  const until = resident.hours?.[1] != null;
  if (kind === 'window') return from && until;
  if (kind === 'from') return from && !until;
  if (kind === 'until') return until && !from;
  // SCREAM-250: a hard-to-find customer is described by their window, and by their days when
  // those are few. "Home every day" or "see you Thursday" would send the player on a wild chase.
  if (resident.hardToFind && kind !== 'home' && kind !== 'away') return false;
  if (kind === 'every') return days.length >= 7;
  if (days.length >= 7) return false;
  if (kind === 'home') return days.length <= SCHEDULE_LIST_MAX;
  if (kind === 'away') return 7 - days.length <= SCHEDULE_LIST_MAX;
  const wait = daysUntilHome(days, day)!;
  if (day + wait > lastDay) return false;
  return kind === 'next' || wait >= 2;
}

/** SCREAM-249: a time as people say it: 1140 → "7", 1110 → "6:30". */
export function timeText(minutes: number): string {
  const hour = Math.floor(minutes / 60) % 12 || 12;
  const rest = Math.round(minutes % 60);
  return rest === 0 ? `${hour}` : `${hour}:${String(rest).padStart(2, '0')}`;
}

/** The line with the days (and times) put in. */
export function fillSchedule(text: string, resident: Pick<Resident, 'days' | 'hours'>, day: number): string {
  const days = resident.days ?? [];
  const wait = daysUntilHome(days, day);
  const next = wait === null ? '' : WEEKDAYS[(weekdayOf(day) + wait) % 7]!;
  const away = [0, 1, 2, 3, 4, 5, 6].filter((d) => !days.includes(d));
  return text
    .split(SCHEDULE_TAGS.next).join(next)
    .split(SCHEDULE_TAGS.back).join(next)
    .split(SCHEDULE_TAGS.home).join(dayList(days))
    .split(SCHEDULE_TAGS.away).join(dayList(away))
    .split(SCHEDULE_TAGS.from).join(resident.hours?.[0] != null ? timeText(resident.hours[0]) : '')
    .split(SCHEDULE_TAGS.until).join(resident.hours?.[1] != null ? timeText(resident.hours[1]) : '');
}

/** A small seeded random number generator (mulberry32): the same seed gives the same numbers. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * PO (decision 063): a person's traits don't change during a playthrough, and (064) the lines
 * shouldn't get repetitive. So each resident gets their own few lines for the whole run, one
 * per kind (their one excuse: always soccer, never soccer one day and swimming the next), picked
 * from the run's seed and their id; different people get different lines. Returns resident id →
 * their lines. People with no ticks get none.
 */
export function assignScheduleLines(
  residents: readonly Resident[],
  lines: readonly ScheduleLine[],
  seed: number,
  everyEach = EVERY_DAY_LINES_EACH,
): Map<string, ScheduleLine[]> {
  const out = new Map<string, ScheduleLine[]>();
  for (const r of residents) {
    if (!r.days || r.days.length === 0) continue;
    const rnd = seeded(seed ^ hash(r.id));
    const own: ScheduleLine[] = [];
    for (const kind of ['next', 'back', 'home', 'away', 'every', 'from', 'until', 'window'] as const) {
      const fits = lines.filter((l) => kindOfLine(l.text) === kind && (l.who === 'any' || (l.who === 'kid') === r.kid));
      const roll = rnd(); // always roll, so one kind's lines don't shift another's
      if (fits.length === 0) continue;
      if (kind === 'from' || kind === 'until' || kind === 'window') {
        // SCREAM-249: only people with that hour; regulars too. SCREAM-250: both hours = a window.
        const has = [r.hours?.[0] != null, r.hours?.[1] != null];
        const wanted = kind === 'window' ? has[0] && has[1] : kind === 'from' ? has[0] && !has[1] : has[1] && !has[0];
        if (wanted) own.push(fits[Math.floor(roll * fits.length)]!);
        continue;
      }
      if (r.hardToFind && kind !== 'home' && kind !== 'away') continue; // SCREAM-250: their window and their days only
      if (kind !== 'every') {
        if (r.days.length < 7) own.push(fits[Math.floor(roll * fits.length)]!);
        continue;
      }
      if (r.days.length < 7) continue;
      for (let n = 0; n < everyEach && fits.length > 0; n++) own.push(fits.splice(Math.floor(rnd() * fits.length), 1)[0]!);
    }
    if (own.length > 0) out.set(r.id, own);
  }
  return out;
}

/**
 * One of the resident's own lines that fits today, filled in; null when none fits. Lines in
 * `heard` (ids already said this evening, by anyone) are left out, so the player never hears
 * the same wording twice in an evening; null if that leaves nothing.
 */
export function scheduleLineToday(
  own: readonly ScheduleLine[] | undefined,
  resident: Pick<Resident, 'days' | 'hours' | 'hardToFind'>,
  day: number,
  lastDay: number,
  rnd: () => number = Math.random,
  heard: readonly string[] = [],
): { id: string; text: string } | null {
  const fits = (own ?? []).filter((l) => !heard.includes(l.id) && kindFits(kindOfLine(l.text), resident, day, lastDay));
  if (fits.length === 0) return null;
  const line = fits[Math.floor(rnd() * fits.length)]!;
  return { id: line.id, text: fillSchedule(line.text, resident, day) };
}

// ---- SCREAM-248 (PO, November 10; decision 065): neighbours know each other's days ----

/** Salt for the neighbours' lines, so they aren't picked by the same dice as people's own lines. */
const NEIGHBOUR_SALT = 0x5ca1ab1e;

/**
 * SCREAM-250 (PO, November 10: "I want these hints to be a little less common than the others"):
 * when a hard-to-find neighbour comes up as the one to talk about, they're passed over this
 * often and the customer talks about someone else (or about themselves).
 */
export const HARD_TO_FIND_HINT_SKIP = 0.5;

/**
 * SCREAM-275 (PO, November 12): schedule and neighbour lines are only about the customers "who will
 * give you better business", "people like Pizza Joe and Big Kev": a set order size (042) or hard to
 * find (067).
 */
export function isSpecialCustomer(resident: Pick<Resident, 'orderSize' | 'hardToFind'>): boolean {
  return resident.orderSize !== undefined || !!resident.hardToFind;
}

/** Whether other customers can talk about this resident: they have ticked days and do buy. */
export function canBeToldAbout(resident: Pick<Resident, 'days' | 'likelihood'>): boolean {
  return !!resident.days && resident.days.length > 0 && resident.likelihood > 0;
}

/**
 * What the street says about each resident, for the whole run: one line per kind (the same PO
 * rule as hints, November 8: nobody is described in two different ways in the same story).
 * The lines are the "Neighbour lines" tab of the Residents sheet; Who is the neighbour's age.
 * Returns the id of the resident talked about → their lines.
 */
export function assignNeighbourLines(residents: readonly Resident[], lines: readonly ScheduleLine[], seed: number): Map<string, ScheduleLine[]> {
  return assignScheduleLines(residents.filter(canBeToldAbout), lines, (seed ^ NEIGHBOUR_SALT) >>> 0, 1);
}

/** A neighbour's line with their name, street and days put in. */
export function fillNeighbour(text: string, about: Pick<Resident, 'name' | 'street' | 'days' | 'hours'>, day: number): string {
  return fillSchedule(text, about, day).split('[Name]').join(about.name.trim()).split('[Street]').join(about.street);
}

/**
 * What this customer can say today about someone else on their street, or null. Engineering's
 * calls: neighbours are the people on the same street (and the same map); never about someone
 * already talked about tonight (`toldAbout`), and never a wording already heard tonight (`heard`).
 */
export function neighbourLineToday(
  speaker: Pick<Resident, 'id' | 'street'>,
  people: readonly Resident[],
  linesFor: ReadonlyMap<string, readonly ScheduleLine[]>,
  day: number,
  lastDay: number,
  rnd: () => number = Math.random,
  heard: readonly string[] = [],
  toldAbout: readonly string[] = [],
  hardToFindSkip = HARD_TO_FIND_HINT_SKIP,
): { about: string; id: string; text: string } | null {
  const neighbours = people.filter((r) => r.id !== speaker.id && r.street === speaker.street && canBeToldAbout(r) && !toldAbout.includes(r.id));
  while (neighbours.length > 0) {
    const about = neighbours.splice(Math.floor(rnd() * neighbours.length), 1)[0]!;
    if (about.hardToFind && rnd() < hardToFindSkip) continue; // SCREAM-250: their hints are rarer
    const fits = (linesFor.get(about.id) ?? []).filter((l) => !heard.includes(l.id) && kindFits(kindOfLine(l.text), about, day, lastDay));
    if (fits.length === 0) continue;
    const line = fits[Math.floor(rnd() * fits.length)]!;
    return { about: about.id, id: line.id, text: fillNeighbour(line.text, about, day) };
  }
  return null;
}
