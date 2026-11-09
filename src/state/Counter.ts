import { COUNTER_ENTRIES, COUNTER_FORM_URL, COUNTER_HOSTS } from '../config/counter';

/**
 * SCREAM-201 (PO, November 7): a few anonymous counts, so the devlogs can say how many people
 * who open the public link get past the tutorial and play. Each event is one Google Form
 * submission (event, mode, seconds, a random id for this visit, the build). Nothing personal,
 * no cookies, nothing kept in the browser between visits; off on localhost and when the form
 * isn't set up; a blocked request is ignored (fire-and-forget).
 */
export type CounterEvent = 'tutorial-started' | 'tutorial-skipped' | 'tutorial-finished' | 'wheel' | 'first-sale' | 'evening-ended';

/** The id for this visit (a page load), shared by all its events so a play can be followed across rows. */
const VISIT = Math.random().toString(36).slice(2, 10);
/** The build (set by the deploy workflow), or 'dev'. */
const VERSION = ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_COMMIT ?? 'dev').slice(0, 7);

let firstSaleCounted = false;
let tutorialStartedAt = 0;

export function counterOn(): boolean {
  try {
    return COUNTER_FORM_URL !== '' && COUNTER_HOSTS.includes(window.location.hostname);
  } catch {
    return false;
  }
}

/** Sends one event. Safe to call anywhere: it does nothing when the counter is off. */
export function count(event: CounterEvent, mode = '', seconds?: number): void {
  if (event === 'tutorial-started') tutorialStartedAt = Date.now();
  if (event === 'first-sale') {
    if (firstSaleCounted) return;
    firstSaleCounted = true;
  }
  if (!counterOn()) return;
  const body = new URLSearchParams();
  body.set(COUNTER_ENTRIES.event, event);
  body.set(COUNTER_ENTRIES.mode, mode);
  body.set(COUNTER_ENTRIES.seconds, seconds === undefined ? '' : String(Math.round(seconds)));
  body.set(COUNTER_ENTRIES.visit, VISIT);
  body.set(COUNTER_ENTRIES.version, VERSION);
  try {
    void fetch(COUNTER_FORM_URL, { method: 'POST', mode: 'no-cors', body, keepalive: true }).catch(() => undefined);
  } catch {
    // Nothing: counting never gets in the way of playing.
  }
}

/** SCREAM-200, 201: seconds since the guided tutorial started (the credits), for the "time to the wheel" count. */
export function secondsSinceTutorialStart(): number {
  return tutorialStartedAt ? (Date.now() - tutorialStartedAt) / 1000 : 0;
}
