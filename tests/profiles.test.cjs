const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup() {
  const values = new Map();
  const timers = new Map();
  let timerId = 0;
  let playerName = "Knight One";
  const makeModule = (initial = {}) => {
    const config = structuredClone(initial);
    let running = !!config.enabled;
    return {
      config,
      status: () => ({ running, config: { ...config } }),
      updateConfig(next = {}) { Object.assign(config, next); return { ...config }; },
      start() { config.enabled = true; running = true; return true; },
      stop(options = {}) {
        running = false;
        if (options.persistEnabled !== false) config.enabled = false;
        return true;
      },
    };
  };
  const bot = {
    storage: {
      get(key, fallback = null) { return values.has(key) ? structuredClone(values.get(key)) : fallback; },
      set(key, value) { values.set(key, structuredClone(value)); return value; },
      remove(key) { values.delete(key); },
    },
    addCleanup() {},
    getPlayerName: () => playerName,
    rune: makeModule({ runeSpellWords: "adori vita", enabled: false }),
    heal: makeModule({ rules: [], minimumMana: 0, enabled: false }),
    invisible: makeModule({ spellWords: "utana vid", enabled: false }),
    magicShield: makeModule({ spellWords: "utamo vita", enabled: false }),
    attack: makeModule({ targetPriority: [], enabled: false }),
    cave: Object.assign(makeModule({ routeMode: "pingpong", enabled: false }), {
      route: [], transitions: [],
      getRoute() { return structuredClone(this.route); },
      getTransitions() { return structuredClone(this.transitions); },
      applyProfilePreset(preset) {
        this.route = structuredClone(preset.route);
        this.transitions = structuredClone(preset.transitions);
        this.config.routeMode = preset.routeMode;
        this.config.activePresetName = preset.name;
      },
    }),
    equipRing: makeModule({ enabled: false }),
    eat: makeModule({ eatHotbarSlot: 10, enabled: false }),
    talk: makeModule({ apiKey: "test-api-key", systemPrompt: "reply briefly", enabled: false }),
    pz: {
      home: null,
      getHomePz() { return this.home; },
      setHomePz(x, y, z) { this.home = { x, y, z }; },
      clearHomePz() { this.home = null; },
    },
    xray: {
      config: { overlayEnabled: false, selectedFloor: null },
      setSelectedFloor(value) { this.config.selectedFloor = value; },
      setOverlayEnabled(value) { this.config.overlayEnabled = value; },
      stopOverlay() { this.config.overlayEnabled = false; },
    },
    panic: {
      config: { trustedNames: [] },
      status() { return { config: { ...this.config } }; },
      updateConfig(next) { Object.assign(this.config, next); },
      stop() {},
    },
    master: { isPaused: () => false },
  };
  const window = {
    setInterval(fn) { const id = ++timerId; timers.set(id, fn); return id; },
    clearInterval(id) { timers.delete(id); },
  };
  vm.runInNewContext(fs.readFileSync("src/modules/profiles.js", "utf8"), { window });
  window.__minibiaBotBundle.installProfileModule(bot);
  return {
    bot,
    values,
    setPlayerName(name) { playerName = name; },
    refresh: () => bot.profiles.refreshCharacter(),
  };
}

test("profiles save and restore each character's settings independently", () => {
  const h = setup();
  assert.equal(h.refresh(), true);
  assert.equal(h.bot.profiles.getStatus().currentProfileName, "Knight One");

  h.bot.rune.updateConfig({ runeSpellWords: "exura vita" });
  h.bot.cave.route = [{ x: 10, y: 20, z: 7, type: "node" }];
  h.bot.cave.transitions = [{ from: { x: 10, y: 20, z: 7 }, to: { x: 10, y: 20, z: 6 } }];
  h.bot.cave.config.routeMode = "loop";
  h.bot.profiles.save("Knight One");

  h.setPlayerName("Knight Two");
  assert.equal(h.refresh(), true);
  assert.equal(h.bot.profiles.getStatus().currentProfileName, "Knight Two");
  assert.equal(h.bot.rune.config.runeSpellWords, "adori vita");

  h.bot.rune.updateConfig({ runeSpellWords: "exura gran" });
  h.bot.profiles.save("Knight Two");
  h.setPlayerName("Knight One");
  h.refresh();

  assert.equal(h.bot.rune.config.runeSpellWords, "exura vita");
  assert.equal(h.bot.cave.route[0].x, 10);
  assert.equal(h.bot.cave.config.routeMode, "loop");
  assert.equal(h.bot.cave.config.activePresetName, "Knight One");
  const registry = h.values.get("minibiaBot.profiles.v1");
  assert.equal(registry.profiles.length, 2);
  assert.equal(JSON.stringify(registry).includes("test-api-key"), false);
});

test("choosing a saved profile associates it with the active character", () => {
  const h = setup();
  h.refresh();
  h.bot.rune.updateConfig({ runeSpellWords: "adori mas flam" });
  h.bot.profiles.save("Mage setup");
  h.bot.rune.updateConfig({ runeSpellWords: "exura" });
  h.bot.profiles.save("Knight One");

  const mage = h.bot.profiles.getStatus().profiles.find((profile) => profile.name === "Mage setup");
  assert.equal(h.bot.profiles.use(mage.id), true);
  assert.equal(h.bot.rune.config.runeSpellWords, "adori mas flam");
  assert.equal(h.bot.profiles.getStatus().currentProfileName, "Mage setup");
});
