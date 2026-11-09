import * as Phaser from 'phaser';
import type { WorcesterMap } from '../config/mapTypes';
import { gasStations } from '../config/gasStation';
import { AutoRoute, nextSpeed } from '../state/AutoRoute';
import type { EveningState } from '../state/EveningState';
import { TutorialEvents, type TutorialRun, type UncleLeg } from '../state/Tutorial';
import {
  REGULAR_CALL_DISTANCE,
  REGULAR_HOLD_MS,
  REGULAR_STOP_SHORT,
  UNCLE_CREEP,
  UNCLE_TO_REGULAR,
  TUTORIAL_REGULAR_ID,
  UNCLE_TO_PUMP,
  UNCLE_HOME_CORNERS,
  UNCLE_HOME_LANES,
  UNCLE_PASS_OFFSET,
  UNCLE_ROUTE_CORNERS,
  UNCLE_ROUTE_LANES,
  UNCLE_ROUTE_RADIUS,
} from '../config/tutorialRoute';

/** SCREAM-190: the uncle on the map (his sheet in the residents' layout), and how fast he walks home. */
export const UNCLE_WALKER_KEY = 'uncle-walker';
const UNCLE_WALK_SPEED = 38;

/** What the uncle's driving needs from the drive scene: the truck, the map, and a few controls. */
export interface UncleHost {
  readonly scene: Phaser.Scene;
  readonly truck: Phaser.GameObjects.Container;
  readonly map: WorcesterMap;
  readonly evening: EveningState;
  setHeading(degrees: number): void;
  /** Park brake on (parked, label shown) or off (he's about to drive). */
  setParked(on: boolean): void;
  /** The truck's speed as the rest of the scene sees it (the look, the music, the tests). */
  setSpeed(px: number): void;
  /** Depth for a map-sized walker at this y (the residents' rule). */
  walkerDepth(y: number): number;
  /** SCREAM-185: home with the uncle: fade and return to the truck screen. */
  arriveHome(): void;
}

/**
 * SCREAM-171 (PO, November 5): in the guided tutorial the uncle drives: from home to his
 * regular (who comes out once he's in range), after the sale on to the pump bay, and after
 * the gas home again (SCREAM-185). Each leg starts where the truck is and ends parked, park
 * brake on; the usual rules then open the sales window when she's at her square, or the pump
 * in the bay. SCREAM-190: his part over, he steps out and walks home. Pulled out of DriveScene
 * (SCREAM-200) so the tutorial-only code lives in one place.
 */
export class UncleDrive {
  route?: AutoRoute;
  leg: UncleLeg | null = null;
  along = 0;
  private end = 0;
  private speed = 0;
  private from = 0;
  private nudge = { x: 0, y: 0 };
  private regularCalled = false;
  /** SCREAM-185: which route `route` is (out to the pump, or home). */
  private routeName: 'out' | 'home' | null = null;
  private walker?: Phaser.GameObjects.Sprite;
  /** The points of his walk home still to reach (tests read it). */
  walkPath: [number, number][] = [];
  private readonly run: TutorialRun;
  private readonly host: UncleHost;

