import type * as Phaser from 'phaser';
// SCREAM-24: the ice cream truck's music, played while driving.
// PO decisions (November 2): chiptune versions of public-domain tunes, written in
// code (no recordings to licence); more than one song, shuffled; plays the whole
// time you drive; M mutes it and the game remembers that; N skips to the next song.
//
// Notes are made with the browser's own sound (Web Audio): a square wave, like an
// old games console or a truck's chime box, with a short fade on each note.

import { parseSong, SONGS, type Song } from './songs';

const MUTE_KEY = 'icemachine.music.muted.v1';
/** Overall loudness, 0 to 1. Kept low: it plays the whole evening. */
const VOLUME = 0.07;
/** Notes are scheduled this far ahead, in seconds, so the tune never stutters. */
const LOOKAHEAD = 0.4;
/** A gap between songs, in seconds. */
const GAP_BETWEEN_SONGS = 1.2;

/**
 * SCREAM-335 (PO, November 14): the Drum Cone's drum solo, played in place of the tune. An
 * original two-bar pattern by engineering, in sixteenth notes: K kick, S snare, H hi-hat,
 * T and t a high and a low tom, - a rest. The second bar ends in a fill round the toms.
 */
export const DRUM_SOLO_TITLE = 'Drum Solo';
const DRUM_STEP_SECONDS = 0.125;
const DRUM_PATTERN = 'K-HKS-HHK-HKSSH-' + 'KKH-S-HKTTttSSSK';

export class Music {
  private readonly ctx: AudioContext | null;
  private readonly master: GainNode | null;
  private order: number[] = [];
  private songIndex = -1;
  private notes: [number, number][] = [];
  private noteIndex = 0;
  private nextTime = 0;
  private playing = false;
  private mutedValue: boolean;
  /** SCREAM-335: the drum solo is playing in place of the tune (test hook: `drumSolo`, `drumHits`). */
  private drumSoloOn = false;
  private drumStep = 0;
  private noise: AudioBuffer | null = null;
  drumHits = 0;
  /** Called with the song's title each time a new song starts. */
  onSong?: (title: string) => void;
  /** SCREAM-186: other sounds (the credits tune) that mute and unmute with the music. */
  private readonly followers = new Set<{ setMute(value: boolean): unknown }>();

  constructor(ctx: AudioContext | null | undefined) {
    this.ctx = ctx ?? null;
    this.master = this.ctx ? this.ctx.createGain() : null;
    if (this.ctx && this.master) this.master.connect(this.ctx.destination);
    this.mutedValue = readMuted();
    this.applyVolume();
  }

  get muted(): boolean {
    return this.mutedValue;
  }

  /** The song playing now (or next), or null before the first one. */
  get song(): Song | null {
    return SONGS[this.order[this.songIndex] ?? -1] ?? null;
  }

