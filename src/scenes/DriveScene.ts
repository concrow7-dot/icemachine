import * as Phaser from 'phaser';
import { formatMoney } from '../util/format';
import { hitCostCents } from '../state/Damage';
import { WORCESTER } from '../config/worcester';
import { boxesOverlap, distanceToSegment, RoadNetwork, ROAD_HALF_WIDTH, type TurnedBox } from '../state/RoadGeometry';
import {
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
// The only way back into the truck is to drive into a waiting customer.
// Issue #10: potholes ($5, spin and stop), parked cars ($10) and the road
// edge ($2 a hit) cost money. Cars and the road edge stop the truck.
// SCREAM-10 (PO, October 30): the map is the real streets around June St,
// Pleasant St, Park Ave and Chandler St in Worcester, at their real angles,
// with real street names, about twice as big as the old grid map. Generated
// by tools/worcester/build_map.py from OpenStreetMap; LimeZu art.

/** A parked car, in px: 54 x 32, as before. */
const CAR_HALF_LENGTH = 27;
const CAR_HALF_WIDTH = 16;
const CAR_COLOURS = [0xc0392b, 0x2e86c1, 0x7d3c98, 0x27ae60, 0xd68910, 0x566573];
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
/** Points round the truck's outline, checked against the road edge (along, across). */
const TRUCK_OUTLINE: [number, number][] = [];
for (let l = -TRUCK_HALF_LENGTH; l <= TRUCK_HALF_LENGTH; l += TRUCK_HALF_LENGTH / 4) {
  TRUCK_OUTLINE.push([l, -TRUCK_HALF_WIDTH], [l, TRUCK_HALF_WIDTH]);
}
for (const w of [-TRUCK_HALF_WIDTH / 2, 0, TRUCK_HALF_WIDTH / 2]) TRUCK_OUTLINE.push([-TRUCK_HALF_LENGTH, w], [TRUCK_HALF_LENGTH, w]);
/** After a crash, no new charge for this long (one bump = one charge). */
const HIT_COOLDOWN_MS = 400;
/** How close (in pixels) the truck's centre must get to the pickup zone: pulling into the curb lane beside the customer (#12). */
/** The pink pickup square beside a curb customer, in px (it pulses bigger on screen; this is its real size). */
const PICKUP_ZONE_SIZE = 50;
/** SCREAM-16 (PO): at least half of the truck's hitbox must be in the pickup square. */
const PICKUP_MIN_OVERLAP = 0.5;


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

/** Colours (the road surface itself comes as images from the map generator). */
const COLOURS = {
  lane: 0xe8d36a,
  park: 0x5fae5a,
  pitch: 0x4f9d4a,
  school: 0xb9ad97,
};
/**
 * The painted map image round the camera: the 512 px square the view starts in
 * plus enough to cover the 960 x 496 view from anywhere in it, and a little
 * extra for the camera shake.
 */
const MAP_SQUARE = 512;
const MAP_PAINT_MARGIN = 32;
const MAP_TEXTURE_WIDTH = MAP_SQUARE + 960 + 2 * MAP_PAINT_MARGIN + 64;
const MAP_TEXTURE_HEIGHT = MAP_SQUARE + 496 + 2 * MAP_PAINT_MARGIN + 16;
const v = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

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
  private cars: TurnedBox[] = [];
  /** The map being driven (SCREAM-10: Worcester). */
  readonly map = WORCESTER;
  private readonly roads = new RoadNetwork(WORCESTER.roads, WORCESTER.roadMask);
  /** Map pieces shown only near the camera (2,000 houses and trees drawn every frame were too slow). */
  /** Street, field and Home names, shown only near the camera. */
  private mapTexts: { obj: Phaser.GameObjects.Text; x: number; y: number }[] = [];
  private roadGraphics!: Phaser.GameObjects.Graphics;
  private fieldGraphics!: Phaser.GameObjects.Graphics;
  /** The ground, roads, houses and trees round the camera, painted into one image (one draw per frame). */
  private mapTexture!: Phaser.GameObjects.RenderTexture;
  private sortedObjects = [...WORCESTER.objects].sort((a, b) => a.y - b.y);
  private dashes: { x: number; y: number; ux: number; uy: number }[] = [];
  private viewKey = '';
  private potholes: { x: number; y: number; armed: boolean }[] = [];
  private spinning = false;
  private hitCooldownUntil = 0;
  /** Still in contact with what it last ran into: scraping along it isn't a new hit (SCREAM-10). */
  private scraping = false;
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

  preload(): void {
    this.load.image('map-grass', 'assets/limezu/map/grass.png');
    for (const { key } of WORCESTER.sprites) this.load.image(`map-${key}`, `assets/limezu/map/${key}.png`);
    for (const { key } of WORCESTER.roadTiles) this.load.image(`map-${key}`, `assets/map/${key}.png`);
  }

  create(): void {
    this.evening = getEvening(this);
    this.speed = 0;
    this.hitCooldownUntil = 0;
    this.scraping = false;
    // Each drive starts with the park brake on, so the truck doesn't creep off by itself.
    this.parkBrake = true;
    this.rolling = 1;
    this.brakeHeldStill = 0;
    this.held = [];
    this.leaving = false;
    this.spinning = false;

    const worldWidth = WORCESTER.width;
    const worldHeight = WORCESTER.height;

    this.drawNeighbourhood(worldWidth, worldHeight);
    this.placeObstacles();
    this.customer = this.makeCustomer();
    this.truck = this.makeTruck();

    const { x, y, angle } = this.evening.truck;
    this.truck.setPosition(x, y);
    this.setHeading(angle);
    this.viewKey = '';
    this.refreshVisibleMap();

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
      .text(this.scale.width / 2, this.scale.height - HUD_HEIGHT - 16, '↑ gas  ↓ brake/reverse  ← → steer  Q park brake    Pull up beside a customer (!)', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffffff',
        backgroundColor: '#00000099',
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20);

    // OpenStreetMap's licence asks for a credit wherever the map is shown.
    this.add
      .text(this.scale.width - 6, 4, '© OpenStreetMap contributors', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ffffff',
        backgroundColor: '#00000066',
        padding: { x: 3, y: 1 },
      })
      .setOrigin(1, 0)
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
    this.refreshVisibleMap();
    if (this.leaving) return;
    if (this.spinning) {
      this.updatePointer();
      return;
    }
    // Cap long frames (e.g. after switching tabs) so the truck never jumps.
    const dt = Math.min(deltaMs, 100) / 1000;
    this.driveHard(dt);

    if (this.speed !== 0) {
      const rad = Phaser.Math.DegToRad(this.heading);
      const moved = this.moveTruck(Math.cos(rad) * this.speed * dt, Math.sin(rad) * this.speed * dt);
      if (!moved) this.speed = 0; // up against something: stopped (a creep just presses gently against it)
    }

    this.checkPotholes();
    this.checkCustomer();
    this.updatePointer();
  }

  /** Car-style driving (#32): the only way to drive since Easy was removed (SCREAM-53). */
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

  // ---- Map (SCREAM-10) ----

  private drawNeighbourhood(worldWidth: number, worldHeight: number): void {
    this.textures.get('map-grass').setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.mapTexture = this.add.renderTexture(0, 0, MAP_TEXTURE_WIDTH, MAP_TEXTURE_HEIGHT).setOrigin(0, 0).setDepth(0);

    // Parks, sports fields and the school grounds, from OpenStreetMap.
    const fields = this.make.graphics({}, false);
    this.fieldGraphics = fields;
    for (const area of WORCESTER.areas) {
      const pts: Phaser.Math.Vector2[] = [];
      for (let i = 0; i + 1 < area.points.length; i += 2) pts.push(v(area.points[i]!, area.points[i + 1]!));
      const colour = area.kind === 'school' ? COLOURS.school : area.kind === 'park' ? COLOURS.park : COLOURS.pitch;
      fields.fillStyle(colour, 1).fillPoints(pts, true);
      if (area.kind === 'pitch') fields.lineStyle(3, 0xffffff, 0.8).strokePoints(pts, true);
    }

    // Roads: redrawn for the area round the camera as it moves (see refreshVisibleMap).
    this.roadGraphics = this.make.graphics({}, false);
    this.dashes = [];
    for (const s of this.roads.segments) {
      const len = Math.hypot(s.bx - s.ax, s.by - s.ay);
      const ux = (s.bx - s.ax) / len;
      const uy = (s.by - s.ay) / len;
      for (let d = 8; d + 16 < len; d += 32) {
        const x = s.ax + ux * (d + 8);
        const y = s.ay + uy * (d + 8);
        // Left out at junctions.
        if (!this.roads.segments.some((o) => o.road !== s.road && distanceToSegment(x, y, o) < ROAD_HALF_WIDTH * 2)) this.dashes.push({ x, y, ux, uy });
      }
    }

    // Houses and trees (LimeZu, at the pack's 16 px size), drawn front to back.
    for (const { key } of [...WORCESTER.sprites, ...WORCESTER.roadTiles]) this.textures.get(`map-${key}`).setFilter(Phaser.Textures.FilterMode.NEAREST);
    // Names: text over the map image, shown only near the camera (refreshVisibleMap).
    this.mapTexts = [];
    const paint = (x: number, y: number, text: Phaser.GameObjects.Text) => {
      this.add.existing(text.setPosition(x, y).setDepth(7).setVisible(false));
      this.mapTexts.push({ obj: text, x, y });
    };
    const home = WORCESTER.home;
    if (home) {
      const sprite = WORCESTER.sprites.find((s) => s.key === home.key);
      const y = home.y - (sprite?.h ?? 100) - 6;
      paint(home.x, y, this.make.text({ x: 0, y: 0, text: 'HOME', style: { fontFamily: 'monospace', fontSize: '18px', color: '#ffe066', fontStyle: 'bold' } }, false).setOrigin(0.5, 1).setStroke('#3a2a10', 5));
    }
    // Street names, written along the road.
    for (const label of WORCESTER.labels) {
      paint(
        label.x,
        label.y,
        this.make
          .text({ x: 0, y: 0, text: label.name.toUpperCase(), style: { fontFamily: 'monospace', fontSize: '13px', color: '#ffffff', fontStyle: 'bold' } }, false)
          .setOrigin(0.5)
          .setAngle(label.angle)
          .setStroke('#2b2b2b', 4)
          .setAlpha(0.9),
      );
    }
    // Field and park names.
    for (const area of WORCESTER.areas) {
      if (!area.name) continue;
      let x = 0;
      let y = 0;
      const n = area.points.length / 2;
      for (let i = 0; i < area.points.length; i += 2) {
        x += area.points[i]! / n;
        y += area.points[i + 1]! / n;
      }
      paint(
        x,
        y,
        this.make
          .text({ x: 0, y: 0, text: area.name, style: { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff', fontStyle: 'bold', align: 'center', wordWrap: { width: 260 } } }, false)
          .setOrigin(0.5)
          .setStroke('#24502a', 5),
      );
    }
  }

  /**
   * Paints the map round the camera into one image: grass, fields, roads,
   * potholes, parked cars, houses and trees (names stay as text on top). Drawing them all as
   * separate objects every frame was too slow (2,000 houses and trees). Runs
   * when the camera moves into a new 512 px square, so most frames do nothing.
   */
  private refreshVisibleMap(): void {
    const C = MAP_SQUARE;
    const view = this.cameras.main.worldView;
    const cx = view.width > 0 ? view.x : this.truck.x - 480;
    const cy = view.width > 0 ? view.y : this.truck.y - 270;
    const key = `${Math.floor(cx / C)},${Math.floor(cy / C)}`;
    if (key === this.viewKey) return;
    this.viewKey = key;
    const x0 = Math.floor(cx / C) * C - MAP_PAINT_MARGIN;
    const y0 = Math.floor(cy / C) * C - MAP_PAINT_MARGIN;
    const x1 = x0 + MAP_TEXTURE_WIDTH;
    const y1 = y0 + MAP_TEXTURE_HEIGHT;

    // The road surface (sidewalks, curbs, asphalt, rounded corners) comes as images
    // from the map generator; lane lines, potholes and parked cars are drawn over it.
    const g = this.roadGraphics.clear();
    g.fillStyle(COLOURS.lane, 1);
    for (const { x, y, ux, uy } of this.dashes) {
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      g.fillPoints(
        [v(x - ux * 8 - uy * 1.5, y - uy * 8 + ux * 1.5), v(x + ux * 8 - uy * 1.5, y + uy * 8 + ux * 1.5), v(x + ux * 8 + uy * 1.5, y + uy * 8 - ux * 1.5), v(x - ux * 8 + uy * 1.5, y - uy * 8 - ux * 1.5)],
        true,
      );
    }

    // Potholes and parked cars.
    for (const { x, y } of WORCESTER.potholes) {
      if (x < x0 - 40 || x > x1 + 40 || y < y0 - 40 || y > y1 + 40) continue;
      g.fillStyle(0x45484f, 1).fillEllipse(x, y, 42, 34);
      g.fillStyle(0x2b2d31, 1).fillEllipse(x, y, 36, 28);
      g.fillStyle(0x1a1b1e, 1).fillEllipse(x - 3, y - 2, 18, 12);
    }
    const turned = (x: number, y: number, angle: number, hl: number, hw: number) => {
      const r = Phaser.Math.DegToRad(angle);
      const ux = Math.cos(r);
      const uy = Math.sin(r);
      return [v(x + ux * hl - uy * hw, y + uy * hl + ux * hw), v(x + ux * hl + uy * hw, y + uy * hl - ux * hw), v(x - ux * hl + uy * hw, y - uy * hl - ux * hw), v(x - ux * hl - uy * hw, y - uy * hl + ux * hw)];
    };
    WORCESTER.parkedCars.forEach(({ x, y, angle }, i) => {
      if (x < x0 - 60 || x > x1 + 60 || y < y0 - 60 || y > y1 + 60) return;
      g.fillStyle(0x1b1b1b, 1).fillPoints(turned(x, y, angle, CAR_HALF_LENGTH + 1, CAR_HALF_WIDTH + 1), true);
      g.fillStyle(CAR_COLOURS[i % CAR_COLOURS.length] ?? 0x888888, 1).fillPoints(turned(x, y, angle, CAR_HALF_LENGTH - 1, CAR_HALF_WIDTH - 1), true);
      g.fillStyle(0xbfe6ff, 0.9).fillPoints(turned(x, y, angle, 11, 12), true);
    });

    // Paint it all into the map image: grass, fields, roads, then houses and trees front to back, then names.
    const rt = this.mapTexture.setPosition(x0, y0).clear();
    const GRASS = 64;
    rt.repeat('map-grass', undefined, -(((x0 % GRASS) + GRASS) % GRASS), -(((y0 % GRASS) + GRASS) % GRASS), MAP_TEXTURE_WIDTH + GRASS, MAP_TEXTURE_HEIGHT + GRASS);
    rt.draw(this.fieldGraphics, -x0, -y0);
    const tileSize = 512 * WORCESTER.roadTileScale;
    for (const t of WORCESTER.roadTiles) {
      if (t.x + tileSize < x0 || t.x > x1 || t.y + tileSize < y0 || t.y > y1) continue;
      rt.stamp(`map-${t.key}`, undefined, t.x - x0, t.y - y0, { originX: 0, originY: 0, scale: WORCESTER.roadTileScale });
    }
    rt.draw(g, -x0, -y0);
    for (const o of this.sortedObjects) {
      if (o.x < x0 - 150 || o.x > x1 + 150 || o.y < y0 || o.y > y1 + 220) continue;
      rt.stamp(`map-${o.key}`, undefined, o.x - x0, o.y - y0, { originX: 0.5, originY: 1 });
    }
    rt.render();
    for (const t of this.mapTexts) t.obj.setVisible(t.x > x0 - 200 && t.x < x1 + 200 && t.y > y0 - 200 && t.y < y1 + 200);
  }

  // ---- Truck ----

  /**
   * The truck from above, facing right, in the colours of LimeZu's ice cream
   * truck (SCREAM-6, PO October 30: the pack only has it side-on, so the driving
   * truck is drawn here to match). Same 46 x 28 size as the collision shape.
   */
  private makeTruck(): Phaser.GameObjects.Container {
    const body = this.add.rectangle(0, 0, 46, 28, 0xd6779d).setStrokeStyle(2, 0x3a3a50);
    const roof = this.add.rectangle(-5, 0, 30, 22, 0x5ea592).setStrokeStyle(1, 0x367f82);
    const windscreen = this.add.rectangle(15, 0, 6, 22, 0xa4bbd5);
    const bonnet = this.add.rectangle(20, 0, 4, 24, 0xeea5b8);
    const cone = this.add.triangle(-6, 0, 0, -4, 0, 4, -12, 0, 0xd9a35a);
    const scoop = this.add.circle(-3, 0, 5, 0xeea5b8).setStrokeStyle(1, 0xb95d72);
    return this.add.container(0, 0, [body, roof, windscreen, bonnet, cone, scoop]).setDepth(10);
  }

  /** Top speed: hits are priced against it. */
  private get topSpeed(): number {
    return TRUCK_SPEED;
  }

  /** Q: the park brake goes on only once the truck has stopped; Q again (or the gas) takes it off. */
  private toggleParkBrake(): void {
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
   * into: a parked car, the road edge (any part of it off the asphalt), or nothing.
   */
  private obstacleAt(x: number, y: number, angle = this.heading): 'edge' | 'car' | null {
    const truck: TurnedBox = { x, y, angle, halfLength: TRUCK_HALF_LENGTH, halfWidth: TRUCK_HALF_WIDTH };
    if (this.cars.some((c) => boxesOverlap(truck, c))) return 'car';
    const rad = Phaser.Math.DegToRad(angle);
    const ux = Math.cos(rad);
    const uy = Math.sin(rad);
    // Points round the truck's outline: every corner, and every few pixels along each side.
    for (const [l, w] of TRUCK_OUTLINE) {
      const px = x + ux * l - uy * w;
      const py = y + uy * l + ux * w;
      if (!this.roads.onRoad(px, py)) return 'edge';
    }
    return null;
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
      this.scraping = false;
      this.truck.setPosition(x + dx, y + dy);
      return true;
    }
    const distance = Math.hypot(dx, dy);
    // Glancing off the edge: slide along the road (its direction here), or else
    // along whichever of across/down is still free. Only the part of the motion
    // going into the obstacle counts as a hit.
    let slide: [number, number] | null = null;
    const seg = this.roads.nearestSegment(x, y);
    if (seg) {
      const len = Math.hypot(seg.bx - seg.ax, seg.by - seg.ay) || 1;
      const tx = (seg.bx - seg.ax) / len;
      const ty = (seg.by - seg.ay) / len;
      const along = dx * tx + dy * ty;
      // The drawn curb comes in 2 px steps (rounded corners), so a truck sliding
      // along it may also ease up to 3 px back toward the middle of the road.
      const vx = seg.bx - seg.ax;
      const vy = seg.by - seg.ay;
      const t = Math.max(0, Math.min(1, ((x - seg.ax) * vx + (y - seg.ay) * vy) / (vx * vx + vy * vy || 1)));
      const toMiddleX = seg.ax + t * vx - x;
      const toMiddleY = seg.ay + t * vy - y;
      const toMiddle = Math.hypot(toMiddleX, toMiddleY) || 1;
      if (Math.abs(along) > 0.01) {
        for (const ease of [0, 1, 2, 3]) {
          const sx = tx * along + (toMiddleX / toMiddle) * ease;
          const sy = ty * along + (toMiddleY / toMiddle) * ease;
          if (!this.obstacleAt(x + sx, y + sy)) {
            slide = [sx, sy];
            break;
          }
        }
      }
    }
    if (!slide && dx !== 0 && dy !== 0) {
      if (!this.obstacleAt(x + dx, y)) slide = [dx, 0];
      else if (!this.obstacleAt(x, y + dy)) slide = [0, dy];
    }
    const kept = slide ? Math.hypot(slide[0], slide[1]) / distance : 0;
    const intoIt = slide ? Math.sqrt(Math.max(0, 1 - kept * kept)) : 1;
    const impact = Math.abs(this.speed) * intoIt;
    // One charge per hit: after a crash, a short cooldown stops a slow frame from charging twice,
    // and grinding along a slanted curb you're already touching isn't a new hit.
    const fresh = !this.scraping;
    this.scraping = true;
    if (fresh && impact >= this.topSpeed * HIT_MIN_SPEED_FRACTION && this.time.now >= this.hitCooldownUntil) {
      this.crash(hit, impact, dx / distance, dy / distance);
    } else if (slide) {
      // Sliding along the edge at the speed you're going along it. (It used to
      // shave speed off every frame, which pinned the truck against parked cars.)
      this.truck.setPosition(x + slide[0], y + slide[1]);
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
    // Drawn in the map image (refreshVisibleMap); these are what the truck runs into.
    for (const { x, y } of WORCESTER.potholes) this.potholes.push({ x, y, armed: true });
    // Parked against the curb, along the road (SCREAM-10: at the road's angle).
    for (const { x, y, angle } of WORCESTER.parkedCars) this.cars.push({ x, y, angle, halfLength: CAR_HALF_LENGTH, halfWidth: CAR_HALF_WIDTH });
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
      .rectangle(0, 0, PICKUP_ZONE_SIZE, PICKUP_ZONE_SIZE, 0xff4f9a, 0.18)
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
    const spot = road ? WORCESTER.curbSpots.at(road.spot) : undefined;
    const visible = !!spot && !this.evening.customerWaiting;
    this.customer.setVisible(visible).setAlpha(1);
    this.pickupZone.setVisible(visible);
    if (!spot) return;

    // The pickup square sits in the curb lane, turned to the road; the customer is on the sidewalk beside it.
    this.pickupZone.setPosition(spot.x, spot.y).setAngle(spot.angle);
    this.customer.setPosition(spot.customerX, spot.customerY);

    // The label sits on the far side of the customer from the road, so it never covers the pickup zone.
    const labelY = spot.customerY > spot.y + 10 ? 34 : -34;
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

  /**
   * SCREAM-16 (PO, October 30): the sales window opens only once the truck has
   * come to a complete stop with at least half its hitbox in the pickup square,
   * and then straight away (no "press Enter to serve").
   */
  private checkCustomer(): void {
    if (!this.customer.visible || this.speed !== 0) return;
    if (this.pickupOverlap() < PICKUP_MIN_OVERLAP) return;
    this.leaving = true;
    this.evening.startSale();
    this.scene.start(SceneKeys.Sales);
  }

  /** How much of the truck's hitbox (0 to 1) is inside the pickup square, sampled on a grid. */
  pickupOverlap(): number {
    const rad = Phaser.Math.DegToRad(this.heading);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const half = PICKUP_ZONE_SIZE / 2;
    const zoneRad = this.pickupZone.rotation;
    const zoneCos = Math.cos(zoneRad);
    const zoneSin = Math.sin(zoneRad);
    const steps = 10;
    let inside = 0;
    let total = 0;
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= steps; j++) {
        const lx = (i / steps - 0.5) * 2 * TRUCK_HALF_LENGTH;
        const ly = (j / steps - 0.5) * 2 * TRUCK_HALF_WIDTH;
        const x = this.truck.x + lx * cos - ly * sin;
        const y = this.truck.y + lx * sin + ly * cos;
        total++;
        // In the pickup square's own frame (it's turned to the road).
        const ox = x - this.pickupZone.x;
        const oy = y - this.pickupZone.y;
        if (Math.abs(ox * zoneCos + oy * zoneSin) <= half && Math.abs(-ox * zoneSin + oy * zoneCos) <= half) inside++;
      }
    }
    return inside / total;
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
