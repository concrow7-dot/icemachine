import * as Phaser from 'phaser';
import { PLACEHOLDER_SALE_CENTS } from '../config/tuning';
import { getEvening, returnToTruck, SceneKeys, type Station } from '../flow';
import { formatMoney } from '../util/format';

// Temporary screens for stations that aren't built yet, so the truck hub (#7)
// can be tested end to end. Replaced by the real window (#13).

abstract class PlaceholderStationScene extends Phaser.Scene {
  protected abstract readonly station: Station;
  protected abstract readonly title: string;
  protected abstract readonly comingIn: string;
  protected backHint = 'Backspace or B: back to the truck';

  /** What happens when the player leaves this screen. */
  protected leave(): void {
    returnToTruck(this, this.station);
  }

  create(): void {
    const { width, height } = this.scale;
    this.add.rectangle(0, 44, width, height - 44, 0x2a3446).setOrigin(0, 0);

    this.add
      .text(width / 2, height / 2 - 40, this.title, {
        fontFamily: 'monospace',
        fontSize: '36px',
        color: '#bfe6ff',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 10, this.comingIn, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#8a9bb3',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 70, this.backHint, {
        fontFamily: 'monospace',
        fontSize: '18px',
        color: '#ffe8a3',
      })
      .setOrigin(0.5);

    const back = () => this.leave();
    this.input.keyboard?.once('keydown-BACKSPACE', back);
    this.input.keyboard?.once('keydown-B', back);
  }
}

export class WindowScene extends PlaceholderStationScene {
  protected readonly station = 'window';
  protected readonly title = 'THE WINDOW';
  protected readonly comingIn = 'Taking orders comes in issue #13';
  protected override backHint = `B: serve the customer (placeholder: +${formatMoney(PLACEHOLDER_SALE_CENTS)}) and go back`;

  constructor() {
    super(SceneKeys.Window);
  }

  /**
   * PO decision (doc 10, follow-up 8): until selling (#13-#15) exists, leaving
   * the window counts as serving the customer for a flat $4.00. No stock is used.
   */
  protected override leave(): void {
    const evening = getEvening(this);
    if (evening.customerWaiting) {
      evening.changeMoney(PLACEHOLDER_SALE_CENTS, 'Sale');
      evening.setCustomerWaiting(false);
    }
    returnToTruck(this, 'driver');
  }
}
