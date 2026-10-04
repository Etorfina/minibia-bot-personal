const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function setup(savedConfig = {}, playerState = { health: 400, maxHealth: 1000, mana: 200, maxMana: 500 }) {
  const store = new Map([['minibiaBot.heal.config', savedConfig]]);
  const pressedSlots = [];
  const bot = {
    storage: {
      get(key, fallback) { return store.get(key) ?? fallback; },
      set(key, value) { store.set(key, structuredClone(value)); },
    },
    getPlayerSnapshot: () => playerState,
    clickHotbar(index) { pressedSlots.push(index); return true; },
    addCleanup() {},
    log() {},
  };
  const window = { setTimeout() { return 1; }, clearTimeout() {} };
  vm.runInNewContext(fs.readFileSync('src/modules/heal.js', 'utf8'), { window });
  window.__minibiaBotBundle.installHealModule(bot);
  return { heal: bot.heal, pressedSlots, store };
}

test('healing keeps existing absolute HP and mana thresholds by default', () => {
  const { heal } = setup({ minHp: 450, minMana: 220 });
  assert.equal(heal.canUseHpHeal(Date.now()), true);
  assert.equal(heal.canUseManaHeal(Date.now()), true);
  assert.equal(heal.config.hpThresholdMode, 'absolute');
});

test('percentage thresholds use each stat maximum and clamp to 100', () => {
  const { heal } = setup();
  heal.updateConfig({ hpThresholdMode: 'percentage', minHp: 45, manaThresholdMode: 'percentage', minMana: 41 });
  assert.equal(heal.canUseHpHeal(Date.now()), true); // 400 / 1000 = 40%
  assert.equal(heal.canUseManaHeal(Date.now()), true); // 200 / 500 = 40%
  heal.updateConfig({ minHp: 101 });
  assert.equal(heal.config.minHp, 100);
});

test('healing still prioritizes HP before mana and clicks the configured hotbar slot', () => {
  const { heal, pressedSlots } = setup({ minHp: 450, minMana: 300, hpHotbarSlot: 4, manaHotbarSlot: 7 });
  heal.updateConfig({ enabled: true });
  assert.equal(heal.tryHeal(), true);
  assert.deepEqual(pressedSlots, [3]);
});

test('switching a legacy absolute threshold to percent avoids a 100% trigger', () => {
  const { heal } = setup({ minHp: 250, minMana: 150 });
  heal.updateConfig({ hpThresholdMode: 'percentage' });
  assert.equal(heal.config.minHp, 50);
});
