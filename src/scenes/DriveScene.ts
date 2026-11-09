import * as Phaser from 'phaser';
import { BUBBLE_INK, drawBubble } from '../ui/speechBubble';
import { showLoadingWhileLoading } from './LoadingScene';
import { formatMoney } from '../util/format';
import { hitCostCents } from '../state/Damage';
import { currentMap, versioned, type GameMap } from '../config/maps';
import type { WorcesterMap } from '../config/mapTypes';
import { boxesOverlap, distanceToSegment, LANE_WIDTH, RoadNetwork, type TurnedBox } from '../state/RoadGeometry';
import {
  HIT_MIN_SPEED_FRACTION,
  MUSIC_RING_RADIUS,
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
  TRUCK_COAST_KEEP,
  TRUCK_COAST_KEEP_SECONDS,
  TRUCK_LENGTH,
  TRUCK_WIDTH,
  PICKUP_ZONE_LENGTH,
  PICKUP_ZONE_WIDTH,
  TRUCK_LOOK_SCALE,
  TRUCK_LOOK_TILT,
  PARKED_CAR_SCALE,
  DRIVE_CAMERA_ZOOM,
  TURN_SLOWDOWN_ABOVE_FRACTION,
  TURN_SPEED_LOSS_PER_SECOND,
} from '../config/tuning';
import { getEvening, SceneKeys } from '../flow';
import { EveningState, type Facing } from '../state/EveningState';
import { loadResidentSheet, residentFrame, residentsKey } from '../ui/residentLook';
import { UNCLE_URL } from '../ui/smoothPixels';

import type { ResidentNow } from '../state/Residents';
import { musicFor, type Music } from '../audio/Music';
import { loadTruckViews, truckView, TRUCK_VIEWS_KEY, TRUCK_VIEW_ORIGIN_Y } from '../ui/truckViews';
import { gasStations } from '../config/gasStation';
import type { AutoRoute } from '../state/AutoRoute';
import type { UncleLeg } from '../state/Tutorial';
import { UncleDrive, UNCLE_WALKER_KEY } from './uncleDrive';

// Issue #9: driving the truck around the neighbourhood, seen from above.
// The only way back into the truck is to pick up a waiting customer.
// SCREAM-67 (PO, November 2): customers are the residents. A faint ring round the
// truck shows how far its music reaches; people inside it may want ice cream, and
// then a "!" pops up and they run to the curb. Stop fully, with half the truck in
// the pink square beside them, to serve them. The pointer arrow is gone (SCREAM-68).
// SCREAM-24: the truck plays music while you drive; M mutes it, N skips a song.
// Issue #10: potholes ($5, spin and stop), parked cars ($10) and the road
// edge ($2 a hit) cost money. Cars and the road edge stop the truck.
// SCREAM-10 (PO, October 30): the map is the real streets around June St,
// Pleasant St, Park Ave and Chandler St in Worcester, at their real angles,
// with real street names, about twice as big as the old grid map. Generated
// by tools/worcester/build_map.py from OpenStreetMap; LimeZu art.

/** A parked car, in px: 54 x 32, as before. */
const CAR_HALF_LENGTH = 27 * PARKED_CAR_SCALE;
const CAR_HALF_WIDTH = 16 * PARKED_CAR_SCALE;
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
const TRUCK_HALF_LENGTH = TRUCK_LENGTH / 2;
const TRUCK_HALF_WIDTH = TRUCK_WIDTH / 2;
/** Points round the truck's outline, checked against the road edge (along, across). */
const TRUCK_OUTLINE: [number, number][] = [];
for (let l = -TRUCK_HALF_LENGTH; l <= TRUCK_HALF_LENGTH; l += TRUCK_HALF_LENGTH / 4) {
  TRUCK_OUTLINE.push([l, -TRUCK_HALF_WIDTH], [l, TRUCK_HALF_WIDTH]);
}
for (const w of [-TRUCK_HALF_WIDTH / 2, 0, TRUCK_HALF_WIDTH / 2]) TRUCK_OUTLINE.push([-TRUCK_HALF_LENGTH, w], [TRUCK_HALF_LENGTH, w]);
/** After a crash, no new charge for this long (one bump = one charge). */
const HIT_COOLDOWN_MS = 400;
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


/** Residents (and the houses and trees in front of them) are drawn between the map (0) and the curb customer (6). */
const RESIDENT_DEPTH = 5;
/** Depth added per px down the map, so lower on screen means in front: the map is under 10,000 px tall. */
const DEPTH_PER_PX = 10000;
/** The size of the squares houses and trees are filed under, to find the ones near a resident quickly. */
const OCCLUDER_CELL = 128;
const MAP_PAINT_MARGIN = 32;
const MAP_TEXTURE_WIDTH = MAP_SQUARE + 960 + 2 * MAP_PAINT_MARGIN + 64;
const MAP_TEXTURE_HEIGHT = MAP_SQUARE + 496 + 2 * MAP_PAINT_MARGIN + 16;
const v = (x: number, y: number) => new Phaser.Math.Vector2(x, y);

