import * as Phaser from 'phaser';
import { CUSTOMER_SPOTS, NEIGHBOURHOOD_MAP, TILE_SIZE } from '../config/neighbourhood';
import { TRUCK_ACCELERATION_SECONDS, TRUCK_BRAKING_SECONDS, TRUCK_SPEED } from '../config/tuning';
import { getEvening, SceneKeys } from '../flow';
import { EveningEvents, EveningState, type Facing } from '../state/EveningState';

// Issue #9: driving the truck around the neighbourhood, seen from above.
// PO decisions: four-direction movement (like Pokémon), one fixed map about
// 20 seconds across, and the only way back into the truck is to drive into a
// waiting customer, which opens the hub with the window ready.
// Placeholder shapes until art direction (#17) is decided.

const HUD_HEIGHT = 44;
/** The truck collides as a 32 x 32 square whichever way it faces, so it can always turn at a junction. */
const HIT_BOX = 32;
/** How close (in pixels) the truck's centre must get to a customer to stop for them: anywhere across the road counts. */
const CUSTOMER_REACH = 48;

const DIRECTIONS: Record<Facing, { dx: number; dy: number; angle: number }> = {
  right: { dx: 1, dy: 0, angle: 0 },
  down: { dx: 0, dy: 1, angle: 90 },
  left: { dx: -1, dy: 0, angle: 180 },
  up: { dx: 0, dy: -1, angle: -90 },
};

const KEY_TO_FACING: Record<string, Facing> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

const COLOURS = {
  road: 0x5d6168,
  sidewalk: 0xc9c4b8,
  lawn: 0x86c06a,
  park: 0x4e9a46,
  tree: 0x2f6e33,
  home: 0xf2b46b,
  roofs: [0xb5523b, 0x6c7a89, 0x8e6c4a, 0x4f6d8f, 0x9c4f6e],
};

export class DriveScene extends Phaser.Scene {
  private evening!: EveningState;
  private truck!: Phaser.GameObjects.Container;
  private facing: Facing = 'right';
  private speed = 0;
  /** Direction keys currently held, most recent last: the newest one steers. */
  private held: Facing[] = [];
  private customer!: Phaser.GameObjects.Container;
  private pointer!: Phaser.GameObjects.Triangle;
  private leaving = false;

  constructor() {
    super(SceneKeys.Drive);
  }

