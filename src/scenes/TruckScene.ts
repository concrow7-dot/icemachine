import * as Phaser from 'phaser';
import { getEvening, SceneKeys, type Station } from '../flow';
import { EveningEvents, EveningState } from '../state/EveningState';

// Issue #7: the truck interior hub. A fixed screen (like the Backyard Baseball
// treehouse) with three stations, laid out as in the PO's sketch:
// cooler on the left, the aisle to the driver's seat in the middle, the window
// on the right. Placeholder shapes until art direction (#17) is decided.

type StationView = {
  id: Station;
  shape: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  note: Phaser.GameObjects.Text;
};

const HIGHLIGHT = 0xffe066;
const OUTLINE = 0x3b2a1a;

export class TruckScene extends Phaser.Scene {
  private evening!: EveningState;
  private stations: StationView[] = [];
  private selected: Station = 'cooler';

  constructor() {
    super(SceneKeys.Truck);
  }

  init(data: { station?: Station }): void {
    this.selected = data.station ?? 'cooler';
  }

  create(): void {
    this.evening = getEvening(this);
    const { width, height } = this.scale;

    // Walls and floor of the truck.
    this.add.rectangle(0, 44, width, height - 44, 0xc89b6d).setOrigin(0, 0);
    this.add.rectangle(0, height - 120, width, 120, 0x8a6a4a).setOrigin(0, 0);

    this.stations = [
      this.makeStation('cooler', 180, 360, 240, 150, 0x9fd3e6, 'COOLER'),
      this.makeStation('driver', 480, 280, 170, 270, 0x5a4636, "DRIVER'S SEAT"),
      this.makeStation('window', 790, 250, 230, 170, 0x9ecbff, 'WINDOW'),
    ];

    this.add
      .text(width / 2, height - 22, '← → choose    Enter: go    or use the mouse', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: '#2b1d10',
      })
      .setOrigin(0.5);

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-LEFT', () => this.move(-1));
    keyboard?.on('keydown-A', () => this.move(-1));
    keyboard?.on('keydown-RIGHT', () => this.move(1));
    keyboard?.on('keydown-D', () => this.move(1));
    keyboard?.on('keydown-ENTER', () => this.activate(this.selected));
    keyboard?.on('keydown-SPACE', () => this.activate(this.selected));

    const onCustomer = () => {
      // If the customer leaves while the window is highlighted, move to the
      // driver's seat (its neighbour) so something is always highlighted.
      if (!this.isAvailable(this.selected)) this.selected = 'driver';
      this.refresh();
    };
    this.evening.on(EveningEvents.CustomerChanged, onCustomer);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.evening.off(EveningEvents.CustomerChanged, onCustomer);
    });

    if (!this.isAvailable(this.selected)) this.selected = 'cooler';
    this.refresh();
  }

  private makeStation(
    id: Station,
    x: number,
    y: number,
    w: number,
    h: number,
    fill: number,
    name: string,
  ): StationView {
    const shape = this.add
      .rectangle(x, y, w, h, fill)
      .setStrokeStyle(4, OUTLINE)
      .setInteractive({ useHandCursor: true });

    const label = this.add
      .text(x, y + h / 2 + 18, name, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: '#2b1d10',
      })
      .setOrigin(0.5);

    const note = this.add
      .text(x, y, '', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#2b1d10',
        align: 'center',
      })
      .setOrigin(0.5);

    shape.on('pointerover', () => {
      if (!this.isAvailable(id)) return;
      this.selected = id;
      this.refresh();
    });
    shape.on('pointerdown', () => this.activate(id));

    return { id, shape, label, note };
  }

  /** The window can only be used while a customer is waiting (PO decision on #7). */
  private isAvailable(id: Station): boolean {
    return id !== 'window' || this.evening.customerWaiting;
  }

  /** Moves the highlight left or right, skipping stations that aren't available. */
  private move(direction: -1 | 1): void {
    const order = this.stations.map((s) => s.id);
    let index = order.indexOf(this.selected);
    for (let step = 0; step < order.length; step++) {
      index = (index + direction + order.length) % order.length;
      const candidate = order.at(index);
      if (candidate && this.isAvailable(candidate)) {
        this.selected = candidate;
        break;
      }
    }
    this.refresh();
  }

  private activate(id: Station): void {
    if (!this.isAvailable(id)) return;
    if (id === 'cooler') this.scene.start(SceneKeys.Cooler);
    if (id === 'driver') {
      // Heading for the road ends prep: stock and prices are set for the evening (#8, #23).
      this.evening.lockPrep();
      this.scene.start(SceneKeys.TestRoom);
    }
    if (id === 'window') this.scene.start(SceneKeys.Window);
  }

  private refresh(): void {
    for (const s of this.stations) {
      const available = this.isAvailable(s.id);
      const isSelected = available && s.id === this.selected;
      s.shape.setAlpha(available ? 1 : 0.35);
      s.label.setAlpha(available ? 1 : 0.45);
      s.shape.setStrokeStyle(isSelected ? 8 : 4, isSelected ? HIGHLIGHT : OUTLINE);
      s.label.setColor(isSelected ? '#000000' : '#2b1d10');
      s.label.setFontStyle(isSelected ? 'bold' : 'normal');
      if (s.id === 'window') s.note.setText(available ? 'Customer\nwaiting!' : 'No customer');
    }
  }
}
