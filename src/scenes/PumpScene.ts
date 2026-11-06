import * as Phaser from 'phaser';
import { showLoadingWhileLoading } from './LoadingScene';
import { FUEL_FULL_TANK_CENTS, FUEL_STEP_CENTS } from '../config/tuning';
import { getEvening, SceneKeys } from '../flow';
import { MAP_ATLAS, MAP_ATLAS_JSON, MAP_ATLAS_PNG } from '../config/gasStation';
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
  /** SCREAM-112: click to change the amount by $5. */
  private lessButton!: Phaser.GameObjects.Text;
  private moreButton!: Phaser.GameObjects.Text;
  private gauge!: Phaser.GameObjects.Graphics;

  constructor() {
    super(SceneKeys.Pump);
  }

  preload(): void {
    // SCREAM-111: the pump comes from the map's picture sheet, already loaded on the road.
    if (!this.textures.exists(MAP_ATLAS)) this.load.atlas(MAP_ATLAS, MAP_ATLAS_PNG, MAP_ATLAS_JSON);
    showLoadingWhileLoading(this); // SCREAM-75
  }

  create(): void {
    this.evening = getEvening(this);
    const { width, height } = this.scale;
    // SCREAM-184 (PO, November 6): it opens at $0.00.
    this.amount = 0;
    // SCREAM-173: the uncle's line at the pump.
    this.evening.tutorial?.signal('atPump');

    // The forecourt, and a pump blown up from the map's sprite.
    this.add.rectangle(0, 44, width, height - 44, 0x6f7479).setOrigin(0, 0);
    this.add.rectangle(0, 44, width, 70, 0xc62828).setOrigin(0, 0); // the canopy's edge
    this.add
      .text(width / 2, 79, 'GAS', { fontFamily: 'monospace', fontSize: '34px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    const pump = this.add.image(170, 470, MAP_ATLAS, 'pump').setOrigin(0.5, 1).setScale(9).setName('pump');
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
    // SCREAM-112 (PO, November 2): the mouse works too. Click to change the amount by $5
    // (the up and down arrow keys still do the same), or scroll the mouse wheel.
    this.lessButton = this.stepButton(330, '▼  $5 less', -FUEL_STEP_CENTS);
    this.moreButton = this.stepButton(490, '▲  $5 more', FUEL_STEP_CENTS);
    this.add.text(650, 401, 'Or ↑ ↓ / Mouse Wheel', { fontFamily: 'monospace', fontSize: '14px', color: '#8a6a4a' });
    this.input.on('wheel', (_p: unknown, _o: unknown, _dx: number, dy: number) => {
      if (dy !== 0) this.change(dy < 0 ? FUEL_STEP_CENTS : -FUEL_STEP_CENTS);
    });

    this.payButton = this.button(470, 478, '', '#2e7d32', () => this.pay());
    this.button(760, 478, 'DRIVE OFF', '#1d5c8c', () => this.leave());
    this.add
      .text(width / 2, 522, 'Enter: Pay And Drive Off    B: Drive Off Without Gas    The clock is running.', {
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

  /** A small button that changes the amount by `cents` when clicked. */
  private stepButton(x: number, label: string, cents: number): Phaser.GameObjects.Text {
    return this.add
      .text(x, 398, label, { fontFamily: 'monospace', fontSize: '16px', color: '#ffffff', backgroundColor: '#5a4636', padding: { x: 10, y: 6 } })
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.change(cents));
  }

  /**
   * $5 more or less. SCREAM-184: from an odd amount (a fill-up, e.g. $23.45), a step goes to
   * the next whole $5; the last step up stops at a full tank (or what the wallet allows).
   */
  private change(cents: number): void {
    const step = FUEL_STEP_CENTS;
    const next = cents > 0 ? (Math.floor(this.amount / step) + 1) * step : (Math.ceil(this.amount / step) - 1) * step;
    this.amount = Phaser.Math.Clamp(next, 0, this.evening.maxGasCents);
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
    const fillUp = this.evening.fillUpCents;
    const fills = this.amount > 0 && this.amount >= fillUp;
    const adds = fills ? 1 - now : this.amount / FUEL_FULL_TANK_CENTS;
    const uncle = this.evening.unclePaysGas;
    this.amountText.setText(formatMoney(this.amount));
    this.addsText.setText(this.amount <= 0 ? '' : fills ? 'Fills it up' : `+${tankFraction(this.amount)} tank`);
    this.noteText.setText(
      fillUp === 0
        ? "The tank's full."
        : max === 0
          ? 'Not enough cash for gas.'
          : this.amount < max || fills
            ? ''
            : uncle
              ? "That's the uncle's $20."
              : "That's all the cash allows.",
    );
    // SCREAM-173: in the tutorial the uncle pays.
    this.payButton.setText(`${uncle ? 'UNCLE PAYS' : 'PAY'} ${formatMoney(this.amount)}`).setVisible(this.amount > 0);
    // Faded when there's no further to go that way.
    this.lessButton.setAlpha(this.amount > 0 ? 1 : 0.35);
    this.moreButton.setAlpha(this.amount < max ? 1 : 0.35);

    // The gauge: what's in the tank now, and (lighter) what this would add.
    const g = this.gauge.clear();
    g.fillStyle(0xe6e0d6, 1).fillRect(GAUGE.x, GAUGE.y, GAUGE.w, GAUGE.h);
    g.fillStyle(0xf5a623, 1).fillRect(GAUGE.x, GAUGE.y, GAUGE.w * now, GAUGE.h);
    g.fillStyle(0x7ccf6f, 1).fillRect(GAUGE.x + GAUGE.w * now, GAUGE.y, GAUGE.w * Math.min(adds, 1 - now), GAUGE.h);
    g.lineStyle(2, 0x2b1d10, 1);
    for (let i = 1; i < 6; i++) g.lineBetween(GAUGE.x + (GAUGE.w * i) / 6, GAUGE.y, GAUGE.x + (GAUGE.w * i) / 6, GAUGE.y + 8);
    g.strokeRect(GAUGE.x, GAUGE.y, GAUGE.w, GAUGE.h);
  }
}

/** $15 → "1/2", $20 → "2/3": the share of a tank, in sixths, simplified (a whole number of $5 steps). */
function tankFraction(cents: number): string {
  const sixths = Math.max(1, Math.round((cents / FUEL_FULL_TANK_CENTS) * 6));
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  const d = gcd(sixths, 6);
  return `${sixths / d}/${6 / d}`;
}
