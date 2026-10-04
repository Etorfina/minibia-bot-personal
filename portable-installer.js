(async function minibiaPortable(profile) {
  if (!/(^|\.)minibia\.com$/i.test(location.hostname)) {
    alert("Abre minibia.com antes de ejecutar este código.");
    return;
  }
  const keys = [
    "minibiaBot.pz.home", "minibiaBot.panic.config",
    "minibiaBot.cave.config", "minibiaBot.cave.route",
    "minibiaBot.cave.transitions", "minibiaBot.cave.presets",
    "minibiaBot.attack.config", "minibiaBot.rune.config",
    "minibiaBot.heal.config", "minibiaBot.eat.config",
    "minibiaBot.equipRing.config", "minibiaBot.invisible.config",
    "minibiaBot.magicShield.config", "minibiaBot.xray.config"
  ];
  const capture = () => Object.fromEntries(
    keys.map(key => [key, localStorage.getItem(key)]).filter(([, value]) => value !== null)
  );
  const settings = profile || capture();
  if (profile) {
    for (const [key, value] of Object.entries(profile)) {
      if (keys.includes(key) && typeof value === "string") localStorage.setItem(key, value);
    }
  }
  const retreatInProgress = !!window.minibiaBot?.panic?.status?.().pendingReturn;
  if (!retreatInProgress) {
    document.getElementById("mb-drag-fix")?.remove();
    document.getElementById("mb-portable-drag")?.remove();
    window.minibiaMobileUndo?.();
    window.minibiaSafetyActive = false;
    window.minibiaCombatPriorityActive = false;
    const url = "https://raw.githubusercontent.com/spardue/minibia-bot/b82178d89f34f8e2916c0aa4f596b03a917c75ae/pz-bot.js";
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`No pude descargar el bot: HTTP ${response.status}`);
    (0, eval)(await response.text());
  }
  if (!window.minibiaBot) throw new Error("El bot no se inició.");

  /* PATCHES */
  (() => {
  window.minibiaMobileUndo?.();
  const panel = document.getElementById("minibia-bot-panel");
  if (!panel) { alert("Carga el bot primero."); return; }
  const originalStyle = panel.getAttribute("style");
  const assignments = [
    ["#minibia-bot-reload", "inicio"],
    ["#minibia-bot-home", "seguridad"],
    ["#minibia-bot-panic-gm-input", "seguridad"],
    ["#minibia-bot-rune-enabled", "mas"],
    [".mb-main-column .mb-note", "mas"],
    ["#minibia-bot-xray-overlay-toggle", "mas"],
    ["#minibia-bot-auto-heal-enabled", "combate"],
    ["#minibia-bot-talk-enabled", "mas"],
    ["#minibia-bot-cave-preset-select", "cueva"],
    ["#minibia-bot-auto-attack-enabled", "combate"],
  ];
  const tagged = [];
  for (const [selector, tab] of assignments) {
    const section = panel.querySelector(selector)?.closest(".mb-column-section");
    if (section) { section.dataset.liveTab = tab; tagged.push(section); }
  }
  const nav = document.createElement("div");
  nav.className = "mb-live-nav";
  for (const [tab, label] of [["inicio", "Inicio"], ["cueva", "Cueva"], ["combate", "Combate"], ["seguridad", "Seguridad"], ["mas", "Más"]]) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.tab = tab;
    nav.append(button);
  }
  panel.querySelector(".mb-titlebar").after(nav);
  const css = document.createElement("style");
  css.textContent = `
    #minibia-bot-panel.mb-live { box-sizing:border-box; width:min(440px,calc(100vw - 16px)); max-width:calc(100vw - 16px); padding:10px; font-size:14px; }
    #minibia-bot-panel.mb-live[data-collapsed="true"] { width:190px; }
    #minibia-bot-panel.mb-live .mb-live-nav { display:flex; gap:4px; overflow-x:auto; margin-bottom:8px; -webkit-overflow-scrolling:touch; }
    #minibia-bot-panel.mb-live[data-collapsed="true"] .mb-live-nav { display:none; }
    #minibia-bot-panel.mb-live .mb-live-nav button { width:auto; min-width:max-content; min-height:44px; padding:8px 12px; }
    #minibia-bot-panel.mb-live .mb-live-nav button[aria-selected="true"] { background:#a17a39; color:white; }
    #minibia-bot-panel.mb-live .mb-body { display:block; max-height:min(70dvh,620px); overflow-y:auto; overflow-x:hidden; -webkit-overflow-scrolling:touch; touch-action:pan-y; }
    #minibia-bot-panel.mb-live .mb-body[hidden] { display:none; }
    #minibia-bot-panel.mb-live .mb-main-column, #minibia-bot-panel.mb-live .mb-side-column, #minibia-bot-panel.mb-live .mb-cave-column { display:contents; }
    #minibia-bot-panel.mb-live .mb-column-section { display:none; }
    #minibia-bot-panel.mb-live[data-live-active="inicio"] [data-live-tab="inicio"],
    #minibia-bot-panel.mb-live[data-live-active="cueva"] [data-live-tab="cueva"],
    #minibia-bot-panel.mb-live[data-live-active="combate"] [data-live-tab="combate"],
    #minibia-bot-panel.mb-live[data-live-active="seguridad"] [data-live-tab="seguridad"],
    #minibia-bot-panel.mb-live[data-live-active="mas"] [data-live-tab="mas"] { display:block; }
    #minibia-bot-panel.mb-live button, #minibia-bot-panel.mb-live select { min-height:44px; }
    #minibia-bot-panel.mb-live input, #minibia-bot-panel.mb-live textarea, #minibia-bot-panel.mb-live select { font-size:16px; }
    #minibia-bot-panel.mb-live .mb-title { touch-action:none; }
  `;
  document.head.append(css);
  panel.classList.add("mb-live");
  const select = (tab) => {
    panel.dataset.liveActive = tab;
    nav.querySelectorAll("button").forEach(button => button.setAttribute("aria-selected", String(button.dataset.tab === tab)));
    panel.querySelector(".mb-body").scrollTop = 0;
  };
  nav.addEventListener("click", e => { if (e.target.dataset.tab) select(e.target.dataset.tab); });
  select("inicio");
  const rect = panel.getBoundingClientRect();
  panel.style.left = `${Math.max(0, Math.min(rect.left, window.innerWidth - panel.offsetWidth))}px`;
  panel.style.top = `${Math.max(0, Math.min(rect.top, window.innerHeight - panel.offsetHeight))}px`;
  panel.style.right = "auto";
  const title = panel.querySelector(".mb-title");
  let drag;
  const down = e => {
    drag = { x:e.clientX - panel.getBoundingClientRect().left, y:e.clientY - panel.getBoundingClientRect().top };
    title.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const move = e => {
    if (!drag) return;
    panel.style.left = `${Math.max(0, Math.min(e.clientX - drag.x, window.innerWidth - panel.offsetWidth))}px`;
    panel.style.top = `${Math.max(0, Math.min(e.clientY - drag.y, window.innerHeight - panel.offsetHeight))}px`;
  };
  const up = () => { drag = null; };
  title.addEventListener("pointerdown", down);
  title.addEventListener("pointermove", move);
  title.addEventListener("pointerup", up);
  title.addEventListener("pointercancel", up);
  window.minibiaMobileUndo = () => {
    title.removeEventListener("pointerdown", down);
    title.removeEventListener("pointermove", move);
    title.removeEventListener("pointerup", up);
    title.removeEventListener("pointercancel", up);
    panel.classList.remove("mb-live");
    panel.removeAttribute("data-live-active");
    tagged.forEach(section => section.removeAttribute("data-live-tab"));
    if (originalStyle == null) panel.removeAttribute("style"); else panel.setAttribute("style", originalStyle);
    css.remove(); nav.remove();
    delete window.minibiaMobileUndo;
  };
  console.log("Interfaz móvil lista. Para deshacer: minibiaMobileUndo()");
})();

(() => {
  const panel = document.getElementById("minibia-bot-panel");
  if (!panel) return;
  document.getElementById("mb-portable-drag")?.remove();
  const handle = document.createElement("button");
  handle.id = "mb-portable-drag";
  handle.textContent = "☰ MOVER BOT";
  Object.assign(handle.style, {
    position: "fixed", right: "12px", bottom: "85px", zIndex: "2147483647",
    width: "140px", height: "48px", border: "2px solid #e5c783",
    borderRadius: "12px", background: "#352817", color: "white",
    font: "bold 14px Arial, sans-serif", touchAction: "none"
  });
  document.body.append(handle);
  let start = null;
  handle.addEventListener("pointerdown", (event) => {
    const rect = panel.getBoundingClientRect();
    start = { id: event.pointerId, x: event.clientX, y: event.clientY,
      left: rect.left, top: rect.top };
    handle.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  handle.addEventListener("pointermove", (event) => {
    if (!start || start.id !== event.pointerId) return;
    const left = start.left + event.clientX - start.x;
    const top = start.top + event.clientY - start.y;
    const x = Math.max(-panel.offsetWidth + 80, Math.min(left, innerWidth - 80));
    const y = Math.max(-panel.offsetHeight + 80, Math.min(top, innerHeight - 80));
    panel.style.setProperty("left", `${x}px`, "important");
    panel.style.setProperty("top", `${y}px`, "important");
    panel.style.setProperty("right", "auto", "important");
    event.preventDefault();
  });
  handle.addEventListener("pointerup", () => { start = null; });
  handle.addEventListener("pointercancel", () => { start = null; });
})();

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


  // Show the retreat destination and wait directly in the bot panel on mobile.
  const monitoredBot = window.minibiaBot;
  document.getElementById("mb-safe-monitor")?.remove();
  const monitor = document.createElement("div");
  monitor.id = "mb-safe-monitor";
  Object.assign(monitor.style, {
    whiteSpace: "pre-line", padding: "8px 10px", font: "13px Arial,sans-serif",
    lineHeight: "1.4", color: "#fff", background: "#34443b",
    borderBottom: "1px solid #76977c"
  });
  const titlebar = document.querySelector("#minibia-bot-panel .mb-titlebar");
  if (titlebar) titlebar.after(monitor);
  else document.getElementById("minibia-bot-panel")?.prepend(monitor);
  let lastSeenByMonitor = 0;
  const updateMonitor = () => {
    if (window.minibiaBot !== monitoredBot || !monitor.isConnected) {
      clearInterval(monitorTimer);
      monitor.remove();
      return;
    }
    const status = monitoredBot.panic?.status?.();
    const pending = status?.pendingReturn;
    const players = monitoredBot.panic?.getVisiblePlayers?.() || [];
    if (players.length) lastSeenByMonitor = Date.now();
    if (!pending) {
      monitor.textContent = "🛡️ Protección lista · Sin regreso pendiente";
      return;
    }
    const { x, y, z } = pending.origin;
    const deadline = Math.max(
      pending.returnNotBeforeAt || 0,
      (pending.lastThreatAt || 0) + 180000,
      lastSeenByMonitor + 180000
    );
    const secondsLeft = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    const time = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`;
    monitor.textContent = `📍 Destino al salir: ${x}, ${y}, ${z}\n` +
      (players.length ? `👀 ${players.length} jugador(es) cerca · esperando` :
        secondsLeft ? `⏱️ Espera mínima para salir: ${time}` :
          "🚶 Intentando volver a esa posición…");
  };
  const monitorTimer = setInterval(updateMonitor, 1000);
  updateMonitor();

  async function showExport() {
    const current = capture();
    const raw = `(${minibiaPortable.toString()})(${JSON.stringify(current)});`;
    let code = raw;
    if (typeof CompressionStream === "function") {
      const stream = new Blob([raw]).stream().pipeThrough(new CompressionStream("gzip"));
      const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
      const binary = Array.from(bytes, byte => String.fromCharCode(byte)).join("");
      const encoded = btoa(binary);
      code = `(async()=>{const b=Uint8Array.from(atob("${encoded}"),c=>c.charCodeAt(0));` +
        `const s=await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"))).text();` +
        `(0,eval)(s)})().catch(e=>alert(e.message));`;
    }
    document.getElementById("mb-portable-export")?.remove();
    const box = document.createElement("div");
    box.id = "mb-portable-export";
    Object.assign(box.style, {
      position: "fixed", inset: "8px", zIndex: "2147483647",
      background: "#1f1b16", color: "white", padding: "16px",
      font: "16px Arial,sans-serif", overflow: "auto", borderRadius: "12px"
    });
    const title = document.createElement("p");
    title.textContent = "Copia este único código para tus otros equipos. Después toca CERRAR para ver el estado de Seguridad dentro del panel. Si cambias rutas u opciones, escribe minibiaPortableExport() en la consola para generar otro.";
    const input = document.createElement("textarea");
    input.value = code;
    Object.assign(input.style, {width:"100%",height:"55vh",boxSizing:"border-box",fontSize:"12px"});
    const copy = document.createElement("button");
    copy.textContent = "COPIAR CÓDIGO UNIVERSAL";
    Object.assign(copy.style, {display:"block",width:"100%",height:"48px",marginTop:"8px"});
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(code); }
      catch { input.select(); document.execCommand("copy"); }
      copy.textContent = "COPIADO";
    };
    const close = document.createElement("button");
    close.textContent = "CERRAR";
    Object.assign(close.style, {display:"block",width:"100%",height:"44px",marginTop:"8px"});
    close.onclick = () => box.remove();
    box.append(title,input,copy,close);
    document.body.append(box);
  }
  window.minibiaPortableExport = showExport;
  if (!profile) showExport();
  console.log("Bot unificado listo. Para actualizar el código con nuevos ajustes: minibiaPortableExport()");
})(null).catch(error => { console.error(error); alert(`Error al cargar el bot: ${error.message}`); });
