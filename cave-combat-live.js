(() => {
  const bot = window.minibiaBot;
  if (!bot?.cave || !bot?.attack || !bot?.getPlayerPosition) {
    alert("Carga el bot antes de ejecutar este código.");
    return;
  }
  if (window.minibiaCombatPriorityActive) {
    console.log("La prioridad de combate ya está activa.");
    return;
  }

  const originalStatus = bot.attack.status;
  const firstSeen = new Map();
  const ignoredUntil = new Map();
  const acquisitionMs = 6000;
  let lastMoveAt = 0;
  let lastPositionKey = "";
  let lastProgressAt = 0;

  bot.attack.status = function (...args) {
    const result = originalStatus.apply(this, args);
    if (!result?.running || !result.config?.enabled) return result;

    const me = bot.getPlayerPosition();
    const now = Date.now();
    const maxDistance = Number(result.config.maxTargetDistance) || 8;
    const eligible = (result.nearbyMonsters || []).filter((monster) => {
      const p = monster.position;
      return p && me && Number(p.z) === Number(me.z) &&
        Math.max(Math.abs(p.x - me.x), Math.abs(p.y - me.y)) <= maxDistance;
    });

    const visibleIds = new Set(eligible.map(monster => monster.id));
    for (const id of firstSeen.keys()) {
      if (!visibleIds.has(id)) firstSeen.delete(id);
    }
    for (const id of ignoredUntil.keys()) {
      if (!visibleIds.has(id)) ignoredUntil.delete(id);
    }

    const priority = eligible.some((monster) => {
      if ((ignoredUntil.get(monster.id) || 0) > now) return false;
      if (!firstSeen.has(monster.id)) firstSeen.set(monster.id, now);
      const engaged = result.combatActive &&
        (result.engagedTargetId === monster.id || result.currentTarget?.id === monster.id);
      return engaged || now - firstSeen.get(monster.id) < acquisitionMs;
    });

    if (!priority) return { ...result, combatActive: false };
    return { ...result, combatActive: true, combatDurationMs: 0 };
  };

  const distance = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
  const keepRangedDistance = () => {
    if (window.minibiaBot !== bot) {
      clearInterval(timer);
      window.minibiaCombatPriorityActive = false;
      return;
    }
    if (!bot.attack.config?.enabled || bot.attack.config.meleeMode) return;
    const target = bot.attack.getCurrentTarget?.();
    const me = bot.getPlayerPosition();
    const them = target?.getPosition?.() || target?.__position;
    if (!target || !me || !them || me.z !== them.z) return;

    const range = distance(me, them);
    if (range >= 2 && range <= 3) {
      lastProgressAt = 0;
      lastPositionKey = "";
      return;
    }

    const now = Date.now();
    const positionKey = `${me.x},${me.y},${me.z}`;
    if (positionKey !== lastPositionKey) {
      lastPositionKey = positionKey;
      lastProgressAt = now;
    } else if (lastProgressAt && now - lastProgressAt > 8000) {
      ignoredUntil.set(target.id, now + 5000);
      lastProgressAt = now;
      return;
    }
    if (now - lastMoveAt < 1500) return;

    const world = window.gameClient?.world;
    const pathfinder = world?.pathfinder;
    if (!pathfinder?.search || !pathfinder?.findPath || typeof Position !== "function") return;
    const startTile = world.getTileFromWorldPosition?.(new Position(me.x, me.y, me.z));
    if (!startTile) return;

    const positions = [];
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        const r = Math.max(Math.abs(dx), Math.abs(dy));
        if (r >= 2 && r <= 3) positions.push({ x: them.x + dx, y: them.y + dy, z: them.z });
      }
    }
    positions.sort((a, b) => distance(me, a) - distance(me, b));

    for (const spot of positions) {
      const tile = world.getTileFromWorldPosition?.(new Position(spot.x, spot.y, spot.z));
      if (!tile?.isWalkable?.()) continue;
      try {
        if (!pathfinder.search(startTile, tile)?.length) continue;
        pathfinder.findPath(me, new Position(spot.x, spot.y, spot.z));
        lastMoveAt = now;
        return;
      } catch (error) {
        console.warn("No pude llegar a la casilla de combate:", error);
      }
    }
  };

  const timer = setInterval(keepRangedDistance, 500);

  window.minibiaCombatPriorityActive = true;
  console.log("Combate prioritario activo: melee persigue; distancia mantiene 2–3 sqm.");
  console.log("Enciende Auto Attack y Cave Bot. Selecciona Melee Mode según tu personaje.");
})();
