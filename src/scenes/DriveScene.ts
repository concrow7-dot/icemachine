import * as Phaser from 'phaser';
import { formatMoney } from '../util/format';
import { hitCostCents } from '../state/Damage';
import { CURB_SPOTS, NEIGHBOURHOOD_MAP, PARKED_CARS, POTHOLES, TILE_SIZE } from '../config/neighbourhood';
import {
  EASY_ACCELERATION_SECONDS,
  EASY_STOPPING_SECONDS,
  EASY_TRUCK_SPEED,
  HIT_MIN_SPEED_FRACTION,
  PARKED_CAR_DAMAGE_CENTS,
  POTHOLE_DAMAGE_CENTS,
  POTHOLE_SPIN_SECONDS,
  ROAD_EDGE_DAMAGE_CENTS,
  TRUCK_ACCELERATION_SECONDS,
  TRUCK_BRAKING_SECONDS,
  TRUCK_COAST_SECONDS,
  TRUCK_CREEP_SPEED,
  TRUCK_MAX_TURN_DEGREES_PER_SECOND,
  TRUCK_MIN_TURN_RADIUS,
  TRUCK_REVERSE_ACCELERATION_SECONDS,
  TRUCK_REVERSE_DELAY_SECONDS,
  TRUCK_REVERSE_SPEED,
  TRUCK_SPEED,
  TURN_SLOWDOWN_ABOVE_FRACTION,
  TURN_SPEED_LOSS_PER_SECOND,
} from '../config/tuning';
import { getEvening, SceneKeys } from '../flow';
import { EveningEvents, EveningState, type Facing } from '../state/EveningState';

// Issue #9: driving the truck around the neighbourhood, seen from above.
// PO decisions: four-direction movement (like Pokémon), one fixed map about
// 20 seconds across, and the only way back into the truck is to drive into a
// waiting customer, which opens the hub with the window ready.
// Issue #10: potholes ($5, spin and stop), parked cars ($10) and the road
// edge ($2 a hit) cost money. Cars and the road edge stop the truck.
// Placeholder shapes until art direction (#17) is decided.

/** A solid box on the road, in pixels (a parked car). */
type Box = { left: number; top: number; right: number; bottom: number };
/** Driving into a pothole from this close (centre to centre) counts as hitting it. */
const POTHOLE_REACH = 22;

const HUD_HEIGHT = 44;
/** The truck collides as a 32 x 32 square whichever way it faces, so it can always turn at a junction. */
/**
 * The truck's collision shape: a rectangle the size of the drawn truck (46 x 28),
 * a touch smaller so near-misses that look clear are clear, turning with the
 * truck. It used to be a 32 px square that didn't turn, which caught on parked
 * cars the truck visibly cleared (PO, testing PR #58).
 */
const TRUCK_HALF_LENGTH = 22;
const TRUCK_HALF_WIDTH = 13;
/** After a crash, no new charge for this long (one bump = one charge). */
const HIT_COOLDOWN_MS = 400;
/** How close (in pixels) the truck's centre must get to the pickup zone: pulling into the curb lane beside the customer (#12). */
const CUSTOMER_REACH = 30;

const DIRECTIONS: Record<Facing, { dx: number; dy: number; angle: number }> = {
  right: { dx: 1, dy: 0, angle: 0 },
  down: { dx: 0, dy: 1, angle: 90 },
  left: { dx: -1, dy: 0, angle: 180 },
  up: { dx: 0, dy: -1, angle: -90 },
};

