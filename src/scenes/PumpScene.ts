import * as Phaser from 'phaser';
import { FUEL_FULL_TANK_CENTS, FUEL_STEP_CENTS } from '../config/tuning';
import { getEvening, SceneKeys } from '../flow';
import { EveningState } from '../state/EveningState';
import { formatMoney } from '../util/format';

// SCREAM-22 (PO, October 29 and November 2): the gas station. Stop in the bay
// beside the pumps and this opens. Gas comes in $5 steps; a full tank is $30.
// The clock keeps running here (the HUD keeps ticking), so a stop for gas costs
// daylight. Pay and you're straight back on the road.

const INK = '#2b1d10';
/** The gauge on this screen: left edge, width and height, in px. */
const GAUGE = { x: 330, y: 214, w: 520, h: 40 };

export class PumpScene extends Phaser.Scene {
  private evening!: EveningState;
  /** The amount on the pump's display, in cents: a whole number of $5 steps. */
  private amount = 0;
  private amountText!: Phaser.GameObjects.Text;
  private addsText!: Phaser.GameObjects.Text;
  private noteText!: Phaser.GameObjects.Text;
  private payButton!: Phaser.GameObjects.Text;
  private gauge!: Phaser.GameObjects.Graphics;

  constructor() {
    super(SceneKeys.Pump);
  }

  preload(): void {
    if (!this.textures.exists('map-pump')) this.load.image('map-pump', 'assets/limezu/map/pump.png');
  }

