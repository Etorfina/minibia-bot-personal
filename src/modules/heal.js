window.__minibiaBotBundle = window.__minibiaBotBundle || {};

window.__minibiaBotBundle.installHealModule = function installHealModule(bot) {
  const configStorageKey = "minibiaBot.heal.config";
  const state = {
    running: false,
    timerId: null,
    lastActionAt: 0,
    lastAction: null,
    lastAttempt: null,
    pending: null,
    attempts: Object.create(null),
    successes: Object.create(null),
  };

  const saved = bot.storage.get(configStorageKey, {}) || {};
  const legacyRules = [
    { id: "legacy-hp", kind: "spell", name: "Spell Hi", slot: saved.hpHotbarSlot ?? 1, stat: "hp", operator: "below", value: saved.minHp ?? 250, unit: saved.hpThresholdMode === "percentage" ? "percent" : "points", manaCost: 0, cooldownMs: saved.healCooldownMs ?? 1200, enabled: true },
    { id: "legacy-mana", kind: "potion", name: "Mana", slot: saved.manaHotbarSlot ?? 2, stat: "mana", operator: "below", value: saved.minMana ?? 150, unit: saved.manaThresholdMode === "percentage" ? "percent" : "points", manaCost: 0, cooldownMs: saved.healCooldownMs ?? 1200, enabled: true },
  ];

  const config = Object.assign({
    tickMs: 100,
    delayMs: 0,
    minimumMana: 0,
    healCooldownMs: 1200,
    minHp: 250,
    hpThresholdMode: "absolute",
    hpHotbarSlot: 1,
    minMana: 150,
    manaThresholdMode: "absolute",
    manaHotbarSlot: 2,
    enabled: false,
    rules: Array.isArray(saved.rules) ? saved.rules : legacyRules,
  }, saved);
  config.hpThresholdMode = config.hpThresholdMode === "percentage" ? "percentage" : "absolute";
  config.manaThresholdMode = config.manaThresholdMode === "percentage" ? "percentage" : "absolute";
  config.rules = normalizeRules(config.rules);

  function normalizeRules(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value.slice(0, 24).map((source, index) => {
      const rule = source && typeof source === "object" ? source : {};
      const id = String(rule.id || `heal-${index + 1}`).slice(0, 48);
      return {
        id: seen.has(id) ? `heal-${index + 1}-${Date.now()}` : (seen.add(id), id),
        kind: ["spell", "rune", "potion"].includes(rule.kind) ? rule.kind : "spell",
        name: String(rule.name || "Acción de curación").trim().slice(0, 48),
        slot: normalizeHotbarSlot(rule.slot),
        stat: rule.stat === "mana" ? "mana" : "hp",
        operator: rule.operator === "above" ? "above" : "below",
        value: clampNumber(rule.value, rule.unit === "percent" ? 100 : 1000000, 0),
        unit: rule.unit === "percent" ? "percent" : "points",
        manaCost: clampNumber(rule.manaCost, 1000000, 0),
        cooldownMs: clampNumber(rule.cooldownMs, 60000, 1200),
        enabled: rule.enabled !== false,
      };
    });
  }

  function clampNumber(value, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(0, number)) : fallback;
  }

  function normalizeHotbarSlot(value) {
    const slot = Math.trunc(Number(value));
    return Number.isFinite(slot) && slot >= 1 && slot <= 12 ? slot : null;
  }

  function persistConfig() {
    bot.storage.set(configStorageKey, { ...config, rules: config.rules.map((rule) => ({ ...rule })) });
  }

  function readStats() {
    const player = bot.getPlayerSnapshot?.();
    return player ? {
      hp: { current: Number(player.health ?? 0), max: Number(player.maxHealth ?? 0) },
      mana: { current: Number(player.mana ?? 0), max: Number(player.maxMana ?? 0) },
    } : { hp: null, mana: null };
  }

  function readRuleValue(rule, stats) {
    const stat = stats[rule.stat];
    if (!stat || !Number.isFinite(stat.current)) return null;
    if (rule.unit === "percent") {
      if (!Number.isFinite(stat.max) || stat.max <= 0) return null;
      return (stat.current / stat.max) * 100;
    }
    return stat.current;
  }

  function conditionMet(rule, stats) {
    const actual = readRuleValue(rule, stats);
    if (actual == null) return false;
    return rule.operator === "above" ? actual >= rule.value : actual <= rule.value;
  }

  function canUseRule(rule, now, stats) {
    if (!rule.enabled || !rule.slot || !conditionMet(rule, stats)) return false;
    if (Number(stats.mana?.current ?? 0) < Math.max(config.minimumMana, rule.manaCost)) return false;
    if (state.pending || now - state.lastActionAt < Number(config.delayMs || 0)) return false;
    return now - Number(state.attempts[rule.id] || 0) >= rule.cooldownMs;
  }

  function didActionWork(before, after) {
    return Number(after?.hp?.current ?? 0) > Number(before?.hp?.current ?? 0) ||
      Number(after?.mana?.current ?? 0) > Number(before?.mana?.current ?? 0) ||
      Number(after?.mana?.current ?? 0) < Number(before?.mana?.current ?? 0);
  }

  function resolvePending(now, stats) {
    if (!state.pending) return;
    if (didActionWork(state.pending.stats, stats)) {
      state.successes[state.pending.ruleId] = state.pending.at;
      state.lastAction = state.pending.ruleName;
      bot.log("confirmed healing action", { name: state.pending.ruleName, slot: state.pending.slot });
      state.pending = null;
    } else if (now - state.pending.at >= Math.max(100, Number(config.confirmMs) || 600)) {
      bot.log("healing action not confirmed", { name: state.pending.ruleName, slot: state.pending.slot });
      state.pending = null;
    }
  }

  function triggerRule(rule, now, stats) {
    if (!canUseRule(rule, now, stats)) return false;
    const clicked = bot.clickHotbar(rule.slot - 1);
    if (!clicked) return false;
    state.attempts[rule.id] = now;
    state.lastActionAt = now;
    state.lastAttempt = { id: rule.id, name: rule.name, kind: rule.kind, slot: rule.slot, at: now };
    state.pending = { ruleId: rule.id, ruleName: rule.name, slot: rule.slot, stats, at: now };
    bot.log("triggered healing rule", { name: rule.name, kind: rule.kind, slot: rule.slot, stat: rule.stat });
    return true;
  }

  function tryHeal() {
    if (!config.enabled) return false;
    const now = Date.now();
    const stats = readStats();
    resolvePending(now, stats);
    if (state.pending) return false;
    for (const rule of config.rules) {
      if (triggerRule(rule, now, stats)) return true;
    }
    return false;
  }

  function scheduleNextTick() {
    if (!state.running) return;
    state.timerId = window.setTimeout(tick, Math.max(50, Number(config.tickMs) || 100));
  }

  function tick() {
    if (!state.running) return;
    try { tryHeal(); } catch (error) { bot.log("auto heal tick failed", error?.message || error); }
    finally { scheduleNextTick(); }
  }

  function start(overrides = {}) {
    updateConfig({ ...overrides, enabled: true });
    if (state.running) return false;
    state.running = true;
    bot.log("auto heal started", { rules: config.rules.length });
    tick();
    return true;
  }

  function stop(options = {}) {
    state.running = false;
    if (state.timerId != null) window.clearTimeout(state.timerId);
    state.timerId = null;
    if (options.persistEnabled !== false) {
      config.enabled = false;
      persistConfig();
    }
    bot.log("auto heal stopped");
    return true;
  }

  function updateConfig(next = {}) {
    const hpMode = next.hpThresholdMode ?? config.hpThresholdMode;
    const manaMode = next.manaThresholdMode ?? config.manaThresholdMode;
    if (Object.prototype.hasOwnProperty.call(next, "hpThresholdMode") && hpMode === "percentage" && !Object.prototype.hasOwnProperty.call(next, "minHp") && Number(config.minHp) > 100) next.minHp = 50;
    if (Object.prototype.hasOwnProperty.call(next, "manaThresholdMode") && manaMode === "percentage" && !Object.prototype.hasOwnProperty.call(next, "minMana") && Number(config.minMana) > 100) next.minMana = 50;
    if (Object.prototype.hasOwnProperty.call(next, "minHp")) next.minHp = clampNumber(next.minHp, hpMode === "percentage" ? 100 : 1000000, 0);
    if (Object.prototype.hasOwnProperty.call(next, "minMana")) next.minMana = clampNumber(next.minMana, manaMode === "percentage" ? 100 : 1000000, 0);
    const hasRules = Object.prototype.hasOwnProperty.call(next, "rules");
    if (!hasRules) {
      const hpRule = config.rules.find((rule) => rule.stat === "hp");
      const manaRule = config.rules.find((rule) => rule.stat === "mana");
      if (hpRule) {
        if (Object.prototype.hasOwnProperty.call(next, "minHp")) hpRule.value = clampNumber(next.minHp, (next.hpThresholdMode ?? config.hpThresholdMode) === "percentage" ? 100 : 1000000, 0);
        if (Object.prototype.hasOwnProperty.call(next, "hpThresholdMode")) hpRule.unit = next.hpThresholdMode === "percentage" ? "percent" : "points";
        if (Object.prototype.hasOwnProperty.call(next, "hpHotbarSlot")) hpRule.slot = normalizeHotbarSlot(next.hpHotbarSlot);
      }
      if (manaRule) {
        if (Object.prototype.hasOwnProperty.call(next, "minMana")) manaRule.value = clampNumber(next.minMana, (next.manaThresholdMode ?? config.manaThresholdMode) === "percentage" ? 100 : 1000000, 0);
        if (Object.prototype.hasOwnProperty.call(next, "manaThresholdMode")) manaRule.unit = next.manaThresholdMode === "percentage" ? "percent" : "points";
        if (Object.prototype.hasOwnProperty.call(next, "manaHotbarSlot")) manaRule.slot = normalizeHotbarSlot(next.manaHotbarSlot);
      }
      if (Object.prototype.hasOwnProperty.call(next, "healCooldownMs")) {
        for (const rule of config.rules) rule.cooldownMs = clampNumber(next.healCooldownMs, 60000, 1200);
      }
    }
    if (Object.prototype.hasOwnProperty.call(next, "rules")) next.rules = normalizeRules(next.rules);
    if (Object.prototype.hasOwnProperty.call(next, "tickMs")) next.tickMs = Math.max(50, clampNumber(next.tickMs, 5000, 100));
    if (Object.prototype.hasOwnProperty.call(next, "delayMs")) next.delayMs = clampNumber(next.delayMs, 60000, 0);
    if (Object.prototype.hasOwnProperty.call(next, "minimumMana")) next.minimumMana = clampNumber(next.minimumMana, 1000000, 0);
    Object.assign(config, next);
    persistConfig();
    bot.log("auto heal config updated", { rules: config.rules.length });
    return { ...config, rules: config.rules.map((rule) => ({ ...rule })) };
  }

  function status() {
    return {
      running: state.running,
      config: { ...config, rules: config.rules.map((rule) => ({ ...rule })) },
      stats: readStats(),
      lastActionAt: state.lastActionAt,
      lastAction: state.lastAction,
      lastAttempt: state.lastAttempt ? { ...state.lastAttempt } : null,
      pending: state.pending ? { ...state.pending } : null,
    };
  }

  function getLegacyRule(stat) {
    return config.rules.find((rule) => rule.stat === stat && rule.enabled) || config.rules.find((rule) => rule.stat === stat) || null;
  }

  function canUseStat(stat, now = Date.now(), stats = readStats()) {
    const rule = getLegacyRule(stat);
    return !!rule && canUseRule(rule, now, stats);
  }

  function triggerStat(stat, now = Date.now(), stats = readStats()) {
    const rule = getLegacyRule(stat);
    return !!rule && triggerRule(rule, now, stats);
  }

  bot.heal = {
    start, stop, status, updateConfig, readStats, tryHeal,
    canUseHpHeal: (now, stats) => canUseStat("hp", now, stats),
    canUseManaHeal: (now, stats) => canUseStat("mana", now, stats),
    triggerHpHeal: (now, stats) => triggerStat("hp", now, stats),
    triggerManaHeal: (now, stats) => triggerStat("mana", now, stats),
    normalizeHotbarSlot,
    config,
  };

  if (config.enabled) start();
  bot.addCleanup(() => stop({ persistEnabled: false }));
};