/** Easy driving: the way each arrow points the truck, in degrees. */
const EASY_HEADING: Record<Facing, number> = { right: 0, down: 90, left: 180, up: -90 };

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
  /** Which way the truck points, in degrees: 0 = right, 90 = down (car-style steering, #32). */
  private heading = 0;
  private speed = 0;
  /** Driving keys currently held: up = gas, down = brake/reverse, left/right = steer. */
  private held: Facing[] = [];
  /** The customer, standing on the sidewalk. */
  private customer!: Phaser.GameObjects.Container;
  /** The patch of road beside them where the truck pulls in to pick them up. */
  private pickupZone!: Phaser.GameObjects.Rectangle;
  private customerLabel!: Phaser.GameObjects.Text;
  private labelBob?: Phaser.Tweens.Tween;
  private pointer!: Phaser.GameObjects.Triangle;
  private leaving = false;
  private cars: Box[] = [];
  private potholes: { x: number; y: number; armed: boolean }[] = [];
  private spinning = false;
  private hitCooldownUntil = 0;
  /** The park brake (Q, only at a standstill): holds the truck still until the gas (or Q again). */
  private parkBrake = true;
  /** Which way the truck last moved (1 forward, -1 reverse): it creeps that way when you let go. */
  private rolling = 1;
  private parkLabel!: Phaser.GameObjects.Text;
  private notice?: Phaser.GameObjects.Text;
  /** How long the brake has been held at a standstill (it reverses after a moment). */
  private brakeHeldStill = 0;

  constructor() {
    super(SceneKeys.Drive);
  }

  create(): void {
    this.evening = getEvening(this);
    this.speed = 0;
    this.hitCooldownUntil = 0;
    // Each drive (hard) starts with the park brake on, so the truck doesn't creep off by itself.
    this.parkBrake = this.evening.difficulty === 'hard';
    this.rolling = 1;
    this.brakeHeldStill = 0;
    this.held = [];
    this.leaving = false;
    this.spinning = false;

    const worldWidth = (NEIGHBOURHOOD_MAP[0]?.length ?? 0) * TILE_SIZE;
    const worldHeight = NEIGHBOURHOOD_MAP.length * TILE_SIZE;

    this.drawNeighbourhood(worldWidth, worldHeight);
    this.placeObstacles();
    this.customer = this.makeCustomer();
    this.truck = this.makeTruck();

    const { x, y, angle } = this.evening.truck;
    this.truck.setPosition(x, y);
    this.setHeading(angle);

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
      .text(this.scale.width / 2, this.scale.height - HUD_HEIGHT - 16, this.evening.difficulty === 'easy'
          ? 'Arrows / WASD: drive    Pull up beside a customer (!)    Mind the potholes and cars'
          : '↑ gas  ↓ brake/reverse  ← → steer  Q park brake    Pull up beside a customer (!)', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffffff',
        backgroundColor: '#00000099',
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20);

    this.parkLabel = this.add
      .text(16, this.scale.height - HUD_HEIGHT - 66, 'P  PARK BRAKE   Gas or Q to release', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffffff',
        backgroundColor: '#c62828',
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(20)
      .setVisible(this.parkBrake);

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (event.key === 'q' || event.key === 'Q') this.toggleParkBrake();
      const dir = KEY_TO_FACING[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (dir && !this.held.includes(dir)) this.held.push(dir);
    });
    keyboard?.on('keyup', (event: KeyboardEvent) => {
      const dir = KEY_TO_FACING[event.key.length === 1 ? event.key.toLowerCase() : event.key];
      if (dir) this.held = this.held.filter((d) => d !== dir);
    });
    // Letting go of keys while the window is in the background shouldn't leave the truck driving.
    this.game.events.on(Phaser.Core.Events.BLUR, this.releaseKeys, this);
    // Keys let go of while paused never reached this screen: start clean on resume (#19).
    this.events.on(Phaser.Scenes.Events.RESUME, this.releaseKeys, this);

    const onCustomer = () => this.refreshCustomer();
    this.evening.on(EveningEvents.CustomerChanged, onCustomer);
    this.evening.on(EveningEvents.RoadCustomerChanged, onCustomer);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.evening.off(EveningEvents.CustomerChanged, onCustomer);
      this.evening.off(EveningEvents.RoadCustomerChanged, onCustomer);
      this.game.events.off(Phaser.Core.Events.BLUR, this.releaseKeys, this);
      this.evening.parkTruck({ x: this.truck.x, y: this.truck.y, angle: this.heading });
    });

    this.refreshCustomer();
  }

  update(_time: number, deltaMs: number): void {
    if (this.leaving) return;
    if (this.spinning) {
      this.updatePointer();
      return;
    }
    // Cap long frames (e.g. after switching tabs) so the truck never jumps.
    const dt = Math.min(deltaMs, 100) / 1000;
    if (this.easy) {
      this.driveEasy(dt);
    } else {
      this.driveHard(dt);
    }

    if (this.speed !== 0) {
      const rad = Phaser.Math.DegToRad(this.heading);
      const moved = this.moveTruck(Math.cos(rad) * this.speed * dt, Math.sin(rad) * this.speed * dt);
      if (!moved) this.speed = 0; // up against something: stopped (a creep just presses gently against it)
    }

    this.checkPotholes();
    this.checkCustomer();
    this.updatePointer();
  }

  /** Easy (PO, October 29): the original driving. The newest arrow held points the truck that way; let go and it stops. */
  private driveEasy(dt: number): void {
    const steering = this.held.at(-1);
    if (steering === undefined) {
      this.speed = Math.max(0, this.speed - (EASY_TRUCK_SPEED * dt) / EASY_STOPPING_SECONDS);
      return;
    }
    if (this.turnTo(EASY_HEADING[steering])) {
      this.speed = Math.min(EASY_TRUCK_SPEED, this.speed + (EASY_TRUCK_SPEED * dt) / EASY_ACCELERATION_SECONDS);
    }
  }

  /**
   * Easy: points the truck straight at `heading`. Right beside a curb there may
   * be no room to swing round on the spot, so it tries stepping a few pixels
   * the new way first. Returns false if the truck can't turn that way.
   */
  private turnTo(heading: number): boolean {
    if (Phaser.Math.Angle.WrapDegrees(heading) === this.heading) return true;
    const rad = Phaser.Math.DegToRad(heading);
    for (let step = 0; step <= TRUCK_HALF_LENGTH - TRUCK_HALF_WIDTH + 1; step++) {
      const x = this.truck.x + Math.cos(rad) * step;
      const y = this.truck.y + Math.sin(rad) * step;
      if (!this.obstacleAt(x, y, heading)) {
        this.truck.setPosition(x, y);
        this.setHeading(heading);
        return true;
      }
    }
    return false;
  }

  /** Hard (#32): car-style driving. */
  private driveHard(dt: number): void {
    const gas = this.held.includes('up');
    const brake = this.held.includes('down');
    const steer = (this.held.includes('right') ? 1 : 0) - (this.held.includes('left') ? 1 : 0);

    // Car-style driving (#32, PO testing PR #58). Gas speeds up. Let go of
    // everything and the truck rolls at a creep, the way it was last going;
    // the brake stops it, and holding the brake at a stop reverses after a
    // moment. To stay still once stopped, put the park brake on (Q).
    if (gas && !brake) {
      this.parkBrake = false;
      this.brakeHeldStill = 0;
      this.speed =
        this.speed < 0
          ? Math.min(0, this.speed + (TRUCK_SPEED * dt) / TRUCK_BRAKING_SECONDS)
          : Math.min(TRUCK_SPEED, this.speed + (TRUCK_SPEED * dt) / TRUCK_ACCELERATION_SECONDS);
    } else if (brake && !gas) {
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - (TRUCK_SPEED * dt) / TRUCK_BRAKING_SECONDS);
        this.brakeHeldStill = 0;
      } else if (this.speed === 0 && this.brakeHeldStill < TRUCK_REVERSE_DELAY_SECONDS) {
        this.brakeHeldStill += dt;
      } else {
        this.parkBrake = false;
        this.speed = Math.max(-TRUCK_REVERSE_SPEED, this.speed - (TRUCK_REVERSE_SPEED * dt) / TRUCK_REVERSE_ACCELERATION_SECONDS);
      }
    } else if (this.parkBrake) {
      this.brakeHeldStill = 0;
      this.speed = 0;
    } else {
      this.brakeHeldStill = 0;
      const roll = (TRUCK_SPEED * dt) / TRUCK_COAST_SECONDS;
      const creep = this.rolling * TRUCK_CREEP_SPEED;
      // Faster than a creep: slow down to it. Slower (just set off, or after a stop): ease up to it.
      if (Math.abs(this.speed) > TRUCK_CREEP_SPEED) this.speed -= Math.sign(this.speed) * Math.min(roll, Math.abs(this.speed) - TRUCK_CREEP_SPEED);
      else this.speed = creep > this.speed ? Math.min(creep, this.speed + roll / 4) : Math.max(creep, this.speed - roll / 4);
    }
    if (this.speed !== 0) this.rolling = Math.sign(this.speed);
    this.parkLabel.setVisible(this.parkBrake);

    // Steering turns the truck only while it's moving, like a car: tight turns
    // when slow, wider at speed. In reverse the wheel works the other way round.
    if (steer !== 0 && this.speed !== 0) {
      const turnRate = Math.min(TRUCK_MAX_TURN_DEGREES_PER_SECOND, Phaser.Math.RadToDeg(Math.abs(this.speed) / TRUCK_MIN_TURN_RADIUS));
      const turnedTo = this.heading + steer * Math.sign(this.speed) * turnRate * dt;
      // Don't swing the truck's nose or tail into a wall or a parked car.
      if (!this.obstacleAt(this.truck.x, this.truck.y, turnedTo)) this.setHeading(turnedTo);
      const fast = TRUCK_SPEED * TURN_SLOWDOWN_ABOVE_FRACTION;
      if (this.speed > fast) this.speed = Math.max(fast, this.speed - TRUCK_SPEED * TURN_SPEED_LOSS_PER_SECOND * dt);
    }

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

  /** Easy difficulty: the original arrows-point-the-way driving. */
  private get easy(): boolean {
    return this.evening.difficulty === 'easy';
  }

  /** Top speed for this difficulty: hits are priced against it. */
  private get topSpeed(): number {
    return this.easy ? EASY_TRUCK_SPEED : TRUCK_SPEED;
  }

  /** Q: the park brake goes on only once the truck has stopped; Q again (or the gas) takes it off. */
  private toggleParkBrake(): void {
    if (this.easy) return; // no park brake on easy: the truck stops when you let go
    if (this.parkBrake) {
      this.parkBrake = false;
    } else if (this.speed <= TRUCK_CREEP_SPEED + 1) {
      // #64: works at a stop, while creeping, and in reverse (always slow), not
      // only at a dead stop, which the creeping truck almost never reaches.
      this.speed = 0;
      this.parkBrake = true;
    } else {
      this.flashNotice('Slow to a creep to use the park brake');
    }
    this.parkLabel.setVisible(this.parkBrake);
  }

  /** A short message above the controls hint that fades out. */
  private flashNotice(message: string): void {
    this.notice?.destroy();
    const notice = this.add
      .text(16, this.scale.height - HUD_HEIGHT - 66, message, {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#1b1b1b',
        backgroundColor: '#ffe066',
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(21);
    this.notice = notice;
    this.tweens.add({ targets: notice, alpha: 0, delay: 1200, duration: 400, onComplete: () => notice.destroy() });
  }

  /** Points the truck `degrees` round from facing right (90 = down), any angle. */
  private setHeading(degrees: number): void {
    this.heading = Phaser.Math.Angle.WrapDegrees(degrees);
    this.truck.setAngle(this.heading);
  }

  /**
   * What the truck, centred on (x, y) and pointing `angle` degrees round, runs
   * into: the road edge, a parked car, or nothing.
   */
  private obstacleAt(x: number, y: number, angle = this.heading): 'edge' | 'car' | null {
    const rad = Phaser.Math.DegToRad(angle);
    const ux = Math.cos(rad);
    const uy = Math.sin(rad);
    if (this.cars.some((c) => this.truckOverlaps(x, y, ux, uy, c))) return 'car';
    // The truck's reach on screen at this angle, to find the map tiles it could touch.
    const reachX = TRUCK_HALF_LENGTH * Math.abs(ux) + TRUCK_HALF_WIDTH * Math.abs(uy);
    const reachY = TRUCK_HALF_LENGTH * Math.abs(uy) + TRUCK_HALF_WIDTH * Math.abs(ux);
    const left = Math.floor((x - reachX) / TILE_SIZE);
    const right = Math.floor((x + reachX - 0.001) / TILE_SIZE);
    const top = Math.floor((y - reachY) / TILE_SIZE);
    const bottom = Math.floor((y + reachY - 0.001) / TILE_SIZE);
    for (let row = top; row <= bottom; row++) {
      for (let col = left; col <= right; col++) {
        if (!this.isSolid(col, row)) continue;
        const tile = { left: col * TILE_SIZE, top: row * TILE_SIZE, right: (col + 1) * TILE_SIZE, bottom: (row + 1) * TILE_SIZE };
        if (this.truckOverlaps(x, y, ux, uy, tile)) return 'edge';
      }
    }
    return null;
  }

  /**
   * Does the truck's turned rectangle (centre x, y; pointing along ux, uy)
   * overlap a box? Checked on the four edge directions of the two shapes: if
   * there's a gap along any of them, they don't touch.
   */
  private truckOverlaps(x: number, y: number, ux: number, uy: number, box: Box): boolean {
    const vx = -uy;
    const vy = ux;
    const halfW = (box.right - box.left) / 2;
    const halfH = (box.bottom - box.top) / 2;
    const dx = box.left + halfW - x;
    const dy = box.top + halfH - y;
    const L = TRUCK_HALF_LENGTH;
    const W = TRUCK_HALF_WIDTH;
    if (Math.abs(dx) >= halfW + L * Math.abs(ux) + W * Math.abs(vx)) return false;
    if (Math.abs(dy) >= halfH + L * Math.abs(uy) + W * Math.abs(vy)) return false;
    if (Math.abs(dx * ux + dy * uy) >= L + halfW * Math.abs(ux) + halfH * Math.abs(uy)) return false;
    if (Math.abs(dx * vx + dy * vy) >= W + halfW * Math.abs(vx) + halfH * Math.abs(vy)) return false;
    return true;
  }

  /**
   * Moves the truck by (dx, dy), stopping flush against walls and parked cars.
   * A glancing blow slides along the edge instead of stopping dead; only the
   * part of the speed going into the obstacle counts as a hit (#10, #32).
   * Returns false if it couldn't move at all.
   */
  private moveTruck(dx: number, dy: number): boolean {
    // Straight up, down, left or right: drop the rounding crumbs from cos/sin, so it isn't mistaken for sliding.
    if (Math.abs(dx) < 1e-6) dx = 0;
    if (Math.abs(dy) < 1e-6) dy = 0;
    const { x, y } = this.truck;
    const hit = this.obstacleAt(x + dx, y + dy);
    if (!hit) {
      this.truck.setPosition(x + dx, y + dy);
      return true;
    }
    const xFree = dx !== 0 && !this.obstacleAt(x + dx, y);
    const yFree = dy !== 0 && !this.obstacleAt(x, y + dy);
    const distance = Math.hypot(dx, dy);
    // Sliding along a wall: only the sideways part of the motion is blocked.
    const slideX = xFree && !yFree;
    const slideY = yFree && !xFree;
    const intoIt = slideX ? Math.abs(dy) / distance : slideY ? Math.abs(dx) / distance : 1;
    const kind = (slideX ? this.obstacleAt(x, y + dy) : slideY ? this.obstacleAt(x + dx, y) : hit) ?? hit;
    const impact = Math.abs(this.speed) * intoIt;
    // One charge per hit: after a crash, a short cooldown stops a slow frame from charging twice.
    if (impact >= this.topSpeed * HIT_MIN_SPEED_FRACTION && this.time.now >= this.hitCooldownUntil) {
      this.crash(kind, impact, dx / distance, dy / distance);
    } else if (slideX || slideY) {
      // Sliding along the edge at the speed you're going along it. (It used to
      // shave speed off every frame, which pinned the truck against parked cars.)
      this.truck.setPosition(slideX ? x + dx : x, slideY ? y + dy : y);
      return true;
    }
    // Creep forward a pixel at a time to sit right up against the obstacle.
    const steps = Math.ceil(distance);
    let moved = false;
    for (let i = 1; i <= steps; i++) {
      const nx = x + (dx * i) / steps;
      const ny = y + (dy * i) / steps;
      if (this.obstacleAt(nx, ny)) break;
      this.truck.setPosition(nx, ny);
      moved = true;
    }
    return moved;
  }


  private releaseKeys(): void {
    this.held = [];
  }

  // ---- Obstacles (#10) ----

  private placeObstacles(): void {
    this.cars = [];
    this.potholes = [];
    const carColours = [0xc0392b, 0x2e86c1, 0x7d3c98, 0x27ae60, 0xd68910, 0x566573];

    POTHOLES.forEach(({ col, row }) => {
      const x = (col + 0.5) * TILE_SIZE;
      const y = (row + 0.5) * TILE_SIZE;
      this.add.ellipse(x, y, 36, 28, 0x2b2d31).setStrokeStyle(3, 0x45484f).setDepth(2);
      this.add.ellipse(x - 3, y - 2, 18, 12, 0x1a1b1e).setDepth(2);
      this.potholes.push({ x, y, armed: true });
    });

    PARKED_CARS.forEach(({ col, row, side }, i) => {
      const { dx, dy } = DIRECTIONS[side];
      // Parked against the curb: the car's centre sits 10 px from the lane's centre, toward the curb.
      const x = (col + 0.5) * TILE_SIZE + dx * 10;
      const y = (row + 0.5) * TILE_SIZE + dy * 10;
      const horizontal = side === 'up' || side === 'down';
      const w = horizontal ? 54 : 32;
      const h = horizontal ? 32 : 54;
      const colour = carColours[i % carColours.length] ?? 0x888888;
      this.add.rectangle(x, y, w, h, colour).setStrokeStyle(2, 0x1b1b1b).setDepth(3);
      this.add.rectangle(x, y, horizontal ? 22 : 24, horizontal ? 24 : 22, 0xbfe6ff, 0.9).setDepth(3);
      this.cars.push({ left: x - w / 2, top: y - h / 2, right: x + w / 2, bottom: y + h / 2 });
    });
  }

  /** Hitting a parked car or the road edge: the truck stops, the shake shows it, and it costs money. */
  private crash(kind: 'edge' | 'car', impact = Math.abs(this.speed), dirX = Math.cos(Phaser.Math.DegToRad(this.heading)), dirY = Math.sin(Phaser.Math.DegToRad(this.heading))): void {
    // Harder hits cost more (#32): priced from the speed going into the obstacle.
    const cost = hitCostCents(kind === 'car' ? PARKED_CAR_DAMAGE_CENTS : ROAD_EDGE_DAMAGE_CENTS, impact, this.topSpeed);
    this.speed = 0;
    this.hitCooldownUntil = this.time.now + HIT_COOLDOWN_MS;
    this.cameras.main.shake(150, 0.006);
    this.evening.takeDamage(cost, kind === 'car' ? 'Parked car' : 'Curb');
    // The cost pops up where the truck hit (PO, testing PR #40): its nose, or its back when reversing.
    this.showCost(this.truck.x + dirX * TRUCK_HALF_LENGTH, this.truck.y + dirY * TRUCK_HALF_LENGTH, cost);
  }

  /** A red "-$2.00" at the point of contact that floats up and fades. */
  private showCost(x: number, y: number, cents: number): void {
    const label = this.add
      .text(x, y, `-${formatMoney(cents)}`, { fontFamily: 'monospace', fontSize: '22px', color: '#d32f2f', fontStyle: 'bold' })
      .setOrigin(0.5)
      .setStroke('#ffffff', 5)
      .setDepth(20);
    this.tweens.add({ targets: label, y: y - 48, alpha: 0, duration: 1200, ease: 'Cubic.easeOut', onComplete: () => label.destroy() });
  }

  /** Driving over a pothole spins the truck round and stops it (PO, #10). Each pothole re-arms once you've left it. */
  private checkPotholes(): void {
    for (const hole of this.potholes) {
      const distance = Phaser.Math.Distance.Between(this.truck.x, this.truck.y, hole.x, hole.y);
      if (!hole.armed) {
        if (distance > POTHOLE_REACH + 24) hole.armed = true;
        continue;
      }
      if (distance > POTHOLE_REACH) continue;
      hole.armed = false;
      const cost = hitCostCents(POTHOLE_DAMAGE_CENTS, Math.abs(this.speed), this.topSpeed);
      this.speed = 0;
      this.spinning = true;
      this.cameras.main.shake(250, 0.01);
      this.evening.takeDamage(cost, 'Pothole');
      this.showCost(hole.x, hole.y, cost);
      this.tweens.add({
        targets: this.truck,
        angle: this.truck.angle + 360,
        duration: POTHOLE_SPIN_SECONDS * 1000,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          this.spinning = false;
          this.setHeading(this.heading);
        },
      });
      return;
    }
  }

  // ---- Customer at the curb (#12) ----

  private makeCustomer(): Phaser.GameObjects.Container {
    // The pickup zone: a soft pink patch in the curb lane, pulsing so it's easy to aim for.
    this.pickupZone = this.add
      .rectangle(0, 0, 50, 50, 0xff4f9a, 0.18)
      .setStrokeStyle(3, 0xff4f9a)
      .setDepth(4);
    this.tweens.add({ targets: this.pickupZone, scale: 1.2, alpha: 0.45, duration: 700, yoyo: true, repeat: -1 });

    const person = this.add.circle(0, 0, 14, 0xffd1e3).setStrokeStyle(3, 0xff4f9a);
    const bang = this.add
      .text(0, -1, '!', { fontFamily: 'monospace', fontSize: '20px', color: '#c2185b', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.customerLabel = this.add
      .text(0, -34, 'CUSTOMER', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffffff',
        backgroundColor: '#c2185b',
        padding: { x: 4, y: 1 },
      })
      .setOrigin(0.5);
    return this.add.container(0, 0, [person, bang, this.customerLabel]).setDepth(6);
  }

  /**
   * Places the customer on the sidewalk at their curb spot, with the pickup
   * zone in the road tile beside them. Hidden when nobody is waiting at the
   * curb, or while a customer is at the window.
   */
  private refreshCustomer(): void {
    const road = this.evening.roadCustomer;
    const spot = road ? CURB_SPOTS.at(road.spot) : undefined;
    const visible = !!spot && !this.evening.customerWaiting;
    this.customer.setVisible(visible).setAlpha(1);
    this.pickupZone.setVisible(visible);
    if (!spot) return;

    const { dx, dy } = DIRECTIONS[spot.side];
    const cx = (spot.col + 0.5) * TILE_SIZE;
    const cy = (spot.row + 0.5) * TILE_SIZE;
    this.pickupZone.setPosition(cx, cy);
    // On the sidewalk: just past the edge of the road tile.
    const toSidewalk = TILE_SIZE / 2 + 5;
    this.customer.setPosition(cx + dx * toSidewalk, cy + dy * toSidewalk);

    // The label sits on the far side of the customer from the road, so it never covers the pickup zone.
    const labelY = spot.side === 'down' ? 34 : -34;
    this.labelBob?.remove();
    this.customerLabel.setY(labelY);
    this.labelBob = this.tweens.add({
      targets: this.customerLabel,
      y: labelY + (labelY > 0 ? 6 : -6),
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Pulling into the pickup zone stops the truck and starts the sale. */
  private checkCustomer(): void {
    if (!this.customer.visible) return;
    const distance = Phaser.Math.Distance.Between(this.truck.x, this.truck.y, this.pickupZone.x, this.pickupZone.y);
    if (distance > CUSTOMER_REACH) return;
    this.leaving = true;
    this.speed = 0;
    // PO, doc 12 Q22: straight to the sales screen.
    this.evening.startSale();
    this.scene.start(SceneKeys.Sales);
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
