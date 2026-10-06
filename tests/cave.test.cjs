const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(route = [], config = {}) {
  let now = 10000, position = { x: 0, y: 0, z: 7 }, combat = false, reachable = true;
  const timers = new Map(), paths = [], store = new Map([
    ['minibiaBot.cave.route', route], ['minibiaBot.cave.config', config]
  ]);
  let timerId = 0;
  const element = () => ({ appendChild() {}, querySelector() { return null; } });
  const window = {
    setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; },
    clearTimeout(id) { timers.delete(id); }, setInterval() { return ++timerId; }, clearInterval() {},
    gameClient: { world: {
      getTileFromWorldPosition(p) { return { __position: p, isWalkable: () => true }; },
      pathfinder: { findPath(from, to) { paths.push(to); }, search() { return reachable ? [{}] : []; } }
    } }
  };
  const bot = {
    storage: { get(key, fallback) { return store.get(key) ?? fallback; }, set(key, value) { store.set(key, structuredClone(value)); } },
    getPlayerPosition: () => position, log() {}, addCleanup() {},
    attack: { hasPriorityTarget: () => combat, status: () => ({}) }
  };
  class Position { constructor(x,y,z) { Object.assign(this, {x,y,z}); } }
  vm.runInNewContext(fs.readFileSync('src/modules/cave.js', 'utf8'), {
    window, Position, HTMLCanvasElement: class {},
    Date: { now: () => now },
    document: { getElementById() { return null; }, createElement: element, head: element(), body: element() }
  });
  window.__minibiaBotBundle.installCaveModule(bot);
  return { cave: bot.cave, store, paths,
    position(p) { position = p; }, combat(v) { combat = v; }, reachable(v) { reachable = v; },
    step(ms = 500) { now += ms; const entry = timers.entries().next().value; if (entry) { timers.delete(entry[0]); entry[1](); } },
    timerCount: () => timers.size
  };
}
const point = (x, type = 'node', extra = {}) => ({ x, y: 0, z: 7, type, ...extra });

test('legacy routes and presets retain typed data and loop mode after reload', () => {
  const h = setup([{ x: 5, y: 0, z: 7 }]);
  assert.equal(h.cave.getRoute()[0].type, 'node');
  h.cave.addWaypoint(point(5, 'label', { label: 'HUNT' }));
  h.cave.addWaypoint(point(5, 'action', { action: 'goto:HUNT' }));
  h.cave.updateConfig({ routeMode: 'loop' });
  h.cave.savePreset('Cave');
  h.cave.createPreset('Other');
  h.cave.loadPreset('Cave');
  assert.equal(h.cave.status().config.routeMode, 'loop');
  assert.equal(h.cave.getRoute()[1].label, 'HUNT');
  assert.equal(h.cave.getRoute()[2].action, 'goto:HUNT');
  assert.equal(h.store.get('minibiaBot.cave.presets').find(p => p.name === 'Cave').routeMode, 'loop');
});

