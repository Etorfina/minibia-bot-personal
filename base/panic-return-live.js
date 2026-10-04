(() => {
  const bot = window.minibiaBot;
  if (!bot?.panic || !bot?.pz || !bot?.rune || !bot?.cave) {
    alert("Carga el bot antes de ejecutar este código.");
    return;
  }
  if (window.minibiaSafetyActive) {
    console.log("El regreso seguro ya está activado.");
    return;
  }
  if (!bot.pz.getHomePz()) {
    alert("Primero ve al refugio/PZ y pulsa Set Home en Seguridad.");
    return;
  }

  const THREE_MINUTES = 180000;
  let lastPlayerSeenAt = Date.now();
  let returnOrigin = null;
  let resumeRunes = false;
  let waitingForReturn = false;
  const sameSpot = (a, b) => !!a && !!b &&
    Number(a.x) === Number(b.x) &&
    Number(a.y) === Number(b.y) &&
    Number(a.z) === Number(b.z);

  // Existing checkboxes still decide which events trigger a retreat.
  bot.panic.updateConfig({
    returnToOriginEnabled: true,
    returnDelayMs: THREE_MINUTES,
    returnDelayJitterMs: 0
  });

  const originalHome = bot.pz.goToHomePz;
  const originalCaveMove = bot.cave.goToPosition;
  const originalPzMove = bot.pz.goToTile;

  bot.pz.goToHomePz = function (...args) {
    const pending = bot.panic.status().pendingReturn;
    if (pending) {
      if (!waitingForReturn) {
        returnOrigin = { ...pending.origin };
        resumeRunes = !!bot.rune.status().running;
        waitingForReturn = true;
      }
      if (resumeRunes && bot.rune.status().running) {
        bot.rune.stop({ persistEnabled: false });
        bot.ui?.refreshRuneStatus?.();
      }
    }
    return originalHome.apply(this, args);
  };

  function mayReturn(target) {
    const pending = bot.panic.status().pendingReturn;
    if (!pending || !sameSpot(target, pending.origin)) return true;
    return bot.panic.getVisiblePlayers().length === 0 &&
      Date.now() - lastPlayerSeenAt >= THREE_MINUTES;
  }

  bot.cave.goToPosition = function (target, ...rest) {
    return mayReturn(target) ? originalCaveMove.call(this, target, ...rest) : false;
  };

  bot.pz.goToTile = function (tile, ...rest) {
    return mayReturn(tile?.__position) ? originalPzMove.call(this, tile, ...rest) : false;
  };

  const timer = setInterval(() => {
    if (window.minibiaBot !== bot) {
      clearInterval(timer);
      window.minibiaSafetyActive = false;
      return;
    }
    const players = bot.panic.getVisiblePlayers();
    if (players.length) lastPlayerSeenAt = Date.now();
    if (!waitingForReturn) return;

    const pending = bot.panic.status().pendingReturn;
    if (pending) return;

    const safelyReturned = sameSpot(bot.getPlayerPosition(), returnOrigin) &&
      players.length === 0 && Date.now() - lastPlayerSeenAt >= THREE_MINUTES;
    if (safelyReturned && resumeRunes && bot.rune.config.enabled) {
      bot.rune.start();
      bot.ui?.refreshRuneStatus?.();
      console.log("Regresó al lugar original; runas reanudadas.");
    }
    waitingForReturn = false;
    resumeRunes = false;
    returnOrigin = null;
  }, 500);

  window.minibiaSafetyActive = true;
  console.log("Regreso seguro activo: 3 minutos sin jugadores visibles.");
  console.log("Activa Unknown Player y/o Lose Health en Seguridad. Auto Return ya está activo.");
})();
