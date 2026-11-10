// SCREAM-229 (PO, November 9: "I'd love to add a noise"): the portal's sound, made with the
// browser's own sound (Web Audio) like the music, so there's no recording to licence or download.
// A rushing wind (filtered noise) that wobbles as the portal swirls, with a low hum under it. It
// grows with the portal, rises to a whoosh as the portal swallows the screen, and falls away as it
// closes on the other map. M (mute) silences it too.

import { PORTAL_VOLUME } from '../config/tuning';

export class PortalSound {
  private readonly ctx: AudioContext | null;
  private readonly isMuted: () => boolean;
  private out: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private wobble: GainNode | null = null;
  private wobbleRate: OscillatorNode | null = null;
  private hum: OscillatorNode | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  /** For the tests: the last thing the sound did ('', 'hum', 'swallow', 'close', 'stopped'). */
  lastEvent = '';
  /** For the tests: how loud it was last set (0 to 1, before muting). */
  level = 0;

  constructor(ctx: AudioContext | null | undefined, isMuted: () => boolean) {
    this.ctx = ctx ?? null;
    this.isMuted = isMuted;
  }

  /** Builds the sound the first time it's needed. */
  private start(): boolean {
    const ctx = this.ctx;
    if (!ctx) return false;
    if (this.out) return true;
    if (ctx.state === 'suspended') void ctx.resume();
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(ctx.destination);
    // Wind: two seconds of noise, looped, through a filter that picks out a band of it.
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.6;
    filter.frequency.value = 300;
    noise.connect(filter).connect(out);
    // The swirl: the filter's pitch rocks up and down a few times a second.
    const wobbleRate = ctx.createOscillator();
    wobbleRate.frequency.value = 1;
    const wobble = ctx.createGain();
    wobble.gain.value = 0;
    wobbleRate.connect(wobble).connect(filter.frequency);
    // The hum underneath.
    const hum = ctx.createOscillator();
    hum.type = 'triangle';
    hum.frequency.value = 55;
    const humLevel = ctx.createGain();
    humLevel.gain.value = 0.6;
    hum.connect(humLevel).connect(out);
    for (const s of [noise, wobbleRate, hum]) s.start();
    this.sources = [noise, wobbleRate, hum];
    this.out = out;
    this.filter = filter;
    this.wobble = wobble;
    this.wobbleRate = wobbleRate;
    this.hum = hum;
    return true;
  }

  /** While lapping: as strong as the portal (0 to 1). Call every frame; cheap when nothing changes. */
  setStrength(strength: number): void {
    this.level = strength;
    if (strength <= 0 && !this.out) return;
    if (!this.start() || !this.ctx) return;
    const now = this.ctx.currentTime;
    const loud = this.isMuted() ? 0 : PORTAL_VOLUME * strength;
    this.out!.gain.setTargetAtTime(loud, now, 0.08);
    this.filter!.frequency.setTargetAtTime(250 + 900 * strength, now, 0.1);
    this.wobble!.gain.setTargetAtTime(60 + 220 * strength, now, 0.1);
    this.wobbleRate!.frequency.setTargetAtTime(0.8 + 2.5 * strength, now, 0.1);
    this.hum!.frequency.setTargetAtTime(50 + 30 * strength, now, 0.1);
    if (strength > 0) this.lastEvent = 'hum';
  }

  /** Quiet while the game is paused (the portal's level comes back with the next frame). */
  silence(): void {
    if (this.out && this.ctx) this.out.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
  }

  /** The whoosh as the portal swallows the screen: rising, then gone at the end. */
  swallow(ms: number): void {
    this.lastEvent = 'swallow';
    this.level = 1;
    if (!this.start() || !this.ctx) return;
    const now = this.ctx.currentTime;
    const end = now + ms / 1000;
    const peak = this.isMuted() ? 0 : PORTAL_VOLUME * 1.8;
    this.ramp(this.out!.gain, [[now, this.out!.gain.value], [now + (ms / 1000) * 0.75, peak], [end, 0]]);
    this.ramp(this.filter!.frequency, [[now, this.filter!.frequency.value], [end, 2800]]);
    this.ramp(this.wobbleRate!.frequency, [[now, this.wobbleRate!.frequency.value], [end, 7]]);
    this.ramp(this.hum!.frequency, [[now, this.hum!.frequency.value], [end, 140]]);
  }

  /** On the other map: starts as the whoosh ended and falls away as the portal closes. */
  close(ms: number): void {
    this.lastEvent = 'close';
    this.level = 1;
    if (!this.start() || !this.ctx) return;
    const now = this.ctx.currentTime;
    const end = now + ms / 1000;
    const loud = this.isMuted() ? 0 : PORTAL_VOLUME * 1.5;
    this.ramp(this.out!.gain, [[now, 0], [now + 0.08, loud], [end, 0]]);
    this.ramp(this.filter!.frequency, [[now, 2800], [end, 220]]);
    this.ramp(this.wobbleRate!.frequency, [[now, 7], [end, 0.8]]);
    this.ramp(this.hum!.frequency, [[now, 140], [end, 45]]);
    this.level = 0;
  }

  private ramp(param: AudioParam, points: [number, number][]): void {
    param.cancelScheduledValues(points[0]![0]);
    param.setValueAtTime(points[0]![1], points[0]![0]);
    for (const [t, v] of points.slice(1)) param.linearRampToValueAtTime(v, t);
  }

  /** When the driving screen closes. */
  stop(): void {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        // already stopped
      }
    }
    this.out?.disconnect();
    this.sources = [];
    this.out = null;
    this.lastEvent = 'stopped';
    this.level = 0;
  }
}
