// Test track (SCREAM-10): the old grid map's straight roads, 120 px wide, at the
// same positions, swapped into the Drive scene so the driving-feel checks keep
// measuring on straight, level roads. Map-specific checks use the real Worcester map.
//   Roads (centre lines): horizontal y = 180, 840, 1440 (x 180..2700), y = 540 (x 1020..1920);
//   vertical x = 180, 1020, 1920, 2700 (y 180..1440).
// Use: await drive(TRACK)   (inside a page.evaluate where `s` is the Drive scene)
const TRACK = `(() => {
  const R = s.roads.constructor;
  const real = s.roads;
  // Back to the real map when the scene restarts (Phaser reuses the scene object).
  s.events.once('shutdown', () => { s.roads = real; });
  const H = (y, x0, x1) => ({ name: 'test', points: [x0, y, x1, y] });
  const V = (x, y0, y1) => ({ name: 'test', points: [x, y0, x, y1] });
  s.roads = new R([H(180, 180, 2700), H(840, 180, 2700), H(1440, 180, 2700), H(540, 1020, 1920),
    V(180, 180, 1440), V(1020, 180, 1440), V(1920, 180, 1440), V(2700, 180, 1440)]);
  // One parked car, against the left curb of the x = 1020 road, as on the old map.
  s.cars = [{ x: 980, y: 1290, angle: 90, halfLength: 27, halfWidth: 16 }];
  // Potholes off the track, so none is driven over by accident.
  s.potholes.forEach(h => { h.x += 100000; });
  return true;
})()`;
module.exports = { TRACK };