  create(): void {
    this.evening = getEvening(this);
    const { width, height } = this.scale;
    // Starts at the most you can buy: fill up, or as much as the wallet allows.
    this.amount = this.evening.maxGasCents;

    // The forecourt, and a pump blown up from the map's sprite.
    this.add.rectangle(0, 44, width, height - 44, 0x6f7479).setOrigin(0, 0);
    this.add.rectangle(0, 44, width, 70, 0xc62828).setOrigin(0, 0); // the canopy's edge
    this.add
      .text(width / 2, 79, 'GAS', { fontFamily: 'monospace', fontSize: '34px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    const pump = this.add.image(170, 470, 'map-pump').setOrigin(0.5, 1).setScale(9);
    pump.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);

    // The pump's display.
    this.add.rectangle(310, 140, 580, 300, 0xfffdf9).setOrigin(0, 0).setStrokeStyle(4, 0x2b1d10);
    this.add.text(330, 156, `A full tank is ${formatMoney(FUEL_FULL_TANK_CENTS)}, in ${formatMoney(FUEL_STEP_CENTS)} steps`, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: INK,
    });
    this.gauge = this.add.graphics();
    this.add.text(GAUGE.x, GAUGE.y + GAUGE.h + 4, 'E', { fontFamily: 'monospace', fontSize: '16px', color: INK });
    this.add.text(GAUGE.x + GAUGE.w, GAUGE.y + GAUGE.h + 4, 'F', { fontFamily: 'monospace', fontSize: '16px', color: INK }).setOrigin(1, 0);
    this.amountText = this.add.text(330, 296, '', { fontFamily: 'monospace', fontSize: '44px', color: INK, fontStyle: 'bold' });
    this.addsText = this.add.text(560, 312, '', { fontFamily: 'monospace', fontSize: '22px', color: '#2e7d32' });
    this.noteText = this.add.text(330, 362, '', { fontFamily: 'monospace', fontSize: '18px', color: '#8a6a4a' });
    this.add.text(330, 398, '↑ ↓  $5 more or less', { fontFamily: 'monospace', fontSize: '16px', color: INK });

    this.payButton = this.button(470, 478, '', '#2e7d32', () => this.pay());
    this.button(760, 478, 'DRIVE OFF', '#1d5c8c', () => this.leave());
    this.add
      .text(width / 2, 522, 'Enter: pay and drive off    B: drive off without gas    The clock is running', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    this.input.keyboard?.on('keydown', (event: KeyboardEvent) => {
      const k = event.key;
      if (k === 'ArrowUp' || k === 'ArrowRight' || k === '+' || k === '=') this.change(FUEL_STEP_CENTS);
      else if (k === 'ArrowDown' || k === 'ArrowLeft' || k === '-') this.change(-FUEL_STEP_CENTS);
      else if (k === 'Enter') this.pay();
      else if (k === 'b' || k === 'B') this.leave();
    });
    this.refresh();
  }

  private button(x: number, y: number, label: string, colour: string, onClick: () => void): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, label, { fontFamily: 'monospace', fontSize: '20px', color: '#ffffff', backgroundColor: colour, padding: { x: 14, y: 8 } })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick);
  }

  private change(cents: number): void {
    this.amount = Phaser.Math.Clamp(this.amount + cents, 0, this.evening.maxGasCents);
    this.refresh();
  }

  /** Pays for the amount on the display (if any) and heads back out. */
  private pay(): void {
    if (this.amount > 0 && !this.evening.buyGas(this.amount)) return;
    this.leave();
  }

  private leave(): void {
    if (this.evening.isOver) return; // the HUD is taking us to the end of the evening
    this.scene.start(SceneKeys.Drive);
  }

  private refresh(): void {
    const max = this.evening.maxGasCents;
    const now = this.evening.fuel;
    const adds = this.amount / FUEL_FULL_TANK_CENTS;
    this.amountText.setText(formatMoney(this.amount));
    this.addsText.setText(this.amount <= 0 ? '' : this.amount >= FUEL_FULL_TANK_CENTS ? 'a full tank' : `+${tankFraction(this.amount)} tank`);
    this.noteText.setText(
      max === 0
        ? now >= 1 - FUEL_STEP_CENTS / FUEL_FULL_TANK_CENTS + 1e-6
          ? "The tank's full."
          : `Not enough cash: gas is ${formatMoney(FUEL_STEP_CENTS)} a step.`
        : this.amount < max
          ? ''
          : max < this.roomCents
            ? "That's all the cash allows."
            : now + adds >= 0.999
              ? 'Fills it up.'
              : 'As much as fits (the next $5 would overflow).',
    );
    this.payButton.setText(`PAY ${formatMoney(this.amount)}`).setVisible(this.amount > 0);

    // The gauge: what's in the tank now, and (lighter) what this would add.
    const g = this.gauge.clear();
    g.fillStyle(0xe6e0d6, 1).fillRect(GAUGE.x, GAUGE.y, GAUGE.w, GAUGE.h);
    g.fillStyle(0xf5a623, 1).fillRect(GAUGE.x, GAUGE.y, GAUGE.w * now, GAUGE.h);
    g.fillStyle(0x7ccf6f, 1).fillRect(GAUGE.x + GAUGE.w * now, GAUGE.y, GAUGE.w * Math.min(adds, 1 - now), GAUGE.h);
    g.lineStyle(2, 0x2b1d10, 1);
    for (let i = 1; i < 6; i++) g.lineBetween(GAUGE.x + (GAUGE.w * i) / 6, GAUGE.y, GAUGE.x + (GAUGE.w * i) / 6, GAUGE.y + 8);
    g.strokeRect(GAUGE.x, GAUGE.y, GAUGE.w, GAUGE.h);
  }

  /** Whole $5 steps of room left in the tank, in cents. */
  private get roomCents(): number {
    return Math.floor(((1 - this.evening.fuel) * FUEL_FULL_TANK_CENTS) / FUEL_STEP_CENTS + 1e-6) * FUEL_STEP_CENTS;
  }
}

/** $15 → "1/2", $20 → "2/3": the share of a tank, in sixths, simplified. */
function tankFraction(cents: number): string {
  const sixths = Math.round((cents / FUEL_FULL_TANK_CENTS) * 6);
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(sixths, 6);
  return `${sixths / d}/${6 / d}`;
}
