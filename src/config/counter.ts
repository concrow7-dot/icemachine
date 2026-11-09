/**
 * SCREAM-201 (PO, November 7): the anonymous play counter posts to a Google Form whose
 * answers land in a sheet in Product Management Decisions. Fill these in once the PO has made
 * the form (the brief says how): the form's `formResponse` URL and the `entry.NNN` id of each
 * question. With an empty URL the counter is off.
 */
export const COUNTER_FORM_URL: string = 'https://docs.google.com/forms/d/e/1FAIpQLSeDTfyf9YcaYh8IDukRb9BQdIvO_lwhWa1sEMkUt3UKRHdyLA/formResponse';

/** The form's question ids, in the order the PO makes them: event, mode, seconds, visit, version. */
export const COUNTER_ENTRIES = {
  event: 'entry.563867750',
  mode: 'entry.1802982599',
  seconds: 'entry.988226464',
  visit: 'entry.466142778',
  version: 'entry.1457989601',
};

/** Only the public site counts; `npm run dev` and the test suites (localhost) stay quiet. */
export const COUNTER_HOSTS = ['concrow7-dot.github.io'];