  create(): void {
    this.evening = getEvening(this);
    this.speed = 0;
    this.held = [];
    this.leaving = false;

    const worldWidth = (NEIGHBOURHOOD_MAP[0]?.length ?? 0) * TILE_SIZE;
    const worldHeight = NEIGHBOURHOOD_MAP.length * TILE_SIZE;

    this.drawNeighbourhood(worldWidth, worldHeight);
    this.customer = this.makeCustomer();
    this.truck = this.makeTruck();

    const { x, y, facing } = this.evening.truck;
    this.truck.setPosition(x, y);
    this.setFacing(facing);

    // The HUD covers the top strip, so the map is shown below it.
    const camera = this.cameras.main;
    camera.setViewport(0, HUD_HEIGHT, this.scale.width, this.scale.height - HUD_HEIGHT);
    camera.setBounds(0, 0, worldWidth, worldHeight);
    camera.startFollow(this.truck, true, 0.15, 0.15);

    this.pointer = this.add
      .triangle(0, 0, 0, -14, 24, 0, 0, 14, 0xff4f9a)
      .setStrokeStyle(2, 0xffffff)
      .setScrollFactor(0)
      .setDepth(20);

    this.add
      .text(this.scale.width / 2, this.scale.height - HUD_HEIGHT - 16, 'Arrows / WASD: drive    Drive into a customer (!) to serve them', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffffff',
        backgroundColor: '#00000099',
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20);

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown', (event: KeyboardEvent) => {
      const dir = KEY_TO_FACING[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (dir && !this.held.includes(dir)) this.held.push(dir);
    });
    keyboard?.on('keyup', (event: KeyboardEvent) => {
      const dir = KEY_TO_FACING[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (dir) this.held = this.held.filter((d) => d !== dir);
    });
    // Letting go of keys while the window is in the background shouldn't leave the truck driving.
    this.game.events.on(Phaser.Core.Events.BLUR, this.releaseKeys, this);

    const onCustomer = () => this.refreshCustomer();
    this.evening.on(EveningEvents.CustomerChanged, onCustomer);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.evening.off(EveningEvents.CustomerChanged, onCustomer);
      this.game.events.off(Phaser.Core.Events.BLUR, this.releaseKeys, this);
      this.evening.parkTruck({ x: this.truck.x, y: this.truck.y, facing: this.facing });
    });

    this.refreshCustomer();
  }

  update(_time: number, deltaMs: number): void {
    if (this.leaving) return;
    // Cap long frames (e.g. after switching tabs) so the truck never jumps.
    const dt = Math.min(deltaMs, 100) / 1000;
    const steering = this.held.at(-1);

    if (steering) {
      this.setFacing(steering);
      this.speed = Math.min(TRUCK_SPEED, this.speed + (TRUCK_SPEED * dt) / TRUCK_ACCELERATION_SECONDS);
    } else {
      this.speed = Math.max(0, this.speed - (TRUCK_SPEED * dt) / TRUCK_BRAKING_SECONDS);
    }

    if (this.speed > 0) {
      const { dx, dy } = DIRECTIONS[this.facing];
      const moved = this.moveTruck(dx * this.speed * dt, dy * this.speed * dt);
      if (!moved) this.speed = 0;
    }

    this.checkCustomer();
    this.updatePointer();
  }

  // ---- Map ----

  private tileAt(col: number, row: number): string {
    return NEIGHBOURHOOD_MAP[row]?.[col] ?? '#';
  }

  private isSolid(col: number, row: number): boolean {
    return this.tileAt(col, row) !== '.';
  }

  private drawNeighbourhood(worldWidth: number, worldHeight: number): void {
    const g = this.make.graphics({}, false);
    g.fillStyle(COLOURS.road).fillRect(0, 0, worldWidth, worldHeight);

    const rows = NEIGHBOURHOOD_MAP.length;
    const cols = NEIGHBOURHOOD_MAP[0]?.length ?? 0;
    const T = TILE_SIZE;
    const SIDEWALK = 10;

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const tile = this.tileAt(col, row);
        if (tile === '.') continue;
        const x = col * T;
        const y = row * T;
        g.fillStyle(tile === 'p' ? COLOURS.park : tile === 'H' ? COLOURS.home : COLOURS.lawn).fillRect(x, y, T, T);

        // Sidewalk along every edge that faces a road.
        g.fillStyle(COLOURS.sidewalk);
        const roadAbove = !this.isSolid(col, row - 1);
        const roadBelow = !this.isSolid(col, row + 1);
        const roadLeft = !this.isSolid(col - 1, row);
        const roadRight = !this.isSolid(col + 1, row);
        if (roadAbove) g.fillRect(x, y, T, SIDEWALK);
        if (roadBelow) g.fillRect(x, y + T - SIDEWALK, T, SIDEWALK);
        if (roadLeft) g.fillRect(x, y, SIDEWALK, T);
        if (roadRight) g.fillRect(x + T - SIDEWALK, y, SIDEWALK, T);

        const facesRoad = roadAbove || roadBelow || roadLeft || roadRight;
        if (tile === '#' && facesRoad && (col + row) % 2 === 0) {
          // A house roof on every other plot along the street.
          const roof = COLOURS.roofs[(col * 7 + row * 3) % COLOURS.roofs.length] ?? 0x888888;
          g.fillStyle(roof).fillRect(x + 14, y + 14, T - 28, T - 28);
        }
        if (tile === 'p' && (col * 3 + row * 5) % 4 === 0) {
          g.fillStyle(COLOURS.tree).fillCircle(x + T / 2, y + T / 2, 16);
        }
      }
    }

    // Lane markings down the middle of each two-lane road.
    g.fillStyle(0xe8d36a);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        if (this.isSolid(col, row)) continue;
        const horizontal = !this.isSolid(col, row + 1) && this.isSolid(col, row - 1) && this.isSolid(col, row + 2);
        const vertical = !this.isSolid(col + 1, row) && this.isSolid(col - 1, row) && this.isSolid(col + 2, row);
        if (horizontal) g.fillRect(col * T + 10, (row + 1) * T - 2, T - 20, 4);
        if (vertical) g.fillRect((col + 1) * T - 2, row * T + 10, 4, T - 20);
      }
    }

    // Bake the map into a single image once: redrawing thousands of shapes every frame is slow.
    const key = 'neighbourhood-map';
    if (!this.textures.exists(key)) g.generateTexture(key, worldWidth, worldHeight);
    g.destroy();
    this.add.image(0, 0, key).setOrigin(0, 0);

    this.labelArea('H', 'HOME', '#5a3a12');
    this.labelArea('p', 'PARK', '#ffffff');
  }

  /** Writes a label in the middle of every tile of the given type. */
  private labelArea(tile: string, text: string, color: string): void {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    NEIGHBOURHOOD_MAP.forEach((line, row) => {
      [...line].forEach((ch, col) => {
        if (ch !== tile) return;
        sumX += (col + 0.5) * TILE_SIZE;
        sumY += (row + 0.5) * TILE_SIZE;
        count++;
      });
    });
    if (count === 0) return;
    this.add
      .text(sumX / count, sumY / count, text, { fontFamily: 'monospace', fontSize: '22px', color, fontStyle: 'bold' })
      .setOrigin(0.5);
  }

  // ---- Truck ----

  private makeTruck(): Phaser.GameObjects.Container {
    const body = this.add.rectangle(0, 0, 46, 28, 0xfafafa).setStrokeStyle(2, 0x2b2b2b);
    const cab = this.add.rectangle(16, 0, 12, 24, 0x5ec8ff);
    const stripe = this.add.rectangle(-6, 0, 22, 6, 0xff7eb6);
    return this.add.container(0, 0, [body, stripe, cab]).setDepth(10);
  }

  private setFacing(facing: Facing): void {
    this.facing = facing;
    this.truck.setAngle(DIRECTIONS[facing].angle);
  }

  /** True if the truck's hit box, centred on (x, y), overlaps anything solid. */
  private blockedAt(x: number, y: number): boolean {
    const half = HIT_BOX / 2;
    const left = Math.floor((x - half) / TILE_SIZE);
    const right = Math.floor((x + half - 0.001) / TILE_SIZE);
    const top = Math.floor((y - half) / TILE_SIZE);
    const bottom = Math.floor((y + half - 0.001) / TILE_SIZE);
    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        if (this.isSolid(col, row)) return true;
      }
    }
    return false;
  }

  /** Moves the truck, stopping flush against walls. Returns false if it couldn't move at all. */
  private moveTruck(dx: number, dy: number): boolean {
    const start = { x: this.truck.x, y: this.truck.y };
    const target = { x: start.x + dx, y: start.y + dy };
    if (!this.blockedAt(target.x, target.y)) {
      this.truck.setPosition(target.x, target.y);
      return true;
    }
    // Creep forward a pixel at a time to sit right up against the obstacle.
    const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)));
    let moved = false;
    for (let i = 1; i <= steps; i++) {
      const nx = start.x + (dx * i) / steps;
      const ny = start.y + (dy * i) / steps;
      if (this.blockedAt(nx, ny)) break;
      this.truck.setPosition(nx, ny);
      moved = true;
    }
    return moved;
  }

  private releaseKeys(): void {
    this.held = [];
  }

  // ---- Customer marker ----

  private makeCustomer(): Phaser.GameObjects.Container {
    const ring = this.add.circle(0, 0, 26).setStrokeStyle(3, 0xff4f9a);
    const person = this.add.circle(0, 0, 14, 0xffd1e3).setStrokeStyle(3, 0xff4f9a);
    const bang = this.add
      .text(0, -1, '!', { fontFamily: 'monospace', fontSize: '20px', color: '#c2185b', fontStyle: 'bold' })
      .setOrigin(0.5);
    const label = this.add
      .text(0, -40, 'CUSTOMER', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffffff',
        backgroundColor: '#c2185b',
        padding: { x: 4, y: 1 },
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: ring, scale: 1.35, alpha: 0.2, duration: 700, yoyo: true, repeat: -1 });
    this.tweens.add({ targets: label, y: -46, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    return this.add.container(0, 0, [ring, person, bang, label]).setDepth(5);
  }

  /** Shows the customer at their spot, unless one is already at the window. */
  private refreshCustomer(): void {
    const spot = CUSTOMER_SPOTS.at(this.evening.customerSpot);
    const visible = !!spot && !this.evening.customerWaiting;
    this.customer.setVisible(visible);
    if (spot) this.customer.setPosition(spot.col * TILE_SIZE, spot.row * TILE_SIZE);
  }

  /** Driving into the customer stops the truck and opens the hub with the window ready. */
  private checkCustomer(): void {
    if (!this.customer.visible) return;
    const distance = Phaser.Math.Distance.Between(this.truck.x, this.truck.y, this.customer.x, this.customer.y);
    if (distance > CUSTOMER_REACH) return;
    this.leaving = true;
    this.speed = 0;
    this.evening.meetCustomer();
    this.scene.start(SceneKeys.Truck, { station: 'window' });
  }

  /** An arrow at the screen edge points to the customer while they're off screen. */
  private updatePointer(): void {
    const camera = this.cameras.main;
    const view = camera.worldView;
    const onScreen = view.contains(this.customer.x, this.customer.y);
    this.pointer.setVisible(this.customer.visible && !onScreen);
    if (!this.pointer.visible) return;

    const angle = Phaser.Math.Angle.Between(view.centerX, view.centerY, this.customer.x, this.customer.y);
    const margin = 28;
    const halfW = camera.width / 2 - margin;
    const halfH = camera.height / 2 - margin;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const scale = Math.min(halfW / Math.abs(cos || 1e-6), halfH / Math.abs(sin || 1e-6));
    this.pointer.setPosition(camera.width / 2 + cos * scale, camera.height / 2 + sin * scale);
    this.pointer.setRotation(angle);
  }
}