  constructor(host: UncleHost, run: TutorialRun) {
    this.host = host;
    this.run = run;
    // SCREAM-200: skipped while he drives: the truck stops where it is and the player has the wheel.
    const onChanged = () => {
      if (run.skipped && this.leg) this.stop();
    };
    run.on(TutorialEvents.Changed, onChanged);
    host.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => run.off(TutorialEvents.Changed, onChanged));
  }

  /** Called when the drive scene starts: his walk home if due, hearing off while he drives, and the leg to drive. */
  setUp(): void {
    const { host, run } = this;
    this.leg = null;
    this.walker = undefined;
    // SCREAM-190 (PO, November 6): his part over, he steps out of the truck and walks home.
    if (run.step === 'done' && !run.walkedHome && !run.skipped) {
      run.walkedHome = true;
      this.startWalk();
    }
    // Nobody but his regular comes out while he has the wheel.
    host.evening.residents.hearingOff = run.uncleDriving;
    const regular = host.evening.residents.all.find((p) => p.resident.id === TUTORIAL_REGULAR_ID);
    if (regular) run.regularName = regular.resident.name;
    const leg = run.legToDrive;
    if (!leg) return;
    const square = regular?.resident.curb;
    // SCREAM-185: home from the pump is a route of its own.
    if (leg === 'toHome' && this.routeName !== 'home') this.route = undefined;
    this.routeName = leg === 'toHome' ? 'home' : 'out';
    const cars = host.map.parkedCars.map((c) => [c.x, c.y] as [number, number]);
    this.route ??=
      leg === 'toHome'
        ? new AutoRoute({ corners: UNCLE_HOME_CORNERS, lanes: UNCLE_HOME_LANES, radius: UNCLE_ROUTE_RADIUS, cars, passOffset: UNCLE_PASS_OFFSET })
        : new AutoRoute({
            corners: UNCLE_ROUTE_CORNERS,
            lanes: UNCLE_ROUTE_LANES,
            radius: UNCLE_ROUTE_RADIUS,
            cars,
            passOffset: UNCLE_PASS_OFFSET,
            // PO (November 6): he pulls up to her straight; the parked car just past her he swings round after.
            keepStraightAt: square ? [[square[2], square[3]]] : [],
          });
    const route = this.route;
    const truck = host.truck;
    let from: number;
    if (leg === 'toRegular') {
      // PO's note: fade in on the truck driving itself. He sets off from home, down Westland St.
      const hs = host.map.homeStart;
      from = route.distanceAlong(hs.x, hs.y);
      const at = route.at(from);
      truck.setPosition(at.x, at.y);
      host.setHeading(at.heading);
      this.end = square ? route.distanceAlong(square[2], square[3]) - REGULAR_STOP_SHORT : route.length;
      host.scene.cameras.main.fadeIn(700);
    } else if (leg === 'toHome') {
      // SCREAM-185: from the pump bay to home, across the street from it.
      from = route.distanceAlong(truck.x, truck.y);
      const hs = host.map.homeStart;
      this.end = route.distanceAlong(hs.x, hs.y);
    } else {
      from = route.distanceAlong(truck.x, truck.y);
      const bay = gasStations()[0]?.bay;
      this.end = bay ? route.distanceAlong(bay.x, bay.y) : route.length;
    }
    const at = route.at(from);
    this.nudge = { x: truck.x - at.x, y: truck.y - at.y };
    this.along = this.from = from;
    this.speed = 0;
    this.regularCalled = leg !== 'toRegular';
    this.leg = leg;
    host.setParked(false);
  }

  /** One frame: his driving (if he has the wheel) and his walk home (if he's on it). */
  update(dt: number, timeMs: number): void {
    this.walkHome(dt, timeMs);
    if (this.leg) this.drive(dt);
  }

  /** SCREAM-200: the player skipped him mid-drive: stop here, park, and hand over the wheel. */
  private stop(): void {
    this.leg = null;
    this.speed = 0;
    this.host.setSpeed(0);
    this.host.setParked(true);
    this.host.evening.residents.hearingOff = false;
  }

  /** SCREAM-171: one frame of the uncle's driving. */
  private drive(dt: number): void {
    const { host, run, route } = this;
    if (!route || !this.leg) return;
    const truck = host.truck;
    // PO (November 6): slowly from home to his regular; the instant she has her "!", he stops
    // while he talks about her (REGULAR_HOLD_MS); then he creeps up to her square.
    const holding = this.leg === 'toRegular' && this.regularCalled && run.step === 'regular' && run.lineNumber === 0;
    const profile = this.leg === 'toPump' || this.leg === 'toHome' ? UNCLE_TO_PUMP : this.regularCalled ? UNCLE_CREEP : UNCLE_TO_REGULAR;
    const stopAt = holding ? this.along : this.end;
    this.speed = holding ? Math.max(0, this.speed - UNCLE_TO_REGULAR.brake * dt) : nextSpeed(route, this.along, stopAt, this.speed, dt, profile);
    const step = Math.min(this.speed * dt, this.end - this.along);
    this.along += step;
    const arrived = this.end - this.along < 1 || (this.speed < 2 && this.end - this.along < 6);
    if (arrived) this.along = this.end;
    const at = route.at(this.along);
    // Where the truck started off the path a little (back from a sale), it eases onto it.
    const fade = Math.max(0, 1 - (this.along - this.from) / 120);
    truck.setPosition(at.x + this.nudge.x * fade, at.y + this.nudge.y * fade);
    host.setHeading(at.heading);
    host.evening.burnFuel(step);
    host.setSpeed(arrived ? 0 : this.speed);
    if (this.leg === 'toRegular' && !this.regularCalled) {
      const regular = host.evening.residents.all.find((p) => p.resident.id === TUTORIAL_REGULAR_ID);
      const sq = regular?.resident.curb;
      if (regular && sq && (arrived || Phaser.Math.Distance.Between(truck.x, truck.y, sq[2], sq[3]) < REGULAR_CALL_DISTANCE)) {
        this.regularCalled = true;
        host.evening.residents.comeOutToOwnCurb(regular);
        run.signal('regularSpotted');
        host.scene.time.delayedCall(REGULAR_HOLD_MS, () => {
          if (run.step === 'regular' && run.lineNumber === 0) run.nextLine();
        });
      }
    }
    if (!arrived) return;
    // SCREAM-172: pulled up at the regular's square: his line about the sale, then her window.
    if (this.leg === 'toRegular') {
      if (run.step === 'regular' && run.lineNumber === 0) run.nextLine();
      run.signal('pulledUp');
    }
    const leg = this.leg;
    run.finishLeg(leg);
    this.leg = null;
    host.setParked(true);
    host.evening.residents.hearingOff = run.uncleDriving;
    // SCREAM-185 (PO's note): "You arrive home. The screen with the uncle in the truck returns."
    if (leg === 'toHome') {
      run.signal('arrivedHome');
      host.arriveHome();
    }
  }

  /** SCREAM-190: the uncle, map-sized, and the points of his walk from the truck to home's front door. */
  private startWalk(): void {
    const { host } = this;
    const home = host.map.home;
    if (!home) return;
    const hs = host.map.homeStart;
    const truck = host.truck;
    const side = Math.sign(home.x - truck.x) || 1;
    // Out of the truck's side toward home, across the street, along the sidewalk, then along the front to the door.
    const out: [number, number] = [truck.x + side * 26, truck.y + 6];
    const walkway = hs.x + side * 46;
    this.walkPath = [
      [walkway, out[1]],
      [walkway, home.y + 12],
      [home.x, home.y + 12],
      [home.x, home.y - 2],
    ];
    this.walker = host.scene.add.sprite(out[0], out[1], UNCLE_WALKER_KEY, 24).setOrigin(0.5, 1).setName(UNCLE_WALKER_KEY).setAlpha(0);
    host.scene.tweens.add({ targets: this.walker, alpha: 1, duration: 300 });
  }

  /** SCREAM-190: one frame of his walk home; at the door he goes in. */
  private walkHome(dt: number, timeMs: number): void {
    const w = this.walker;
    const next = this.walkPath[0];
    if (!w || !w.active) return;
    const tweens = this.host.scene.tweens;
    if (!next) {
      if (w.alpha === 1 && !tweens.isTweening(w)) tweens.add({ targets: w, alpha: 0, duration: 400, onComplete: () => w.destroy() });
      return;
    }
    const dx = next[0] - w.x;
    const dy = next[1] - w.y;
    const d = Math.hypot(dx, dy);
    const stepPx = UNCLE_WALK_SPEED * dt;
    if (d <= stepPx) {
      w.setPosition(next[0], next[1]);
      this.walkPath.shift();
    } else w.setPosition(w.x + (dx / d) * stepPx, w.y + (dy / d) * stepPx);
    const facing = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy > 0 ? 3 : 1; // right, up, left, down columns
    w.setFrame(24 + facing * 6 + (Math.floor(timeMs / 110) % 6)).setDepth(this.host.walkerDepth(w.y));
  }
}
