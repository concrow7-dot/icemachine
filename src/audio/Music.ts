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
  /** Called with the song's title each time a new song starts. */
  onSong?: (title: string) => void;

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
      this.nextTime = this.ctx.currentTime + 0.1;
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
    return this.mutedValue;
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
