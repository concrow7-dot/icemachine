// SCREAM-24: the truck's music. Public-domain tunes, arranged by engineering as simple
// chiptune melodies (PO, November 2: more than one song; no songs with a bad origin, so
// no "Turkey in the Straw" or "Do Your Ears Hang Low", and no minstrel songs).
//
// Each song is a list of notes, "pitch:length", with lengths counted in `beat` seconds.
// Pitches are note names with an octave (C4 is middle C, Eb4 a flat, F#4 a sharp);
// R is a rest.

export interface Song {
  title: string;
  /** Seconds per length unit. */
  beat: number;
  notes: string;
}

export const SONGS: readonly Song[] = [
  {
    // Scott Joplin, 1902. The main theme, in sixteenth notes.
    title: 'The Entertainer',
    beat: 0.15,
    notes: [
      'D4:1 Eb4:1 E4:1 C5:2 E4:1 C5:2 E4:1 C5:6',
      'C5:1 D5:1 Eb5:1 E5:1 C5:1 D5:1 E5:2 B4:1 D5:2 C5:6 R:2',
      'D4:1 Eb4:1 E4:1 C5:2 E4:1 C5:2 E4:1 C5:6 R:2',
      'A4:1 G4:1 F#4:1 A4:1 C5:1 E5:2 D5:1 C5:1 A4:1 D5:6 R:2',
      'D4:1 Eb4:1 E4:1 C5:2 E4:1 C5:2 E4:1 C5:6',
      'C5:1 D5:1 Eb5:1 E5:1 C5:1 D5:1 E5:2 B4:1 D5:2 C5:6 R:2',
      'C5:1 D5:1 E5:1 C5:1 D5:1 E5:2 C5:1 D5:1 C5:1 E5:2 C5:1 D5:1 E5:1',
      'C5:1 D5:1 C5:1 E5:2 C5:1 D5:1 E5:2 B4:1 D5:2 C5:8 R:4',
    ].join(' '),
  },
  {
    // Albert Von Tilzer and Jack Norworth, 1908. Waltz time, in quarter notes.
    title: 'Take Me Out to the Ball Game',
    beat: 0.32,
    notes: [
      'C4:2 C5:1 A4:1 G4:1 E4:1 G4:3 D4:3',
      'C4:2 C5:1 A4:1 G4:1 E4:1 G4:6',
      'A4:1 G#4:1 A4:1 E4:1 F4:1 G4:1 A4:2 F4:1 D4:3',
      'A4:2 A4:1 A4:1 B4:1 C5:1 D5:1 B4:1 A4:1 G4:3',
      'C5:6 R:3',
    ].join(' '),
  },
  {
    // Ludwig van Beethoven, about 1810. The opening, in sixteenth notes.
    title: 'Für Elise',
    beat: 0.16,
    notes: [
      'E5:1 D#5:1 E5:1 D#5:1 E5:1 B4:1 D5:1 C5:1 A4:2 R:1 C4:1 E4:1 A4:1 B4:2 R:1 E4:1 G#4:1 B4:1 C5:2 R:1 E4:1',
      'E5:1 D#5:1 E5:1 D#5:1 E5:1 B4:1 D5:1 C5:1 A4:2 R:1 C4:1 E4:1 A4:1 B4:2 R:1 E4:1 C5:1 B4:1 A4:4 R:2',
    ].join(' '),
  },
  {
    // Traditional, 1850s. In eighth notes (6/8 time).
    title: 'Pop Goes the Weasel',
    beat: 0.18,
    notes: [
      'C4:2 C4:1 D4:2 D4:1 E4:1 G4:1 E4:1 C4:3',
      'G3:1 C4:2 C4:1 D4:2 D4:1 E4:3 C4:2',
      'C4:2 C4:1 D4:2 D4:1 E4:1 G4:1 E4:1 C4:3',
      'A4:3 D4:2 F4:1 E4:3 C4:3 R:3',
    ].join(' '),
  },
];

const NOTE_STEPS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** A note name like "C#4" or "Eb5" as a frequency in hertz (A4 = 440). R (a rest) is 0. */
export function frequency(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) return 0;
  const step = NOTE_STEPS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  const midi = (Number(m[3]) + 1) * 12 + step;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** A song's notes as [frequency in Hz (0 for a rest), length in seconds]. */
export function parseSong(song: Song): [number, number][] {
  return song.notes
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => {
      const [pitch, length] = token.split(':');
      return [frequency(pitch), Number(length) * song.beat];
    });
}