test('profile preset replaces the active route and retains its transitions and mode', () => {
  const h = setup([{ x: 1, y: 1, z: 7 }]);
  const applied = h.cave.applyProfilePreset({
    name: 'Knight One',
    routeMode: 'loop',
    route: [point(20), point(21, 'walk')],
    transitions: [{ from: { x: 21, y: 0, z: 7 }, to: { x: 21, y: 0, z: 6 } }],
  });

  assert.equal(applied.name, 'Knight One');
  assert.deepEqual(h.cave.getRoute().map(({ x, type }) => [x, type]), [[20, 'node'], [21, 'walk']]);
  assert.equal(h.cave.status().config.routeMode, 'loop');
  assert.equal(h.cave.getTransitions().length, 1);
  assert.equal(h.cave.getPresetNames().includes('Knight One'), true);
});
test('stand is exact; node is flexible; floor-change approach remains exact', () => {
  const h = setup([point(1), point(5)]);
  assert.equal(h.cave.isAtWaypoint({ x: 0, y: 0, z: 7 }, point(1)), true);
  assert.equal(h.cave.isAtWaypoint({ x: 0, y: 0, z: 7 }, point(1, 'stand')), false);
  const floors = setup([point(1), point(1, 'node', { z: 6 })]);
  assert.equal(floors.cave.isAtWaypoint({ x: 0, y: 0, z: 7 }, point(1)), false);
});
test('loop wraps forward while pingpong reverses', () => {
  for (const mode of ['loop', 'pingpong']) {
    const h = setup([point(0, 'stand'), point(4, 'stand')]);
    h.cave.updateConfig({ routeMode: mode });
    h.position(point(4)); h.cave.start();
    assert.equal(h.cave.status().currentIndex, 0);
    assert.equal(h.cave.status().direction, mode === 'loop' ? 1 : -1);
  }
});
test('combat pauses navigation and does not count toward stuck timeout', () => {
  const h = setup([point(4), point(8)]);
  h.cave.start(); const paths = h.paths.length;
  h.combat(true); h.step(15000);
  assert.equal(h.paths.length, paths);
  assert.equal(h.cave.status().pausedForCombat, true);
  h.combat(false); h.step();
  assert.equal(h.cave.status().running, true);
  assert.ok(h.paths.length > paths);
});
test('stuck node skips only to a verified reachable flexible point', () => {
  const h = setup([point(4), point(8)]);
  h.cave.start(); h.step(8500);
  assert.equal(h.cave.status().currentIndex, 1);
  assert.equal(h.cave.status().running, true);
  for (const next of [point(8, 'stand'), point(8, 'action', { action: 'wait:2000' }), point(8, 'node', { z: 6 })]) {
    const strict = setup([point(4), next]); strict.cave.start(); strict.step(8500);
    assert.equal(strict.cave.status().currentIndex, 0);
    assert.equal(strict.cave.status().running, false);
  }
  const blocked = setup([point(4), point(8)]); blocked.reachable(false);
  blocked.cave.start(); blocked.step(8500);
  assert.equal(blocked.cave.status().running, false);
  assert.match(blocked.cave.status().lastError, /Atascado/);
});
test('wait, skip and goto execute once per tick; missing label stops with error', () => {
  const h = setup([point(0, 'stand'), point(0, 'action', { action: 'wait:2000' }), point(8)]);
  h.cave.start(); h.step(); h.step(1500);
  assert.equal(h.cave.status().currentIndex, 1);
  h.step(); assert.equal(h.cave.status().currentIndex, 2);
  for (const [action, index] of [['skip:1', 3], ['goto:HUNT', 3]]) {
    const c = setup([point(0, 'stand'), point(0, 'action', { action }), point(9), point(10, 'label', { label: 'HUNT' })]);
    c.cave.start(); c.step(); assert.equal(c.cave.status().currentIndex, index);
  }
  const bad = setup([point(0, 'stand'), point(0, 'action', { action: 'goto:ABSENT' })]);
  bad.cave.start(); bad.step(); assert.equal(bad.cave.status().running, false);
  assert.match(bad.cave.status().lastError, /Label no encontrado/);
});
test('invalid points are rejected; STOP clears pending ticks; restart resets wait', () => {
  const h = setup([point(0, 'stand'), point(0, 'action', { action: 'wait:2000' })]);
  assert.equal(h.cave.addWaypoint(point(4, 'action', { action: 'eval:code' })), null);
  assert.equal(h.cave.addWaypoint(point(4, 'label', { label: '' })), null);
  h.cave.start(); h.step(); assert.ok(h.cave.status().waitingUntil);
  h.cave.stop(); assert.equal(h.timerCount(), 0);
  h.step(20000); assert.equal(h.cave.status().currentIndex, 1);
  h.cave.start(); assert.equal(h.cave.status().waitingUntil, 0);
});
test('shared route round trip keeps points, route mode, transitions and existing presets', () => {
  const source = setup([point(1), point(2, 'label', { label: 'SALIDA' }), point(2, 'action', { action: 'goto:SALIDA' })]);
  source.cave.updateConfig({ routeMode: 'loop' });
  const shared = JSON.parse(source.cave.exportPreset());
  shared.transitions = [{ from: { x: 2, y: 0, z: 7 }, to: { x: 2, y: 1, z: 6 }, count: 3, lastSeenAt: 10000 }];
  const recipient = setup([point(9)]);
  const first = recipient.cave.importPreset(JSON.stringify(shared));
  assert.equal(first.waypoints, 3);
  assert.equal(recipient.cave.status().config.routeMode, 'loop');
  assert.equal(recipient.cave.getRoute()[2].action, 'goto:SALIDA');
  assert.equal(recipient.cave.getTransitions()[0].to.z, 6);
  const second = recipient.cave.importPreset(JSON.stringify(shared));
  assert.equal(second.name, 'Default (3)');
  assert.equal(recipient.cave.getPresetNames().length, 3);
  recipient.cave.loadPreset('Default');
  assert.equal(recipient.cave.getRoute()[0].x, 9);
});
test('import rejects malformed and oversized data without changing the active route', () => {
  const h = setup([point(1)]);
  const original = h.cave.exportPreset();
  for (const invalid of ['oops', '{}', JSON.stringify({ ...JSON.parse(original), route: [point(2, 'action', { action: 'eval:bad' })] }), 'x'.repeat(500001)]) {
    assert.throws(() => h.cave.importPreset(invalid));
    assert.equal(h.cave.getRoute()[0].x, 1);
    assert.equal(h.cave.getPresetNames().length, 1);
  }
});