  /** Starts (or carries on) the music. Call `tick` every frame while it plays. */
  start(): void {
    if (this.playing) return;
    this.playing = true;
    if (this.songIndex < 0) this.nextSong();
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      // SCREAM-118: when the HUD takes over from the driving view (or back), notes already
      // scheduled are still to come: carry on after them, so the song neither skips nor doubles.
      this.nextTime = Math.max(this.nextTime, this.ctx.currentTime + 0.1);
    }
  }

  /** Stops scheduling notes. The song carries on from the same place on `start`. */
  stop(): void {
    this.playing = false;
  }

  /** M: mute or unmute, remembered in the browser. */
  toggleMute(): boolean {
    this.mutedValue = !this.mutedValue;
    try {
      localStorage.setItem(MUTE_KEY, this.mutedValue ? '1' : '0');
    } catch {
      // Storage can be blocked; muting still works for this session.
    }
    this.applyVolume();
    for (const s of this.followers) s.setMute(this.mutedValue);
    return this.mutedValue;
  }

  /**
   * SCREAM-186 (PO, November 6): a sound that should mute with the music, M on any screen: muted
   * now if the music is, and from then on whenever M is pressed. Forgotten when it is destroyed.
   */
  follow(sound: { setMute(value: boolean): unknown; once(event: string, fn: () => void): unknown }): void {
    sound.setMute(this.mutedValue);
    this.followers.add(sound);
    sound.once('destroy', () => this.followers.delete(sound));
  }

  get drumSolo(): boolean {
    return this.drumSoloOn;
  }

  /**
   * SCREAM-335: swaps the tune for the drum solo, or back. The tune waits where it was and
   * carries on from there afterwards. Its name shows like a song's.
   */
  setDrumSolo(on: boolean): void {
    if (on === this.drumSoloOn) return;
    this.drumSoloOn = on;
    this.drumStep = 0;
    if (this.ctx) this.nextTime = Math.max(this.nextTime, this.ctx.currentTime + 0.05);
    const title = on ? DRUM_SOLO_TITLE : this.song?.title;
    if (title) this.onSong?.(title);
  }

  /** N: skip to the next song. */
  skip(): void {
    this.nextSong();
    if (this.ctx) this.nextTime = this.ctx.currentTime + 0.05;
  }

  /** Schedules the notes due in the next moment. Call every frame. */
  tick(): void {
    if (!this.playing || !this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    // After a pause the clock has run on without us: carry on from now, not from the past.
    if (this.nextTime < now - 0.1) this.nextTime = now + 0.05;
    while (this.nextTime < now + LOOKAHEAD) {
      if (this.drumSoloOn) {
        // SCREAM-335: one sixteenth of the drum pattern in place of the tune's next note.
        this.playDrum(DRUM_PATTERN[this.drumStep % DRUM_PATTERN.length] ?? '-', this.nextTime);
        this.drumStep++;
        this.nextTime += DRUM_STEP_SECONDS;
        continue;
      }
      const note = this.notes[this.noteIndex];
      if (!note) {
        this.nextSong();
        this.nextTime += GAP_BETWEEN_SONGS;
        continue;
      }
      const [freq, length] = note;
      if (freq > 0) this.playNote(freq, this.nextTime, length);
      this.nextTime += length;
      this.noteIndex++;
    }
  }

  private playNote(freq: number, at: number, length: number): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, at);
    const end = at + Math.max(0.05, length * 0.9);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(1, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.35, at + Math.min(0.15, length * 0.6));
    gain.gain.exponentialRampToValueAtTime(0.001, end);
    osc.connect(gain).connect(this.master);
    osc.start(at);
    osc.stop(end + 0.02);
  }

  /** SCREAM-335: one drum hit, made from the browser's own sound like the notes: no recordings. */
  private playDrum(hit: string, at: number): void {
    if (!this.ctx || !this.master || hit === '-') return;
    this.drumHits++;
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.connect(this.master);
    if (hit === 'K' || hit === 'T' || hit === 't') {
      // A drum skin: a sine that drops in pitch as it fades. The kick is lowest.
      const [from, to, length, level] = hit === 'K' ? [150, 45, 0.16, 2.6] : hit === 'T' ? [260, 150, 0.14, 2] : [190, 100, 0.16, 2];
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(from, at);
      osc.frequency.exponentialRampToValueAtTime(to, at + length);
      gain.gain.setValueAtTime(level, at);
      gain.gain.exponentialRampToValueAtTime(0.001, at + length);
      osc.connect(gain);
      osc.start(at);
      osc.stop(at + length + 0.02);
      return;
    }
    // Snare and hi-hat: a burst of noise, the hi-hat short and thin.
    if (!this.noise) {
      this.noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(hit === 'S' ? 1200 : 6000, at);
    const length = hit === 'S' ? 0.14 : 0.04;
    gain.gain.setValueAtTime(hit === 'S' ? 1.6 : 0.7, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + length);
    source.connect(filter).connect(gain);
    source.start(at);
    source.stop(at + length + 0.02);
  }

  private nextSong(): void {
    this.songIndex++;
    if (this.songIndex >= this.order.length) {
      // A fresh shuffle each time round, never starting with the song just played.
      const last = this.order[this.order.length - 1];
      this.order = shuffle(SONGS.map((_, i) => i));
      if (this.order.length > 1 && this.order[0] === last) this.order.push(this.order.shift() as number);
      this.songIndex = 0;
    }
    const song = this.song;
    this.notes = song ? parseSong(song) : [];
    this.noteIndex = 0;
    if (song) this.onSong?.(song.title);
  }

  private applyVolume(): void {
    if (this.master && this.ctx) this.master.gain.setValueAtTime(this.mutedValue ? 0 : VOLUME, this.ctx.currentTime);
  }
}

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function shuffle<T>(list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** The game's one music player, kept in the registry so a song carries on after a sale. */
export function musicFor(scene: Phaser.Scene): Music {
  const existing = scene.registry.get('music') as Music | undefined;
  if (existing) return existing;
  const manager = scene.sound as Phaser.Sound.BaseSoundManager & { context?: AudioContext };
  const music = new Music(manager.context);
  scene.registry.set('music', music);
  return music;
}