export class DriveScene extends Phaser.Scene {
  private evening!: EveningState;
  private truck!: Phaser.GameObjects.Container;
  /** SCREAM-115: the truck's picture inside its container. */
  private truckLook!: Phaser.GameObjects.Image;
  /** SCREAM-115: tilt the view to the exact heading (tests and playtests can flip it). */
  lookTilt = TRUCK_LOOK_TILT;
  /** Which way the truck points, in degrees: 0 = right, 90 = down (car-style steering, #32). */
  private heading = 0;
  private speed = 0;
  /** Driving keys currently held: up = gas, down = brake/reverse, left/right = steer. */
  private held: Facing[] = [];
  /** One sprite per resident, in the same order as evening.residents.all. */
  private residentSprites: Phaser.GameObjects.Sprite[] = [];
  /** Houses and trees by 128 px square, as indexes into this.map.objects, for finding what stands in front of a resident. */
  private objectGrid = new Map<string, number[]>();
  /** Copies of houses and trees drawn over a resident who is behind them (SCREAM-104), by object index. */
  private occluders = new Map<number, Phaser.GameObjects.Image>();
  /** SCREAM-67: the faint ring round the truck: how far its music reaches. */
  private ring!: Phaser.GameObjects.Arc;
  /** The pink square in the curb lane beside each waiting customer, by resident index. */
  private pickupZones = new Map<number, Phaser.GameObjects.Rectangle>();
  /** The "!" thought bubble over each customer running to (or waiting at) the curb, by resident index. */
  private bubbles = new Map<number, Phaser.GameObjects.Container>();
  private music!: Music;
  private songLabel!: Phaser.GameObjects.Text;
  private songLabelTween?: Phaser.Tweens.Tween;
  private leaving = false;
  private cars: TurnedBox[] = [];
  /** The map being driven (SCREAM-10: Worcester; SCREAM-146: or the tutorial map). Set in preload. */
  map: WorcesterMap = currentMap().data;
  /** The map's files and texture keys. */
  private assets: GameMap = currentMap();
  private roads = new RoadNetwork(this.map.roads, this.map.roadMask);
  private objectSizes = new Map(this.map.sprites.map((s) => [s.key, s] as const));
  /** Map pieces shown only near the camera (2,000 houses and trees drawn every frame were too slow). */
  /** Street, field and Home names, shown only near the camera. */
  private mapTexts: { obj: Phaser.GameObjects.Text; x: number; y: number }[] = [];
  private roadGraphics!: Phaser.GameObjects.Graphics;
  private fieldGraphics!: Phaser.GameObjects.Graphics;
  /** The ground, roads, houses and trees round the camera, painted into one image (one draw per frame). */
  private mapTexture!: Phaser.GameObjects.RenderTexture;
  /** Houses and trees painted into the map, front to back, with the gas station's pumps (SCREAM-22) in place of the house on its spot. */
  private sortedObjects: { key: string; x: number; y: number }[] = [];
  /** The truck's hit box, half its length and width in px (tests read it, since TRUCK_LENGTH and TRUCK_WIDTH change it). */
  readonly truckHalf = { length: TRUCK_HALF_LENGTH, width: TRUCK_HALF_WIDTH };
  /** SCREAM-22, SCREAM-109: the bay beside each gas station's pumps. Stop in one to buy gas. */
  private pumpBays: Phaser.GameObjects.Rectangle[] = [];
  /** False after coming back from the pump, until the truck has left every bay (so the pump doesn't open again straight away). */
  private pumpArmed = true;
  /** SCREAM-171, 185, 190: the uncle driving the truck and walking home, in the guided tutorial (scenes/uncleDrive.ts). */
  private uncle?: UncleDrive;
  /** The leg he's driving now, if any (tests read these). */
  get uncleLeg(): UncleLeg | null {
    return this.uncle?.leg ?? null;
  }
  get uncleRoute(): AutoRoute | undefined {
    return this.uncle?.route;
  }
  get uncleAlong(): number {
    return this.uncle?.along ?? 0;
  }
  get uncleWalkPath(): [number, number][] {
    return this.uncle?.walkPath ?? [];
  }
  /** SCREAM-185: arrived home with the uncle, fading to the truck screen (no restock stop). */
  private arrivingHome = false;
  /** SCREAM-54: Home's driveway spot, where the truck stops to restock; re-armed once the truck has left it. */
  private homeBay!: Phaser.GameObjects.Rectangle;
  private homeArmed = false;
  /** SCREAM-54 (Tom Cobb, round 2): an arrow toward home, shown only when sold out. */
  private homeArrow!: Phaser.GameObjects.Container;
  /** Lane lines: yellow down the middle; SCREAM-159: white between two lanes going the same way. */
  private dashes: { x: number; y: number; ux: number; uy: number; white?: boolean }[] = [];
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
    this.useMap(currentMap());
    const a = this.assets;
    this.load.image(a.grassKey, a.grassUrl);
    loadTruckViews(this);
    // Houses, trees, yard ornaments and the gas pump, all in one picture sheet (SCREAM-108).
    if (!this.textures.exists(a.atlasKey)) this.load.atlas(a.atlasKey, a.atlasPng, a.atlasJson);
    for (const { key } of this.map.roadTiles) this.load.image(a.roadKeyPrefix + key, versioned(`${a.roadDir}/${key}.png`, this.map));
    loadResidentSheet(this);
    if (!this.textures.exists(UNCLE_WALKER_KEY)) this.load.spritesheet(UNCLE_WALKER_KEY, UNCLE_URL, { frameWidth: 16, frameHeight: 32 });
    showLoadingWhileLoading(this); // SCREAM-75
  }

  /** SCREAM-146: switches to the map tonight's evening is on (the scene is reused between evenings). */
  private useMap(assets: GameMap): void {
    if (this.assets === assets && this.sortedObjects.length) return;
    this.assets = assets;
    this.map = assets.data;
    this.roads = new RoadNetwork(this.map.roads, this.map.roadMask);
    this.objectSizes = new Map(this.map.sprites.map((s) => [s.key, s] as const));
    this.sortedObjects = [...this.map.objects, ...gasStations().flatMap((g) => g.pumps.map((p) => ({ key: 'pump', ...p })))].sort(
      (a, b) => a.y - b.y,
    );
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

    const worldWidth = this.map.width;
    const worldHeight = this.map.height;

    this.drawNeighbourhood(worldWidth, worldHeight);
    this.placeObstacles();
    this.pickupZones.clear();
    this.bubbles.clear();
    this.ring = this.add.circle(0, 0, MUSIC_RING_RADIUS).setStrokeStyle(2, 0xffffff, 0.35).setFillStyle(0xffffff, 0.04).setDepth(4);
    this.tweens.add({ targets: this.ring, alpha: 0.55, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.residentSprites = this.evening.residents.all.map(() =>
      this.add.sprite(0, 0, residentsKey(), 0).setOrigin(0.5, 1).setDepth(RESIDENT_DEPTH).setVisible(false),
    );
    this.occluders.clear();
    this.objectGrid.clear();
    this.map.objects.forEach((o, i) => {
      const size = this.objectSizes.get(o.key);
      if (!size) return;
      const left = Math.floor((o.x - size.w / 2) / OCCLUDER_CELL);
      const right = Math.floor((o.x + size.w / 2) / OCCLUDER_CELL);
      const top = Math.floor((o.y - size.h) / OCCLUDER_CELL);
      const bottom = Math.floor(o.y / OCCLUDER_CELL);
      for (let cx = left; cx <= right; cx++)
        for (let cy = top; cy <= bottom; cy++) {
          const key = `${cx},${cy}`;
          const list = this.objectGrid.get(key);
          if (list) list.push(i);
          else this.objectGrid.set(key, [i]);
        }
    });
    this.truck = this.makeTruck();

    const { x, y, angle } = this.evening.truck;
    this.truck.setPosition(x, y);
    this.setHeading(angle);
    this.setUpUncle();

    // SCREAM-22, SCREAM-109: each station's pump bay, painted on the road beside the pumps like a parking space.
    this.pumpBays = gasStations().map((g) =>
      this.add
        .rectangle(g.bay.x, g.bay.y, PICKUP_ZONE_LENGTH + 10, PICKUP_ZONE_WIDTH, 0xffd23f, 0.12)
        .setStrokeStyle(3, 0xffd23f, 0.9)
        .setAngle(g.bay.angle)
        .setDepth(4),
    );
    this.pumpArmed = this.pumpBays.every((b) => this.pickupOverlap(b) === 0);
    // SCREAM-54 (PO, November 2): Home's driveway, a marked spot on the road outside home
    // (where each evening starts). Stopping in it like a customer pickup opens the cooler to restock.
    const hs = this.map.homeStart;
    this.homeBay = this.add
      .rectangle(hs.x, hs.y, PICKUP_ZONE_LENGTH + 10, PICKUP_ZONE_WIDTH, 0x4fc3f7, 0.14)
      .setStrokeStyle(3, 0x4fc3f7, 0.95)
      .setAngle(hs.angle)
      .setDepth(4);
    this.homeArmed = this.pickupOverlap(this.homeBay) === 0;
    this.homeArrow = this.add
      .container(0, 0, [
        this.add.triangle(0, 0, -14, -10, -14, 10, 14, 0, 0x4fc3f7).setStrokeStyle(3, 0x0d3b66),
        this.add
          .text(0, 20, 'HOME', { fontFamily: 'monospace', fontSize: '13px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#0d3b66', padding: { x: 4, y: 1 } })
          .setOrigin(0.5),
      ])
      .setDepth(12)
      .setVisible(false);
    for (const { sign } of gasStations()) {
      this.mapTexts.push({
        obj: this.add
          .text(sign.x, sign.y - 72, 'GAS', { fontFamily: 'monospace', fontSize: '18px', color: '#ffffff', fontStyle: 'bold', backgroundColor: '#c62828', padding: { x: 6, y: 2 } })
          .setOrigin(0.5, 1)
          .setDepth(7)
          .setVisible(false),
        x: sign.x,
        y: sign.y,
      });
    }
    this.viewKey = '';
    this.refreshVisibleMap();

    // The HUD covers the top strip, so the map is shown below it.
    const camera = this.cameras.main;
    camera.setViewport(0, HUD_HEIGHT, this.scale.width, this.scale.height - HUD_HEIGHT);
    camera.setBounds(0, 0, worldWidth, worldHeight);
    camera.startFollow(this.truck, true, 0.15, 0.15);
    // SCREAM-114 (PO, November 2): a little closer to the street.
    camera.setZoom(DRIVE_CAMERA_ZOOM);

    this.add
      .text(this.scale.width / 2, this.scale.height - HUD_HEIGHT - 16, '↑ Gas  ↓ Brake  ← → Steer  Q Park  M Mute  N Next Song   People in your ring may want ice cream (!)', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ffffff',
        backgroundColor: '#00000099',
        padding: { x: 8, y: 3 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0).setData('pin', true)
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
      .setScrollFactor(0).setData('pin', true)
      .setDepth(20);

    this.parkLabel = this.add
      .text(16, this.scale.height - HUD_HEIGHT - 66, 'P  PARK BRAKE   Gas Or Q To Release', {
        fontFamily: 'monospace',
        fontSize: '15px',
        color: '#ffffff',
        backgroundColor: '#c62828',
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0).setData('pin', true)
      .setDepth(20)
      .setVisible(this.parkBrake);

    // SCREAM-24: the music, with the song's name shown for a moment when it starts.
    this.songLabel = this.add
      .text(this.scale.width - 6, 22, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: '#00000088',
        padding: { x: 5, y: 2 },
      })
      .setOrigin(1, 0)
      .setScrollFactor(0).setData('pin', true)
      .setDepth(20)
      .setAlpha(0);
    this.music = musicFor(this);
    this.music.onSong = (title) => this.showSong(title);
    this.music.start();
    if (this.music.song) this.showSong(this.music.song.title);

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown', (event: KeyboardEvent) => {
      if (event.key === 'q' || event.key === 'Q') this.toggleParkBrake();
      if (event.key === 'm' || event.key === 'M') this.showSong(this.music.toggleMute() ? 'Music off (M)' : (this.music.song?.title ?? ''));
      if (event.key === 'n' || event.key === 'N') this.music.skip();
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

    // The music stops while paused and when leaving the road; the song carries on next time.
    this.events.on(Phaser.Scenes.Events.PAUSE, () => this.music.stop());
    this.events.on(Phaser.Scenes.Events.RESUME, () => this.music.start());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.music.stop();
      this.music.onSong = undefined;
      this.game.events.off(Phaser.Core.Events.BLUR, this.releaseKeys, this);
      this.evening.parkTruck({ x: this.truck.x, y: this.truck.y, angle: this.heading });
    });
    // SCREAM-114: keep the on-screen labels where they belong despite the camera's zoom.
    for (const o of this.children.list) if (o instanceof Phaser.GameObjects.Text && o.getData('pin')) this.pin(o);

  }

  update(time: number, deltaMs: number): void {
    this.refreshVisibleMap();
    if (this.leaving) return;
    this.music.tick();
    this.ring.setPosition(this.truck.x, this.truck.y);
    this.uncle?.update(Math.min(deltaMs, 100) / 1000, time);
    this.evening.residents.update(Math.min(deltaMs, 100) / 1000, {
      x: this.truck.x,
      y: this.truck.y,
      radius: MUSIC_RING_RADIUS,
      open: this.evening.acceptingCustomers,
    });
    this.drawResidents(time);
    this.drawCustomers();
    this.updateTruckLook();
    if (this.spinning) return;
    // Cap long frames (e.g. after switching tabs) so the truck never jumps.
    const dt = Math.min(deltaMs, 100) / 1000;
    const tutorial = this.evening.tutorial;
    if (this.uncleLeg) {
      // The uncle drove the truck this frame (UncleDrive.update).
    } else if (tutorial?.uncleDriving) {
      // SCREAM-171: the uncle has the wheel, parked (waiting for his regular): no steering.
      this.speed = 0;
      this.parkBrake = true;
      this.parkLabel.setVisible(true);
    } else {
      this.driveHard(dt);
    }

    if (this.speed !== 0 && !this.uncleLeg) {
      const rad = Phaser.Math.DegToRad(this.heading);
      const moved = this.moveTruck(Math.cos(rad) * this.speed * dt, Math.sin(rad) * this.speed * dt);
      if (!moved) this.speed = 0; // up against something: stopped (a creep just presses gently against it)
      else this.evening.burnFuel(Math.abs(this.speed) * dt); // SCREAM-22: driving uses gas
    }

    this.checkPotholes();
    this.checkPump();
    this.checkHome();
    this.checkCustomer();
    this.placeHomeArrow();
  }

  /** SCREAM-171, 185, 190: the uncle's driving and his walk home live in UncleDrive. */
  private setUpUncle(): void {
    this.arrivingHome = false;
    const run = this.evening.tutorial;
    if (!run) return;
    this.uncle = new UncleDrive(
      {
        scene: this,
        truck: this.truck,
        map: this.map,
        evening: this.evening,
        setHeading: (d) => this.setHeading(d),
        setParked: (on) => {
          this.parkBrake = on;
          // The label is made after the uncle is set up at the start of the scene.
          (this.parkLabel as Phaser.GameObjects.Text | undefined)?.setVisible(on);
        },
        setSpeed: (px) => {
          this.speed = px;
        },
        walkerDepth: (y) => RESIDENT_DEPTH + y / DEPTH_PER_PX,
        arriveHome: () => {
          this.arrivingHome = true;
          this.cameras.main.fadeOut(600);
          this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(SceneKeys.UncleIntro));
        },
      },
      run,
    );
    this.uncle.setUp();
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
    // SCREAM-119: an empty tank ends the evening (the old quarter-speed crawl is gone).
    const top = TRUCK_SPEED;
    if (this.speed > top) this.speed = Math.max(top, this.speed - (TRUCK_SPEED * dt) / TRUCK_COAST_SECONDS);
    if (gas && !brake) {
      this.parkBrake = false;
      this.brakeHeldStill = 0;
      this.speed =
        this.speed < 0
          ? Math.min(0, this.speed + (TRUCK_SPEED * dt) / TRUCK_BRAKING_SECONDS)
          : Math.min(top, this.speed + (TRUCK_SPEED * dt) / TRUCK_ACCELERATION_SECONDS);
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
      // Faster than a creep: momentum (SCREAM-114): keep most of the speed, slowing only gently
      // toward a creep. Slower (just set off, or after a stop): ease up to a creep.
      if (Math.abs(this.speed) > TRUCK_CREEP_SPEED)
        this.speed = Math.sign(this.speed) * Math.max(TRUCK_CREEP_SPEED, Math.abs(this.speed) * TRUCK_COAST_KEEP ** (dt / TRUCK_COAST_KEEP_SECONDS));
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
    this.textures.get(this.assets.grassKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.mapTexture = this.add.renderTexture(0, 0, MAP_TEXTURE_WIDTH, MAP_TEXTURE_HEIGHT).setOrigin(0, 0).setDepth(0);

    // Parks, sports fields and the school grounds, from OpenStreetMap.
    const fields = this.make.graphics({}, false);
    this.fieldGraphics = fields;
    for (const area of this.map.areas) {
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
        const reach = (o: { road: number }) => this.roads.halfWidth(o.road) + this.roads.halfWidth(s.road);
        if (this.roads.segments.some((o) => o.road !== s.road && distanceToSegment(x, y, o) < reach(o))) continue;
        this.dashes.push({ x, y, ux, uy });
        // SCREAM-159: a wider street gets a white dashed line between its lanes each way.
        for (let k = 1; k * LANE_WIDTH < this.roads.halfWidth(s.road); k++) {
          for (const side of [1, -1]) this.dashes.push({ x: x - uy * LANE_WIDTH * k * side, y: y + ux * LANE_WIDTH * k * side, ux, uy, white: true });
        }
      }
    }

    // Houses and trees (LimeZu, at the pack's 16 px size), drawn front to back.
    this.textures.get(this.assets.atlasKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
    for (const { key } of this.map.roadTiles) this.textures.get(this.assets.roadKeyPrefix + key).setFilter(Phaser.Textures.FilterMode.NEAREST);
    // Names: text over the map image, shown only near the camera (refreshVisibleMap).
    this.mapTexts = [];
    const paint = (x: number, y: number, text: Phaser.GameObjects.Text) => {
      this.add.existing(text.setPosition(x, y).setDepth(7).setVisible(false));
      this.mapTexts.push({ obj: text, x, y });
    };
    const home = this.map.home;
    if (home) {
      const sprite = this.map.sprites.find((s) => s.key === home.key);
      const y = home.y - (sprite?.h ?? 100) - 6;
      paint(home.x, y, this.make.text({ x: 0, y: 0, text: 'HOME', style: { fontFamily: 'monospace', fontSize: '18px', color: '#ffe066', fontStyle: 'bold' } }, false).setOrigin(0.5, 1).setStroke('#3a2a10', 5));
    }
    // SCREAM-52: the businesses' names, on their signs (the pack's own lettering is painted out).
    for (const sign of this.map.signs ?? []) {
      paint(
        sign.x,
        sign.y,
        this.make
          .text({ x: 0, y: 0, text: sign.text, style: { fontFamily: 'monospace', fontSize: '11px', color: sign.colour, fontStyle: 'bold' } }, false)
          .setOrigin(0.5)
          .setStroke('#fff8e7', 3)
          .setName(`sign-${sign.text}`),
      );
    }
    // Street names, written along the road.
    for (const label of this.map.labels) {
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
    for (const area of this.map.areas) {
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
    for (const { x, y, ux, uy, white } of this.dashes) {
      if (x < x0 || x > x1 || y < y0 || y > y1) continue;
      g.fillStyle(white ? 0xf2f2f2 : COLOURS.lane, white ? 0.9 : 1);
      g.fillPoints(
        [v(x - ux * 8 - uy * 1.5, y - uy * 8 + ux * 1.5), v(x + ux * 8 - uy * 1.5, y + uy * 8 + ux * 1.5), v(x + ux * 8 + uy * 1.5, y + uy * 8 - ux * 1.5), v(x - ux * 8 + uy * 1.5, y - uy * 8 - ux * 1.5)],
        true,
      );
    }

    // Potholes and parked cars.
    for (const { x, y } of this.map.potholes) {
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
    // SCREAM-22: the gas station's concrete forecourt, under the pumps.
    for (const { pad } of gasStations()) {
      if (pad.x < x0 - 150 || pad.x > x1 + 150 || pad.y < y0 - 150 || pad.y > y1 + 150) continue;
      g.fillStyle(0x8d9196, 1).fillPoints(turned(pad.x, pad.y, pad.angle, pad.length / 2, pad.depth / 2), true);
      g.lineStyle(2, 0x6b6f74, 1).strokePoints(turned(pad.x, pad.y, pad.angle, pad.length / 2, pad.depth / 2), true);
    }
    this.map.parkedCars.forEach(({ x, y, angle }, i) => {
      if (x < x0 - 60 || x > x1 + 60 || y < y0 - 60 || y > y1 + 60) return;
      g.fillStyle(0x1b1b1b, 1).fillPoints(turned(x, y, angle, CAR_HALF_LENGTH + 1, CAR_HALF_WIDTH + 1), true);
      g.fillStyle(CAR_COLOURS[i % CAR_COLOURS.length] ?? 0x888888, 1).fillPoints(turned(x, y, angle, CAR_HALF_LENGTH - 1, CAR_HALF_WIDTH - 1), true);
      g.fillStyle(0xbfe6ff, 0.9).fillPoints(turned(x, y, angle, 11, 12), true);
    });

    // Paint it all into the map image: grass, fields, roads, then houses and trees front to back, then names.
    const rt = this.mapTexture.setPosition(x0, y0).clear();
    const GRASS = 64;
    rt.repeat(this.assets.grassKey, undefined, -(((x0 % GRASS) + GRASS) % GRASS), -(((y0 % GRASS) + GRASS) % GRASS), MAP_TEXTURE_WIDTH + GRASS, MAP_TEXTURE_HEIGHT + GRASS);
    rt.draw(this.fieldGraphics, -x0, -y0);
    const tileSize = 512 * this.map.roadTileScale;
    for (const t of this.map.roadTiles) {
      if (t.x + tileSize < x0 || t.x > x1 || t.y + tileSize < y0 || t.y > y1) continue;
      rt.stamp(this.assets.roadKeyPrefix + t.key, undefined, t.x - x0, t.y - y0, { originX: 0, originY: 0, scale: this.map.roadTileScale });
    }
    rt.draw(g, -x0, -y0);
    const atlas = this.textures.get(this.assets.atlasKey);
    for (const o of this.sortedObjects) {
      if (o.x < x0 - 150 || o.x > x1 + 150 || o.y < y0 || o.y > y1 + 220) continue;
      // SCREAM-160: a piece missing from the picture sheet is skipped (Phaser would draw the whole sheet).
      if (!atlas.has(o.key)) continue;
      rt.stamp(this.assets.atlasKey, o.key, o.x - x0, o.y - y0, { originX: 0.5, originY: 1 });
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
    // SCREAM-115: the title screen's LimeZu ice cream truck, in four views (see truckViews.ts).
    this.textures.get(TRUCK_VIEWS_KEY).setFilter(Phaser.Textures.FilterMode.NEAREST);
    // The picture is its own object (not in the container), drawn where the truck is.
    this.truckLook = this.add.image(0, 0, TRUCK_VIEWS_KEY, 0).setScale(TRUCK_LOOK_SCALE).setDepth(10);
    // The truck itself: what moves and turns (its bump box is TRUCK_LENGTH x TRUCK_WIDTH).
    return this.add.container(0, 0, []).setDepth(10);
  }

  /**
   * SCREAM-115: shows the view for the way the truck faces (truckView), where the truck is,
   * tilted by what's left over when
   * TRUCK_LOOK_TILT is on. Reads the drawn angle, so a pothole spin still shows.
   */
  private updateTruckLook(): void {
    const facing = Phaser.Math.Angle.WrapDegrees(this.truck.angle);
    const view = truckView(facing);
    const leftover = this.lookTilt ? Phaser.Math.Angle.WrapDegrees(facing - view * 90) : 0;
    const look = this.truckLook;
    if (Number(look.frame.name) !== view) look.setFrame(view);
    look.setOrigin(0.5, TRUCK_VIEW_ORIGIN_Y[view]);
    look.setPosition(this.truck.x, this.truck.y).setAngle(leftover).setVisible(this.truck.visible);
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
      this.flashNotice('Slow to a creep to use the park brake.');
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
    this.pin(notice);
    this.notice = notice;
    this.tweens.add({ targets: notice, alpha: 0, delay: 1200, duration: 400, onComplete: () => notice.destroy() });
  }

  /**
   * SCREAM-114: the camera's zoom also enlarges on-screen labels (hints, park brake, song,
   * credit) and moves them away from the middle. This puts each back where it was meant to
   * be on screen, at its normal size. Call once, after the label is placed.
   */
  private pin<T extends Phaser.GameObjects.Text>(obj: T): T {
    const z = DRIVE_CAMERA_ZOOM;
    const cx = this.scale.width / 2;
    const cy = (this.scale.height - HUD_HEIGHT) / 2;
    return obj.setPosition(cx + (obj.x - cx) / z, cy + (obj.y - cy) / z).setScale(obj.scaleX / z);
  }

  /** Points the truck `degrees` round from facing right (90 = down), any angle. */
  private setHeading(degrees: number): void {
    this.heading = Phaser.Math.Angle.WrapDegrees(degrees);
    this.truck.setAngle(this.heading);
    this.updateTruckLook();
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
      // along it may also ease up to 3 px sideways: back toward the middle of the
      // road first, or else away from it (SCREAM-115: the longer truck, angled
      // slightly into a parked car, may need to cross the middle line to get by).
      const vx = seg.bx - seg.ax;
      const vy = seg.by - seg.ay;
      const t = Math.max(0, Math.min(1, ((x - seg.ax) * vx + (y - seg.ay) * vy) / (vx * vx + vy * vy || 1)));
      // Across the road (normal to its direction), pointing toward its middle (either way on the middle line).
      const toMiddle = -ty * (seg.ax + t * vx - x) + tx * (seg.ay + t * vy - y);
      const across = toMiddle >= 0 ? 1 : -1;
      const acrossX = -ty * across;
      const acrossY = tx * across;
      if (Math.abs(along) > 0.01) {
        for (const ease of [0, 1, 2, 3, -1, -2, -3]) {
          const sx = tx * along + acrossX * ease;
          const sy = ty * along + acrossY * ease;
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
    for (const { x, y } of this.map.potholes) this.potholes.push({ x, y, armed: true });
    // Parked against the curb, along the road (SCREAM-10: at the road's angle).
    for (const { x, y, angle } of this.map.parkedCars) this.cars.push({ x, y, angle, halfLength: CAR_HALF_LENGTH, halfWidth: CAR_HALF_WIDTH });
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

  // ---- Residents (SCREAM-59, SCREAM-73) ----

  /**
   * Draws the residents who are outside and near the view. Frames are picked by
   * hand rather than with Phaser animations (160 people x 8 animations would be a lot):
   * each look is two rows in residents.png, idle then walk, with six frames each
   * for right, up, left and down.
   */
  private drawResidents(timeMs: number): void {
    const view = this.cameras.main.worldView;
    const inFront = new Set<number>();
    this.evening.residents.all.forEach((p, i) => {
      const sprite = this.residentSprites[i];
      const near =
        p.outside && p.x > view.x - 40 && p.x < view.right + 40 && p.y > view.y - 10 && p.y < view.bottom + 50;
      sprite.setVisible(near);
      if (!near) return;
      const step = Math.floor(timeMs / (p.walking ? 110 : 160) + i * 2) % 6;
      const frame = residentFrame(p.resident.look, p.walking, p.facing, step);
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      // Front to back (SCREAM-104): the lower someone's feet on screen, the more in front they are.
      sprite.setPosition(x, y).setFrame(frame).setDepth(RESIDENT_DEPTH + y / DEPTH_PER_PX);
      this.findInFront(x, y, inFront);
    });
    // Houses and trees are painted into the map image, under everyone. Any whose base is
    // lower on screen than a visible resident's feet is drawn again over them.
    for (const [i, image] of this.occluders) if (!inFront.has(i)) image.setVisible(false);
    for (const i of inFront) {
      let image = this.occluders.get(i);
      if (!image) {
        const o = this.map.objects[i];
        image = this.add.image(o.x, o.y, this.assets.atlasKey, o.key).setOrigin(0.5, 1).setDepth(RESIDENT_DEPTH + o.y / DEPTH_PER_PX);
        this.occluders.set(i, image);
      }
      image.setVisible(true);
    }
  }

  /** Adds to `out` the houses and trees that overlap a person standing at (x, y) and stand in front of them. */
  private findInFront(x: number, y: number, out: Set<number>): void {
    const left = Math.floor((x - 8) / OCCLUDER_CELL);
    const right = Math.floor((x + 8) / OCCLUDER_CELL);
    const top = Math.floor((y - 32) / OCCLUDER_CELL);
    const bottom = Math.floor(y / OCCLUDER_CELL);
    for (let cx = left; cx <= right; cx++)
      for (let cy = top; cy <= bottom; cy++)
        for (const i of this.objectGrid.get(`${cx},${cy}`) ?? []) {
          const o = this.map.objects[i];
          const size = this.objectSizes.get(o.key);
          if (!size || o.y <= y) continue;
          if (x + 8 > o.x - size.w / 2 && x - 8 < o.x + size.w / 2 && y > o.y - size.h && y - 32 < o.y) out.add(i);
        }
  }

  // ---- Customers at the curb (#12, SCREAM-67) ----

  /** The pink square beside the nearest waiting customer (tests use this), or undefined. */
  get pickupZone(): Phaser.GameObjects.Rectangle | undefined {
    let best: Phaser.GameObjects.Rectangle | undefined;
    let bestDist = Infinity;
    for (const zone of this.pickupZones.values()) {
      if (!zone.visible) continue;
      const d = Math.hypot(zone.x - this.truck.x, zone.y - this.truck.y);
      if (d < bestDist) {
        best = zone;
        bestDist = d;
      }
    }
    return best;
  }

  /**
   * Draws a "!" thought bubble over everyone who wants ice cream, and a pink square
   * in the curb lane beside everyone waiting there. The bubble flashes in the last
   * few seconds before a customer gives up.
   */
  private drawCustomers(): void {
    // SCREAM-156: several customers can share a spot; draw (and serve from) one square per spot,
    // the first person there. SCREAM-150: only customers on the sidewalk get a square.
    const spotTaken = new Set<string>();
    this.evening.residents.all.forEach((p, i) => {
      const wants = p.outside && (p.customer === 'running' || p.customer === 'waiting');
      let bubble = this.bubbles.get(i);
      if (wants && !bubble) {
        bubble = this.makeBubble();
        this.bubbles.set(i, bubble);
      }
      if (bubble) {
        bubble.setVisible(wants);
        if (wants) {
          bubble.setPosition(Math.round(p.x) + 5, Math.round(p.y) - 30);
          const hurry = p.customer === 'waiting' && p.waitLeft < 5;
          bubble.setAlpha(hurry ? 0.4 + 0.6 * Math.abs(Math.sin(this.time.now / 150)) : 1);
        }
      }
      let waiting = p.customer === 'waiting' && !this.roads.onRoad(p.x, p.y);
      if (waiting) {
        const key = `${p.pickup[0]},${p.pickup[1]}`;
        if (spotTaken.has(key)) waiting = false;
        else spotTaken.add(key);
      }
      let zone = this.pickupZones.get(i);
      if (waiting && !zone) {
        const [zx, zy, angle] = p.pickup;
        zone = this.add
          // The pink pickup square (it pulses bigger on screen; PICKUP_ZONE_LENGTH x WIDTH is its real size).
          .rectangle(zx, zy, PICKUP_ZONE_LENGTH, PICKUP_ZONE_WIDTH, 0xff4f9a, 0.18)
          .setStrokeStyle(3, 0xff4f9a)
          .setAngle(angle)
          .setDepth(4);
        this.tweens.add({ targets: zone, scale: 1.2, alpha: 0.45, duration: 700, yoyo: true, repeat: -1 });
        this.pickupZones.set(i, zone);
      }
      // SCREAM-140: the square sits where they stopped along the curb.
      if (waiting && zone && (zone.x !== p.pickup[0] || zone.y !== p.pickup[1])) zone.setPosition(p.pickup[0], p.pickup[1]).setAngle(p.pickup[2]);
      zone?.setVisible(waiting);
    });
  }

  /**
   * A small "!" speech bubble (PO, November 2). SCREAM-126: the game's shared pixel bubble
   * style, kept small and in plain ink so it's subtler than the old pink one. The
   * container's (0, 0) is the tip of the tail.
   */
  private makeBubble(): Phaser.GameObjects.Container {
    const g = drawBubble(this.add.graphics(), { x: -3, y: -15, w: 11, h: 12, unit: 1, tail: { side: 'down', at: 3, steps: 3 } });
    // The "!" in pixels: a stem and a dot.
    g.fillStyle(BUBBLE_INK, 1).fillRect(1, -13, 2, 5).fillRect(1, -6, 2, 2);
    return this.add.container(0, 0, [g]).setDepth(7);
  }

  /** The song's name, top right, for a few seconds. */
  private showSong(title: string): void {
    if (!title) return;
    this.songLabel.setText(`♪ ${title}`).setAlpha(1);
    this.songLabelTween?.remove();
    this.songLabelTween = this.tweens.add({ targets: this.songLabel, alpha: 0, delay: 3000, duration: 800 });
  }

  /**
   * SCREAM-16 (PO, October 30): the sales window opens only once the truck has
   * come to a complete stop with at least half its hitbox in a customer's pickup
   * square, and then straight away (no "press Enter to serve").
   */
  /** SCREAM-22: stopped in the pump bay (the same rule as a customer's square), the pump opens. */
  private checkPump(): void {
    const overlap = Math.max(0, ...this.pumpBays.map((b) => this.pickupOverlap(b)));
    if (!this.pumpArmed) {
      if (overlap === 0) this.pumpArmed = true;
      return;
    }
    if (this.speed !== 0 || overlap < PICKUP_MIN_OVERLAP || this.evening.isOver) return;
    this.leaving = true;
    this.scene.start(SceneKeys.Pump);
  }

  /** SCREAM-54: stopped in Home's driveway spot (the customer rule), the cooler opens to restock. */
  private checkHome(): void {
    // SCREAM-185: not while the uncle drives home, or as the truck screen fades in.
    if (this.uncleLeg || this.arrivingHome) return;
    // Cheap test first: the exact overlap is only worth working out near the driveway.
    if (Phaser.Math.Distance.Between(this.truck.x, this.truck.y, this.homeBay.x, this.homeBay.y) > 200) {
      this.homeArmed = true;
      return;
    }
    const overlap = this.pickupOverlap(this.homeBay);
    if (!this.homeArmed) {
      if (overlap === 0) this.homeArmed = true;
      return;
    }
    if (this.speed !== 0 || overlap < PICKUP_MIN_OVERLAP || this.evening.isOver) return;
    if (!this.evening.startRestock()) return;
    this.leaving = true;
    this.scene.start(SceneKeys.Cooler);
  }

  /**
   * SCREAM-54 (Tom Cobb's round 2 playtest): when sold out, an arrow points home. With the
   * driveway on screen it bobs above it; otherwise it sits at the edge of the view, pointing
   * the way. It goes away once there's stock again.
   */
  private placeHomeArrow(): void {
    const show = this.evening.isSoldOut && !this.evening.isOver;
    this.homeArrow.setVisible(show);
    if (!show) return;
    const view = this.cameras.main.worldView;
    const bay = this.homeBay;
    const margin = 46 / this.cameras.main.zoom;
    const inside = Phaser.Geom.Rectangle.Contains(view, bay.x, bay.y);
    const bob = Math.sin(this.time.now / 200) * 6;
    if (inside) {
      this.homeArrow.setPosition(bay.x, bay.y - 70 + bob);
      (this.homeArrow.list[0] as Phaser.GameObjects.Triangle).setAngle(90); // pointing down at it
      return;
    }
    const x = Phaser.Math.Clamp(bay.x, view.x + margin, view.right - margin);
    const y = Phaser.Math.Clamp(bay.y, view.y + margin, view.bottom - margin);
    this.homeArrow.setPosition(x, y);
    (this.homeArrow.list[0] as Phaser.GameObjects.Triangle).setRotation(Math.atan2(bay.y - y, bay.x - x));
  }

  private checkCustomer(): void {
    if (this.speed !== 0) return;
    // SCREAM-172: the window opens once the uncle's line as he pulls up has been read.
    if (this.evening.tutorial?.holdsWindow) return;
    const people = this.evening.residents.all;
    for (const [i, zone] of this.pickupZones) {
      const p = people[i];
      if (!zone.visible || !p || p.customer !== 'waiting') continue;
      if (this.pickupOverlap(zone) < PICKUP_MIN_OVERLAP) continue;
      this.serve(p);
      return;
    }
  }

  private serve(customer: ResidentNow): void {
    this.leaving = true;
    this.evening.startSale(customer);
    this.scene.start(SceneKeys.Sales);
  }

  /** How much of the truck's hitbox (0 to 1) is inside a pickup square, sampled on a grid. */
  pickupOverlap(zone: Phaser.GameObjects.Rectangle | undefined = this.pickupZone): number {
    if (!zone) return 0;
    const rad = Phaser.Math.DegToRad(this.heading);
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    // Its real size along and across the road (not the pulse).
    const halfAlong = zone.width / 2;
    const halfAcross = zone.height / 2;
    const zoneRad = zone.rotation;
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
        const ox = x - zone.x;
        const oy = y - zone.y;
        if (Math.abs(ox * zoneCos + oy * zoneSin) <= halfAlong && Math.abs(-ox * zoneSin + oy * zoneCos) <= halfAcross) inside++;
      }
    }
    return inside / total;
  }
}

