window.__minibiaBotBundle = window.__minibiaBotBundle || {};

window.__minibiaBotBundle.createBot = function createBot() {
  const cleanups = [];
  const defaultAlarmAudioSrc = "https://upload.wikimedia.org/wikipedia/commons/transcoded/3/3f/ACA_Allertor_125_video.ogv/ACA_Allertor_125_video.ogv.480p.vp9.webm";
  const alarmAudioSrcStorageKey = "minibiaBot.audio.alarmSrc";
  const recentSentChats = [];
  const reconnectButtonSelectors = [
    "button",
    "[role=\"button\"]",
    "input[type=\"button\"]",
    "input[type=\"submit\"]",
    "a",
    ".button",
    ".btn",
  ];
  let alarmAudio = null;
  let reconnectObserver = null;
  let reconnectPollTimerId = null;
  let lastReconnectClickAt = 0;

  function addCleanup(fn) {
    if (typeof fn === "function") {
      cleanups.push(fn);
    }
  }

  function runCleanups() {
    while (cleanups.length) {
      const fn = cleanups.pop();
      try {
        fn();
      } catch (error) {
        console.error("[minibia-bot] cleanup failed", error);
      }
    }
  }

  function getStoredAlarmAudioSrc() {
    try {
      const value = window.localStorage.getItem(alarmAudioSrcStorageKey);
      return value == null ? defaultAlarmAudioSrc : JSON.parse(value);
    } catch (error) {
      return defaultAlarmAudioSrc;
    }
  }

  function setStoredAlarmAudioSrc(src) {
    window.localStorage.setItem(alarmAudioSrcStorageKey, JSON.stringify(src));
    return src;
  }

  function destroyAlarmAudio() {
    if (!alarmAudio) {
      return;
    }

    try {
      alarmAudio.pause();
      alarmAudio.removeAttribute("src");
      alarmAudio.load();
    } catch (error) {
      console.error("[minibia-bot] audio cleanup failed", error);
    }

    alarmAudio = null;
  }

  function getAlarmAudio() {
    const src = getStoredAlarmAudioSrc();
    if (!src) {
      return null;
    }

    if (!alarmAudio) {
      alarmAudio = new Audio(src);
      alarmAudio.preload = "auto";
    } else if (alarmAudio.src !== src) {
      alarmAudio.pause();
      alarmAudio = new Audio(src);
      alarmAudio.preload = "auto";
    }

    return alarmAudio;
  }

  function normalizeChatText(text) {
    return String(text || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function rememberSentChat(text) {
    const normalized = normalizeChatText(text);
    if (!normalized) {
      return;
    }

    recentSentChats.push({
      text: normalized,
      at: Date.now(),
    });

    const maxEntries = 20;
    if (recentSentChats.length > maxEntries) {
      recentSentChats.splice(0, recentSentChats.length - maxEntries);
    }
  }

  function isRecentSentChat(text, withinMs = 45000) {
    const normalized = normalizeChatText(text);
    if (!normalized) {
      return false;
    }

    const cutoff = Date.now() - withinMs;
    for (let index = recentSentChats.length - 1; index >= 0; index -= 1) {
      const entry = recentSentChats[index];
      if (entry.at < cutoff) {
        continue;
      }

      if (entry.text === normalized) {
        return true;
      }
    }

    return false;
  }

  function normalizeUiText(text) {
    return String(text || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function getSkillWindowValue(skillNames = []) {
    for (const skillName of skillNames) {
      const value =
        document.querySelector(`#skill-window div[skill="${skillName}"] .skill`)?.textContent?.trim() ||
        null;
      if (value) {
        return value;
      }
    }

    return null;
  }

  function parseNumberText(value) {
    if (value == null) {
      return null;
    }

    const normalized = String(value).replace(/[^\d.-]/g, "");
    if (!normalized) {
      return null;
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function isVisibleElement(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return false;
    }

    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  function getElementUiText(element) {
    if (!(element instanceof Element)) {
      return "";
    }

    return normalizeUiText(
      element.textContent ||
      element.innerText ||
      element.getAttribute("value") ||
      element.getAttribute("aria-label") ||
      element.getAttribute("title") ||
      ""
    );
  }

  function findReconnectElement() {
    for (const selector of reconnectButtonSelectors) {
      const candidates = document.querySelectorAll(selector);
      for (const candidate of candidates) {
        if (!isVisibleElement(candidate)) {
          continue;
        }

        if (getElementUiText(candidate) === "reconnect") {
          return candidate;
        }
      }
    }

    return null;
  }

  function tryClickReconnect() {
    const now = Date.now();
    if (now - lastReconnectClickAt < 3000) {
      return false;
    }

    const reconnectElement = findReconnectElement();
    if (!reconnectElement) {
      return false;
    }

    reconnectElement.click();
    lastReconnectClickAt = now;
    console.log("[minibia-bot] clicked reconnect");
    return true;
  }

  function startReconnectWatcher() {
    if (reconnectObserver || reconnectPollTimerId) {
      return;
    }

    const runCheck = () => {
      try {
        tryClickReconnect();
      } catch (error) {
        console.error("[minibia-bot] reconnect watcher failed", error);
      }
    };

    reconnectObserver = new MutationObserver(runCheck);
    reconnectObserver.observe(document.documentElement || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden", "aria-hidden", "value"],
    });

    reconnectPollTimerId = window.setInterval(runCheck, 2000);
    runCheck();
  }

  function stopReconnectWatcher() {
    if (reconnectObserver) {
      reconnectObserver.disconnect();
      reconnectObserver = null;
    }

    if (reconnectPollTimerId) {
      window.clearInterval(reconnectPollTimerId);
      reconnectPollTimerId = null;
    }
  }

  if (!window.localStorage.getItem("minibiaBot.master.resume")) {
    startReconnectWatcher();
  }

  return {
    version: "0.3.0",
    addCleanup,
    setReconnectWatcherEnabled(enabled) {
      if (enabled) startReconnectWatcher();
      else stopReconnectWatcher();
    },
    destroy() {
      if (this.panic?.stop) {
        this.panic.stop();
      }

      if (this.rune?.stop) {
        this.rune.stop({ persistEnabled: false });
      }

      if (this.heal?.stop) {
        this.heal.stop({ persistEnabled: false });
      }

      if (this.invisible?.stop) {
        this.invisible.stop({ persistEnabled: false });
      }

      if (this.magicShield?.stop) {
        this.magicShield.stop({ persistEnabled: false });
      }

      if (this.attack?.stop) {
        this.attack.stop({ persistEnabled: false });
      }

      if (this.cave?.stop) {
        this.cave.stop({ persistEnabled: false });
      }

      if (this.equipRing?.stop) {
        this.equipRing.stop({ persistEnabled: false });
      }

      if (this.eat?.stop) {
        this.eat.stop({ persistEnabled: false });
      }

      if (this.talk?.stop) {
        this.talk.stop({ persistEnabled: false });
      }

      if (this.ui?.destroy) {
        this.ui.destroy();
      }

      stopReconnectWatcher();
      destroyAlarmAudio();
      runCleanups();
    },
    log(...args) {
      console.log("[minibia-bot]", ...args);
    },
    storage: {
      get(key, fallback = null) {
        try {
          const value = window.localStorage.getItem(key);
          return value == null ? fallback : JSON.parse(value);
        } catch (error) {
          return fallback;
        }
      },
      set(key, value) {
        window.localStorage.setItem(key, JSON.stringify(value));
        return value;
      },
      remove(key) {
        window.localStorage.removeItem(key);
      },
    },
    getPlayerPosition() {
      return window.gameClient?.player?.getPosition?.() || null;
    },
    getPlayerState() {
      return window.gameClient?.player?.state || null;
    },
    getPlayerName() {
      return (
        String(
          this.getPlayerState()?.name ||
          window.gameClient?.player?.name ||
          window.gameClient?.player?.state?.name ||
          ""
        ).trim() || null
      );
    },
    getPlayerSnapshot() {
      const playerState = this.getPlayerState() || {};
      const levelText = getSkillWindowValue(["level"]);
      const magicLevelText = getSkillWindowValue(["magic", "magic-level", "mlvl"]);
      const experienceText = getSkillWindowValue(["experience", "exp"]);
      const capacityText = getSkillWindowValue(["capacity", "cap"]);

      return {
        name: this.getPlayerName(),
        level: parseNumberText(playerState.level) ?? parseNumberText(levelText),
        magicLevel: parseNumberText(playerState.magicLevel ?? playerState.magic_level) ?? parseNumberText(magicLevelText),
        health: parseNumberText(playerState.health),
        maxHealth: parseNumberText(playerState.maxHealth),
        mana: parseNumberText(playerState.mana),
        maxMana: parseNumberText(playerState.maxMana),
        experience: parseNumberText(playerState.experience ?? playerState.exp) ?? parseNumberText(experienceText),
        capacity: parseNumberText(playerState.capacity ?? playerState.cap) ?? parseNumberText(capacityText),
        food: getSkillWindowValue(["food"]),
      };
    },
    sendChat(text) {
      const channelManager = window.gameClient?.interface?.channelManager;
      if (!channelManager || !text) {
        return false;
      }

      channelManager.sendMessageText(text);
      rememberSentChat(text);
      this.log("sent chat:", text);
      return true;
    },
    isRecentSentChat(text, withinMs) {
      return isRecentSentChat(text, withinMs);
    },
    clickReconnect() {
      return tryClickReconnect();
    },
    clickHotbar(index) {
      const button = window.gameClient?.interface?.hotbarManager?.slots?.[index]?.canvas?.canvas;
      if (!button) {
        return false;
      }

      button.click();
      return true;
    },
    getAlarmAudioSrc() {
      return getStoredAlarmAudioSrc();
    },
    setAlarmAudioSrc(src) {
      const nextSrc = String(src || "").trim();
      if (!nextSrc) {
        return false;
      }

      setStoredAlarmAudioSrc(nextSrc);
      destroyAlarmAudio();
      this.log("alarm audio updated", nextSrc);
      return true;
    },
    unlockAudio() {
      try {
        const audio = getAlarmAudio();
        if (!audio) {
          return false;
        }

        audio.muted = true;
        const playResult = audio.play();

        if (playResult && typeof playResult.then === "function") {
          playResult
            .then(() => {
              audio.pause();
              audio.currentTime = 0;
              audio.muted = false;
            })
            .catch((error) => {
              audio.muted = false;
              this.log("audio unlock failed", error?.message || error);
            });
        } else {
          audio.pause();
          audio.currentTime = 0;
          audio.muted = false;
        }

        return true;
      } catch (error) {
        console.error("[minibia-bot] audio unlock failed", error);
        return false;
      }
    },
    playAlarm() {
      try {
        const audio = getAlarmAudio();
        if (!audio) {
          return false;
        }

        audio.pause();
        audio.currentTime = 0;
        audio.muted = false;
        const playResult = audio.play();

        if (playResult && typeof playResult.catch === "function") {
          playResult.catch((error) => {
            this.log("alarm playback failed", error?.message || error);
          });
        }

        return true;
      } catch (error) {
        console.error("[minibia-bot] alarm failed", error);
        return false;
      }
    },
  };
};
window.__minibiaBotBundle = window.__minibiaBotBundle || {};

window.__minibiaBotBundle.installPzModule = function installPzModule(bot) {
  const homeStorageKey = "minibiaBot.pz.home";

  function getLoadedTiles() {
    const chunks = window.gameClient?.world?.chunks || [];
    const tiles = [];

    for (const chunk of chunks) {
      if (!chunk?.tiles) continue;

      for (const tile of chunk.tiles) {
        if (tile?.__position) {
          tiles.push(tile);
        }
      }
    }

    return tiles;
  }

  function hasPzFlag(tile) {
    return !!tile && ((tile.flags || 0) & 1) !== 0;
  }

  function getPzCandidates() {
    const me = bot.getPlayerPosition();
    if (!me) return [];

    return getLoadedTiles()
      .filter((tile) => hasPzFlag(tile) && tile.__position?.z === me.z)
      .map((tile) => {
        const p = tile.__position;
        return {
          tile,
          x: p.x,
          y: p.y,
          z: p.z,
          flags: tile.flags || 0,
          dist: Math.abs(p.x - me.x) + Math.abs(p.y - me.y),
        };
      })
      .sort((a, b) => a.dist - b.dist);
  }

  function goToTile(tile) {
    if (!tile?.__position) return false;

    const from = bot.getPlayerPosition();
    if (!from) return false;

    const p = tile.__position;
    const to = new Position(p.x, p.y, p.z);

    try {
      window.gameClient?.world?.pathfinder?.findPath?.(from, to);
      bot.log("pathing to", { x: p.x, y: p.y, z: p.z, flags: tile.flags });
      return true;
    } catch (error) {
      bot.log("pathing failed", { x: p.x, y: p.y, z: p.z, error: error?.message });
      return false;
    }
  }

  function goToNearestPz(maxAttempts = 20) {
    const candidates = getPzCandidates().slice(0, maxAttempts);

    if (!candidates.length) {
      bot.log("No PZ candidates found");
      return false;
    }

    for (const candidate of candidates) {
      if (goToTile(candidate.tile)) {
        bot.log("selected PZ", {
          x: candidate.x,
          y: candidate.y,
          z: candidate.z,
          flags: candidate.flags,
          dist: candidate.dist,
        });
        return true;
      }
    }

    bot.log("No PZ candidate accepted by pathfinder");
    return false;
  }

  function setHomePz(x, y, z) {
    const home = { x, y, z };
    bot.storage.set(homeStorageKey, home);
    bot.log("home PZ set", home);
    return home;
  }

  function setHomePzCurrentSpot() {
    const pos = bot.getPlayerPosition();
    if (!pos) {
      bot.log("Could not read current position");
      return null;
    }

    return setHomePz(pos.x, pos.y, pos.z);
  }

  function getHomePz() {
    return bot.storage.get(homeStorageKey, null);
  }

  function clearHomePz() {
    bot.storage.remove(homeStorageKey);
    bot.log("home PZ cleared");
  }

  function getNearestPzTo(x, y, z) {
    const candidates = getLoadedTiles()
      .filter((tile) => hasPzFlag(tile) && tile.__position?.z === z)
      .map((tile) => {
        const p = tile.__position;
        return {
          tile,
          x: p.x,
          y: p.y,
          z: p.z,
          flags: tile.flags || 0,
          dist: Math.abs(p.x - x) + Math.abs(p.y - y),
        };
      })
      .sort((a, b) => a.dist - b.dist);

    return candidates[0] || null;
  }

  function goToHomePz() {
    const home = getHomePz();
    if (!home) {
      bot.log("No home PZ set");
      return false;
    }

    const candidate = getNearestPzTo(home.x, home.y, home.z);
    if (!candidate) {
      bot.log("No loaded PZ found near saved home", home);
      return false;
    }

    bot.log("home candidate", {
      x: candidate.x,
      y: candidate.y,
      z: candidate.z,
      flags: candidate.flags,
      distFromHome: candidate.dist,
    });

    return goToTile(candidate.tile);
  }

  function printPzCandidates(limit = 10) {
    const rows = getPzCandidates()
      .slice(0, limit)
      .map((candidate) => ({
        x: candidate.x,
        y: candidate.y,
        z: candidate.z,
        flags: candidate.flags,
        dist: candidate.dist,
      }));

    console.table(rows);
    return rows;
  }

  bot.pz = {
    getLoadedTiles,
    getPzCandidates,
    goToTile,
    goToNearestPz,
    setHomePz,
    setHomePzCurrentSpot,
    getHomePz,
    clearHomePz,
    getNearestPzTo,
    goToHomePz,
    printPzCandidates,
  };

  bot.goToNearestPz = goToNearestPz;
  bot.setHomePz = setHomePz;
  bot.setHomePzCurrentSpot = setHomePzCurrentSpot;
  bot.getHomePz = getHomePz;
  bot.clearHomePz = clearHomePz;
  bot.goToHomePz = goToHomePz;
};
window.__minibiaBotBundle = window.__minibiaBotBundle || {};

window.__minibiaBotBundle.installXrayModule = function installXrayModule(bot) {
  const configStorageKey = "minibiaBot.xray.config";
  const overlayRootId = "minibia-bot-xray-overlay";
  const overlayStyleId = "minibia-bot-xray-overlay-style";
  const overlayState = {
    running: false,
    timerId: null,
  };
  const config = Object.assign(
    {
      overlayEnabled: false,
      selectedFloor: null,
    },
    bot.storage.get(configStorageKey, {})
  );

  config.selectedFloor = normalizeSelectedFloor(config.selectedFloor);

  function persistConfig() {
    bot.storage.set(configStorageKey, { ...config });
  }

  function normalizeName(name) {
    return String(name || "").trim().toLowerCase();
  }

  function normalizeSelectedFloor(value) {
    if (value == null || value === "" || value === "all") {
      return null;
    }

    const floor = Number(value);
    if (!Number.isFinite(floor)) {
      return null;
    }

    return Math.trunc(floor);
  }

  function isWithinVisibleRange(me, pos) {
    if (!me || !pos) {
      return false;
    }

    const dx = Math.abs(pos.x - me.x);
    const dy = Math.abs(pos.y - me.y);
    return dx <= 8 && dy <= 6;
  }

  function getTrackedCreatures() {
    const myState = bot.getPlayerState();
    const myId = window.gameClient?.player?.id;
    const myName = normalizeName(myState?.name);

    return Object.values(window.gameClient?.world?.activeCreatures || {}).filter((creature) => {
      if (!creature) return false;
      if (creature.id === myId) return false;

      const name = normalizeName(creature.name);
      if (name && name === myName) return false;

      return true;
    });
  }

  function getVisibleCreatures() {
    const me = bot.getPlayerPosition();
    if (!me) {
      return [];
    }

    // Keep the visible query strict; panic logic relies on this staying screen-limited.
    return getTrackedCreatures().filter((creature) => isWithinVisibleRange(me, creature.__position));
  }

  function getVisiblePlayers(options = {}) {
    const { sameFloorOnly = false } = options;
    const me = bot.getPlayerPosition();
    if (!me) {
      return [];
    }

    return getVisibleCreatures().filter((creature) => {
      if (creature?.type !== 0) {
        return false;
      }

      if (!sameFloorOnly) {
        return true;
      }

      return creature.__position?.z === me.z;
    });
  }

  function getVisibleMonsters(options = {}) {
    const { sameFloorOnly = false } = options;
    const me = bot.getPlayerPosition();
    if (!me) {
      return [];
    }

    return getVisibleCreatures().filter((creature) => {
      if (creature?.type === 0) {
        return false;
      }

      if (!sameFloorOnly) {
        return true;
      }

      return creature.__position?.z === me.z;
    });
  }

  function readCreatureHealth(creature) {
    if (!creature) {
      return null;
    }

    const current = [
      creature.health,
      creature.hp,
      creature.currentHealth,
      creature.state?.health,
    ].find((value) => Number.isFinite(Number(value)));

    const max = [
      creature.maxHealth,
      creature.maxHp,
      creature.maximumHealth,
      creature.state?.maxHealth,
    ].find((value) => Number.isFinite(Number(value)));

    const percent = [
      creature.healthPercent,
      creature.hpPercent,
      creature.healthpercentage,
      creature.state?.healthPercent,
    ].find((value) => Number.isFinite(Number(value)));

    if (current != null && max != null) {
      return `${Number(current)}/${Number(max)} HP`;
    }

    if (percent != null) {
      return `${Math.round(Number(percent))}% HP`;
    }

    if (current != null) {
      return `${Number(current)} HP`;
    }

    return null;
  }

  function getCreatureLabel(creature) {
    if (creature?.name) {
      return creature.name;
    }

    return creature?.type === 0 ? "Player" : "Mob";
  }

  function getOverlayCreatures() {
    const me = bot.getPlayerPosition();
    if (!me) {
      return [];
    }

    return getTrackedCreatures().filter((creature) => {
      const pos = creature?.__position;
      if (!pos || pos.z == null) {
        return false;
      }

      if (config.selectedFloor != null && pos.z !== config.selectedFloor) {
        return false;
      }

      if (pos.z !== me.z) {
        return isWithinVisibleRange(me, pos);
      }

      return !isWithinVisibleRange(me, pos);
    });
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function getSameFloorOffscreenMarkerText(creature, healthLabel) {
    return healthLabel
      ? `${getCreatureLabel(creature)} ${healthLabel}`
      : `${getCreatureLabel(creature)}`;
  }

  function ensureOverlayStyle() {
    if (document.getElementById(overlayStyleId)) {
      return;
    }

    const style = document.createElement("style");
    style.id = overlayStyleId;
    style.textContent = `
      #${overlayRootId} {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 999998;
      }

      #${overlayRootId} .mb-xray-marker {
        position: fixed;
        transform: translate(-50%, -50%);
        padding: 2px 6px;
        border: 1px solid rgba(255, 211, 128, 0.85);
        border-radius: 999px;
        background: rgba(65, 24, 12, 0.72);
        box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
        color: #ffe7ae;
        font: 11px/1.2 Verdana, sans-serif;
        white-space: nowrap;
      }

      #${overlayRootId} .mb-xray-marker.mb-xray-marker-offscreen {
        border-color: rgba(123, 235, 178, 0.92);
        background: rgba(11, 61, 43, 0.8);
        color: #d8ffea;
      }

      /* Combate móvil: controles compactos sin reducir la legibilidad. */
      #minibia-bot-panel.mb-mobile .mb-section[aria-labelledby="minibia-bot-attack-title"] { padding: 7px !important; }
      #minibia-bot-panel.mb-mobile .mb-section[aria-labelledby="minibia-bot-attack-title"] > .mb-label { margin: 0 0 3px; font-size: 11px; }
      #minibia-bot-panel.mb-mobile .mb-attack-intro { margin: 0 0 4px; font-size: 9px; line-height: 1.25; }
      #minibia-bot-panel.mb-mobile .mb-attack-layout { gap: 4px; }
      #minibia-bot-panel.mb-mobile .mb-attack-card { gap: 4px; padding: 6px; border-radius: 8px; }
      #minibia-bot-panel.mb-mobile .mb-attack-card-heading { align-items: center; gap: 5px; }
      #minibia-bot-panel.mb-mobile .mb-attack-card-title { font-size: 10px; line-height: 1.2; }
      #minibia-bot-panel.mb-mobile .mb-attack-card .mb-small-note { margin: 0; font-size: 9px; line-height: 1.25; }
      #minibia-bot-panel.mb-mobile .mb-attack-status { padding: 2px 6px; font-size: 9px; }
      #minibia-bot-panel.mb-mobile .mb-attack-count { min-width: 18px; padding: 1px 5px; font-size: 9px; }
      #minibia-bot-panel.mb-mobile .mb-attack-enable,
      #minibia-bot-panel.mb-mobile .mb-attack-only-listed { min-height: 30px !important; padding: 3px 2px !important; font-size: 11px; }
      #minibia-bot-panel.mb-mobile .mb-attack-add-row { gap: 4px; }
      #minibia-bot-panel.mb-mobile .mb-attack-add-row input { min-height: 34px !important; padding: 4px 7px; font-size: 16px; }
      #minibia-bot-panel.mb-mobile .mb-attack-add-row button,
      #minibia-bot-panel.mb-mobile .mb-attack-visible-list button { min-height: 29px !important; padding: 3px 7px; font-size: 10px; }
      #minibia-bot-panel.mb-mobile .mb-attack-visible-list { gap: 4px; padding: 0 0 2px; }
      #minibia-bot-panel.mb-mobile .mb-attack-visible-empty { padding: 2px 0; font-size: 9px; }
      #minibia-bot-panel.mb-mobile .mb-attack-target-list { gap: 3px; max-height: 96px; }
      #minibia-bot-panel.mb-mobile .mb-attack-empty { padding: 4px 6px; font-size: 9px; }
      #minibia-bot-panel.mb-mobile .mb-attack-target-row { grid-template-columns: 16px minmax(55px,1fr) auto auto; gap: 3px; min-height: 28px; padding: 2px 4px; }
      #minibia-bot-panel.mb-mobile .mb-attack-target-name { font-size: 10px; }
      #minibia-bot-panel.mb-mobile .mb-attack-target-stance { min-width: 67px; min-height: 25px !important; padding: 2px 15px 2px 5px; font-size: 9px; }
      #minibia-bot-panel.mb-mobile .mb-attack-target-controls { gap: 2px; }
      #minibia-bot-panel.mb-mobile .mb-attack-target-controls .mb-attack-row-action { width: 23px; min-width: 23px; min-height: 23px !important; padding: 1px; font-size: 11px; }
      #minibia-bot-panel.mb-mobile .mb-attack-only-listed { padding-top: 4px !important; }
      #minibia-bot-panel.mb-mobile .mb-attack-selection-field { gap: 2px; }
      #minibia-bot-panel.mb-mobile .mb-attack-selection-field select,
      #minibia-bot-panel.mb-mobile #minibia-bot-attack-stance,
      #minibia-bot-panel.mb-mobile #minibia-bot-attack-range,
      #minibia-bot-panel.mb-mobile #minibia-bot-auto-attack-hotkey,
      #minibia-bot-panel.mb-mobile #minibia-bot-auto-attack-rune-hotkey { min-height: 30px !important; padding: 3px 6px; }
      #minibia-bot-panel.mb-mobile .mb-attack-hotkeys { gap: 4px; }

      /* Escritorio: panel flotante compacto con navegación por pestañas. */
      #minibia-bot-panel.mb-desktop {
        box-sizing: border-box;
        width: min(560px, calc(100vw - 24px));
        max-width: calc(100vw - 24px);
        padding: 10px;
      }
      #minibia-bot-panel.mb-desktop .mb-body {
        display: flex;
        flex-direction: column;
        max-height: calc(100dvh - 104px);
        overflow: auto;
        overscroll-behavior: contain;
        min-height: 0;
      }
      #minibia-bot-panel.mb-desktop .mb-main-column,
      #minibia-bot-panel.mb-desktop .mb-side-column,
      #minibia-bot-panel.mb-desktop .mb-cave-column,
      #minibia-bot-panel.mb-desktop .mb-healing-column {
        display: block;
        min-width: 0;
      }
      #minibia-bot-panel.mb-desktop .mb-mobile-tabs {
        display: flex !important;
        gap: 4px;
        overflow-x: auto;
        margin-bottom: 7px;
        scrollbar-width: thin;
      }
      #minibia-bot-panel.mb-desktop .mb-mobile-tabs button {
        width: auto;
        min-width: max-content;
        min-height: 32px;
        padding: 4px 9px;
        border-radius: 7px;
        background: #25282a;
        border-color: rgba(255,255,255,.09);
        color: #cbc8c1;
        font-size: 11px;
      }
      #minibia-bot-panel.mb-desktop .mb-mobile-tabs button[aria-selected="true"] {
        background: #8e6c38;
        border-color: #bd985a;
        color: #fff;
      }
      #minibia-bot-panel.mb-desktop .mb-column-section { display: none; }
      #minibia-bot-panel.mb-desktop[data-mobile-tab="status"] [data-mobile-tab="status"],
      #minibia-bot-panel.mb-desktop[data-mobile-tab="cave"] [data-mobile-tab="cave"],
      #minibia-bot-panel.mb-desktop[data-mobile-tab="combat"] [data-mobile-tab="combat"],
      #minibia-bot-panel.mb-desktop[data-mobile-tab="healing"] [data-mobile-tab="healing"],
      #minibia-bot-panel.mb-desktop[data-mobile-tab="safety"] [data-mobile-tab="safety"],
      #minibia-bot-panel.mb-desktop[data-mobile-tab="more"] [data-mobile-tab="more"] { display: block; }
      #minibia-bot-panel.mb-desktop[data-collapsed="true"] .mb-mobile-tabs { display: none; }

    `;
    document.head.appendChild(style);
  }

  function ensureOverlayRoot() {
    let root = document.getElementById(overlayRootId);
    if (root) {
      return root;
    }

    root = document.createElement("div");
    root.id = overlayRootId;
    document.body.appendChild(root);
    return root;
  }

  function destroyOverlayElements() {
    document.getElementById(overlayRootId)?.remove();
    document.getElementById(overlayStyleId)?.remove();
  }

  function getViewportRect() {
    const canvases = Array.from(document.querySelectorAll("canvas"))
      .map((canvas) => ({ canvas, rect: canvas.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width >= 200 && rect.height >= 150)
      .sort((a, b) => (b.rect.width * b.rect.height) - (a.rect.width * a.rect.height));

    return canvases[0]?.rect || null;
  }

  function renderOverlay() {
    if (!overlayState.running) {
      return;
    }

    const root = ensureOverlayRoot();
    const me = bot.getPlayerPosition();
    const viewportRect = getViewportRect();
    const creatures = getOverlayCreatures();
    root.innerHTML = "";

    if (!me || !viewportRect || !creatures.length) {
      return;
    }

    const tileWidth = viewportRect.width / 17;
    const tileHeight = viewportRect.height / 13;
    const edgePadding = 48;

    creatures.forEach((creature) => {
      const pos = creature?.__position;
      if (!pos) return;

      const dx = pos.x - me.x;
      const dy = pos.y - me.y;
      const healthLabel = readCreatureHealth(creature);
      const marker = document.createElement("div");
      marker.className = "mb-xray-marker";

      if (pos.z === me.z) {
        marker.classList.add("mb-xray-marker-offscreen");
        marker.textContent = getSameFloorOffscreenMarkerText(creature, healthLabel);
        marker.style.left = `${clamp(
          viewportRect.left + ((dx + 8.5) * tileWidth),
          viewportRect.left + edgePadding,
          viewportRect.right - edgePadding
        )}px`;
        marker.style.top = `${clamp(
          viewportRect.top + ((dy + 6.5) * tileHeight),
          viewportRect.top + edgePadding,
          viewportRect.bottom - edgePadding
        )}px`;
      } else {
        const floorOffset = me.z - pos.z;
        const floorLabel = floorOffset === 0 ? "0" : floorOffset > 0 ? `+${floorOffset}` : `${floorOffset}`;
        marker.textContent = healthLabel
          ? `${getCreatureLabel(creature)} (${floorLabel}) ${healthLabel}`
          : `${getCreatureLabel(creature)} (${floorLabel})`;
        marker.style.left = `${viewportRect.left + ((dx + 8.5) * tileWidth)}px`;
        marker.style.top = `${viewportRect.top + ((dy + 6.5) * tileHeight)}px`;
      }

      root.appendChild(marker);
    });
  }

  function startOverlay() {
    config.overlayEnabled = true;
    persistConfig();

    if (overlayState.running) {
      return false;
    }

    overlayState.running = true;
    ensureOverlayStyle();
    renderOverlay();
    overlayState.timerId = window.setInterval(renderOverlay, 250);
    return true;
  }

  function stopOverlay() {
    config.overlayEnabled = false;
    persistConfig();

    if (!overlayState.running && overlayState.timerId == null) {
      return false;
    }

    overlayState.running = false;
    if (overlayState.timerId != null) {
      window.clearInterval(overlayState.timerId);
      overlayState.timerId = null;
    }

    destroyOverlayElements();
    return true;
  }

  function setOverlayEnabled(enabled) {
    const nextEnabled = !!enabled;

    if (nextEnabled) {
      if (overlayState.running) {
        config.overlayEnabled = true;
        persistConfig();
        return true;
      }

      return startOverlay();
    }

    if (!overlayState.running) {
      config.overlayEnabled = false;
      persistConfig();
      destroyOverlayElements();
      return true;
    }

    return stopOverlay();
  }

  function setSelectedFloor(floor) {
    config.selectedFloor = normalizeSelectedFloor(floor);
    persistConfig();

    if (overlayState.running) {
      renderOverlay();
    }

    return config.selectedFloor;
  }

  function status() {
    return {
      visibleCreatures: getVisibleCreatures().map((creature) => ({
        id: creature.id,
        name: creature.name,
        type: creature.type,
        position: creature.__position || null,
      })),
      visiblePlayers: getVisiblePlayers().map((player) => ({
        id: player.id,
        name: player.name,
        position: player.__position || null,
      })),
      visiblePlayersCurrentFloor: getVisiblePlayers({ sameFloorOnly: true }).map((player) => ({
        id: player.id,
        name: player.name,
        position: player.__position || null,
      })),
      visibleMonsters: getVisibleMonsters().map((creature) => ({
        id: creature.id,
        name: creature.name,
        type: creature.type,
        position: creature.__position || null,
      })),
      visibleMonstersCurrentFloor: getVisibleMonsters({ sameFloorOnly: true }).map((creature) => ({
        id: creature.id,
        name: creature.name,
        type: creature.type,
        position: creature.__position || null,
      })),
      overlayCreatures: getOverlayCreatures().map((creature) => ({
        id: creature.id,
        name: creature.name,
        type: creature.type,
        position: creature.__position || null,
      })),
      config: { ...config },
      overlayRunning: overlayState.running,
    };
  }

  bot.xray = {
    getVisibleCreatures,
    getVisiblePlayers,
    getVisibleMonsters,
    getOverlayCreatures,
    startOverlay,
    stopOverlay,
    setOverlayEnabled,
    setSelectedFloor,
    status,
    config,
  };

  if (config.overlayEnabled) {
    startOverlay();
  } else {
    destroyOverlayElements();
  }
  bot.addCleanup(stopOverlay);
};
window.__minibiaBotBundle = window.__minibiaBotBundle || {};

window.__minibiaBotBundle.installPanicModule = function installPanicModule(bot) {
  const configStorageKey = "minibiaBot.panic.config";
  const state = {
    running: false,
    timerId: null,
    lastHealth: null,
    lastTriggerAt: 0,
    lastDamageEventKey: null,
    pendingReturnOrigin: null,
    pendingReturnModules: null,
    returnNotBeforeAt: 0,
    lastThreatAt: 0,
    lastReturnAttemptAt: 0,
  };

  const config = Object.assign(
    {
      tickMs: 200,
      triggerCooldownMs: 4000,
      returnToOriginEnabled: false,
      returnDelayMs: 180000,
      returnDelayJitterMs: 0,
      returnRetryCooldownMs: 2000,
      unknownPlayerEnabled: false,
      healthLossEnabled: false,
      trustedNames: [],
      gameMasterNames: [],
    },
    bot.storage.get(configStorageKey, {})
  );
  // Older saved settings may still contain the previous five-minute randomized delay.
  if (config.returnDelayMs === 300000 && config.returnDelayJitterMs === 30000) {
    config.returnDelayMs = 180000;
    config.returnDelayJitterMs = 0;
  }

  function persistConfig() {
    bot.storage.set(configStorageKey, { ...config });
  }

  function normalizeName(name) {
    return String(name || "").trim().toLowerCase();
  }

  function normalizeDelayMs(value, fallback = 0) {
    const next = Math.trunc(Number(value));
    return Number.isFinite(next) ? Math.max(0, next) : fallback;
  }

  function normalizePosition(position) {
    const x = Number(position?.x);
    const y = Number(position?.y);
    const z = Number(position?.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return null;
    }

    return { x, y, z };
  }

  function isSamePosition(left, right) {
    return !!left && !!right && left.x === right.x && left.y === right.y && left.z === right.z;
  }

  function getTrustedNames() {
    return Array.from(
      new Set(
        (config.trustedNames || [])
          .map((name) => normalizeName(name))
          .filter(Boolean)
      )
    );
  }

  function getGameMasterNames() {
    return Array.from(
      new Set(
        (config.gameMasterNames || [])
          .map((name) => normalizeName(name))
          .filter(Boolean)
      )
    );
  }

  function getVisiblePlayers() {
    const me = bot.getPlayerPosition();
    const players = bot.xray?.getVisiblePlayers?.() || [];
    if (!me) {
      return players;
    }

    return players.filter((creature) => {
      const z = Number(creature?.__position?.z);
      return Number.isFinite(z) && Math.abs(z - me.z) <= 1;
    });
  }

  function getUnknownVisiblePlayers() {
    const trusted = new Set(getTrustedNames());

    return getVisiblePlayers().filter((creature) => {
      const name = normalizeName(creature?.name);
      return !!name && !trusted.has(name);
    });
  }

  function getTrustedVisiblePlayers() {
    const trusted = new Set(getTrustedNames());

    return getVisiblePlayers().filter((creature) => {
      const name = normalizeName(creature?.name);
      return !!name && trusted.has(name);
    });
  }

  function getVisibleGameMasters() {
    const gameMasters = new Set(getGameMasterNames());

    return getVisiblePlayers().filter((creature) => {
      const name = normalizeName(creature?.name);
      return !!name && gameMasters.has(name);
    });
  }

  function getRecentChannelMessages() {
    return (window.gameClient?.interface?.channelManager?.channels || []).flatMap((channel) =>
      (channel?.__contents || []).map((entry) => ({
        channelName: channel?.name || null,
        message: String(entry?.message || ""),
        time: entry?.__time || null,
      }))
    );
  }

  function parseDamageMessage(entry) {
    const match = entry.message.match(
      /^You lose\s+(\d+)\s+hitpoints\s+due to an attack by\s+(.+?)\.$/i
    );

    if (!match) {
      return null;
    }

    return {
      amount: Number(match[1]),
      attackerName: match[2].trim(),
      time: entry.time,
      channelName: entry.channelName,
      key: `${entry.time || "no-time"}|${entry.message}`,
      message: entry.message,
    };
  }

  function getLatestDamageEvent() {
    const messages = getRecentChannelMessages()
      .map(parseDamageMessage)
      .filter(Boolean)
      .sort((a, b) => {
        const aTime = a.time ? Date.parse(a.time) : 0;
        const bTime = b.time ? Date.parse(b.time) : 0;
        return bTime - aTime;
      });

    return messages[0] || null;
  }

  function getReturnDelayMs() {
    const baseDelayMs = normalizeDelayMs(config.returnDelayMs, 0);
    const jitterMs = normalizeDelayMs(config.returnDelayJitterMs, 0);
    if (!jitterMs) {
      return baseDelayMs;
    }

    const randomOffset = Math.floor(Math.random() * ((jitterMs * 2) + 1)) - jitterMs;
    return Math.max(0, baseDelayMs + randomOffset);
  }

  function clearPendingReturn() {
    state.pendingReturnOrigin = null;
    state.pendingReturnModules = null;
    state.returnNotBeforeAt = 0;
    state.lastThreatAt = 0;
    state.lastReturnAttemptAt = 0;
  }

  function snapshotInterruptedModules() {
    return {
      runeRunning: !!bot.rune?.status?.().running,
      caveRunning: !!bot.cave?.status?.().running,
      equipRingRunning: !!bot.equipRing?.status?.().running,
    };
  }

  function armPendingReturn(now = Date.now(), origin = normalizePosition(bot.getPlayerPosition())) {
    if (!config.returnToOriginEnabled) {
      clearPendingReturn();
      return;
    }

    if (!state.pendingReturnOrigin && origin) {
      state.pendingReturnOrigin = origin;
      state.pendingReturnModules = snapshotInterruptedModules();
    }

    if (!state.pendingReturnOrigin) {
      return;
    }

    state.lastThreatAt = now;
    state.returnNotBeforeAt = now + getReturnDelayMs();
  }

  function isReturnCoastClear() {
    return !getVisiblePlayers().length;
  }

  function restoreInterruptedModules() {
    if (state.pendingReturnModules?.runeRunning) {
      bot.rune?.start?.();
      bot.ui?.refreshRuneStatus?.();
    }

    if (state.pendingReturnModules?.caveRunning) {
      bot.cave?.start?.();
    }

    if (state.pendingReturnModules?.equipRingRunning) {
      bot.equipRing?.start?.();
      bot.ui?.refreshEquipRingStatus?.();
    }
  }

  function tryReturnToOrigin(now = Date.now()) {
    if (!config.returnToOriginEnabled || !state.pendingReturnOrigin || !state.returnNotBeforeAt) {
      return false;
    }

    // Every visible player resets the three-minute clear-area clock.
    if (!isReturnCoastClear()) {
      state.lastThreatAt = now;
      state.returnNotBeforeAt = now + getReturnDelayMs();
      return false;
    }

    if (now < state.returnNotBeforeAt) {
      return false;
    }

    if (now - state.lastReturnAttemptAt < normalizeDelayMs(config.returnRetryCooldownMs, 2000)) {
      return false;
    }

    const currentPosition = normalizePosition(bot.getPlayerPosition());
    if (isSamePosition(currentPosition, state.pendingReturnOrigin)) {
      bot.log("panic return completed", {
        origin: state.pendingReturnOrigin,
        threatAgeMs: now - state.lastThreatAt,
      });
      restoreInterruptedModules();
      clearPendingReturn();
      return true;
    }

    state.lastReturnAttemptAt = now;
    const moved =
      !!bot.cave?.goToPosition?.(state.pendingReturnOrigin) ||
      !!bot.pz?.goToTile?.({ __position: state.pendingReturnOrigin });

    if (moved) {
      bot.log("panic returning to origin", {
        origin: state.pendingReturnOrigin,
        threatAgeMs: now - state.lastThreatAt,
      });
      return true;
    }

    bot.log("panic return pathing failed", { origin: state.pendingReturnOrigin });
    return false;
  }

  function triggerPanic(reason, details = {}) {
    const now = Date.now();
    armPendingReturn(now);

    if (now - state.lastTriggerAt < config.triggerCooldownMs) {
      return false;
    }

    state.lastTriggerAt = now;
    bot.playAlarm?.();
    bot.log("panic triggered", { reason, ...details });

    if (bot.cave?.stop) {
      bot.cave.stop({ persistEnabled: false });
    }

    if (bot.rune?.status?.().running) {
      bot.rune.stop({ persistEnabled: false });
      bot.ui?.refreshRuneStatus?.();
    }

    if (bot.equipRing?.stop) {
      bot.equipRing.stop({ persistEnabled: false });
      bot.ui?.refreshEquipRingStatus?.();
    }

    return !!bot.pz?.goToHomePz?.();
  }

  function triggerGameMasterKillSwitch(players) {
    const detectedPlayers = (players || []).map((player) => player?.name).filter(Boolean);

    bot.playAlarm?.();
    bot.log("game master kill switch triggered", { players: detectedPlayers });

    if (bot.rune?.stop) {
      bot.rune.stop();
    }

    if (bot.eat?.stop) {
      bot.eat.stop();
    }

    if (bot.invisible?.stop) {
      bot.invisible.stop();
    }

    if (bot.magicShield?.stop) {
      bot.magicShield.stop();
    }

    if (bot.cave?.stop) {
      bot.cave.stop();
    }

    if (bot.attack?.stop) {
      bot.attack.stop();
    }

    if (bot.equipRing?.stop) {
      bot.equipRing.stop();
    }

    clearPendingReturn();
    config.unknownPlayerEnabled = false;
    config.healthLossEnabled = false;
    persistConfig();
    stop();

    bot.ui?.refreshPanicStatus?.();
    bot.ui?.refreshRuneStatus?.();
    bot.ui?.refreshAutoEatStatus?.();
    bot.ui?.refreshAutoInvisibleStatus?.();
    bot.ui?.refreshAutoMagicShieldStatus?.();
    bot.ui?.refreshAutoAttackStatus?.();
    bot.ui?.refreshCaveStatus?.();
    bot.ui?.refreshEquipRingStatus?.();
    return true;
  }

  function checkGameMasters() {
    if (!getGameMasterNames().length) {
      return false;
    }

    const visibleGameMasters = getVisibleGameMasters();
    if (!visibleGameMasters.length) {
      return false;
    }

    return triggerGameMasterKillSwitch(visibleGameMasters);
  }

  function checkUnknownPlayers() {
    if (!config.unknownPlayerEnabled) {
      return false;
    }

    const unknownPlayers = getUnknownVisiblePlayers();
    if (!unknownPlayers.length) {
      return false;
    }

    return triggerPanic("unknown-player", {
      players: unknownPlayers.map((player) => player.name),
    });
  }

  function checkHealthLoss() {
    if (!config.healthLossEnabled) {
      return false;
    }

    const playerState = bot.getPlayerState();
    const currentHealth = Number(playerState?.health ?? 0);

    if (state.lastHealth == null) {
      state.lastHealth = currentHealth;
      return false;
    }

    const lostHealth = currentHealth < state.lastHealth;
    state.lastHealth = currentHealth;

    if (!lostHealth) {
      return false;
    }

    const latestDamageEvent = getLatestDamageEvent();
    if (latestDamageEvent && latestDamageEvent.key !== state.lastDamageEventKey) {
      state.lastDamageEventKey = latestDamageEvent.key;

      const trustedNames = new Set(getTrustedNames());
      const attackerName = normalizeName(latestDamageEvent.attackerName);

      if (attackerName && trustedNames.has(attackerName)) {
        bot.log("ignored health-loss panic because attacker is trusted", {
          attacker: latestDamageEvent.attackerName,
          amount: latestDamageEvent.amount,
          currentHealth,
        });
        return false;
      }

      return triggerPanic("health-loss", {
        currentHealth,
        attacker: latestDamageEvent.attackerName,
        amount: latestDamageEvent.amount,
      });
    }

    const unknownPlayers = getUnknownVisiblePlayers();
    if (!unknownPlayers.length) {
      const trustedPlayers = getTrustedVisiblePlayers();
      if (trustedPlayers.length) {
        bot.log("ignored health-loss panic because only trusted players are nearby", {
          players: trustedPlayers.map((player) => player.name),
          currentHealth,
        });
        return false;
      }
    }

    return triggerPanic("health-loss", { currentHealth });
  }

  function scheduleNextTick() {
    if (!state.running) return;

    state.timerId = window.setTimeout(() => {
      tick();
    }, config.tickMs);
  }

  function tick() {
    if (!state.running) return;

    try {
      const triggered = checkGameMasters() || checkUnknownPlayers() || checkHealthLoss();
      if (!triggered) {
        tryReturnToOrigin();
      }
    } finally {
      scheduleNextTick();
    }
  }

  function shouldRun() {
    return !!(getGameMasterNames().length || config.unknownPlayerEnabled || config.healthLossEnabled);
  }

  function start() {
    if (state.running) {
      return false;
    }

    state.running = true;
    state.lastHealth = Number(bot.getPlayerState()?.health ?? 0);
    state.lastDamageEventKey = getLatestDamageEvent()?.key || null;
    bot.log("panic runner started", { ...config });
    tick();
    return true;
  }

  function stop() {
    if (!state.running && state.timerId == null) {
      state.lastHealth = null;
      return false;
    }

    state.running = false;

    if (state.timerId != null) {
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }

    state.lastHealth = null;
    state.lastDamageEventKey = null;
    clearPendingReturn();
    bot.log("panic runner stopped");
    return true;
  }

  function syncRunningState() {
    if (shouldRun()) {
      start();
    } else {
      stop();
    }
  }

  function updateConfig(nextConfig = {}) {
    const next = { ...nextConfig };

    if (Array.isArray(next.trustedNames)) {
      next.trustedNames = next.trustedNames
        .map((name) => String(name || "").trim())
        .filter(Boolean);
    }

    if (Array.isArray(next.gameMasterNames)) {
      next.gameMasterNames = next.gameMasterNames
        .map((name) => String(name || "").trim())
        .filter(Boolean);
    }

    if ("triggerCooldownMs" in next) {
      next.triggerCooldownMs = normalizeDelayMs(next.triggerCooldownMs, config.triggerCooldownMs);
    }

    if ("returnDelayMs" in next) {
      next.returnDelayMs = normalizeDelayMs(next.returnDelayMs, config.returnDelayMs);
    }

    if ("returnDelayJitterMs" in next) {
      next.returnDelayJitterMs = normalizeDelayMs(next.returnDelayJitterMs, config.returnDelayJitterMs);
    }

    if ("returnRetryCooldownMs" in next) {
      next.returnRetryCooldownMs = normalizeDelayMs(
        next.returnRetryCooldownMs,
        config.returnRetryCooldownMs
      );
    }

    Object.assign(config, next);
    if (!config.returnToOriginEnabled) {
      clearPendingReturn();
    }
    persistConfig();
    syncRunningState();
    bot.log("panic runner config updated", { ...config });
    return { ...config };
  }

  function status() {
    return {
      running: state.running,
      config: {
        ...config,
        trustedNames: [...config.trustedNames],
        gameMasterNames: [...config.gameMasterNames],
      },
      visiblePlayers: getVisiblePlayers().map((player) => ({
        id: player.id,
        name: player.name,
        position: player.__position || null,
      })),
      unknownVisiblePlayers: getUnknownVisiblePlayers().map((player) => ({
        id: player.id,
        name: player.name,
        position: player.__position || null,
      })),
      trustedVisiblePlayers: getTrustedVisiblePlayers().map((player) => ({
        id: player.id,
        name: player.name,
        position: player.__position || null,
      })),
      visibleGameMasters: getVisibleGameMasters().map((player) => ({
        id: player.id,
        name: player.name,
        position: player.__position || null,
      })),
      latestDamageEvent: getLatestDamageEvent(),
      lastTriggerAt: state.lastTriggerAt,
      pendingReturn: state.pendingReturnOrigin
        ? {
            origin: { ...state.pendingReturnOrigin },
            modules: state.pendingReturnModules ? { ...state.pendingReturnModules } : null,
            returnNotBeforeAt: state.returnNotBeforeAt,
            lastThreatAt: state.lastThreatAt,
            lastReturnAttemptAt: state.lastReturnAttemptAt,
            coastClear: isReturnCoastClear(),
          }
        : null,
    };
  }

  if (shouldRun()) {
    start();
  }

  bot.panic = {
    start,
    stop,
    status,
    updateConfig,
    getVisiblePlayers,
    getUnknownVisiblePlayers,
    getTrustedVisiblePlayers,
    getVisibleGameMasters,
    getTrustedNames,
    getGameMasterNames,
    config,
  };
};
window.__minibiaBotBundle = window.__minibiaBotBundle || {};

window.__minibiaBotBundle.installRuneModule = function installRuneModule(bot) {
  const configStorageKey = "minibiaBot.rune.config";
  const state = {
    running: false,
    timerId: null,
    lastRuneAt: 0,
  };
  let resumeListenersAttached = false;

  const config = Object.assign(
    {
      tickMs: 250,
      minHpPercent: 50,
      minFoodSeconds: 30,
      runeSpellWords: "adori vita vis",
      runeManaCost: 600,
      runeCooldownMs: 3500,
      enabled: false,
    },
    bot.storage.get(configStorageKey, {})
  );
  config.tickMs = 250;

  function persistConfig() {
    bot.storage.set(configStorageKey, { ...config });
  }

  function readStats() {
    const playerState = bot.getPlayerState();

    const hp = playerState
      ? { current: playerState.health ?? 0, max: playerState.maxHealth ?? 0 }
      : null;

    const mana = playerState
      ? { current: playerState.mana ?? 0, max: playerState.maxMana ?? 0 }
      : null;

    const foodText =
      document.querySelector('#skill-window div[skill="food"] .skill')?.textContent?.trim() ||
      null;

    let food = null;
    if (foodText) {
      const match = foodText.match(/^(\d{1,2}):(\d{2})$/);
      food = match
        ? {
            text: foodText,
            seconds: Number(match[1]) * 60 + Number(match[2]),
          }
        : { text: foodText, seconds: null };
    }

    return { hp, mana, food };
  }

  function getGateStatus(now = Date.now()) {
    const { hp, mana, food } = readStats();
    if (!hp || !mana) {
      return {
        hasStats: false,
        enoughHp: false,
        enoughMana: false,
        enoughFood: false,
        cooldownReady: false,
        cooldownRemainingMs: config.runeCooldownMs,
        canMakeRune: false,
      };
    }

    const hpPercent = hp.max > 0 ? (hp.current / hp.max) * 100 : 0;
    const enoughHp = hpPercent >= config.minHpPercent;
    const enoughMana = mana.current >= config.runeManaCost;
    const enoughFood = food?.seconds == null || food.seconds >= config.minFoodSeconds;
    const cooldownElapsedMs = now - state.lastRuneAt;
    const cooldownRemainingMs = Math.max(0, config.runeCooldownMs - cooldownElapsedMs);
    const cooldownReady = cooldownRemainingMs === 0;

    return {
      hasStats: true,
      enoughHp,
      enoughMana,
      enoughFood,
      cooldownReady,
      cooldownRemainingMs,
      canMakeRune: enoughHp && enoughMana && enoughFood && cooldownReady,
    };
  }

  function canMakeRune(now = Date.now()) {
    return getGateStatus(now).canMakeRune;
  }

  function tryMakeRune() {
    if (!canMakeRune()) {
      return false;
    }

    const sent = bot.sendChat(config.runeSpellWords);
    if (sent) {
      state.lastRuneAt = Date.now();
    }

    return sent;
  }

  function scheduleNextTick() {
    if (!state.running) return;

    state.timerId = window.setTimeout(() => {
      tick();
    }, config.tickMs);
  }

  function runImmediateTick() {
    if (!state.running) return;

    if (state.timerId != null) {
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }

    tick();
  }

  function handleResume() {
    if (document.hidden) {
      return;
    }

    runImmediateTick();
  }

  function attachResumeListeners() {
    if (resumeListenersAttached) {
      return;
    }

    document.addEventListener("visibilitychange", handleResume);
    window.addEventListener("focus", handleResume);
    window.addEventListener("pageshow", handleResume);
    resumeListenersAttached = true;
  }

  function detachResumeListeners() {
    if (!resumeListenersAttached) {
      return;
    }

    document.removeEventListener("visibilitychange", handleResume);
    window.removeEventListener("focus", handleResume);
    window.removeEventListener("pageshow", handleResume);
    resumeListenersAttached = false;
  }

  function tick() {
    if (!state.running) return;

    try {
      tryMakeRune();
    } catch (error) {
      bot.log("rune tick failed", error?.message || error);
    } finally {
      scheduleNextTick();
    }
  }

  function start(overrides = {}) {
    Object.assign(config, overrides, { enabled: true });
    config.tickMs = 250;
    persistConfig();

    if (state.running) {
      bot.log("rune maker already running");
      return false;
    }

    state.running = true;
    attachResumeListeners();
    bot.log("rune maker started", { ...config });
    tick();
    return true;
  }

  function stop(options = {}) {
    const shouldPersistEnabled = options.persistEnabled !== false;
    state.running = false;

    if (state.timerId != null) {
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }

    detachResumeListeners();

    if (shouldPersistEnabled) {
      config.enabled = false;
      persistConfig();
    }
    bot.log("rune maker stopped");
    return true;
  }

  function status() {
    return {
      running: state.running,
        config: { ...config },
        stats: readStats(),
        gates: getGateStatus(),
        lastRuneAt: state.lastRuneAt,
      };
  }

  function updateConfig(nextConfig = {}) {
    Object.assign(config, nextConfig);
    config.tickMs = 250;
    persistConfig();
    bot.log("rune config updated", { ...config });
    return { ...config };
  }

  if (config.enabled) {
    start();
  }

  bot.rune = {
    start,
    stop,
    status,
    readStats,
    getGateStatus,
    canMakeRune,
    tryMakeRune,
    config,
    updateConfig,
  };

  bot.startRuneLoop = start;
  bot.stopRuneLoop = stop;
};
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
window.__minibiaBotBundle = window.__minibiaBotBundle || {};

window.__minibiaBotBundle.installAutoInvisibleModule = function installAutoInvisibleModule(bot) {
  const configStorageKey = "minibiaBot.invisible.config";
  const INVISIBLE_CONDITION_ID = 4;
  const state = {
    running: false,
    timerId: null,
    lastCastAt: 0,
  };
  let resumeListenersAttached = false;

  const config = Object.assign(
    {
      tickMs: 500,
      spellWords: "utana vid",
      recastCooldownMs: 2000,
      enabled: false,
    },
    bot.storage.get(configStorageKey, {})
  );
  config.tickMs = 500;

  function persistConfig() {
    bot.storage.set(configStorageKey, { ...config });
  }

  function getInvisibleConditionId() {
    return window.ConditionManager?.prototype?.INVISIBLE ?? INVISIBLE_CONDITION_ID;
  }

  function isInvisibleActive() {
    const player = window.gameClient?.player;
    const conditions = player?.conditions;
    const invisibleConditionId = getInvisibleConditionId();

    if (conditions?.has) {
      return conditions.has(invisibleConditionId);
    }

    if (player?.hasCondition) {
      return player.hasCondition(invisibleConditionId);
    }

    return false;
  }

  function getGateStatus(now = Date.now()) {
    const cooldownRemainingMs = Math.max(0, config.recastCooldownMs - (now - state.lastCastAt));
    const cooldownReady = cooldownRemainingMs === 0;
    const invisibleActive = isInvisibleActive();

    return {
      invisibleActive,
      cooldownReady,
      cooldownRemainingMs,
      canCast: !invisibleActive && cooldownReady,
    };
  }

  function canCastInvisible(now = Date.now()) {
    return getGateStatus(now).canCast;
  }

  function tryCastInvisible(now = Date.now()) {
    if (!config.enabled || !canCastInvisible(now)) {
      return false;
    }

    const sent = bot.sendChat(config.spellWords);
    if (sent) {
      state.lastCastAt = now;
      bot.log("cast invisible spell", { spellWords: config.spellWords });
    }

    return sent;
  }

  function scheduleNextTick() {
    if (!state.running) return;

    state.timerId = window.setTimeout(() => {
      tick();
    }, config.tickMs);
  }

  function runImmediateTick() {
    if (!state.running) return;

    if (state.timerId != null) {
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }

    tick();
  }

  function handleResume() {
    if (document.hidden) {
      return;
    }

    runImmediateTick();
  }

  function attachResumeListeners() {
    if (resumeListenersAttached) {
      return;
    }

    document.addEventListener("visibilitychange", handleResume);
    window.addEventListener("focus", handleResume);
    window.addEventListener("pageshow", handleResume);
    resumeListenersAttached = true;
  }

  function detachResumeListeners() {
    if (!resumeListenersAttached) {
      return;
    }

    document.removeEventListener("visibilitychange", handleResume);
    window.removeEventListener("focus", handleResume);
    window.removeEventListener("pageshow", handleResume);
    resumeListenersAttached = false;
  }

  function tick() {
    if (!state.running) return;

    try {
      tryCastInvisible();
    } catch (error) {
      bot.log("auto invisible tick failed", error?.message || error);
    } finally {
      scheduleNextTick();
    }
  }

  function start(overrides = {}) {
    Object.assign(config, overrides, { enabled: true });
    config.tickMs = 500;
    persistConfig();

    if (state.running) {
      bot.log("auto invisible already running");
      return false;
    }

    state.running = true;
    attachResumeListeners();
    bot.log("auto invisible started", { ...config });
    tick();
    return true;
  }

  function stop(options = {}) {
    const shouldPersistEnabled = options.persistEnabled !== false;
    state.running = false;

    if (state.timerId != null) {
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }

    detachResumeListeners();

    if (shouldPersistEnabled) {
      config.enabled = false;
      persistConfig();
    }

    bot.log("auto invisible stopped");
    return true;
  }

  function status() {
    return {
      running: state.running,
      config: { ...config },
      gates: getGateStatus(),
      lastCastAt: state.lastCastAt,
    };
  }

  function updateConfig(nextConfig = {}) {
    if (Object.prototype.hasOwnProperty.call(nextConfig, "spellWords")) {
      nextConfig.spellWords = String(nextConfig.spellWords || "").trim() || config.spellWords;
    }

    if (Object.prototype.hasOwnProperty.call(nextConfig, "recastCooldownMs")) {
      nextConfig.recastCooldownMs = Math.max(0, Number(nextConfig.recastCooldownMs) || 0);
    }

    Object.assign(config, nextConfig);
    config.tickMs = 500;
    persistConfig();
    bot.log("auto invisible config updated", { ...config });
    return { ...config };
  }

  if (config.enabled) {
    start();
  }

  bot.invisible = {
    start,
    stop,
    status,
    updateConfig,
    isInvisibleActive,
    canCastInvisible,
    tryCastInvisible,
    config,
  };
};
window.__minibiaBotBundle = window.__minibiaBotBundle || {};

window.__minibiaBotBundle.installAutoMagicShieldModule = function installAutoMagicShieldModule(bot) {
  const configStorageKey = "minibiaBot.magicShield.config";
  const MAGIC_SHIELD_FALLBACK_DURATION_MS = 180000;
  const state = {
    running: false,
    timerId: null,
    lastCastAt: 0,
    assumedActiveUntil: 0,
  };
  let resumeListenersAttached = false;

  const config = Object.assign(
    {
      tickMs: 500,
      spellWords: "utamo vita",
      recastCooldownMs: 2000,
      enabled: false,
    },
    bot.storage.get(configStorageKey, {})
  );
  config.tickMs = 500;

  function persistConfig() {
    bot.storage.set(configStorageKey, { ...config });
  }

  function getMagicShieldConditionId() {
    const conditionManagerPrototype = window.ConditionManager?.prototype;
    const playerConditions = window.gameClient?.player?.conditions;
    const candidateKeys = [
      "MAGIC_SHIELD",
      "MANA_SHIELD",
      "MAGICSHIELD",
      "MANASHIELD",
      "UTAMO_VITA",
    ];

    for (const key of candidateKeys) {
      const value = conditionManagerPrototype?.[key] ?? playerConditions?.[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
    }

    return null;
  }

  function isMagicShieldActive(now = Date.now()) {
    const player = window.gameClient?.player;
    const conditions = player?.conditions;
    const magicShieldConditionId = getMagicShieldConditionId();

    if (magicShieldConditionId != null) {
      if (conditions?.has) {
        return conditions.has(magicShieldConditionId);
      }

      if (player?.hasCondition) {
        return player.hasCondition(magicShieldConditionId);
      }
    }

    return now < state.assumedActiveUntil;
  }

  function getGateStatus(now = Date.now()) {
    const cooldownRemainingMs = Math.max(0, config.recastCooldownMs - (now - state.lastCastAt));
    const cooldownReady = cooldownRemainingMs === 0;
    const magicShieldActive = isMagicShieldActive(now);

    return {
      magicShieldActive,
      cooldownReady,
      cooldownRemainingMs,
      canCast: !magicShieldActive && cooldownReady,
    };
  }

  function canCastMagicShield(now = Date.now()) {
    return getGateStatus(now).canCast;
  }

  function tryCastMagicShield(now = Date.now()) {
    if (!config.enabled || !canCastMagicShield(now)) {
      return false;
    }

    const sent = bot.sendChat(config.spellWords);
    if (sent) {
      state.lastCastAt = now;
      state.assumedActiveUntil = now + MAGIC_SHIELD_FALLBACK_DURATION_MS;
      bot.log("cast magic shield spell", { spellWords: config.spellWords });
    }

    return sent;
  }

  function scheduleNextTick() {
    if (!state.running) return;

    state.timerId = window.setTimeout(() => {
      tick();
    }, config.tickMs);
  }

  function runImmediateTick() {
    if (!state.running) return;

    if (state.timerId != null) {
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }

    tick();
  }

  function handleResume() {
    if (document.hidden) {
      return;
    }

    runImmediateTick();
  }

  function attachResumeListeners() {
    if (resumeListenersAttached) {
      return;
    }

    document.addEventListener("visibilitychange", handleResume);
    window.addEventListener("focus", handleResume);
    window.addEventListener("pageshow", handleResume);
    resumeListenersAttached = true;
  }

  function detachResumeListeners() {
    if (!resumeListenersAttached) {
      return;
    }

    document.removeEventListener("visibilitychange", handleResume);
    window.removeEventListener("focus", handleResume);
    window.removeEventListener("pageshow", handleResume);
    resumeListenersAttached = false;
  }

  function tick() {
    if (!state.running) return;

    try {
      tryCastMagicShield();
    } catch (error) {
      bot.log("auto magic shield tick failed", error?.message || error);
    } finally {
      scheduleNextTick();
    }
  }

  function start(overrides = {}) {
    Object.assign(config, overrides, { enabled: true });
    config.tickMs = 500;
    persistConfig();

    if (state.running) {
      bot.log("auto magic shield already running");
      return false;
    }

    state.running = true;
    attachResumeListeners();
    bot.log("auto magic shield started", { ...config });
    tick();
    return true;
  }

  function stop(options = {}) {
    const shouldPersistEnabled = options.persistEnabled !== false;
    state.running = false;

    if (state.timerId != null) {
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }

    detachResumeListeners();

    if (shouldPersistEnabled) {
      config.enabled = false;
      persistConfig();
    }

    bot.log("auto magic shield stopped");
    return true;
  }

  function status() {
    return {
      running: state.running,
      config: { ...config },
      gates: getGateStatus(),
      lastCastAt: state.lastCastAt,
      assumedActiveUntil: state.assumedActiveUntil,
    };
  }

  function updateConfig(nextConfig = {}) {
    if (Object.prototype.hasOwnProperty.call(nextConfig, "spellWords")) {
      nextConfig.spellWords = String(nextConfig.spellWords || "").trim() || config.spellWords;
    }

    if (Object.prototype.hasOwnProperty.call(nextConfig, "recastCooldownMs")) {
      nextConfig.recastCooldownMs = Math.max(0, Number(nextConfig.recastCooldownMs) || 0);
    }

    Object.assign(config, nextConfig);
    config.tickMs = 500;
    persistConfig();
    bot.log("auto magic shield config updated", { ...config });
    return { ...config };
  }

  if (config.enabled) {
    start();
  }

  bot.magicShield = {
    start,
    stop,
    status,
    updateConfig,
    isMagicShieldActive,
    canCastMagicShield,
    tryCastMagicShield,
    config,
  };
};
window.__minibiaBotBundle = window.__minibiaBotBundle || {};

window.__minibiaBotBundle.installAutoAttackModule = function installAutoAttackModule(bot) {
  const configStorageKey = "minibiaBot.attack.config";
  const state = {
    running: false,
    timerId: null,
    lastTargetHotkeyAt: 0,
    lastRuneHotkeyAt: 0,
    engagedTargetId: null,
    combatStartedAt: 0,
    lastChaseAt: 0,
    lastChaseDestinationKey: null,
    lastFollowTargetId: null,
    lastFollowDistance: Number.POSITIVE_INFINITY,
    lastFollowProgressAt: 0,
    lastFollowStallAt: 0,
    skippedTargetIds: new Map(),
    lastRangedPositionKey: null,
    lastRangedProgressAt: 0,
  };

  const storedConfig = bot.storage.get(configStorageKey, {}) || {};
  const config = Object.assign(
    {
      tickMs: 500,
      targetHotbarSlot: 3,
      runeHotbarSlot: null,
      targetCooldownMs: 1200,
      runeCooldownMs: 1200,
      maxTargetDistance: 8,
      meleeMode: true,
      rangedDistance: 3,
      targetPriority: [],
      targetSelectionMode: "proximity",
      onlyPriorityTargets: false,
      enabled: false,
    },
    storedConfig
  );
  if (config.targetHotbarSlot == null && storedConfig.hotbarSlot != null) {
    config.targetHotbarSlot = storedConfig.hotbarSlot;
  }
  config.rangedDistance = normalizeRangedDistance(config.rangedDistance);
  config.targetPriority = normalizeTargetPriority(config.targetPriority);
  config.targetSelectionMode = config.targetSelectionMode === "list" ? "list" : "proximity";
  config.onlyPriorityTargets = !!config.onlyPriorityTargets;

  function normalizeTargetPriority(value) {
    if (!Array.isArray(value)) return [];
    const targets = [];
    const seen = new Set();
    for (const item of value) {
      const name = String(item?.name ?? item ?? "").trim().slice(0, 48);
      const key = name.toLocaleLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      const stance = ["melee", "ranged"].includes(item?.stance) ? item.stance : "default";
      targets.push({ name, stance });
      if (targets.length >= 50) break;
    }
    return targets;
  }

  function normalizeRangedDistance(value) {
    const distance = Math.trunc(Number(value));
    return Number.isFinite(distance) ? Math.min(8, Math.max(2, distance)) : 3;
  }

  function getTargetBehavior(target) {
    const targetName = String(target?.name || "").toLocaleLowerCase();
    const setting = config.targetPriority.find((entry) => entry.name.toLocaleLowerCase() === targetName);
    const stance = setting?.stance === "melee" || setting?.stance === "ranged"
      ? setting.stance
      : config.meleeMode === false ? "ranged" : "melee";
    return { stance, distance: normalizeRangedDistance(config.rangedDistance) };
  }

  function persistConfig() {
    bot.storage.set(configStorageKey, { ...config });
  }

  function normalizeHotbarSlot(slot) {
    const value = Number(slot);
    if (!Number.isFinite(value)) {
      return null;
    }

    const normalized = Math.trunc(value);
    if (normalized < 1 || normalized > 12) {
      return null;
    }

    return normalized;
  }

  function getNearbyMonsters() {
    return bot.xray?.getVisibleMonsters?.({ sameFloorOnly: true }) || [];
  }

  function normalizePosition(value) {
    if (!value) {
      return null;
    }

    const x = Number(value.x);
    const y = Number(value.y);
    const z = Number(value.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return null;
    }

    return {
      x: Math.trunc(x),
      y: Math.trunc(y),
      z: Math.trunc(z),
    };
  }

  function getPositionKey(position) {
    return position ? `${position.x},${position.y},${position.z}` : null;
  }

  function isAdjacentTile(from, to) {
    if (!from || !to || Number(from.z) !== Number(to.z)) {
      return false;
    }

    const dx = Math.abs(Number(from.x) - Number(to.x));
    const dy = Math.abs(Number(from.y) - Number(to.y));
    return (dx !== 0 || dy !== 0) && dx <= 1 && dy <= 1;
  }

  function getTileDistance(from, to) {
    if (!from || !to || Number(from.z) !== Number(to.z)) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.max(
      Math.abs(Number(from.x) - Number(to.x)),
      Math.abs(Number(from.y) - Number(to.y))
    );
  }

  function isSameCreature(left, right) {
    if (!left || !right) {
      return false;
    }

    return left === right || left.id === right.id;
  }

  function findNearbyMonster(creature) {
    if (!creature) {
      return null;
    }

    const nearbyMonsters = getNearbyMonsters();
    return nearbyMonsters.find((monster) => isSameCreature(monster, creature)) || null;
  }

  function findNearbyMonsterById(id) {
    if (id == null) {
      return null;
    }

    return getNearbyMonsters().find((monster) => monster?.id === id) || null;
  }

  function getCurrentTarget() {
    return window.gameClient?.player?.__target || null;
  }

  function getCurrentFollowTarget() {
    return window.gameClient?.player?.__followTarget || null;
  }

  function pruneSkippedTargets(now = Date.now()) {
    for (const [id, expiresAt] of state.skippedTargetIds.entries()) {
      if (expiresAt <= now) {
        state.skippedTargetIds.delete(id);
      }
    }
  }

  function resetFollowProgress() {
    state.lastFollowTargetId = null;
    state.lastFollowDistance = Number.POSITIVE_INFINITY;
    state.lastFollowProgressAt = 0;
    state.lastFollowStallAt = 0;
  }

  function clearEngagedTarget() {
    state.engagedTargetId = null;
    state.combatStartedAt = 0;
    state.lastChaseDestinationKey = null;
    resetFollowProgress();
  }

  function clearCurrentFollowTarget() {
    if (!window.gameClient?.player || typeof window.gameClient.send !== "function") {
      return false;
    }

    if (typeof FollowPacket !== "function") {
      return false;
    }

    if (!getCurrentFollowTarget()) {
      return false;
    }

    window.gameClient.player.setFollowTarget(null);
    window.gameClient.send(new FollowPacket(0));
    return true;
  }

  function clearCurrentTarget() {
    if (!window.gameClient?.player || typeof window.gameClient.send !== "function") {
      return false;
    }

    if (typeof TargetPacket !== "function") {
      return false;
    }

    if (!getCurrentTarget()) {
      return false;
    }

    window.gameClient.player.setTarget(null);
    window.gameClient.send(new TargetPacket(0));
    return true;
  }

  function markCombatActive(now = Date.now()) {
    if (!state.combatStartedAt) {
      state.combatStartedAt = now;
    }
  }

  function getCombatTargetCount() {
    return getEngagedTarget() ? 1 : 0;
  }

  function isCombatActive() {
    if (!config.enabled || !state.running) {
      return false;
    }

    return !!getEngagedTarget();
  }

  function syncCombatState(now = Date.now()) {
    if (isCombatActive()) {
      markCombatActive(now);
      return true;
    }

    state.combatStartedAt = 0;
    return false;
  }

  function getEngagedTarget() {
    const currentTarget = getCurrentTarget();
    if (currentTarget) {
      state.engagedTargetId = currentTarget.id;
      return currentTarget;
    }

    if (state.engagedTargetId == null) {
      return null;
    }

    const followTarget = getCurrentFollowTarget();
    if (followTarget && followTarget.id === state.engagedTargetId) {
      return findNearbyMonster(followTarget) || followTarget;
    }

    const nearbyTarget = findNearbyMonsterById(state.engagedTargetId);
    if (nearbyTarget) {
      return nearbyTarget;
    }

    clearEngagedTarget();
    return null;
  }

  function setCurrentTarget(target) {
    if (!target || !window.gameClient?.player || typeof window.gameClient.send !== "function") {
      return false;
    }

    if (typeof TargetPacket !== "function") {
      return false;
    }

    window.gameClient.player.setTarget(target);
    window.gameClient.send(new TargetPacket(target.id));
    state.engagedTargetId = target.id;
    return true;
  }

  function setCurrentFollowTarget(target) {
    if (!target || !window.gameClient?.player || typeof window.gameClient.send !== "function") {
      return false;
    }

    if (typeof FollowPacket !== "function") {
      return false;
    }

    if (isSameCreature(getCurrentFollowTarget(), target)) {
      return true;
    }

    window.gameClient.player.setFollowTarget(target);
    window.gameClient.send(new FollowPacket(target.id));
    return true;
  }

  function skipTarget(target, reason, now = Date.now(), skipMs = 4000) {
    if (!target?.id) {
      return false;
    }

    const until = now + Math.max(500, Number(skipMs) || 0);
    state.skippedTargetIds.set(target.id, until);

    const clearedTarget = isSameCreature(getCurrentTarget(), target) ? clearCurrentTarget() : false;
    const clearedFollow = isSameCreature(getCurrentFollowTarget(), target) ? clearCurrentFollowTarget() : false;

    if (state.engagedTargetId === target.id) {
      clearEngagedTarget();
    } else if (state.lastFollowTargetId === target.id) {
      resetFollowProgress();
    }

    bot.log("skipping auto attack target", {
      id: target.id,
      name: target.name || "Mob",
      reason,
      skippedForMs: Math.max(500, Number(skipMs) || 0),
      clearedTarget,
      clearedFollow,
    });
    return true;
  }

  function isTargetSkipped(target, now = Date.now()) {
    pruneSkippedTargets(now);
    return !!target?.id && (state.skippedTargetIds.get(target.id) || 0) > now;
  }

  function getMonsterCandidates(now = Date.now()) {
    pruneSkippedTargets(now);

    const playerPosition = normalizePosition(bot.getPlayerPosition());
    const priority = normalizeTargetPriority(config.targetPriority);
    const priorityOrder = new Map(priority.map((target, index) => [target.name.toLocaleLowerCase(), index]));
    return getNearbyMonsters()
      .filter((monster) => !isTargetSkipped(monster, now))
      .filter((monster) => !config.onlyPriorityTargets || priorityOrder.has(String(monster?.name || "").toLocaleLowerCase()))
      .sort((left, right) => {
        if (config.targetSelectionMode === "list") {
          const leftOrder = priorityOrder.get(String(left?.name || "").toLocaleLowerCase()) ?? Number.MAX_SAFE_INTEGER;
          const rightOrder = priorityOrder.get(String(right?.name || "").toLocaleLowerCase()) ?? Number.MAX_SAFE_INTEGER;
          if (leftOrder !== rightOrder) return leftOrder - rightOrder;
        }
        const leftDistance = getTileDistance(playerPosition, normalizePosition(left?.getPosition?.() || left?.__position));
        const rightDistance = getTileDistance(playerPosition, normalizePosition(right?.getPosition?.() || right?.__position));
        return leftDistance - rightDistance || Number(left?.id || 0) - Number(right?.id || 0);
      });
  }

  function hasPriorityTarget(now = Date.now()) {
    if (!state.running || !config.enabled || !normalizeHotbarSlot(config.targetHotbarSlot)) {
      return false;
    }

    const maxDistance = Math.max(1, Number(config.maxTargetDistance) || 8);
    const playerPosition = normalizePosition(bot.getPlayerPosition());
    if (!playerPosition) return false;

    return getMonsterCandidates(now).some((monster) => {
      const position = normalizePosition(monster?.getPosition?.() || monster?.__position);
      return getTileDistance(playerPosition, position) <= maxDistance;
    });
  }

  function shouldGiveUpTarget(target) {
    const maxTargetDistance = Math.max(1, Number(config.maxTargetDistance) || 8);
    const playerPosition = normalizePosition(bot.getPlayerPosition());
    const targetPosition = normalizePosition(target?.getPosition?.() || target?.__position);
    if (!playerPosition || !targetPosition) {
      return false;
    }

    return getTileDistance(playerPosition, targetPosition) > maxTargetDistance;
  }

  function resetTargetIfTooFar() {
    const currentTarget = getCurrentTarget();
    if (currentTarget && shouldGiveUpTarget(currentTarget)) {
      skipTarget(currentTarget, "target too far", Date.now(), 2500);
      bot.log("gave up distant auto attack target", {
        id: currentTarget.id,
        name: currentTarget.name || "Mob",
        position: normalizePosition(currentTarget.getPosition?.() || currentTarget.__position),
        maxTargetDistance: Math.max(1, Number(config.maxTargetDistance) || 8),
      });
      return true;
    }

    const engagedTarget = getEngagedTarget();
    if (engagedTarget && shouldGiveUpTarget(engagedTarget)) {
      skipTarget(engagedTarget, "engaged target too far", Date.now(), 2500);
      bot.log("gave up distant auto attack target", {
        id: engagedTarget.id,
        name: engagedTarget.name || "Mob",
        position: normalizePosition(engagedTarget.getPosition?.() || engagedTarget.__position),
        maxTargetDistance: Math.max(1, Number(config.maxTargetDistance) || 8),
      });
      return true;
    }

    return false;
  }

  function getTileFromPosition(position) {
    if (!position || typeof Position !== "function") {
      return null;
    }

    return window.gameClient?.world?.getTileFromWorldPosition?.(
      new Position(position.x, position.y, position.z)
    ) || null;
  }

  function findReachableAdjacentPosition(targetPosition, playerPosition) {
    if (!targetPosition || !playerPosition) {
      return null;
    }

    const offsets = [
      { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
      { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 },
    ];

    offsets.sort((a, b) => {
      const da = Math.abs(targetPosition.x + a.x - playerPosition.x) +
        Math.abs(targetPosition.y + a.y - playerPosition.y);
      const db = Math.abs(targetPosition.x + b.x - playerPosition.x) +
        Math.abs(targetPosition.y + b.y - playerPosition.y);
      return da - db;
    });

    const pathfinder = window.gameClient?.world?.pathfinder;
    const startTile = getTileFromPosition(playerPosition);
    if (!pathfinder || !startTile || typeof pathfinder.search !== "function") {
      return null;
    }

    for (const offset of offsets) {
      const candidatePosition = {
        x: targetPosition.x + offset.x,
        y: targetPosition.y + offset.y,
        z: targetPosition.z,
      };
      const tile = getTileFromPosition(candidatePosition);
      if (!tile?.isWalkable?.()) {
        continue;
      }

      if (candidatePosition.x === playerPosition.x && candidatePosition.y === playerPosition.y) {
        return candidatePosition;
      }

      try {
        const path = pathfinder.search(startTile, tile);
        if (Array.isArray(path) && path.length > 0) {
          return candidatePosition;
        }
      } catch (error) {
        bot.log("auto attack reachability check failed", {
          ...candidatePosition,
          error: error?.message || error,
        });
        return null;
      }
    }

    return null;
  }

  function findReachableRangedPosition(targetPosition, playerPosition) {
    const pathfinder = window.gameClient?.world?.pathfinder;
    const startTile = getTileFromPosition(playerPosition);
    if (!pathfinder || !startTile || typeof pathfinder.search !== "function") return null;

    const maxDistance = normalizeRangedDistance(config.rangedDistance);
    const minDistance = Math.max(1, maxDistance - 1);
    const candidates = [];
    for (let dx = -maxDistance; dx <= maxDistance; dx += 1) {
      for (let dy = -maxDistance; dy <= maxDistance; dy += 1) {
        const range = Math.max(Math.abs(dx), Math.abs(dy));
        if (range < minDistance || range > maxDistance) continue;
        const position = { x: targetPosition.x + dx, y: targetPosition.y + dy, z: targetPosition.z };
        const tile = getTileFromPosition(position);
        if (!tile?.isWalkable?.()) continue;
        candidates.push({ position, tile });
      }
    }

    candidates.sort((a, b) =>
      getTileDistance(playerPosition, a.position) - getTileDistance(playerPosition, b.position)
    );

    for (const candidate of candidates) {
      try {
        if (pathfinder.search(startTile, candidate.tile)?.length > 0) {
          return candidate.position;
        }
      } catch (error) {
        bot.log("ranged position check failed", error?.message || error);
      }
    }
    return null;
  }

  function syncRangedDistance(now = Date.now()) {
    const target = getEngagedTarget();
    if (!target || getTargetBehavior(target).stance !== "ranged") return false;
    const me = normalizePosition(bot.getPlayerPosition());
    const them = normalizePosition(target?.getPosition?.() || target?.__position);
    if (!target || !me || !them || me.z !== them.z) return false;

    const range = getTileDistance(me, them);
    const maxDistance = normalizeRangedDistance(config.rangedDistance);
    const minDistance = Math.max(1, maxDistance - 1);
    if (range >= minDistance && range <= maxDistance) {
      clearCurrentFollowTarget();
      state.lastRangedProgressAt = 0;
      state.lastRangedPositionKey = null;
      return false;
    }

    const currentKey = getPositionKey(me);
    if (currentKey !== state.lastRangedPositionKey) {
      state.lastRangedPositionKey = currentKey;
      state.lastRangedProgressAt = now;
    } else if (state.lastRangedProgressAt && now - state.lastRangedProgressAt > 8000) {
      state.lastRangedProgressAt = 0;
      return skipTarget(target, "could not reach ranged distance", now, 5000);
    }

    if (now - state.lastChaseAt < 1500) return false;
    const destination = findReachableRangedPosition(them, me);
    if (!destination) {
      if (!state.lastRangedProgressAt) state.lastRangedProgressAt = now;
      return false;
    }

    try {
      clearCurrentFollowTarget();
      window.gameClient.world.pathfinder.findPath(
        bot.getPlayerPosition(), new Position(destination.x, destination.y, destination.z)
      );
      state.lastChaseAt = now;
      bot.log("maintaining ranged distance", { target: target.name, range, destination });
      return true;
    } catch (error) {
      bot.log("ranged movement failed", error?.message || error);
      return false;
    }
  }

  function syncMeleeChase(now = Date.now()) {
    const target = getEngagedTarget();
    if (!target) {
      clearEngagedTarget();
      return false;
    }
    if (getTargetBehavior(target).stance !== "melee") return false;

    const playerPosition = normalizePosition(bot.getPlayerPosition());
    const targetPosition = normalizePosition(target.getPosition?.() || target.__position);
    if (!playerPosition || !targetPosition || playerPosition.z !== targetPosition.z) {
      return false;
    }

    const giveUpDelayMs = Math.max(5000, (Number(config.tickMs) || 0) * 10);

    if (isAdjacentTile(playerPosition, targetPosition)) {
      state.lastChaseDestinationKey = null;
      clearCurrentFollowTarget();
      resetFollowProgress();
      return false;
    }

    const adjacentPosition = findReachableAdjacentPosition(targetPosition, playerPosition);
    if (!adjacentPosition) {
      if (!state.lastFollowStallAt) {
        state.lastFollowStallAt = now;
        return false;
      }

      if (now - state.lastFollowStallAt > giveUpDelayMs) {
        return skipTarget(target, "no reachable adjacent tile", now);
      }

      return false;
    }

    const currentDistance = getTileDistance(playerPosition, targetPosition);
    if (state.lastFollowTargetId !== target.id) {
      state.lastFollowTargetId = target.id;
      state.lastFollowDistance = currentDistance;
      state.lastFollowProgressAt = now;
      state.lastFollowStallAt = 0;
    } else if (currentDistance < state.lastFollowDistance) {
      state.lastFollowDistance = currentDistance;
      state.lastFollowProgressAt = now;
      state.lastFollowStallAt = 0;
    }

    const followed = setCurrentFollowTarget(target);
    if (followed) {
      state.lastChaseAt = now;
      state.lastChaseDestinationKey = getPositionKey(adjacentPosition);
      bot.log("following auto attack target", {
        id: target.id,
        name: target.name || "Mob",
        followTargetId: target.id,
      });
    }

    if (state.lastFollowDistance <= currentDistance) {
      if (!state.lastFollowStallAt) {
        state.lastFollowStallAt = now;
      } else if (now - state.lastFollowStallAt > giveUpDelayMs) {
        return skipTarget(target, "follow made no progress", now);
      }
    }

    return followed;
  }

  function canAttack(now = Date.now()) {
    const slot = normalizeHotbarSlot(config.targetHotbarSlot);
    if (!slot) {
      return false;
    }

    if (now - state.lastTargetHotkeyAt < Math.max(0, Number(config.targetCooldownMs) || 0)) {
      return false;
    }

    const engaged = getEngagedTarget();
    const candidate = engaged || getMonsterCandidates(now)[0] || null;
    if (candidate && getTargetBehavior(candidate).stance === "melee") {
      return getMonsterCandidates(now).length > 0 && !getCurrentTarget();
    }

    return getMonsterCandidates(now).length > 0;
  }

  function triggerAttack(now = Date.now()) {
    if (!canAttack(now)) {
      return false;
    }

    const engagedTarget = getEngagedTarget();
    const preferredTarget = engagedTarget && !isTargetSkipped(engagedTarget, now)
      ? engagedTarget
      : (getMonsterCandidates(now)[0] || null);
    if (preferredTarget && setCurrentTarget(preferredTarget)) {
      state.lastTargetHotkeyAt = now;
      markCombatActive(now);
      bot.log("selected auto attack target", {
        id: preferredTarget.id,
        name: preferredTarget.name || "Mob",
        reason: isSameCreature(preferredTarget, engagedTarget) ? "engaged target" : "nearest candidate",
      });
      return true;
    }

    const currentOrNextTarget = getEngagedTarget() || getMonsterCandidates(now)[0] || null;
    if (currentOrNextTarget && getTargetBehavior(currentOrNextTarget).stance === "melee") {
      return false;
    }

    if (config.onlyPriorityTargets) {
      return false;
    }

    const slot = normalizeHotbarSlot(config.targetHotbarSlot);
    const clicked = bot.clickHotbar(slot - 1);
    if (clicked) {
      const monsters = getNearbyMonsters();
      state.lastTargetHotkeyAt = now;
      markCombatActive(now);
      bot.log("used auto attack target hotkey", {
        slot,
        nearbyMonsters: monsters.map((creature) => creature.name || "Mob"),
      });
    }

    return clicked;
  }

  function canUseRune(now = Date.now()) {
    const slot = normalizeHotbarSlot(config.runeHotbarSlot);
    if (!slot || !getCurrentTarget()) {
      return false;
    }

    if (now - state.lastRuneHotkeyAt < Math.max(0, Number(config.runeCooldownMs) || 0)) {
      return false;
    }

    return true;
  }

  function triggerRune(now = Date.now()) {
    if (!canUseRune(now)) {
      return false;
    }

    const slot = normalizeHotbarSlot(config.runeHotbarSlot);
    const clicked = bot.clickHotbar(slot - 1);
    if (clicked) {
      state.lastRuneHotkeyAt = now;
      markCombatActive(now);
      bot.log("used auto attack rune hotkey", {
        slot,
        target: getCurrentTarget()?.name || "Mob",
      });
    }

    return clicked;
  }

  function tryAttack() {
    if (!config.enabled) {
      return false;
    }

    const now = Date.now();
    if (resetTargetIfTooFar()) {
      return true;
    }

    syncCombatState(now);

    const target = getEngagedTarget();
    const nextTarget = target || getMonsterCandidates(now)[0] || null;
    const targetIsMelee = nextTarget && getTargetBehavior(nextTarget).stance === "melee";

    if (targetIsMelee) {
      const chased = syncMeleeChase(now);
      if (getCurrentTarget()) {
        return false;
      }

      if (chased) {
        return triggerAttack(now) || true;
      }
    }

    if (getCurrentTarget()) {
      const moved = syncRangedDistance(now);
      return triggerRune(now) || moved;
    }

    return triggerAttack(now);
  }

  function scheduleNextTick() {
    if (!state.running) return;

    state.timerId = window.setTimeout(() => {
      tick();
    }, config.tickMs);
  }

  function tick() {
    if (!state.running) return;

    try {
      tryAttack();
    } catch (error) {
      bot.log("auto attack tick failed", error?.message || error);
    } finally {
      scheduleNextTick();
    }
  }

  function start(overrides = {}) {
    Object.assign(config, overrides, { enabled: true });
    persistConfig();

    if (state.running) {
      bot.log("auto attack already running");
      return false;
    }

    state.running = true;
    bot.log("auto attack started", { ...config });
    tick();
    return true;
  }

  function stop(options = {}) {
    const shouldPersistEnabled = options.persistEnabled !== false;
    state.running = false;

    if (state.timerId != null) {
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }

    if (shouldPersistEnabled) {
      config.enabled = false;
      persistConfig();
    }

    clearEngagedTarget();
    state.lastChaseAt = 0;
    state.lastRangedProgressAt = 0;
    state.lastRangedPositionKey = null;
    clearCurrentFollowTarget();
    state.skippedTargetIds.clear();

    bot.log("auto attack stopped");
    return true;
  }

  function status() {
    const combatActive = syncCombatState(Date.now());
    return {
      running: state.running,
      config: { ...config },
      lastTargetHotkeyAt: state.lastTargetHotkeyAt,
      lastRuneHotkeyAt: state.lastRuneHotkeyAt,
      engagedTargetId: state.engagedTargetId,
      combatActive,
      combatStartedAt: state.combatStartedAt || 0,
      combatDurationMs: state.combatStartedAt ? Math.max(0, Date.now() - state.combatStartedAt) : 0,
      targetCount: getCombatTargetCount(),
      lastChaseAt: state.lastChaseAt,
      currentTarget: getCurrentTarget()
        ? {
            id: getCurrentTarget().id,
            name: getCurrentTarget().name,
            type: getCurrentTarget().type,
            position: getCurrentTarget().__position || null,
          }
        : null,
      nearbyMonsters: getNearbyMonsters().map((creature) => ({
        id: creature.id,
        name: creature.name,
        type: creature.type,
        position: creature.__position || null,
      })),
    };
  }

  function updateConfig(nextConfig = {}) {
    if (Object.prototype.hasOwnProperty.call(nextConfig, "targetHotbarSlot")) {
      nextConfig.targetHotbarSlot = normalizeHotbarSlot(nextConfig.targetHotbarSlot) ?? config.targetHotbarSlot;
    }

    if (Object.prototype.hasOwnProperty.call(nextConfig, "runeHotbarSlot")) {
      nextConfig.runeHotbarSlot = normalizeHotbarSlot(nextConfig.runeHotbarSlot);
    }

    if (Object.prototype.hasOwnProperty.call(nextConfig, "maxTargetDistance")) {
      nextConfig.maxTargetDistance = Math.max(1, Math.trunc(Number(nextConfig.maxTargetDistance) || config.maxTargetDistance || 8));
    }

    if (Object.prototype.hasOwnProperty.call(nextConfig, "rangedDistance")) {
      nextConfig.rangedDistance = normalizeRangedDistance(nextConfig.rangedDistance);
    }

    if (Object.prototype.hasOwnProperty.call(nextConfig, "targetPriority")) {
      nextConfig.targetPriority = normalizeTargetPriority(nextConfig.targetPriority);
    }

    if (Object.prototype.hasOwnProperty.call(nextConfig, "targetSelectionMode")) {
      nextConfig.targetSelectionMode = nextConfig.targetSelectionMode === "list" ? "list" : "proximity";
    }

    if (Object.prototype.hasOwnProperty.call(nextConfig, "onlyPriorityTargets")) {
      nextConfig.onlyPriorityTargets = !!nextConfig.onlyPriorityTargets;
    }

    Object.assign(config, nextConfig);
    persistConfig();
    bot.log("auto attack config updated", { ...config });
    return { ...config };
  }

  if (config.enabled) {
    start();
  }

  bot.addCleanup(() => {
    stop({ persistEnabled: false });
  });

  bot.attack = {
    start,
    stop,
    status,
    updateConfig,
    tryAttack,
    canAttack,
    triggerAttack,
    canUseRune,
    triggerRune,
    getNearbyMonsters,
    getMonsterCandidates,
    getTargetBehavior,
    getCurrentTarget,
    getCurrentFollowTarget,
    isCombatActive,
    hasPriorityTarget,
    syncMeleeChase,
    normalizeHotbarSlot,
    config,
  };
};
window.__minibiaBotBundle = window.__minibiaBotBundle || {};

window.__minibiaBotBundle.installCaveModule = function installCaveModule(bot) {
  const configStorageKey = "minibiaBot.cave.config";
  const routeStorageKey = "minibiaBot.cave.route";
  const transitionStorageKey = "minibiaBot.cave.transitions";
  const presetStorageKey = "minibiaBot.cave.presets";
  const defaultPresetName = "Default";
  const minimapOverlayRootId = "minibia-bot-cave-minimap-overlay";
  const minimapOverlayStyleId = "minibia-bot-cave-minimap-overlay-style";
  const ladderItemIds = new Set([1948, 1968]);
  const ropeNamePattern = /\brope\b/i;
  const shovelNamePattern = /\bshovel\b/i;
  const shovelTargetNamePatterns = [
    /\bstone pile\b/i,
    /\bloose stone pile\b/i,
    /\bgravel pile\b/i,
    /\bdirt pile\b/i,
  ];
  const state = {
    running: false,
    timerId: null,
    observerTimerId: null,
    currentIndex: 0,
    direction: 1,
    lastPathAt: 0,
    lastPositionKey: null,
    lastProgressAt: 0,
    lastStairsUseAt: 0,
    lastObservedPosition: null,
    pendingTransitionSource: null,
    pausedForCombat: false,
    bestDistance: Infinity,
    waitingUntil: 0,
    lastError: null,
  };
  const minimapOverlayState = {
    timerId: null,
  };

  const config = Object.assign(
    {
      tickMs: 500,
      repathMs: 1500,
      waypointTolerance: 1,
      routeMode: "pingpong",
      stuckMs: 8000,
      enabled: false,
      activePresetName: defaultPresetName,
    },
    bot.storage.get(configStorageKey, {})
  );
  config.tickMs = 500;

  function normalizePresetName(value) {
    const normalized = String(value || "").trim().replace(/\s+/g, " ");
    return normalized || null;
  }

  function cloneValue(value) {
    return value ? JSON.parse(JSON.stringify(value)) : null;
  }

  function normalizePreset(value) {
    if (!value) {
      return null;
    }

    const name = normalizePresetName(value.name);
    if (!name) {
      return null;
    }

    return {
      name,
      route: normalizeRoute(value.route),
      transitions: normalizeTransitions(value.transitions),
      routeMode: value.routeMode === "loop" ? "loop" : "pingpong",
    };
  }

  function normalizePresets(value) {
    const entries = Array.isArray(value) ? value : [];
    const deduped = new Map();

    entries.map(normalizePreset).filter(Boolean).forEach((preset) => {
      deduped.set(preset.name.toLowerCase(), preset);
    });

    return Array.from(deduped.values());
  }

  let route = normalizeRoute(bot.storage.get(routeStorageKey, []));
  let transitions = normalizeTransitions(bot.storage.get(transitionStorageKey, []));
  let presets = normalizePresets(bot.storage.get(presetStorageKey, []));

  if (!presets.length && (route.length || transitions.length)) {
    presets = [{
      name: defaultPresetName,
      routeMode: config.routeMode,
      route: route.map((waypoint) => cloneValue(waypoint)),
      transitions: transitions.map((transition) => cloneValue(transition)),
    }];
  }

  function getPresetNames() {
    return presets.map((preset) => preset.name);
  }

  function getPresetByName(name) {
    const normalizedName = normalizePresetName(name);
    if (!normalizedName) {
      return null;
    }

    return presets.find((preset) => preset.name.toLowerCase() === normalizedName.toLowerCase()) || null;
  }

  function getActivePresetName() {
    const configuredName = normalizePresetName(config.activePresetName);
    if (configuredName && getPresetByName(configuredName)) {
      return getPresetByName(configuredName).name;
    }

    if (presets.length) {
      return presets[0].name;
    }

    return configuredName || defaultPresetName;
  }

  function persistPresets() {
    bot.storage.set(
      presetStorageKey,
      presets.map((preset) => ({
        name: preset.name,
        routeMode: preset.routeMode,
        route: preset.route.map((waypoint) => ({ ...waypoint })),
        transitions: preset.transitions.map((transition) => cloneValue(transition)),
      }))
    );
  }

  function persistLegacyActivePreset() {
    bot.storage.set(routeStorageKey, route.map((waypoint) => ({ ...waypoint })));
    bot.storage.set(transitionStorageKey, transitions.map((transition) => cloneValue(transition)));
  }

  function setActivePresetName(name) {
    config.activePresetName = normalizePresetName(name) || defaultPresetName;
    persistConfig();
    return config.activePresetName;
  }

  function upsertPreset(name, nextRoute = route, nextTransitions = transitions) {
    const normalizedName = normalizePresetName(name);
    if (!normalizedName) {
      return null;
    }

    const preset = {
      name: normalizedName,
      routeMode: config.routeMode === "loop" ? "loop" : "pingpong",
      route: normalizeRoute(nextRoute).map((waypoint) => cloneValue(waypoint)),
      transitions: normalizeTransitions(nextTransitions).map((transition) => cloneValue(transition)),
    };
    const existingIndex = presets.findIndex((entry) => entry.name.toLowerCase() === normalizedName.toLowerCase());

    if (existingIndex >= 0) {
      presets[existingIndex] = preset;
    } else {
      presets.push(preset);
    }

    persistPresets();
    return preset;
  }

  function persistActivePreset() {
    upsertPreset(getActivePresetName(), route, transitions);
    persistLegacyActivePreset();
  }

  function loadPresetState(name) {
    const preset = getPresetByName(name);
    if (!preset) {
      return null;
    }

    route = normalizeRoute(preset.route);
    transitions = normalizeTransitions(preset.transitions);
    config.routeMode = preset.routeMode;
    resetWaypointProgress();
    state.currentIndex = 0;
    state.direction = 1;
    state.pendingTransitionSource = null;
    setActivePresetName(preset.name);
    persistLegacyActivePreset();
    return preset;
  }

  const initialActivePreset = getActivePresetName();
  if (loadPresetState(initialActivePreset)) {
    config.activePresetName = initialActivePreset;
  } else {
    setActivePresetName(initialActivePreset);
  }

  function persistConfig() {
    bot.storage.set(configStorageKey, { ...config });
  }

  function persistRoute() {
    persistActivePreset();
  }

  function normalizePosition(value) {
    if (!value) {
      return null;
    }

    const x = Number(value.x);
    const y = Number(value.y);
    const z = Number(value.z);
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      return null;
    }

    return {
      x: Math.trunc(x),
      y: Math.trunc(y),
      z: Math.trunc(z),
    };
  }

  function normalizeWaypoint(waypoint) {
    const position = normalizePosition(waypoint);
    if (!position) return null;
    const type = String(waypoint.type || "node").toLowerCase();
    if (!["node", "stand", "walk", "label", "action"].includes(type)) return null;
    const normalized = { ...position, type };
    if (type === "label") {
      normalized.label = String(waypoint.label || "").trim();
      if (!normalized.label) return null;
    }
    if (type === "action") {
      normalized.action = String(waypoint.action || "").trim();
      if (!/^(wait:\d+|skip(?::\d+)?|goto:.+)$/i.test(normalized.action)) return null;
    }
    return normalized;
  }

  function normalizeRoute(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map(normalizeWaypoint).filter(Boolean);
  }

  function normalizeTransition(transition) {
    if (!transition) {
      return null;
    }

    const from = normalizePosition(transition.from || transition);
    const to = normalizePosition(transition.to || {
      x: transition.targetX,
      y: transition.targetY,
      z: transition.targetZ,
    });

    if (!from || !to || from.z === to.z) {
      return null;
    }

    const count = Math.max(1, Math.trunc(Number(transition.count) || 1));
    const lastSeenAt = Math.max(0, Math.trunc(Number(transition.lastSeenAt) || Date.now()));

    return { from, to, count, lastSeenAt };
  }

  function normalizeTransitions(value) {
    if (!Array.isArray(value)) {
      return [];
    }

    const deduped = new Map();
    value.map(normalizeTransition).filter(Boolean).forEach((transition) => {
      deduped.set(getPositionKey(transition.from), transition);
    });
    return Array.from(deduped.values());
  }

  function getRoute() {
    return route.map((waypoint) => cloneValue(waypoint));
  }

  function getTransitions() {
    return transitions.map((transition) => cloneValue(transition));
  }

  function persistTransitions() {
    persistActivePreset();
  }

  function savePreset(name, options = {}) {
    const preset = upsertPreset(name, route, transitions);
    if (!preset) {
      bot.log("cave preset name is required");
      return null;
    }

    if (options.activate !== false) {
      setActivePresetName(preset.name);
      persistLegacyActivePreset();
    }

    bot.log("cave preset saved", {
      name: preset.name,
      waypoints: preset.route.length,
      transitions: preset.transitions.length,
    });
    return {
      name: preset.name,
      route: preset.route.map((waypoint) => cloneValue(waypoint)),
      transitions: preset.transitions.map((transition) => cloneValue(transition)),
    };
  }

  function createPreset(name) {
    const normalizedName = normalizePresetName(name);
    if (!normalizedName) {
      bot.log("cave preset name is required");
      return null;
    }

    if (getPresetByName(normalizedName)) {
      bot.log("cave preset already exists", { name: normalizedName });
      return null;
    }

    if (state.running) {
      stop();
    }

    const preset = upsertPreset(normalizedName, [], []);
    if (!preset) {
      return null;
    }

    loadPresetState(preset.name);
    bot.log("cave preset created", { name: preset.name });
    return {
      name: preset.name,
      route: [],
      transitions: [],
    };
  }

  function loadPreset(name) {
    const preset = getPresetByName(name);
    if (!preset) {
      bot.log("cave preset not found", { name });
      return null;
    }

    if (state.running) {
      stop();
    }

    loadPresetState(preset.name);
    bot.log("cave preset loaded", {
      name: preset.name,
      waypoints: route.length,
      transitions: transitions.length,
    });
    return {
      name: preset.name,
      route: getRoute(),
      transitions: getTransitions(),
    };
  }

  // Shared routes contain movement data only. Never import bot settings or executable code.
  function exportPreset(name = getActivePresetName()) {
    const preset = getPresetByName(name);
    if (!preset) throw new Error("Recorrido no encontrado.");
    if (!preset.route.length) throw new Error("Añade al menos un punto antes de exportar.");
    return JSON.stringify({
      format: "minibia-cave-route",
      version: 1,
      name: preset.name,
      routeMode: preset.routeMode,
      route: preset.route,
      transitions: preset.transitions,
    });
  }

  function importPreset(text) {
    if (typeof text !== "string" || text.length > 500000) {
      throw new Error("El recorrido es demasiado grande o no es texto.");
    }
    let data;
    try { data = JSON.parse(text.trim()); }
    catch { throw new Error("El texto no es un recorrido JSON válido."); }
    if (!data || data.format !== "minibia-cave-route" || data.version !== 1 ||
        !Array.isArray(data.route) || !data.route.length || data.route.length > 3000 ||
        !Array.isArray(data.transitions) || data.transitions.length > 1000 ||
        !["loop", "pingpong"].includes(data.routeMode)) {
      throw new Error("Formato de recorrido no compatible.");
    }
    const importedRoute = normalizeRoute(data.route);
    const importedTransitions = normalizeTransitions(data.transitions);
    if (importedRoute.length !== data.route.length ||
        importedTransitions.length !== data.transitions.length) {
      throw new Error("El recorrido tiene puntos o transiciones inválidos.");
    }
    const base = normalizePresetName(data.name)?.slice(0, 60);
    if (!base) throw new Error("El recorrido necesita un nombre.");
    let name = base;
    for (let number = 2; getPresetByName(name); number += 1) {
      name = `${base.slice(0, 48)} (${number})`;
    }
    if (state.running) stop();
    const preset = upsertPreset(name, importedRoute, importedTransitions);
    preset.routeMode = data.routeMode;
    persistPresets();
    loadPresetState(name);
    bot.log("cave preset imported", { name, waypoints: importedRoute.length });
    return { name, waypoints: importedRoute.length };
  }

  function deletePreset(name) {
    const preset = getPresetByName(name);
    if (!preset) {
      bot.log("cave preset not found", { name });
      return false;
    }

    presets = presets.filter((entry) => entry.name.toLowerCase() !== preset.name.toLowerCase());
    persistPresets();

    if (preset.name.toLowerCase() === getActivePresetName().toLowerCase()) {
      const fallbackPreset = presets[0] || null;
      if (state.running) {
        stop();
      }

      if (fallbackPreset) {
        loadPresetState(fallbackPreset.name);
      } else {
        route = [];
        transitions = [];
        state.currentIndex = 0;
        state.direction = 1;
        state.pendingTransitionSource = null;
        setActivePresetName(defaultPresetName);
        persistLegacyActivePreset();
      }
    }

    bot.log("cave preset deleted", { name: preset.name });
    return true;
  }

  function getCurrentWaypoint() {
    if (!route.length) {
      return null;
    }

    if (state.currentIndex < 0 || state.currentIndex >= route.length) {
      state.currentIndex = 0;
    }

    return route[state.currentIndex] || null;
  }

  function getPositionKey(position) {
    return position ? `${position.x},${position.y},${position.z}` : null;
  }

  function getDistance(from, to) {
    if (!from || !to || Number(from.z) !== Number(to.z)) {
      return Number.POSITIVE_INFINITY;
    }

    return Math.abs(Number(from.x) - Number(to.x)) + Math.abs(Number(from.y) - Number(to.y));
  }

  function isBesideOrSameTile(from, to) {
    if (!from || !to || Number(from.z) !== Number(to.z)) {
      return false;
    }

    return Math.abs(Number(from.x) - Number(to.x)) <= 1 &&
      Math.abs(Number(from.y) - Number(to.y)) <= 1;
  }

  function isAdjacentTile(from, to) {
    if (!from || !to || Number(from.z) !== Number(to.z)) {
      return false;
    }

    const dx = Math.abs(Number(from.x) - Number(to.x));
    const dy = Math.abs(Number(from.y) - Number(to.y));
    return (dx !== 0 || dy !== 0) && dx <= 1 && dy <= 1;
  }

  function getDistanceToWaypoint(position, waypoint) {
    if (!position || !waypoint) {
      return null;
    }

    return getDistance(position, waypoint);
  }

  function isSameTile(a, b) {
    if (!a || !b) {
      return false;
    }

    return Number(a.x) === Number(b.x) &&
      Number(a.y) === Number(b.y) &&
      Number(a.z) === Number(b.z);
  }

  function findClosestWaypointIndex(position) {
    if (!position || !route.length) {
      return 0;
    }

    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    route.forEach((waypoint, index) => {
      if (waypoint.type === "action" || waypoint.type === "label") return;
      const distance = getDistanceToWaypoint(position, waypoint);
      if (!Number.isFinite(distance)) {
        return;
      }

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  function getTileAt(position) {
    if (!position) {
      return null;
    }

    return window.gameClient?.world?.getTileFromWorldPosition?.(
      new Position(position.x, position.y, position.z)
    ) || null;
  }

  function getTilePosition(tile) {
    return normalizePosition(tile?.__position);
  }

  function getThingDefinition(itemId) {
    if (!itemId) {
      return null;
    }

    return (
      window.gameClient?.itemDefinitionsByCid?.[itemId] ||
      window.gameClient?.itemDefinitionsBySid?.[itemId] ||
      window.gameClient?.itemDefinitions?.[itemId] ||
      null
    );
  }

  function getThingName(thing) {
    const definition = getThingDefinition(thing?.id);
    return String(definition?.properties?.name || thing?.name || "").trim().toLowerCase();
  }

  function isLadderThing(thing) {
    if (!thing?.id) {
      return false;
    }

    if (ladderItemIds.has(Number(thing.id))) {
      return true;
    }

    return getThingName(thing).includes("ladder");
  }

  function isFloorChangeThing(thing) {
    const definition = getThingDefinition(thing?.id);
    return !!definition?.properties?.floorchange || isLadderThing(thing);
  }

  function isFloorChangeTile(tile) {
    const tilePosition = getTilePosition(tile);
    if (!tilePosition) {
      return false;
    }

    if (isFloorChangeThing(tile)) {
      return true;
    }

    return Array.isArray(tile.items) && tile.items.some((item) => isFloorChangeThing(item));
  }

  function getTileThings(tile) {
    if (!tile) {
      return [];
    }

    const things = [];
    if (tile.id) {
      things.push(tile);
    }
    if (Array.isArray(tile.items)) {
      tile.items.forEach((item) => {
        if (item) {
          things.push(item);
        }
      });
    }
    return things;
  }

  function tileHasNamedThing(tile, needle) {
    const value = String(needle || "").trim().toLowerCase();
    if (!value) {
      return false;
    }

    return getTileThings(tile).some((thing) => getThingName(thing).includes(value));
  }

  function isLadderTile(tile) {
    return getTileThings(tile).some((thing) => isLadderThing(thing));
  }

  function isStairsTile(tile) {
    return tileHasNamedThing(tile, "stairs");
  }

  function isHoleTile(tile) {
    return tileHasNamedThing(tile, "hole");
  }

  function isRopeSpotTile(tile) {
    return tileHasNamedThing(tile, "rope spot");
  }

  function isRopeTargetTile(tile) {
    return isHoleTile(tile) || isRopeSpotTile(tile);
  }

  function isShovelTargetThing(thing) {
    const name = getThingName(thing);
    if (!name) {
      return false;
    }

    return shovelTargetNamePatterns.some((pattern) => pattern.test(name));
  }

  function isShovelTargetTile(tile) {
    return getTileThings(tile).some((thing) => isShovelTargetThing(thing));
  }

  function isTransitionCandidateTile(tile, waypoint, position) {
    if (!tile) {
      return false;
    }

    if (isFloorChangeTile(tile)) {
      return true;
    }

    const hasWaypointDelta =
      waypoint &&
      position &&
      Number.isFinite(waypoint.z) &&
      Number.isFinite(position.z);

    if (!hasWaypointDelta) {
      return false;
    }

    if (waypoint.z > position.z) {
      return isShovelTargetTile(tile);
    }

    if (waypoint.z < position.z) {
      return isRopeTargetTile(tile);
    }

    return false;
  }

  function getFloorChangeTileBias(tile, position, waypoint) {
    if (!tile || !position || !waypoint || position.z === waypoint.z) {
      return 0;
    }

    const goingDown = waypoint.z > position.z;
    const goingUp = waypoint.z < position.z;

    if (goingDown) {
      if (isLadderTile(tile)) return -30;
      if (isHoleTile(tile)) return -20;
      if (isStairsTile(tile)) return 25;
    }

    if (goingUp) {
      if (isStairsTile(tile)) return -20;
      if (isHoleTile(tile)) return 20;
    }

    return 0;
  }

  function getLoadedTiles() {
    const chunks = window.gameClient?.world?.chunks || [];
    const tiles = [];

    for (const chunk of chunks) {
      if (!chunk?.tiles) continue;

      for (const tile of chunk.tiles) {
        if (tile?.__position) {
          tiles.push(tile);
        }
      }
    }

    return tiles;
  }

  function ensureMinimapOverlayStyle() {
    if (document.getElementById(minimapOverlayStyleId)) {
      return;
    }

    const style = document.createElement("style");
    style.id = minimapOverlayStyleId;
    style.textContent = `
      #${minimapOverlayRootId} {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 999997;
      }

      #${minimapOverlayRootId} canvas {
        position: fixed;
        pointer-events: none;
      }
    `;
    document.head.appendChild(style);
  }

  function ensureMinimapOverlayRoot() {
    let root = document.getElementById(minimapOverlayRootId);
    if (root) {
      return root;
    }

    root = document.createElement("div");
    root.id = minimapOverlayRootId;
    root.innerHTML = '<canvas></canvas>';
    document.body.appendChild(root);
    return root;
  }

  function destroyMinimapOverlayElements() {
    document.getElementById(minimapOverlayRootId)?.remove();
    document.getElementById(minimapOverlayStyleId)?.remove();
  }

  function getMinimapCanvas() {
    return window.gameClient?.renderer?.minimap?.minimap?.canvas || document.getElementById("minimap") || null;
  }

  function getMinimapViewport() {
    const canvas = getMinimapCanvas();
    if (!(canvas instanceof HTMLCanvasElement)) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    return { canvas, rect };
  }

  function getWaypointCanvasPoint(waypoint, viewport, playerPosition, minimap) {
    if (!waypoint || !viewport || !playerPosition || !minimap) {
      return null;
    }

    if (waypoint.z !== minimap.__renderLayer) {
      return null;
    }

    const zoomScale = 1 << (Number(minimap.__zoomLevel) || 0);
    const center = minimap.center || { x: 0, y: 0 };
    const internalWidth = Number(viewport.canvas.width) || 160;
    const internalHeight = Number(viewport.canvas.height) || 160;
    const internalX = (internalWidth / 2) + (waypoint.x - playerPosition.x - Number(center.x || 0)) * zoomScale;
    const internalY = (internalHeight / 2) + (waypoint.y - playerPosition.y - Number(center.y || 0)) * zoomScale;

    return {
      x: internalX * (viewport.rect.width / internalWidth),
      y: internalY * (viewport.rect.height / internalHeight),
    };
  }

  function renderMinimapOverlay() {
    const viewport = getMinimapViewport();
    const minimap = window.gameClient?.renderer?.minimap;
    const playerPosition = normalizePosition(bot.getPlayerPosition());
    const root = ensureMinimapOverlayRoot();
    const canvas = root.querySelector("canvas");

    if (!(canvas instanceof HTMLCanvasElement)) {
      return;
    }

    if (!viewport || !minimap || !playerPosition || !route.length) {
      canvas.width = 0;
      canvas.height = 0;
      return;
    }

    const rect = viewport.rect;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.round(rect.width));
    const height = Math.max(1, Math.round(rect.height));
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth;
      canvas.height = pixelHeight;
    }

    canvas.style.left = `${Math.round(rect.left)}px`;
    canvas.style.top = `${Math.round(rect.top)}px`;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);

    const visibleWaypoints = route
      .map((waypoint, index) => ({
        waypoint,
        index,
        point: getWaypointCanvasPoint(waypoint, viewport, playerPosition, minimap),
      }))
      .filter((entry) => entry.point);

    if (!visibleWaypoints.length) {
      return;
    }

    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";

    for (let index = 1; index < visibleWaypoints.length; index += 1) {
      const previous = visibleWaypoints[index - 1];
      const current = visibleWaypoints[index];
      if (current.index !== previous.index + 1) {
        continue;
      }

      context.strokeStyle = "rgba(92, 228, 196, 0.7)";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(previous.point.x, previous.point.y);
      context.lineTo(current.point.x, current.point.y);
      context.stroke();
    }

    visibleWaypoints.forEach(({ point, index }) => {
      const isCurrent = state.running && index === state.currentIndex;
      const radius = isCurrent ? 7 : 5;

      context.fillStyle = isCurrent ? "#ffcf5a" : "#2bd1c4";
      context.strokeStyle = isCurrent ? "#6a2400" : "#083f49";
      context.lineWidth = 2;
      context.beginPath();
      context.arc(point.x, point.y, radius, 0, Math.PI * 2);
      context.fill();
      context.stroke();

      context.fillStyle = "#ffffff";
      context.font = "bold 11px Verdana, sans-serif";
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillText(String(index + 1), point.x, point.y);
    });

    context.restore();
  }

  function startMinimapOverlay() {
    if (minimapOverlayState.timerId != null) {
      return;
    }

    ensureMinimapOverlayStyle();
    renderMinimapOverlay();
    minimapOverlayState.timerId = window.setInterval(renderMinimapOverlay, 250);
  }

  function stopMinimapOverlay() {
    if (minimapOverlayState.timerId != null) {
      window.clearInterval(minimapOverlayState.timerId);
      minimapOverlayState.timerId = null;
    }

    destroyMinimapOverlayElements();
  }

  function getNearbyTransitionTiles(position, waypoint, radius = 8) {
    if (!position) {
      return [];
    }

    return getLoadedTiles()
      .map((tile) => ({ tile, position: getTilePosition(tile) }))
      .filter((entry) =>
        entry.position &&
        entry.position.z === position.z &&
        Math.abs(entry.position.x - position.x) <= radius &&
        Math.abs(entry.position.y - position.y) <= radius &&
        isTransitionCandidateTile(entry.tile, waypoint, position)
      );
  }

  function findTransitionTileNearPosition(position, waypoint, radius = 1) {
    if (!position) {
      return null;
    }

    let best = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    getNearbyTransitionTiles(position, waypoint, radius).forEach((entry) => {
      const distance = getDistance(position, entry.position);
      if (!Number.isFinite(distance)) {
        return;
      }

      if (distance < bestDistance) {
        bestDistance = distance;
        best = entry;
      }
    });

    return best;
  }

  function findBestKnownTransition(position, waypoint) {
    if (!position || !waypoint) {
      return null;
    }

    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;

    transitions.forEach((transition) => {
      if (transition.from.z !== position.z || transition.to.z !== waypoint.z) {
        return;
      }

      const playerDistance = getDistance(position, transition.from);
      const landingDistance = getDistance(transition.to, waypoint);
      if (!Number.isFinite(playerDistance) || !Number.isFinite(landingDistance)) {
        return;
      }

      const score = playerDistance * 10 + landingDistance;
      if (score < bestScore) {
        bestScore = score;
        best = transition;
      }
    });

    return best;
  }

  function findNearbyTransitionTile(position, waypoint) {
    if (!position || !waypoint) {
      return null;
    }

    const waypointDistance = Math.abs(position.x - waypoint.x) + Math.abs(position.y - waypoint.y);
    const radius = Math.max(4, Math.min(20, waypointDistance + 2));
    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;

    getNearbyTransitionTiles(position, waypoint, radius).forEach((entry) => {
      const playerDistance = getDistance(position, entry.position);
      const tileToWaypointDistance =
        Math.abs(entry.position.x - waypoint.x) + Math.abs(entry.position.y - waypoint.y);
      const score =
        playerDistance * 10 +
        tileToWaypointDistance +
        getFloorChangeTileBias(entry.tile, position, waypoint);

      if (score < bestScore) {
        bestScore = score;
        best = {
          tile: entry.tile,
          position: entry.position,
          playerDistance,
          waypointDistance: tileToWaypointDistance,
        };
      }
    });

    return best;
  }

  function isAtWaypoint(position, waypoint) {
    const distance = getDistanceToWaypoint(position, waypoint);
    if (!Number.isFinite(distance)) {
      return false;
    }

    // Floor-change approach tiles must be reached exactly, even for Node/Walk.
    const nextIndex = config.routeMode === "loop" ? (state.currentIndex + 1) % route.length : state.currentIndex + state.direction;
    const next = route[nextIndex];
    const exact = !["node", "walk"].includes(waypoint.type) || (next && next.z !== waypoint.z);
    return distance <= (exact ? 0 : Math.max(0, Number(config.waypointTolerance) || 0));
  }

  function goToWaypoint(waypoint) {
    const from = bot.getPlayerPosition();
    if (!from || !waypoint) {
      return false;
    }

    const to = new Position(waypoint.x, waypoint.y, waypoint.z);

    try {
      const pathfinder = window.gameClient?.world?.pathfinder;
      if (typeof pathfinder?.findPath !== "function") return false;
      pathfinder.findPath(from, to);
      state.lastPathAt = Date.now();
      bot.log("cave pathing to waypoint", {
        ...waypoint,
        index: state.currentIndex + 1,
        total: route.length,
      });
      return true;
    } catch (error) {
      bot.log("cave pathing failed", { ...waypoint, error: error?.message || error });
      return false;
    }
  }

  function goToPosition(position) {
    if (!position) {
      return false;
    }

    return goToWaypoint(position);
  }

  function markPendingTransitionSource(source) {
    const normalized = normalizePosition(source);
    if (!normalized) {
      return;
    }

    state.pendingTransitionSource = {
      ...normalized,
      at: Date.now(),
    };
  }

  function upsertTransition(from, to) {
    const normalizedFrom = normalizePosition(from);
    const normalizedTo = normalizePosition(to);
    if (!normalizedFrom || !normalizedTo || normalizedFrom.z === normalizedTo.z) {
      return null;
    }

    const key = getPositionKey(normalizedFrom);
    const index = transitions.findIndex((transition) => getPositionKey(transition.from) === key);
    const next = {
      from: normalizedFrom,
      to: normalizedTo,
      count: index >= 0 ? transitions[index].count + 1 : 1,
      lastSeenAt: Date.now(),
    };

    if (index >= 0) {
      transitions[index] = next;
    } else {
      transitions.push(next);
    }

    persistTransitions();
    bot.log("cave learned floor transition", next);
    return cloneValue(next);
  }

  function resolveObservedTransitionSource(previousPosition) {
    const pending = normalizePosition(state.pendingTransitionSource);
    if (pending && pending.z === previousPosition.z) {
      return pending;
    }

    const currentTile = getTileAt(previousPosition);
    if (currentTile && isFloorChangeTile(currentTile)) {
      return previousPosition;
    }

    const nearby = findTransitionTileNearPosition(previousPosition, null, 1);
    if (nearby?.position) {
      return nearby.position;
    }

    return null;
  }

  function observePosition() {
    const current = normalizePosition(bot.getPlayerPosition());
    if (!current) {
      return;
    }

    const previous = state.lastObservedPosition;
    if (previous && !isSameTile(previous, current) && previous.z !== current.z) {
      const source = resolveObservedTransitionSource(previous);
      if (source) {
        upsertTransition(source, current);
      }
      state.pendingTransitionSource = null;
    }

    state.lastObservedPosition = current;
  }

  function getEquipment() {
    return window.gameClient?.player?.equipment || null;
  }

  function getOpenContainers() {
    return Array.from(window.gameClient?.player?.__openedContainers || []);
  }

  function findAdjacentWalkablePosition(targetPosition, playerPosition) {
    if (!targetPosition || !playerPosition) {
      return null;
    }

    const offsets = [
      { x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 },
      { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 },
    ];

    offsets.sort((a, b) => {
      const da = Math.abs(targetPosition.x + a.x - playerPosition.x) +
        Math.abs(targetPosition.y + a.y - playerPosition.y);
      const db = Math.abs(targetPosition.x + b.x - playerPosition.x) +
        Math.abs(targetPosition.y + b.y - playerPosition.y);
      return da - db;
    });

    for (const offset of offsets) {
      const position = new Position(
        targetPosition.x + offset.x,
        targetPosition.y + offset.y,
        targetPosition.z
      );
      const tile = window.gameClient?.world?.getTileFromWorldPosition?.(position);
      if (tile?.isWalkable?.()) {
        return normalizePosition(position);
      }
    }

    return null;
  }

  function isRopeItem(item) {
    const name = getThingName(item);
    return !!name && ropeNamePattern.test(name);
  }

  function isShovelItem(item) {
    const name = getThingName(item);
    return !!name && shovelNamePattern.test(name);
  }

  function findToolSource(predicate) {
    const equipment = getEquipment();

    if (equipment?.slots) {
      for (let slotIndex = 0; slotIndex < equipment.slots.length; slotIndex += 1) {
        const item = equipment.getSlotItem?.(slotIndex);
        if (predicate(item)) {
          return { which: equipment, index: slotIndex, item, location: "equipment" };
        }
      }
    }

    for (const container of getOpenContainers()) {
      const slots = container?.slots || [];
      for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
        const item = container.getSlotItem?.(slotIndex);
        if (predicate(item)) {
          return { which: container, index: slotIndex, item, location: "container" };
        }
      }
    }

    return null;
  }

  function findRopeSource() {
    return findToolSource(isRopeItem);
  }

  function findShovelSource() {
    return findToolSource(isShovelItem);
  }

  function useToolOnTile(tool, targetTile, targetPosition, actionLabel, now = Date.now()) {
    if (!tool || !targetTile || !targetPosition) {
      return false;
    }

    const playerPosition = normalizePosition(bot.getPlayerPosition());
    if (!playerPosition) {
      return false;
    }

    if (!isAdjacentTile(playerPosition, targetPosition)) {
      const adjacentPosition = findAdjacentWalkablePosition(targetPosition, playerPosition);
      if (adjacentPosition) {
        return goToPosition(adjacentPosition);
      }
    }

    window.gameClient?.mouse?.__handleItemUseWith?.(
      { which: tool.which, index: tool.index },
      { which: targetTile, index: 0xFF }
    );
    state.lastStairsUseAt = now;
    state.lastPathAt = now;
    markPendingTransitionSource(targetPosition);
    bot.log(actionLabel, {
      source: targetPosition,
      toolLocation: tool.location,
      toolSlot: tool.index,
      toolName: getThingName(tool.item),
    });
    return true;
  }

  function useRopeOnTile(targetTile, targetPosition, now = Date.now()) {
    return useToolOnTile(
      findRopeSource(),
      targetTile,
      targetPosition,
      "cave roped transition tile",
      now
    );
  }

  function useShovelOnTile(targetTile, targetPosition, now = Date.now()) {
    return useToolOnTile(
      findShovelSource(),
      targetTile,
      targetPosition,
      "cave shoveled transition tile",
      now
    );
  }

  function useFloorChangeTile(target, waypoint, now = Date.now()) {
    const position = normalizePosition(bot.getPlayerPosition());
    const targetPosition = normalizePosition(target?.position);
    const targetTile = target?.tile || (targetPosition ? getTileAt(targetPosition) : null);
    if (!position || !targetPosition || !targetTile) {
      return false;
    }

    if (now - state.lastStairsUseAt < 1200) {
      return true;
    }

    if (waypoint?.z < position.z && isRopeTargetTile(targetTile)) {
      return useRopeOnTile(targetTile, targetPosition, now);
    }

    if (!isFloorChangeTile(targetTile)) {
      if (waypoint?.z > position.z && isShovelTargetTile(targetTile)) {
        return useShovelOnTile(targetTile, targetPosition, now);
      }
      return false;
    }

    if (isLadderTile(targetTile)) {
      window.gameClient?.mouse?.use?.({ which: targetTile, index: 0xFF });
      state.lastStairsUseAt = now;
      state.lastPathAt = now;
      markPendingTransitionSource(targetPosition);
      bot.log("cave used ladder tile", {
        source: targetPosition,
        targetZ: waypoint?.z ?? null,
      });
      return true;
    }

    if (!isSameTile(position, targetPosition)) {
      return goToPosition(targetPosition);
    }

    const currentTile = getTileAt(position);
    if (!currentTile || !isFloorChangeTile(currentTile)) {
      return false;
    }

    window.gameClient?.mouse?.use?.({ which: currentTile, index: 0xFF });
    state.lastStairsUseAt = now;
    state.lastPathAt = now;
    markPendingTransitionSource(position);
    bot.log("cave used floor-change tile", {
      source: position,
      targetZ: waypoint?.z ?? null,
    });
    return true;
  }

  function handleFloorChange(waypoint, now = Date.now()) {
    const position = normalizePosition(bot.getPlayerPosition());
    if (!position || !waypoint || position.z === waypoint.z) {
      return false;
    }

    const visibleCandidate = findNearbyTransitionTile(position, waypoint);
    if (visibleCandidate) {
      const moved = useFloorChangeTile(visibleCandidate, waypoint, now);
      if (moved) {
        bot.log("cave probing visible floor-change tile", {
          tileX: visibleCandidate.position.x,
          tileY: visibleCandidate.position.y,
          tileZ: visibleCandidate.position.z,
          targetZ: waypoint.z,
        });
        return true;
      }
    }

    const knownTransition = findBestKnownTransition(position, waypoint);
    if (knownTransition) {
      const target = {
        tile: getTileAt(knownTransition.from),
        position: knownTransition.from,
      };
      const moved = useFloorChangeTile(target, waypoint, now);
      if (moved) {
        bot.log("cave using learned floor transition", {
          from: knownTransition.from,
          to: knownTransition.to,
          waypoint,
        });
        return true;
      }

      bot.log("cave learned transition unavailable, falling back to live scan", {
        from: knownTransition.from,
        to: knownTransition.to,
        waypoint,
      });
    }
    return false;
  }

  function advanceWaypoint() {
    if (!route.length) {
      return null;
    }

    resetWaypointProgress();
    if (route.length === 1) {
      return route[0];
    }

    let nextIndex = state.currentIndex + state.direction;

    if (config.routeMode === "loop") {
      state.direction = 1;
      nextIndex = (state.currentIndex + 1) % route.length;
    } else if (nextIndex >= route.length) {
      state.direction = -1;
      nextIndex = route.length - 2;
    } else if (nextIndex < 0) {
      state.direction = 1;
      nextIndex = 1;
    }

    state.currentIndex = Math.max(0, Math.min(route.length - 1, nextIndex));

    const nextWaypoint = getCurrentWaypoint();
    bot.log("cave advanced waypoint", {
      index: state.currentIndex + 1,
      total: route.length,
      direction: state.direction,
      waypoint: nextWaypoint,
    });
    return nextWaypoint;
  }

  function resetWaypointProgress(now = Date.now()) {
    state.lastProgressAt = now;
    state.lastPathAt = 0;
    state.bestDistance = Infinity;
    state.waitingUntil = 0;
    state.lastError = null;
  }

  function failRoute(message) {
    stop();
    state.lastError = message;
    bot.log("cave route error", message);
  }

  function runAction(waypoint, now) {
    const [command, ...parts] = waypoint.action.split(":");
    const argument = parts.join(":").trim();
    switch (command.toLowerCase()) {
      case "wait":
        if (!state.waitingUntil) state.waitingUntil = now + Math.min(3600000, Number(argument));
        if (now >= state.waitingUntil) advanceWaypoint();
        break;
      case "skip": {
        const count = Math.max(1, Math.min(route.length, Number(argument) || 1));
        // Skip N following entries as well as the action itself.
        for (let i = 0; i <= count; i += 1) advanceWaypoint();
        break;
      }
      case "goto": {
        const index = route.findIndex(point => point.type === "label" && point.label.toLowerCase() === argument.toLowerCase());
        if (index < 0) { failRoute(`Label no encontrado: ${argument}`); break; }
        state.currentIndex = index;
        resetWaypointProgress(now);
        break;
      }
      default: failRoute(`Acción desconocida: ${waypoint.action}`);
    }
  }

  function trySkipStuckWaypoint(position, waypoint) {
    if (!["node", "walk"].includes(waypoint.type) || route.length < 2) return false;
    let index = state.currentIndex + state.direction;
    if (config.routeMode === "loop") index = (state.currentIndex + 1) % route.length;
    const next = route[index];
    if (!next || !["node", "walk"].includes(next.type) || next.z !== position.z || waypoint.z !== position.z) return false;
    const pathfinder = window.gameClient?.world?.pathfinder;
    const fromTile = getTileAt(position);
    const toTile = getTileAt(next);
    if (!fromTile || !toTile?.isWalkable?.() || typeof pathfinder?.search !== "function") return false;
    const path = isSameTile(position, next) ? [toTile] : pathfinder.search(fromTile, toTile);
    if (!Array.isArray(path) || !path.length) return false;
    bot.log("cave skipped stuck flexible waypoint", { index: state.currentIndex, waypoint });
    advanceWaypoint();
    return true;
  }

  function scheduleNextTick() {
    if (!state.running) return;

    state.timerId = window.setTimeout(() => {
      tick();
    }, config.tickMs);
  }

  function tick() {
    if (!state.running) return;

    try {
      observePosition();

      if (!route.length) {
        stop();
        return;
      }

      const position = normalizePosition(bot.getPlayerPosition());
      const positionKey = getPositionKey(position);
      const now = Date.now();
      const attackStatus = bot.attack?.status?.() || null;
      const shouldPauseForCombat =
        !!bot.attack?.hasPriorityTarget?.(now);

      if (!position) return;
      if (shouldPauseForCombat) {
        if (state.waitingUntil) state.waitingUntil += config.tickMs;
        state.lastProgressAt = now;
        if (!state.pausedForCombat) {
          state.pausedForCombat = true;
          bot.log("cave paused for nearby attack target", {
            combatDurationMs: Number(attackStatus?.combatDurationMs || 0),
            targetCount: Number(attackStatus?.targetCount || 0),
          });
        }
        return;
      }

      if (state.pausedForCombat) {
        state.pausedForCombat = false;
        state.lastProgressAt = now;
        state.bestDistance = Infinity;
        state.lastPathAt = 0;
        bot.log("cave resumed after nearby targets cleared", {
          combatDurationMs: Number(attackStatus?.combatDurationMs || 0),
          targetCount: Number(attackStatus?.targetCount || 0),
        });
      }

      if (positionKey && positionKey !== state.lastPositionKey) {
        state.lastPositionKey = positionKey;
      }

      let waypoint = getCurrentWaypoint();
      if (!waypoint) {
        stop();
        return;
      }

      const distance = getDistanceToWaypoint(position, waypoint);
      if (distance < state.bestDistance) {
        state.bestDistance = distance;
        state.lastProgressAt = now;
      }
      if (isAtWaypoint(position, waypoint)) {
        if (waypoint.type === "action") { runAction(waypoint, now); return; }
        advanceWaypoint();
        return;
      }

      if (waypoint.z !== position.z) {
        handleFloorChange(waypoint, now);
        return;
      }

      if (now - state.lastProgressAt >= Math.max(3000, Number(config.stuckMs) || 8000)) {
        if (trySkipStuckWaypoint(position, waypoint)) return;
        failRoute(`Atascado en punto ${state.currentIndex + 1} (${waypoint.type}). Revisa la ruta.`);
        return;
      }

      const shouldRepath =
        now - state.lastPathAt >= config.repathMs ||
        !state.lastProgressAt ||
        now - state.lastProgressAt >= config.repathMs;

      if (shouldRepath) {
        goToWaypoint(waypoint);
      }
    } catch (error) {
      bot.log("cave tick failed", error?.message || error);
    } finally {
      scheduleNextTick();
    }
  }

  function startObserver() {
    if (state.observerTimerId != null) {
      return;
    }

    state.observerTimerId = window.setInterval(() => {
      try {
        observePosition();
      } catch (error) {
        bot.log("cave observer failed", error?.message || error);
      }
    }, 200);
  }

  function stopObserver() {
    if (state.observerTimerId == null) {
      return;
    }

    window.clearInterval(state.observerTimerId);
    state.observerTimerId = null;
  }

  function start(overrides = {}) {
    Object.assign(config, overrides, { enabled: true });
    config.tickMs = 500;
    persistConfig();

    if (!route.length) {
      bot.log("cave bot cannot start without waypoints");
      return false;
    }

    if (state.running) {
      bot.log("cave bot already running");
      return false;
    }

    const position = normalizePosition(bot.getPlayerPosition());
    state.running = true;
    state.currentIndex = findClosestWaypointIndex(position);
    state.direction = config.routeMode !== "loop" && state.currentIndex >= route.length - 1 ? -1 : 1;
    if (route.length <= 1) {
      state.direction = 1;
    }
    state.lastPathAt = 0;
    state.lastPositionKey = getPositionKey(position);
    resetWaypointProgress();
    state.pausedForCombat = false;
    bot.log("cave bot started", {
      waypoints: route.length,
      currentIndex: state.currentIndex + 1,
      direction: state.direction,
      waypoint: getCurrentWaypoint(),
    });
    tick();
    return true;
  }

  function stop(options = {}) {
    const shouldPersistEnabled = options.persistEnabled !== false;
    state.running = false;

    if (state.timerId != null) {
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }

    if (shouldPersistEnabled) {
      config.enabled = false;
      persistConfig();
    }
    state.pausedForCombat = false;
    bot.log("cave bot stopped");
    return true;
  }

  function addWaypoint(waypoint) {
    const normalized = normalizeWaypoint(waypoint);
    if (!normalized) {
      return null;
    }

    route.push(normalized);
    persistRoute();
    bot.log("cave waypoint added", { ...normalized, total: route.length });
    return cloneValue(normalized);
  }

  function addWaypointCurrentSpot(options = {}) {
    const position = normalizePosition(bot.getPlayerPosition());
    if (!position) {
      bot.log("could not read current position for cave waypoint");
      return null;
    }

    return addWaypoint({ ...position, ...options });
  }

  function clearWaypoints() {
    route = [];
    state.currentIndex = 0;
    state.direction = 1;
    persistRoute();
    bot.log("cave route cleared");

    if (state.running) {
      stop();
    }

    return [];
  }

  function clearTransitions() {
    transitions = [];
    state.pendingTransitionSource = null;
    persistTransitions();
    bot.log("cave learned transitions cleared");
    return [];
  }

  function removeLastWaypoint() {
    if (!route.length) {
      return null;
    }

    const removed = route.pop();
    if (state.currentIndex >= route.length) {
      state.currentIndex = Math.max(0, route.length - 1);
    }
    if (route.length <= 1) {
      state.direction = 1;
    }
    persistRoute();
    bot.log("cave waypoint removed", removed);

    if (!route.length && state.running) {
      stop();
    }

    return removed;
  }

  function setCurrentIndex(index) {
    if (!route.length) {
      state.currentIndex = 0;
      state.direction = 1;
      return 0;
    }

    const nextIndex = Math.max(0, Math.min(route.length - 1, Math.trunc(Number(index) || 0)));
    resetWaypointProgress();
    state.currentIndex = nextIndex;
    state.direction = config.routeMode !== "loop" && nextIndex >= route.length - 1 ? -1 : 1;
    if (route.length <= 1) {
      state.direction = 1;
    }
    return state.currentIndex;
  }

  function status() {
    const position = normalizePosition(bot.getPlayerPosition());
    const waypoint = getCurrentWaypoint();

    return {
      running: state.running,
      config: { ...config },
      route: getRoute(),
      transitions: getTransitions(),
      presetNames: getPresetNames(),
      activePresetName: getActivePresetName(),
      currentIndex: state.currentIndex,
      direction: state.direction,
      currentWaypoint: cloneValue(waypoint),
      distanceToWaypoint: getDistanceToWaypoint(position, waypoint),
      lastPathAt: state.lastPathAt,
      lastProgressAt: state.lastProgressAt,
      pendingTransitionSource: cloneValue(state.pendingTransitionSource),
      pausedForCombat: state.pausedForCombat,
      waitingUntil: state.waitingUntil,
      lastError: state.lastError,
    };
  }

  function updateConfig(nextConfig = {}) {
    Object.assign(config, nextConfig);
    config.routeMode = config.routeMode === "loop" ? "loop" : "pingpong";
    config.tickMs = 500;
    persistConfig();
    persistActivePreset();
    bot.log("cave config updated", { ...config });
    return { ...config };
  }

  startObserver();
  bot.addCleanup(stopObserver);
  startMinimapOverlay();
  bot.addCleanup(stopMinimapOverlay);

  if (config.enabled && route.length) {
    start();
  }

  bot.cave = {
    start,
    stop,
    status,
    updateConfig,
    config,
    getRoute,
    getTransitions,
    getPresetNames,
    getActivePresetName,
    getCurrentWaypoint,
    createPreset,
    savePreset,
    loadPreset,
    exportPreset,
    importPreset,
    deletePreset,
    addWaypoint,
    addWaypointCurrentSpot,
    clearWaypoints,
    clearTransitions,
    removeLastWaypoint,
    setCurrentIndex,
    goToWaypoint,
    goToPosition,
    handleFloorChange,
    findClosestWaypointIndex,
    findRopeSource,
    findShovelSource,
    inspectNearbyTiles: (radius = 1) => {
      const position = normalizePosition(bot.getPlayerPosition());
      if (!position) {
        return [];
      }

      return getLoadedTiles()
        .map((tile) => ({ tile, position: getTilePosition(tile) }))
        .filter((entry) =>
          entry.position &&
          entry.position.z === position.z &&
          Math.abs(entry.position.x - position.x) <= radius &&
          Math.abs(entry.position.y - position.y) <= radius
        )
        .map((entry) => ({
          position: entry.position,
          isFloorChange: isFloorChangeTile(entry.tile),
          isHole: isHoleTile(entry.tile),
          isRopeTarget: isRopeTargetTile(entry.tile),
          isShovelTarget: isShovelTargetTile(entry.tile),
          names: getTileThings(entry.tile).map((thing) => getThingName(thing)).filter(Boolean),
        }));
    },
    isAtWaypoint,
  };
};
window.__minibiaBotBundle = window.__minibiaBotBundle || {};

window.__minibiaBotBundle.installEquipRingModule = function installEquipRingModule(bot) {
  const configStorageKey = "minibiaBot.equipRing.config";
  const RING_SLOT = 8;
  const state = {
    running: false,
    timerId: null,
    lastEquipAt: 0,
  };
  let resumeListenersAttached = false;

  const config = Object.assign(
    {
      tickMs: 1000,
      equipCooldownMs: 1500,
      enabled: false,
    },
    bot.storage.get(configStorageKey, {})
  );
  config.tickMs = 1000;

  function persistConfig() {
    bot.storage.set(configStorageKey, { ...config });
  }

  function getEquipment() {
    return window.gameClient?.player?.equipment || null;
  }

  function getOpenContainers() {
    return Array.from(window.gameClient?.player?.__openedContainers || []);
  }

  function getItemDefinition(item) {
    if (!item) return null;

    return (
      window.gameClient?.itemDefinitionsBySid?.[item.sid] ||
      window.gameClient?.itemDefinitions?.[item.id] ||
      null
    );
  }

  function getItemName(item) {
    const definition = getItemDefinition(item);
    return definition?.properties?.name || item?.name || "";
  }

  function isRingItem(item) {
    if (!item) {
      return false;
    }

    const definition = getItemDefinition(item);
    const slotType = String(
      definition?.properties?.slotType ||
      definition?.properties?.slot ||
      ""
    ).trim().toLowerCase();

    if (slotType === "ring") {
      return true;
    }

    return /\bring\b/i.test(getItemName(item));
  }

  function getEquippedRing() {
    const equipment = getEquipment();
    return equipment?.getSlotItem?.(RING_SLOT) || null;
  }

  function hasEquippedRing() {
    return !!getEquippedRing();
  }

  function findBestRingSource() {
    const equipment = getEquipment();
    if (!equipment) {
      return null;
    }

    let best = null;
    let bestCount = -1;

    const consider = (container, slotIndex, item) => {
      if (!isRingItem(item)) {
        return;
      }

      const count = (typeof item.getCount === "function" ? item.getCount() : item.count) || 1;
      if (count > bestCount) {
        bestCount = count;
        best = { container, slotIndex, item, count, name: getItemName(item) };
      }
    };

    for (let slotIndex = 0; slotIndex < equipment.slots.length; slotIndex += 1) {
      if (slotIndex === RING_SLOT) continue;
      consider(equipment, slotIndex, equipment.getSlotItem(slotIndex));
    }

    getOpenContainers().forEach((container) => {
      (container?.slots || []).forEach((slot, slotIndex) => {
        consider(container, slotIndex, container.getSlotItem(slotIndex));
      });
    });

    return best;
  }

  function getGateStatus(now = Date.now()) {
    const equipment = getEquipment();
    const source = findBestRingSource();
    const cooldownRemainingMs = Math.max(0, config.equipCooldownMs - (now - state.lastEquipAt));

    return {
      hasEquipment: !!equipment,
      hasRingEquipped: hasEquippedRing(),
      hasRingAvailable: !!source,
      cooldownReady: cooldownRemainingMs === 0,
      cooldownRemainingMs,
      source,
      canEquip: !!equipment && !hasEquippedRing() && !!source && cooldownRemainingMs === 0,
    };
  }

  function canEquipRing(now = Date.now()) {
    return getGateStatus(now).canEquip;
  }

  function tryEquipRing(now = Date.now()) {
    if (!config.enabled || !canEquipRing(now)) {
      return false;
    }

    const equipment = getEquipment();
    const source = findBestRingSource();
    if (!equipment || !source) {
      return false;
    }

    const from = {
      which: source.container,
      index: source.slotIndex,
    };
    const to = {
      which: equipment,
      index: RING_SLOT,
    };
    const count = source.count || 1;

    window.gameClient.send(new ItemMovePacket(from, to, count));
    state.lastEquipAt = now;
    bot.log("equipped ring", {
      name: source.name,
      fromContainerId: source.container?.__containerId ?? null,
      fromSlot: source.slotIndex,
    });
    return true;
  }

  function scheduleNextTick() {
    if (!state.running) return;

    state.timerId = window.setTimeout(() => {
      tick();
    }, config.tickMs);
  }

  function runImmediateTick() {
    if (!state.running) return;

    if (state.timerId != null) {
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }

    tick();
  }

  function handleResume() {
    if (document.hidden) {
      return;
    }

    runImmediateTick();
  }

  function attachResumeListeners() {
    if (resumeListenersAttached) {
      return;
    }

    document.addEventListener("visibilitychange", handleResume);
    window.addEventListener("focus", handleResume);
    window.addEventListener("pageshow", handleResume);
    resumeListenersAttached = true;
  }

  function detachResumeListeners() {
    if (!resumeListenersAttached) {
      return;
    }

    document.removeEventListener("visibilitychange", handleResume);
    window.removeEventListener("focus", handleResume);
    window.removeEventListener("pageshow", handleResume);
    resumeListenersAttached = false;
  }

  function tick() {
    if (!state.running) return;

    try {
      tryEquipRing();
    } catch (error) {
      bot.log("equip ring tick failed", error?.message || error);
    } finally {
      scheduleNextTick();
    }
  }

  function start(overrides = {}) {
    Object.assign(config, overrides, { enabled: true });
    config.tickMs = 1000;
    persistConfig();

    if (state.running) {
      bot.log("equip ring already running");
      return false;
    }

    state.running = true;
    attachResumeListeners();
    bot.log("equip ring started", { ...config });
    tick();
    return true;
  }

  function stop(options = {}) {
    const shouldPersistEnabled = options.persistEnabled !== false;
    state.running = false;

    if (state.timerId != null) {
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }

    detachResumeListeners();

    if (shouldPersistEnabled) {
      config.enabled = false;
      persistConfig();
    }
    bot.log("equip ring stopped");
    return true;
  }

  function status() {
    return {
      running: state.running,
      config: { ...config },
      gates: getGateStatus(),
      equippedRing: getEquippedRing(),
      lastEquipAt: state.lastEquipAt,
    };
  }

  function updateConfig(nextConfig = {}) {
    Object.assign(config, nextConfig);
    config.tickMs = 1000;
    persistConfig();
    bot.log("equip ring config updated", { ...config });
    return { ...config };
  }

  if (config.enabled) {
    start();
  }

  bot.equipRing = {
    start,
    stop,
    status,
    updateConfig,
    config,
    getEquippedRing,
    hasEquippedRing,
    findBestRingSource,
    getGateStatus,
    canEquipRing,
    tryEquipRing,
  };
};
window.__minibiaBotBundle = window.__minibiaBotBundle || {};

window.__minibiaBotBundle.installAutoEatModule = function installAutoEatModule(bot) {
  const configStorageKey = "minibiaBot.eat.config";
  const state = {
    running: false,
    timerId: null,
    lastFoodAt: 0,
  };

  const config = Object.assign(
    {
      tickMs: 1000,
      eatCooldownMs: 60000,
      eatHotbarSlot: 10,
      enabled: false,
    },
    bot.storage.get(configStorageKey, {})
  );
  config.tickMs = 1000;

  function persistConfig() {
    bot.storage.set(configStorageKey, { ...config });
  }

  function normalizeHotbarSlot(slot) {
    const value = Number(slot);
    if (!Number.isFinite(value)) {
      return null;
    }

    const normalized = Math.trunc(value);
    if (normalized < 1 || normalized > 12) {
      return null;
    }

    return normalized;
  }

  function readFoodTimer() {
    const foodText =
      document.querySelector('#skill-window div[skill="food"] .skill')?.textContent?.trim() ||
      null;

    if (!foodText) return null;

    const match = foodText.match(/^(\d{1,2}):(\d{2})$/);
    return match
      ? {
          text: foodText,
          seconds: Number(match[1]) * 60 + Number(match[2]),
        }
      : { text: foodText, seconds: null };
  }

  function isSated() {
    const player = window.gameClient?.player;
    const conditions = player?.conditions;

    if (conditions?.has && conditions.SATED != null) {
      return conditions.has(conditions.SATED);
    }

    const food = readFoodTimer();
    if (food?.seconds != null) {
      return food.seconds > 0;
    }

    return true;
  }

  function tryEat() {
    if (!config.enabled) {
      return false;
    }

    if (isSated()) {
      return false;
    }

    if (Date.now() - state.lastFoodAt < config.eatCooldownMs) {
      return false;
    }

    const slot = normalizeHotbarSlot(config.eatHotbarSlot);
    if (!slot) {
      return false;
    }

    const slotIndex = slot - 1;
    const clicked = bot.clickHotbar(slotIndex);

    if (clicked) {
      state.lastFoodAt = Date.now();
      bot.log("used eat hotkey", { slot });
    }

    return clicked;
  }

  function scheduleNextTick() {
    if (!state.running) return;

    state.timerId = window.setTimeout(() => {
      tick();
    }, config.tickMs);
  }

  function tick() {
    if (!state.running) return;

    try {
      tryEat();
    } catch (error) {
      bot.log("auto eat tick failed", error?.message || error);
    } finally {
      scheduleNextTick();
    }
  }

  function start(overrides = {}) {
    Object.assign(config, overrides, { enabled: true });
    config.tickMs = 1000;
    persistConfig();

    if (state.running) {
      bot.log("auto eat already running");
      return false;
    }

    state.running = true;
    bot.log("auto eat started", { eatCooldownMs: config.eatCooldownMs, eatHotbarSlot: config.eatHotbarSlot });
    tick();
    return true;
  }

  function stop(options = {}) {
    const shouldPersistEnabled = options.persistEnabled !== false;
    state.running = false;

    if (state.timerId != null) {
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }

    if (shouldPersistEnabled) {
      config.enabled = false;
      persistConfig();
    }
    bot.log("auto eat stopped");
    return true;
  }

  function status() {
    return {
      running: state.running,
      config: { ...config },
      lastFoodAt: state.lastFoodAt,
      isSated: isSated(),
    };
  }

  function updateConfig(nextConfig = {}) {
    if (Object.prototype.hasOwnProperty.call(nextConfig, "eatHotbarSlot")) {
      nextConfig.eatHotbarSlot = normalizeHotbarSlot(nextConfig.eatHotbarSlot) ?? config.eatHotbarSlot;
    }

    if (Object.prototype.hasOwnProperty.call(nextConfig, "eatCooldownMs")) {
      nextConfig.eatCooldownMs = Math.max(0, Number(nextConfig.eatCooldownMs) || 0);
    }

    Object.assign(config, nextConfig);
    config.tickMs = 1000;
    persistConfig();
    bot.log("auto eat config updated", { ...config });
    return { ...config };
  }

  if (config.enabled) {
    start();
  }

  bot.eat = {
    start,
    stop,
    status,
    updateConfig,
    isSated,
    tryEat,
    normalizeHotbarSlot,
    config,
  };

  bot.startAutoEat = start;
  bot.stopAutoEat = stop;

  if (bot.rune) {
    bot.rune.startAutoEat = start;
    bot.rune.stopAutoEat = stop;
    bot.rune.tryEat = tryEat;
    bot.rune.isSated = isSated;
  }
};
window.__minibiaBotBundle = window.__minibiaBotBundle || {};

window.__minibiaBotBundle.installTalkModule = function installTalkModule(bot) {
  const configStorageKey = "minibiaBot.talk.config";
  const legacyDefaultModels = ["gemini-3-pro-preview", "gemini-2.0-flash"];
  const defaultModel = "gemini-2.5-flash-lite";
  const defaultSystemPrompt =
    "You are a normal Tibia MMORPG player chatting in Minibia in live in-game chat. Every reply must sound like Tibia player chat: casual, brief, informal, fully lowercase, and natural for a real player typing quickly. Use plain text only. Keep it under 90 characters and under 12 words. Prefer short Tibia-style phrasing, light slang, abbreviations, and simple punctuation when natural. Avoid polished grammar, title case, or assistant-like wording. Write like someone typing mid-hunt or while afk for a sec. Never say you are a bot or AI.";
  const defaultGreetingPrompt =
    "Respond to greetings like a Tibia MMORPG player in chat. Be short, casual, friendly, and in-character for fast Tibia-style game chat. Use lowercase. One sentence only. Plain text only.";
  const defaultQuestionPrompt =
    "Respond to questions like a Tibia MMORPG player in chat, but stay vague and noncommittal. Keep it brief, casual, and a little evasive. Use lowercase and do not explain much. One short sentence only. Plain text only. If asked whether you are a bot, reply with no.";
  const defaultStatementPrompt =
    "Respond to statements like a Tibia MMORPG player in chat. Keep it short, casual, reactive, and natural for live Tibia-style game chat. Use lowercase. One sentence only. Plain text only.";
  const minPollMs = 1000;
  const maxMessageAgeMs = 2 * 60 * 1000;
  const state = {
    running: false,
    pending: false,
    timerId: null,
    lastReplyAt: 0,
    seenKeys: [],
    seenSignatures: [],
  };
  const greetingReplies = ["yo", "sup", "hey", "hiya", "yo lol"];
  const agreeReplies = ["true", "fr", "based", "ya", "real"];
  const vagueQuestionReplies = ["maybe", "not sure", "hard to say", "could be"];
  const denyBotReplies = ["no", "nope", "nah"];

  const config = Object.assign(
    {
      enabled: false,
      apiKey: "",
      model: defaultModel,
      pollMs: minPollMs,
      replyCooldownMs: 1500,
      systemPrompt: defaultSystemPrompt,
      greetingPrompt: defaultGreetingPrompt,
      questionPrompt: defaultQuestionPrompt,
      statementPrompt: defaultStatementPrompt,
    },
    bot.storage.get(configStorageKey, {})
  );

  function persistConfig() {
    bot.storage.set(configStorageKey, { ...config });
  }

  function normalizeText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function sanitizeConfig() {
    config.apiKey = String(config.apiKey || "").trim();
    config.model = String(config.model || defaultModel).trim() || defaultModel;
    if (legacyDefaultModels.includes(config.model)) {
      config.model = defaultModel;
    }
    config.pollMs = Math.max(minPollMs, Number(config.pollMs) || minPollMs);
    config.replyCooldownMs = Math.max(0, Number(config.replyCooldownMs) || 1500);
    config.systemPrompt = String(config.systemPrompt || defaultSystemPrompt).trim() || defaultSystemPrompt;
    config.greetingPrompt = String(config.greetingPrompt || defaultGreetingPrompt).trim() || defaultGreetingPrompt;
    config.questionPrompt = String(config.questionPrompt || defaultQuestionPrompt).trim() || defaultQuestionPrompt;
    config.statementPrompt = String(config.statementPrompt || defaultStatementPrompt).trim() || defaultStatementPrompt;
  }

  function trimSeen() {
    const maxSeenEntries = 200;
    if (state.seenKeys.length > maxSeenEntries) {
      state.seenKeys = state.seenKeys.slice(-maxSeenEntries);
    }

    if (state.seenSignatures.length > maxSeenEntries) {
      state.seenSignatures = state.seenSignatures.slice(-maxSeenEntries);
    }
  }

  function getSelfNames() {
    return new Set(
      ["you", bot.getPlayerName?.(), window.gameClient?.player?.name, window.gameClient?.player?.state?.name]
        .map((name) => normalizeText(name))
        .filter(Boolean)
    );
  }

  function extractSenderFromMessage(message) {
    const text = String(message || "").trim();
    if (!text) {
      return { sender: null, body: "" };
    }

    const patterns = [
      /^\[[^\]]+\]\s*([^:\n]{2,40}):\s+(.+)$/i,
      /^([^:\n]{2,40}):\s+(.+)$/i,
      /^([^:\n]{2,40})\s+says:\s+(.+)$/i,
      /^From\s+([^:\n]{2,40}):\s+(.+)$/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return {
          sender: String(match[1] || "").trim() || null,
          body: String(match[2] || "").trim(),
        };
      }
    }

    return { sender: null, body: text };
  }

  function getRawChatEntries() {
    return (window.gameClient?.interface?.channelManager?.channels || []).flatMap((channel) =>
      (channel?.__contents || []).map((entry, index) => ({
        channelName: channel?.name || null,
        entry,
        index,
      }))
    );
  }

  function toChatMessage(rawEntry) {
    const entry = rawEntry?.entry || {};
    const rawMessage = String(entry?.message || entry?.text || "").trim();
    const parsed = extractSenderFromMessage(rawMessage);
    const sender =
      String(entry?.author || entry?.sender || entry?.name || parsed.sender || "").trim() || null;
    const body = String(entry?.text || parsed.body || rawMessage).trim();
    const time = entry?.__time || entry?.time || null;
    const senderType = entry?.type;
    const key = [
      rawEntry?.channelName || "",
      time || "",
      sender || "",
      rawMessage || "",
      rawEntry?.index || 0,
    ].join("|");

    return {
      key,
      channelName: rawEntry?.channelName || null,
      sender,
      body,
      rawMessage,
      time,
      senderType,
    };
  }

  function getChatMessages() {
    return getRawChatEntries().map(toChatMessage).filter((message) => message.body);
  }

  function getMessageTimestamp(message) {
    const rawTime = message?.time;
    if (typeof rawTime === "number" && Number.isFinite(rawTime)) {
      return rawTime < 1e12 ? rawTime * 1000 : rawTime;
    }

    if (rawTime instanceof Date) {
      return rawTime.getTime();
    }

    const parsed = Date.parse(String(rawTime || ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getMessageSignature(message) {
    return [
      normalizeText(message?.channelName),
      normalizeText(message?.sender),
      normalizeText(message?.body || message?.rawMessage),
      String(getMessageTimestamp(message) || ""),
    ].join("|");
  }

  function hasSeenMessage(message) {
    return state.seenKeys.includes(message?.key) || state.seenSignatures.includes(getMessageSignature(message));
  }

  function rememberSeenMessage(message) {
    if (!message) {
      return;
    }

    if (message.key && !state.seenKeys.includes(message.key)) {
      state.seenKeys.push(message.key);
    }

    const signature = getMessageSignature(message);
    if (signature && !state.seenSignatures.includes(signature)) {
      state.seenSignatures.push(signature);
    }

    trimSeen();
  }

  function rememberSeenMessages(messages) {
    messages.forEach((message) => rememberSeenMessage(message));
  }

  function isSelfMessage(message) {
    if (getSelfNames().has(normalizeText(message?.sender))) {
      return true;
    }

    return [message?.body, message?.rawMessage].some((text) => bot.isRecentSentChat?.(text, 20000));
  }

  function isTrustedSender(message) {
    const senderName = normalizeText(message?.sender);
    if (!senderName) {
      return false;
    }

    const trustedNames = bot.panic?.getTrustedNames?.() || [];
    return trustedNames.includes(senderName);
  }

  function isNpcMessage(message) {
    const npcType = window.CONST?.TYPES?.NPC;
    return npcType != null && message?.senderType === npcType;
  }

  function isWithinVisibleRange(me, pos) {
    if (!me || !pos) {
      return false;
    }

    const dx = Math.abs(pos.x - me.x);
    const dy = Math.abs(pos.y - me.y);
    return dx <= 8 && dy <= 6;
  }

  function isSenderVisiblePlayer(message) {
    const me = bot.getPlayerPosition?.();
    const myId = window.gameClient?.player?.id;
    const senderName = normalizeText(message?.sender);
    const playerType = window.CONST?.TYPES?.PLAYER;

    if (!me || !senderName || playerType == null) {
      return false;
    }

    return Object.values(window.gameClient?.world?.activeCreatures || {}).some((creature) => {
      if (!creature) {
        return false;
      }

      if (creature.id === myId || creature.type !== playerType) {
        return false;
      }

      if (normalizeText(creature.name) !== senderName) {
        return false;
      }

      return isWithinVisibleRange(me, creature.__position);
    });
  }

  function getDefaultMessages() {
    return getChatMessages().filter((message) => message.channelName === "Default");
  }

  function getNewestPendingMessage() {
    const pendingMessages = getDefaultMessages().filter((message) => {
      if (!message?.body || !message?.key) {
        return false;
      }

      if (hasSeenMessage(message)) {
        return false;
      }

      if (!message.sender || isSelfMessage(message) || isNpcMessage(message) || isTrustedSender(message)) {
        rememberSeenMessage(message);
        return false;
      }

      const timestamp = getMessageTimestamp(message);
      if (timestamp && Date.now() - timestamp > maxMessageAgeMs) {
        rememberSeenMessage(message);
        return false;
      }

      return true;
    });

    if (!pendingMessages.length) {
      return null;
    }

    return {
      targetMessage: pendingMessages[pendingMessages.length - 1],
      pendingMessages,
    };
  }

  function buildClassifierPrompt(targetMessage, contextMessages) {
    const transcript = contextMessages
      .map((message) => `${message.sender || "player"}: ${message.body}`)
      .join("\n");

    return [
      "Channel: Default",
      "Recent chat:",
      transcript || "(none)",
      "",
      `Last message from ${targetMessage.sender}: ${targetMessage.body}`,
      "Classify the last message as exactly one label:",
      "greeting",
      "question",
      "statement",
      "Reply with the label only.",
    ].join("\n");
  }

  function getTypePrompt(messageType) {
    if (messageType === "greeting") {
      return config.greetingPrompt;
    }

    if (messageType === "question") {
      return config.questionPrompt;
    }

    return config.statementPrompt;
  }

  function buildReplyPrompt(targetMessage, contextMessages, messageType) {
    const transcript = contextMessages
      .map((message) => `${message.sender || "player"}: ${message.body}`)
      .join("\n");

    return [
      config.systemPrompt,
      getTypePrompt(messageType),
      "",
      "Channel: Default",
      `Message type: ${messageType}`,
      "Recent chat:",
      transcript || "(none)",
      "",
      `Last message from ${targetMessage.sender}: ${targetMessage.body}`,
      "Reply with one short sentence only.",
      "Avoid repeating the same wording again and again.",
      "Reply text only:",
    ].join("\n");
  }

  async function generateText(prompt, generationConfig = {}) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": config.apiKey,
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: Object.assign(
            {
              temperature: 0.9,
              topP: 0.95,
              maxOutputTokens: 40,
            },
            generationConfig
          ),
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini request failed (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    return (
      data?.candidates?.[0]?.content?.parts
        ?.map((part) => String(part?.text || ""))
        .join(" ")
        .trim() || ""
    );
  }

  async function classifyMessageType(targetMessage, contextMessages) {
    const rawType = normalizeText(
      await generateText(buildClassifierPrompt(targetMessage, contextMessages), {
        temperature: 0.1,
        topP: 0.8,
        maxOutputTokens: 8,
      })
    );

    if (rawType === "greeting" || rawType === "question" || rawType === "statement") {
      return rawType;
    }

    if (isGreeting(targetMessage?.body)) {
      return "greeting";
    }

    if (/\?/.test(String(targetMessage?.body || ""))) {
      return "question";
    }

    return "statement";
  }

  function sanitizeReply(text) {
    const singleLine = String(text || "")
      .replace(/\s+/g, " ")
      .replace(/^["'`]+|["'`]+$/g, "")
      .trim();

    if (!singleLine) {
      return "";
    }

    const firstSentence = singleLine.split(/(?<=[.!?])\s+/)[0] || singleLine;
    const trimmed = firstSentence.slice(0, 90).trim();
    if (!trimmed) {
      return "";
    }

    if (trimmed === "?") {
      return bot.isRecentSentChat?.("?", 20000) ? "" : "?";
    }

    const styled = trimmed
      .toLowerCase()
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\bi am\b/g, "im")
      .replace(/\byou are\b/g, "youre")
      .replace(/\bdo not\b/g, "dont")
      .replace(/\bcannot\b/g, "cant")
      .replace(/\bgoing to\b/g, "gonna")
      .replace(/\bwant to\b/g, "wanna")
      .replace(/\s+([,.!?])/g, "$1")
      .replace(/([!?.,]){2,}/g, "$1")
      .trim();

    const normalized = normalizeText(styled);
    if (!normalized || /^[^a-z0-9]+$/i.test(styled)) {
      return "";
    }

    if (/\b(bot|ai|assistant|language model|automation|script)\b/i.test(styled)) {
      return "";
    }

    if (bot.isRecentSentChat?.(styled, 20000)) {
      return "";
    }

    return styled;
  }

  function pickUnusedReply(replies, withinMs = 30000, fallback = "?") {
    for (const reply of replies) {
      if (!bot.isRecentSentChat?.(reply, withinMs)) {
        return reply;
      }
    }

    return fallback;
  }

  function isGreeting(text) {
    return /^(hi|hey|yo|sup|howdy|hello|hiya)\b/i.test(String(text || "").trim());
  }

  function isBotQuestion(text) {
    return /\b(are you|u)\b.*\bbot\b|\bbot\b.*\?|\bare you a bot\b/i.test(String(text || ""));
  }

  function isSimpleReaction(text) {
    return /^(based|true|real|lol|lmao|xd|nice|ok|kk|k)\b[!.?]*$/i.test(String(text || "").trim());
  }

  function pickFallbackReply(targetMessage, messageType) {
    const messageText = String(targetMessage?.body || "").trim();

    if (isBotQuestion(messageText)) {
      return pickUnusedReply(denyBotReplies, 30000, "no");
    }

    if (messageType === "greeting" || isGreeting(messageText)) {
      return pickUnusedReply(greetingReplies, 15000, "yo");
    }

    if (isSimpleReaction(messageText)) {
      return pickUnusedReply(agreeReplies, 15000, "true");
    }

    if (messageType === "question" || /\?$/.test(messageText)) {
      return pickUnusedReply(vagueQuestionReplies, 20000, "maybe");
    }

    return pickUnusedReply(["lol", "maybe", "ya", "true", "kinda"], 30000, "lol");
  }

  async function maybeRespond() {
    if (!state.running || state.pending || !config.enabled || !config.apiKey) {
      return false;
    }

    if (Date.now() - state.lastReplyAt < config.replyCooldownMs) {
      return false;
    }

    const pending = getNewestPendingMessage();
    if (!pending?.targetMessage) {
      return false;
    }

    state.pending = true;

    try {
      const contextMessages = getDefaultMessages().slice(-6);
      if (!isSenderVisiblePlayer(pending.targetMessage)) {
        rememberSeenMessages(pending.pendingMessages);
        bot.log("talk skipped reply", {
          sender: pending.targetMessage.sender,
          message: pending.targetMessage.body,
          reason: "sender-not-visible",
        });
        return false;
      }

      const messageType = await classifyMessageType(pending.targetMessage, contextMessages);
      const rawReply = isBotQuestion(pending.targetMessage.body)
        ? "no"
        : await generateText(buildReplyPrompt(pending.targetMessage, contextMessages, messageType));
      const reply = sanitizeReply(rawReply) || pickFallbackReply(pending.targetMessage, messageType);

      rememberSeenMessages(pending.pendingMessages);

      if (!reply) {
        bot.log("talk skipped reply", {
          sender: pending.targetMessage.sender,
          message: pending.targetMessage.body,
          messageType,
          rawReply,
        });
        return false;
      }

      const sent = bot.sendChat(reply);
      if (sent) {
        state.lastReplyAt = Date.now();
        bot.log("talk replied", {
          sender: pending.targetMessage.sender,
          message: pending.targetMessage.body,
          messageType,
          reply,
        });
      }

      return sent;
    } finally {
      state.pending = false;
    }
  }

  function scheduleNextTick() {
    if (!state.running) {
      return;
    }

    state.timerId = window.setTimeout(async () => {
      try {
        await maybeRespond();
      } catch (error) {
        bot.log("talk request failed", error?.message || error);
      }

      scheduleNextTick();
    }, config.pollMs);
  }

  function seedSeenMessages() {
    rememberSeenMessages(getDefaultMessages());
  }

  function start(overrides = {}) {
    Object.assign(config, overrides, { enabled: true });
    sanitizeConfig();
    persistConfig();

    if (!config.apiKey) {
      bot.log("talk module requires a Gemini API key");
      return false;
    }

    if (state.running) {
      return false;
    }

    state.running = true;
    seedSeenMessages();
    bot.log("talk module started", {
      model: config.model,
      channel: "Default",
    });
    scheduleNextTick();
    return true;
  }

  function stop(options = {}) {
    const shouldPersistEnabled = options.persistEnabled !== false;
    state.running = false;

    if (shouldPersistEnabled) {
      config.enabled = false;
      persistConfig();
    }

    if (state.timerId != null) {
      window.clearTimeout(state.timerId);
      state.timerId = null;
    }

    return true;
  }

  function status() {
    return {
      running: state.running,
      pending: state.pending,
      lastReplyAt: state.lastReplyAt,
      config: {
        ...config,
        apiKey: config.apiKey ? "***configured***" : "",
      },
    };
  }

  function updateConfig(nextConfig = {}) {
    Object.assign(config, nextConfig);
    sanitizeConfig();
    persistConfig();
    return status().config;
  }

  sanitizeConfig();

  if (config.enabled && config.apiKey) {
    start();
  }

  bot.talk = {
    start,
    stop,
    status,
    updateConfig,
    getChatMessages,
    config,
  };
};
window.__minibiaBotBundle = window.__minibiaBotBundle || {};

window.__minibiaBotBundle.installPanel = function installPanel(bot) {
  const panelPositionKey = "minibiaBot.ui.panelPosition";
  const panelCollapsedKey = "minibiaBot.ui.panelCollapsed";
  const mobileTabKey = "minibiaBot.ui.mobileTab";

  function destroy() {
    document.getElementById("minibia-bot-panel")?.remove();
    document.getElementById("minibia-bot-style")?.remove();
  }

  function savePanelPosition(position, key = panelPositionKey) {
    bot.storage.set(key, position);
  }

  function getSavedPanelPosition(key = panelPositionKey) {
    return bot.storage.get(key, null);
  }

  function savePanelCollapsed(collapsed) {
    bot.storage.set(panelCollapsedKey, !!collapsed);
  }

  function getSavedPanelCollapsed() {
    return !!bot.storage.get(panelCollapsedKey, true);
  }

  function refreshHomeLabel() {
    const homeLabel = document.getElementById("minibia-bot-home");
    if (!homeLabel) return;

    const home = bot.pz?.getHomePz?.();
    homeLabel.textContent = home
      ? `Punto de regreso: ${home.x}, ${home.y}, piso ${home.z}`
      : "Punto de regreso: sin configurar";
  }

  function refreshPanicStatus() {
    const unknownToggle = document.getElementById("minibia-bot-panic-unknown");
    const healthToggle = document.getElementById("minibia-bot-panic-health");
    const returnToggle = document.getElementById("minibia-bot-panic-return");
    const status = bot.panic?.status?.();

    if (unknownToggle) {
      unknownToggle.checked = !!status?.config?.unknownPlayerEnabled;
    }

    if (healthToggle) {
      healthToggle.checked = !!status?.config?.healthLossEnabled;
    }

    if (returnToggle) {
      returnToggle.checked = !!status?.config?.returnToOriginEnabled;
    }
  }

  function refreshXrayStatus() {
    const status = bot.xray?.status?.();
    const me = bot.getPlayerPosition?.();
    const overlayButton = document.getElementById("minibia-bot-xray-overlay-toggle");
    const overlayLabel = document.getElementById("minibia-bot-xray-overlay-status");
    const floorSelect = document.getElementById("minibia-bot-xray-floor-select");
    const formatFloorOffset = (floor) => {
      if (!me || floor == null) {
        return null;
      }

      const offset = me.z - floor;
      return offset === 0 ? "0" : offset > 0 ? `+${offset}` : `${offset}`;
    };

    if (overlayButton) {
      overlayButton.textContent = status?.config?.overlayEnabled ? "Ocultar radar" : "Mostrar radar";
    }

    if (overlayLabel) {
      const floorLabel = status?.config?.selectedFloor == null
        ? "todos los pisos"
        : `${formatFloorOffset(status.config.selectedFloor) ?? "?"}`;
      overlayLabel.textContent = `${status?.config?.overlayEnabled ? "Radar activo" : "Radar oculto"} · ${floorLabel}`;
    }

    if (floorSelect) {
      const floors = Array.from(
        new Set(
          (status?.visibleCreatures || [])
            .map((creature) => creature?.position?.z)
            .filter((floor) => floor != null)
        )
      ).sort((a, b) => a - b);
      const selectedFloor = status?.config?.selectedFloor;

      if (selectedFloor != null && !floors.includes(selectedFloor)) {
        floors.push(selectedFloor);
        floors.sort((a, b) => a - b);
      }

      floorSelect.innerHTML = "";

      const allOption = document.createElement("option");
      allOption.value = "all";
      allOption.textContent = "Todos los pisos";
      floorSelect.appendChild(allOption);

      floors.forEach((floor) => {
        const option = document.createElement("option");
        option.value = String(floor);
        const offsetLabel = formatFloorOffset(floor);
        option.textContent = offsetLabel == null
          ? String(floor)
          : offsetLabel;
        floorSelect.appendChild(option);
      });

      floorSelect.value = selectedFloor == null ? "all" : String(selectedFloor);
    }
  }

  function renderTrustedNames() {
    const list = document.getElementById("minibia-bot-panic-trusted-list");
    if (!list) return;

    const trustedNames = bot.panic?.config?.trustedNames || [];
    list.innerHTML = "";

    if (!trustedNames.length) {
      const empty = document.createElement("div");
      empty.className = "mb-small-note";
      empty.textContent = "Aún no hay jugadores de confianza.";
      list.appendChild(empty);
      return;
    }

    trustedNames.forEach((name, index) => {
      const row = document.createElement("div");
      row.className = "mb-list-row";

      const label = document.createElement("span");
      label.textContent = name;

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "mb-small-button";
      removeButton.textContent = "Quitar";
      removeButton.addEventListener("click", () => {
        const nextNames = trustedNames.filter((_, currentIndex) => currentIndex !== index);
        bot.panic.updateConfig({ trustedNames: nextNames });
        renderTrustedNames();
      });

      row.appendChild(label);
      row.appendChild(removeButton);
      list.appendChild(row);
    });
  }

  function renderGameMasterNames() {
    const list = document.getElementById("minibia-bot-panic-gm-list");
    if (!list) return;

    const gameMasterNames = bot.panic?.config?.gameMasterNames || [];
    list.innerHTML = "";

    if (!gameMasterNames.length) {
      const empty = document.createElement("div");
      empty.className = "mb-small-note";
      empty.textContent = "Aún no hay nombres guardados.";
      list.appendChild(empty);
      return;
    }

    gameMasterNames.forEach((name, index) => {
      const row = document.createElement("div");
      row.className = "mb-list-row";

      const label = document.createElement("span");
      label.textContent = name;

      const removeButton = document.createElement("button");
      removeButton.type = "button";
      removeButton.className = "mb-small-button";
      removeButton.textContent = "Quitar";
      removeButton.addEventListener("click", () => {
        const nextNames = gameMasterNames.filter((_, currentIndex) => currentIndex !== index);
        bot.panic.updateConfig({ gameMasterNames: nextNames });
        renderGameMasterNames();
      });

      row.appendChild(label);
      row.appendChild(removeButton);
      list.appendChild(row);
    });
  }

  function refreshRuneStatus() {
    const runeToggle = document.getElementById("minibia-bot-rune-enabled");
    const running = !!bot.rune?.status?.().running;

    if (runeToggle) {
      runeToggle.checked = running;
    }
  }

  function refreshAutoEatStatus() {
    const autoEatToggle = document.getElementById("minibia-bot-auto-eat-enabled");
    if (!autoEatToggle) return;

    autoEatToggle.checked = !!bot.eat?.status?.().running;
  }

  function refreshAutoHealStatus() {
    const autoHealToggle = document.getElementById("minibia-bot-auto-heal-enabled");
    if (!autoHealToggle) return;

    autoHealToggle.checked = !!bot.heal?.status?.().running;
  }

  function refreshAutoInvisibleStatus() {
    const autoInvisibleToggle = document.getElementById("minibia-bot-auto-invisible-enabled");
    if (!autoInvisibleToggle) return;

    autoInvisibleToggle.checked = !!bot.invisible?.status?.().running;
  }

  function refreshAutoMagicShieldStatus() {
    const autoMagicShieldToggle = document.getElementById("minibia-bot-auto-magic-shield-enabled");
    if (!autoMagicShieldToggle) return;

    autoMagicShieldToggle.checked = !!bot.magicShield?.status?.().running;
  }

  function refreshAutoAttackStatus() {
    const autoAttackToggle = document.getElementById("minibia-bot-auto-attack-enabled");
    if (!autoAttackToggle) return;

    const status = bot.attack?.status?.() || {};
    autoAttackToggle.checked = !!status.running;
    const summary = document.getElementById("minibia-bot-auto-attack-status");
    if (!summary) return;

    const targetName = status.currentTarget?.name;
    const nearbyCount = Array.isArray(status.nearbyMonsters) ? status.nearbyMonsters.length : 0;
    summary.dataset.active = String(!!status.running);
    summary.textContent = !status.running
      ? "Detenido"
      : targetName
        ? `Atacando: ${targetName}`
        : nearbyCount
          ? `Buscando objetivo · ${nearbyCount} criatura${nearbyCount === 1 ? "" : "s"} cerca`
          : "Activo · esperando criaturas cercanas";
  }

  function refreshAttackTargetList() {
    const list = document.getElementById("minibia-bot-attack-target-list");
    if (!list) return;
    const targets = Array.isArray(bot.attack?.config?.targetPriority) ? bot.attack.config.targetPriority : [];
    const count = document.getElementById("minibia-bot-attack-target-count");
    const onlyListed = document.getElementById("minibia-bot-attack-only-listed");
    const selection = document.getElementById("minibia-bot-attack-selection");
    if (count) count.textContent = String(targets.length);
    if (onlyListed) onlyListed.checked = !!bot.attack?.config?.onlyPriorityTargets;
    if (selection) selection.value = bot.attack?.config?.targetSelectionMode === "list" ? "list" : "proximity";

    list.replaceChildren();
    if (!targets.length) {
      const empty = document.createElement("div");
      empty.className = "mb-attack-empty";
      empty.textContent = "Sin prioridades; por defecto elige el objetivo más cercano.";
      list.appendChild(empty);
      return;
    }

    targets.forEach((target, index) => {
      const name = target.name;
      const row = document.createElement("div");
      row.className = "mb-attack-target-row";
      row.setAttribute("role", "listitem");
      const rank = document.createElement("span");
      rank.className = "mb-attack-target-rank";
      rank.textContent = String(index + 1);
      const label = document.createElement("span");
      label.className = "mb-attack-target-name";
      label.textContent = name;
      row.append(rank, label);
      const stance = document.createElement("select");
      stance.className = "mb-attack-target-stance";
      stance.dataset.attackPriorityStanceIndex = String(index);
      stance.setAttribute("aria-label", `Modo de combate para ${name}`);
      [
        ["default", "General"],
        ["melee", "Cerca"],
        ["ranged", "Lejos"],
      ].forEach(([value, text]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = text;
        stance.appendChild(option);
      });
      stance.value = target.stance || "default";
      const controls = document.createElement("span");
      controls.className = "mb-attack-target-controls";
      [["up", "↑", "Subir"], ["down", "↓", "Bajar"], ["remove", "×", "Quitar"]].forEach(([action, glyph, verb]) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "mb-attack-row-action";
        button.dataset.attackPriorityAction = action;
        button.dataset.attackPriorityIndex = String(index);
        button.textContent = glyph;
        button.setAttribute("aria-label", `${verb} ${name}`);
        button.title = `${verb} ${name}`;
        button.disabled = (action === "up" && index === 0) || (action === "down" && index === targets.length - 1);
        controls.appendChild(button);
      });
      row.append(stance, controls);
      list.appendChild(row);
    });
  }

  function refreshAttackVisibleList() {
    const list = document.getElementById("minibia-bot-attack-visible-list");
    if (!list) return;
    const monsters = bot.attack?.status?.().nearbyMonsters || [];
    const priority = new Set((bot.attack?.config?.targetPriority || []).map((target) => String(target.name).toLocaleLowerCase()));
    const names = [...new Set(monsters.map((monster) => String(monster?.name || "").trim()).filter(Boolean))]
      .filter((name) => !priority.has(name.toLocaleLowerCase()));
    const signature = names.join("\u0000");
    if (list.dataset.signature === signature) return;
    list.dataset.signature = signature;
    list.replaceChildren();
    if (!names.length) {
      const empty = document.createElement("span");
      empty.className = "mb-attack-visible-empty";
      empty.textContent = monsters.length ? "Todas las detectadas ya están en la lista." : "No hay criaturas visibles en este piso.";
      list.appendChild(empty);
      return;
    }
    names.forEach((name) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.attackVisibleTarget = name;
      button.textContent = `+ ${name}`;
      button.setAttribute("aria-label", `Añadir ${name} a la prioridad`);
      list.appendChild(button);
    });
  }

  function refreshCaveStatus() {
    const statusLabel = document.getElementById("minibia-bot-cave-status");
    const startButton = document.getElementById("minibia-bot-cave-start");
    const stopButton = document.getElementById("minibia-bot-cave-stop");
    const route = bot.cave?.getRoute?.() || [];
    const status = bot.cave?.status?.();

    const routeList = document.getElementById("minibia-bot-cave-route");
    const routeSummary = document.getElementById("minibia-bot-cave-route-summary");
    if (routeSummary) routeSummary.textContent = `Ver puntos guardados · ${route.length}`;
    if (routeList) {
      const typeLabels = { node: "PUNTO", stand: "EXACTO", walk: "CAMINO", label: "MARCA", action: "ACCIÓN" };
      routeList.textContent = route.map((point, index) =>
        `${status?.running && index === status.currentIndex ? "▶ " : ""}${index + 1}. ${typeLabels[point.type] || "PUNTO"} · ${point.x}, ${point.y}, piso ${point.z}${point.label ? " · " + point.label : ""}${point.action ? " · " + point.action : ""}`
      ).join("\n");
    }
    const routeMode = document.getElementById("minibia-bot-cave-mode");
    const activeMode = status?.config?.routeMode || "pingpong";
    if (routeMode) routeMode.value = activeMode;
    document.querySelectorAll("#minibia-bot-cave-mode-options [data-cave-mode]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.caveMode === activeMode));
    });
    if (statusLabel) {
      if (status?.lastError) {
        statusLabel.textContent = status.lastError;
      } else if (!route.length) {
        statusLabel.textContent = "Sin puntos todavía · toca un tipo para grabar el primero.";
      } else if (status?.running && status?.pausedForCombat) {
        statusLabel.textContent = "En pausa · hay enemigos cerca.";
      } else if (status?.running) {
        const waypointNumber = (status.currentIndex ?? 0) + 1;
        const distanceLabel =
          Number.isFinite(status?.distanceToWaypoint) && status.distanceToWaypoint >= 0
            ? ` · a ${status.distanceToWaypoint} SQM`
            : "";
        statusLabel.textContent = `${status.waitingUntil ? "Esperando" : "Ruta en marcha"} · punto ${waypointNumber} de ${route.length}${distanceLabel}`;
      } else {
        statusLabel.textContent = `Lista para iniciar · ${route.length} ${route.length === 1 ? "punto" : "puntos"}.`;
      }
    }

    if (startButton) {
      startButton.disabled = !route.length || !!status?.running;
    }

    if (stopButton) {
      stopButton.disabled = !status?.running;
    }
  }

  function refreshCavePresetControls() {
    const select = document.getElementById("minibia-bot-cave-preset-select");
    const label = document.getElementById("minibia-bot-cave-preset-status");
    const deleteButton = document.getElementById("minibia-bot-cave-preset-delete");
    const status = bot.cave?.status?.();
    const presetNames = status?.presetNames || bot.cave?.getPresetNames?.() || [];
    const activePresetName = status?.activePresetName || bot.cave?.getActivePresetName?.() || "Default";

    if (select) {
      const previousValue = select.value;
      select.innerHTML = "";

      if (!presetNames.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "No hay rutas guardadas";
        select.appendChild(option);
        select.disabled = true;
      } else {
        presetNames.forEach((name) => {
          const option = document.createElement("option");
          option.value = name;
          option.textContent = name;
          select.appendChild(option);
        });
        select.disabled = false;
        const nextValue = presetNames.includes(activePresetName) ? activePresetName : previousValue;
        if (nextValue) {
          select.value = nextValue;
        }
      }
    }

    if (label) {
      label.textContent = presetNames.length
        ? `Ruta activa: ${activePresetName} · ${presetNames.length} guardadas`
        : `Ruta activa: ${activePresetName}`;
    }

    if (deleteButton) {
      deleteButton.disabled = !presetNames.length || !select?.value;
    }
  }

  function refreshCaveClosestStatus() {
    const label = document.getElementById("minibia-bot-cave-closest");
    if (!label) return;

    const position = bot.getPlayerPosition?.();
    const route = bot.cave?.getRoute?.() || [];

    if (!position) {
      label.textContent = "Inicio recomendado: posición actual no disponible";
      return;
    }

    if (!route.length) {
      label.textContent = "Inicio recomendado: agrega puntos a la ruta";
      return;
    }

    const closestIndex = bot.cave?.findClosestWaypointIndex?.(position) ?? 0;
    const waypoint = route[closestIndex];

    if (!waypoint) {
      label.textContent = "Inicio recomendado: no disponible";
      return;
    }

    label.textContent = `Mejor punto para empezar: ${closestIndex + 1} · ${waypoint.x}, ${waypoint.y}, piso ${waypoint.z}`;
  }

  function refreshCaveTransitionStatus() {
    const label = document.getElementById("minibia-bot-cave-transition-status");
    if (!label) return;

    const transitions = bot.cave?.getTransitions?.() || [];
    if (!transitions.length) {
      label.textContent = "Cambios de piso: todavía no aprendidos";
      return;
    }

    const latest = transitions
      .slice()
      .sort((a, b) => Number(b?.lastSeenAt || 0) - Number(a?.lastSeenAt || 0))[0];

    if (!latest?.from || !latest?.to) {
      label.textContent = `Cambios de piso aprendidos: ${transitions.length}`;
      return;
    }

    label.textContent =
      `Último cambio de piso: ${latest.from.x}, ${latest.from.y}, ${latest.from.z} → ` +
      `${latest.to.x}, ${latest.to.y}, ${latest.to.z}${transitions.length > 1 ? ` · y ${transitions.length - 1} más` : ""}`;
  }

  function refreshEquipRingStatus() {
    const equipRingToggle = document.getElementById("minibia-bot-equip-ring-enabled");
    if (!equipRingToggle) return;

    equipRingToggle.checked = !!bot.equipRing?.status?.().running;
  }

  function refreshTalkStatus() {
    const talkToggle = document.getElementById("minibia-bot-talk-enabled");
    const statusLabel = document.getElementById("minibia-bot-talk-status");
    const status = bot.talk?.status?.();

    if (talkToggle) {
      talkToggle.checked = !!status?.running;
    }

    if (statusLabel) {
      if (!status?.config?.apiKey) {
        statusLabel.textContent = "Falta la clave API";
      } else if (status?.pending) {
        statusLabel.textContent = "Preparando respuesta…";
      } else if (status?.running) {
        statusLabel.textContent = "Escuchando el chat Default";
      } else {
        statusLabel.textContent = "Inactivo";
      }
    }
  }

  function refreshVisibleCreatures() {
    const list = document.getElementById("minibia-bot-visible-creatures-list");
    if (!list) return;

    const me = bot.getPlayerPosition?.();
    const status = bot.xray?.status?.();
    const creatures = status?.visibleCreatures || [];
    const selectedFloor = status?.config?.selectedFloor;
    list.innerHTML = "";

    if (!me) {
      const empty = document.createElement("div");
      empty.className = "mb-small-note";
      empty.textContent = "Posición actual no disponible.";
      list.appendChild(empty);
      return;
    }

    const getFloorOffset = (creature) => (creature.position?.z || 0) - me.z;
    const getFloorDistance = (creature) => Math.abs(getFloorOffset(creature));

    const visibleCreatures = creatures
      .filter((creature) => {
        const floor = creature?.position?.z;
        if (floor == null) {
          return false;
        }

        if (selectedFloor != null) {
          return floor === selectedFloor;
        }

        return floor !== me.z;
      })
      .sort((a, b) => {
      const floorDistanceDiff = getFloorDistance(a) - getFloorDistance(b);
      if (floorDistanceDiff !== 0) return floorDistanceDiff;

      const floorOffsetDiff = getFloorOffset(a) - getFloorOffset(b);
      if (floorOffsetDiff !== 0) return floorOffsetDiff;

      const aDist = Math.abs((a.position?.x || 0) - me.x) + Math.abs((a.position?.y || 0) - me.y);
      const bDist = Math.abs((b.position?.x || 0) - me.x) + Math.abs((b.position?.y || 0) - me.y);
      return aDist - bDist;
    });

    if (!visibleCreatures.length) {
      const empty = document.createElement("div");
      empty.className = "mb-small-note";
      empty.textContent = selectedFloor == null
        ? "No hay criaturas visibles en otros pisos."
        : `No hay criaturas visibles en el piso ${selectedFloor}.`;
      list.appendChild(empty);
      return;
    }

    let currentFloor = null;

    visibleCreatures.forEach((creature) => {
      const floor = creature.position?.z;
      if (floor !== currentFloor) {
        currentFloor = floor;
        const floorOffset = me.z - floor;
        const floorOffsetLabel =
          floorOffset === 0 ? "0" : floorOffset > 0 ? `+${floorOffset}` : `${floorOffset}`;

        const floorLabel = document.createElement("div");
        floorLabel.className = "mb-floor-label";
        floorLabel.textContent = floorOffsetLabel;
        list.appendChild(floorLabel);
      }

      const row = document.createElement("div");
      row.className = "mb-creature-row";

      const name = document.createElement("div");
      name.className = "mb-creature-name";
      name.textContent = creature.name || (creature.type === 0 ? "Jugador" : "Criatura");

      const meta = document.createElement("div");
      meta.className = "mb-small-note";
      meta.textContent = `${creature.type === 0 ? "Jugador" : "Criatura"} · ${creature.position.x}, ${creature.position.y}, piso ${creature.position.z}`;

      row.appendChild(name);
      row.appendChild(meta);
      list.appendChild(row);
    });
  }

  function setPanelCollapsed(panel, collapsed) {
    if (!panel) return;

    const body = panel.querySelector(".mb-body");
    const toggle = panel.querySelector("#minibia-bot-collapse");
    const nextCollapsed = !!collapsed;

    panel.dataset.collapsed = nextCollapsed ? "true" : "false";

    if (body) {
      body.hidden = nextCollapsed;
    }

    if (toggle) {
      toggle.textContent = nextCollapsed ? "☰" : "×";
      toggle.setAttribute("aria-label", nextCollapsed ? "Abrir menú" : "Cerrar menú");
      toggle.setAttribute("title", nextCollapsed ? "Abrir menú" : "Cerrar menú");
    }

    savePanelCollapsed(nextCollapsed);
    if (nextCollapsed) {
      centerToolbar(panel);
    } else {
      // Measure after the hidden body has participated in layout. Measuring in
      // the same task uses the collapsed panel height and leaves it misplaced.
      requestAnimationFrame(() => {
        const rect = panel.getBoundingClientRect();
        const next = clampPanelPosition(panel, rect.left, rect.top);
        panel.style.left = `${next.left}px`;
        panel.style.top = `${next.top}px`;
        panel.style.right = "auto";

        // A second frame accounts for the final width/height after wrapping,
        // tab visibility and native controls have settled in desktop browsers.
        requestAnimationFrame(() => {
          const settled = panel.getBoundingClientRect();
          const finalPosition = clampPanelPosition(panel, settled.left, settled.top);
          panel.style.left = `${finalPosition.left}px`;
          panel.style.top = `${finalPosition.top}px`;
          panel.style.right = "auto";
        });
      });
    }
  }

  function centerToolbar(panel) {
    const next = clampPanelPosition(
      panel,
      (window.innerWidth - panel.offsetWidth) / 2,
      (window.innerHeight - panel.offsetHeight) / 2
    );
    panel.style.left = `${next.left}px`;
    panel.style.top = `${next.top}px`;
    panel.style.right = "auto";
    savePanelPosition(next);
  }

  function applySavedPanelPosition(panel, key = panelPositionKey) {
    const position = getSavedPanelPosition(key);
    if (!position) return;

    if (typeof position.top === "number") {
      panel.style.top = `${position.top}px`;
    }

    if (typeof position.left === "number") {
      panel.style.left = `${position.left}px`;
      panel.style.right = "auto";
    }
    const rect = panel.getBoundingClientRect();
    const next = clampPanelPosition(panel, rect.left, rect.top);
    panel.style.left = `${next.left}px`;
    panel.style.top = `${next.top}px`;
    panel.style.right = "auto";
  }

  function clampPanelPosition(panel, left, top) {
    const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
    const maxTop = Math.max(0, window.innerHeight - panel.offsetHeight);

    return {
      left: Math.min(Math.max(0, left), maxLeft),
      top: Math.min(Math.max(0, top), maxTop),
    };
  }

  function enableDrag(panel, key = panelPositionKey) {
    const handle = panel.querySelector(".mb-drag-handle");
    if (!handle) return;

    let dragState = null;

    const onPointerMove = (event) => {
      if (!dragState) return;

      const next = clampPanelPosition(
        panel,
        event.clientX - dragState.offsetX,
        event.clientY - dragState.offsetY
      );

      panel.style.left = `${next.left}px`;
      panel.style.top = `${next.top}px`;
      panel.style.right = "auto";
    };

    const onPointerUp = () => {
      if (!dragState) return;

      dragState = null;
      const rect = panel.getBoundingClientRect();
      savePanelPosition({ left: rect.left, top: rect.top }, key);
    };

    const onPointerDown = (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;

      const rect = panel.getBoundingClientRect();
      dragState = {
        offsetX: event.clientX - rect.left,
        offsetY: event.clientY - rect.top,
      };
      handle.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    };
    handle.addEventListener("pointerdown", onPointerDown);

    handle.addEventListener("pointermove", onPointerMove);
    handle.addEventListener("pointerup", onPointerUp);
    handle.addEventListener("pointercancel", onPointerUp);

    bot.addCleanup(() => {
      handle.removeEventListener("pointerdown", onPointerDown);
      handle.removeEventListener("pointermove", onPointerMove);
      handle.removeEventListener("pointerup", onPointerUp);
      handle.removeEventListener("pointercancel", onPointerUp);
    });
  }

  function installMobileTabs(panel) {
    const sections = [
      ["#minibia-bot-reload", "status"],
      ["#minibia-bot-home", "safety"],
      ["#minibia-bot-panic-gm-input", "safety"],
      ["#minibia-bot-rune-enabled", "more"],
      [".mb-main-column .mb-note", "more"],
      ["#minibia-bot-xray-overlay-toggle", "more"],
      ["#minibia-bot-auto-heal-enabled", "healing"],
      ["#minibia-bot-talk-enabled", "more"],
      ["#minibia-bot-cave-preset-select", "cave"],
      ["#minibia-bot-auto-attack-enabled", "combat"],
    ];
    sections.forEach(([selector, tab]) => {
      panel.querySelector(selector)?.closest(".mb-column-section")?.setAttribute("data-mobile-tab", tab);
    });

    const tabs = ["status", "cave", "combat", "healing", "safety", "more"];
    const nav = panel.querySelector(".mb-mobile-tabs");
    const body = panel.querySelector(".mb-body");
    const saved = bot.storage.get(mobileTabKey, "status");
    const select = (tab) => {
      if (!tabs.includes(tab)) return;
      panel.dataset.mobileTab = tab;
      nav.querySelectorAll("button").forEach((button) => {
        const active = button.dataset.tab === tab;
        button.setAttribute("aria-selected", String(active));
        button.tabIndex = active ? 0 : -1;
      });
      body.scrollTop = 0;
      bot.storage.set(mobileTabKey, tab);
    };
    nav.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-tab]");
      if (button && nav.contains(button)) select(button.dataset.tab);
    });
    select(tabs.includes(saved) ? saved : "status");
  }

  function inject() {
    destroy();

    const style = document.createElement("style");
    style.id = "minibia-bot-style";
    style.textContent = `
      #minibia-bot-panel {
        position: fixed;
        z-index: 999999;
        max-width: calc(100vw - 32px);
        padding: 12px;
        border: 1px solid rgba(205, 171, 111, 0.38);
        border-radius: 14px;
        background: rgba(20, 21, 22, 0.985);
        box-shadow: 0 16px 48px rgba(0, 0, 0, 0.48);
        color: #f2efe8;
        font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        user-select: none;
      }

      #minibia-bot-panel {
        top: 16px;
        right: 16px;
        width: min(560px, calc(100vw - 24px));
      }

      #minibia-bot-panel[data-collapsed="true"] {
        width: max-content;
      }

      #minibia-bot-panel .mb-drag-handle {
        font-weight: 700;
        cursor: grab;
        touch-action: none;
      }

      #minibia-bot-panel .mb-titlebar {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 8px;
        margin: 0 0 8px;
      }

      #minibia-bot-panel .mb-brand {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-right: auto;
        color: #f4ead5;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .08em;
        white-space: nowrap;
      }
      #minibia-bot-panel .mb-brand-mark {
        display: grid;
        width: 24px;
        height: 24px;
        place-items: center;
        border-radius: 7px;
        background: #9b773f;
        color: #fff;
        font-size: 10px;
        letter-spacing: 0;
      }

      #minibia-bot-panel .mb-titlebar button {
        width: auto;
        flex: none;
        min-width: 42px;
        min-height: 36px;
        white-space: nowrap;
      }

      #minibia-bot-panel .mb-titlebar [data-active="true"] {
        background: #557848;
        color: #fff;
      }

      #minibia-bot-panel .mb-safety-status {
        white-space: pre-line;
        padding: 7px 10px;
        margin-bottom: 9px;
        font-size: 12px;
        line-height: 1.4;
        color: #fff;
        background: #21352d;
        border: 1px solid rgba(122, 181, 143, .2);
        border-radius: 8px;
      }

      #minibia-bot-panel .mb-icon-button {
        width: 24px;
        min-width: 24px;
        padding: 2px 0;
        border-radius: 6px;
        font-weight: 700;
        line-height: 1;
      }

      #minibia-bot-panel[data-collapsed="true"] .mb-titlebar {
        margin-bottom: 0;
      }
      #minibia-bot-panel[data-collapsed="true"] .mb-safety-status {
        display: none;
      }

      #minibia-bot-panel .mb-body {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 280px 240px;
        gap: 12px;
        align-items: start;
        max-height: calc(100dvh - 112px);
        overflow: auto;
      }

      #minibia-bot-panel .mb-body[hidden] {
        display: none !important;
      }

      #minibia-bot-panel .mb-mobile-tabs,
      #minibia-bot-panel .mb-mobile-summary { display: none; }

      #minibia-bot-panel .mb-side-column,
      #minibia-bot-panel .mb-main-column,
      #minibia-bot-panel .mb-cave-column,
      #minibia-bot-panel .mb-healing-column {
        display: grid;
        gap: 10px;
      }
      #minibia-bot-panel .mb-healing-column { grid-column: 1 / -1; }

      #minibia-bot-panel .mb-heal-layout { display:grid; grid-template-columns:minmax(0,1fr) minmax(190px,.72fr); gap:8px; align-items:start; }
      #minibia-bot-panel .mb-heal-group, #minibia-bot-panel .mb-heal-conditions { min-width:0; padding:9px; border:1px solid rgba(255,255,255,.08); border-radius:10px; background:#17191b; }
      #minibia-bot-panel .mb-heal-group-title { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:7px; color:#e7d2ac; font-size:11px; font-weight:750; letter-spacing:.035em; text-transform:uppercase; }
      #minibia-bot-panel .mb-heal-rule-list { display:grid; gap:5px; max-height:190px; overflow:auto; }
      #minibia-bot-panel .mb-heal-rule { padding:5px 6px; border:1px solid rgba(255,255,255,.08); border-radius:8px; background:#202225; }
      #minibia-bot-panel .mb-heal-rule-head { display:grid; grid-template-columns:auto minmax(0,1fr) auto auto auto auto; gap:4px; align-items:center; }
      #minibia-bot-panel .mb-heal-rule-head input[type=checkbox] { width:auto; margin:0; }
      #minibia-bot-panel .mb-heal-rule-head button { min-height:28px; width:auto; padding:3px 6px; font-size:11px; }
      #minibia-bot-panel .mb-heal-rule-toggle { min-width:0; border:0; background:transparent; text-align:left; padding:3px; }
      #minibia-bot-panel .mb-heal-rule-toggle strong { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-size:11px; }
      #minibia-bot-panel .mb-heal-rule-summary { display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#aaa394; font-size:9px; margin-top:1px; }
      #minibia-bot-panel .mb-heal-priority { color:#c8b997; font-size:9px; white-space:nowrap; }
      #minibia-bot-panel .mb-heal-rule-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:7px; }
      #minibia-bot-panel .mb-heal-rule-grid .mb-field-label { font-size:10px; }
      #minibia-bot-panel .mb-heal-rule-grid input, #minibia-bot-panel .mb-heal-rule-grid select { min-height:34px; padding:6px 8px; }
      #minibia-bot-panel .mb-heal-add-row { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:6px; margin-top:7px; }
      #minibia-bot-panel .mb-heal-add { min-height:34px; width:auto; padding:6px 5px; font-size:10px; }
      #minibia-bot-panel .mb-heal-editor { padding:9px; border:1px solid rgba(190,151,83,.4); border-radius:9px; background:#202225; }
      #minibia-bot-panel .mb-heal-editor-actions { display:grid; grid-template-columns:1fr 1fr; gap:7px; margin-top:8px; }
      #minibia-bot-panel .mb-heal-editor-actions button { min-height:36px; }
      #minibia-bot-panel .mb-heal-list-summary { padding:6px 8px; margin-bottom:7px; border-radius:7px; background:#17191b; color:#c8b997; font-size:10px; }
      #minibia-bot-panel .mb-heal-hidden[hidden], #minibia-bot-panel [hidden] { display:none!important; }
      #minibia-bot-panel .mb-heal-live { padding:8px; border:1px solid rgba(116,164,132,.24); border-radius:8px; background:rgba(44,81,63,.28); color:#dbe9dd; font-size:11px; line-height:1.5; }

      #minibia-bot-panel .mb-section {
        padding: 12px;
        border: 1px solid rgba(255,255,255,.08);
        border-radius: 12px;
        background: #1b1d1f;
        box-shadow: 0 4px 14px rgba(0,0,0,.16);
      }

      #minibia-bot-panel .mb-column-section:first-child {
        padding-top: 12px;
      }

      #minibia-bot-panel .mb-label {
        margin: 0 0 8px;
        color: #e7d2ac;
        font-size: 12px;
        font-weight: 750;
        letter-spacing: .045em;
        text-transform: uppercase;
        word-break: break-word;
      }

      #minibia-bot-panel .mb-actions {
        display: grid;
        gap: 6px;
      }

      #minibia-bot-panel .mb-actions-inline-three {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      #minibia-bot-panel .mb-actions-inline-two {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      #minibia-bot-panel button {
        width: 100%;
        min-height: 38px;
        padding: 8px 10px;
        border: 1px solid rgba(222, 195, 151, 0.24);
        border-radius: 8px;
        background: #302c26;
        color: #f0ece4;
        font: inherit;
        cursor: pointer;
        transition: background .15s ease, border-color .15s ease, transform .15s ease;
      }

      #minibia-bot-panel button:hover {
        background: #40382d;
        border-color: rgba(222,195,151,.48);
      }

      #minibia-bot-panel button:disabled { opacity: .46; cursor: not-allowed; }
      #minibia-bot-panel button:focus-visible,
      #minibia-bot-panel select:focus-visible,
      #minibia-bot-panel input:focus-visible,
      #minibia-bot-panel textarea:focus-visible { outline: 2px solid #cba86a; outline-offset: 2px; }

      #minibia-bot-panel select {
        width: 100%;
        min-height: 38px;
        box-sizing: border-box;
        padding: 7px 10px;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 8px;
        background: #111315;
        color: #f2efe8;
        font: inherit;
      }

      #minibia-bot-panel #minibia-bot-stop-all {
        border-color: #e06b6b;
        background: #a9222b;
        color: #fff;
      }

      #minibia-bot-panel #minibia-bot-stop-all:hover,
      #minibia-bot-panel #minibia-bot-stop-all[data-active="true"] {
        background: #ca2935;
      }

      #minibia-bot-panel input,
      #minibia-bot-panel textarea {
        width: 100%;
        box-sizing: border-box;
        padding: 8px 10px;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 8px;
        background: #111315;
        color: #f2efe8;
        font: inherit;
      }

      #minibia-bot-panel textarea {
        min-height: 72px;
        resize: vertical;
      }

      #minibia-bot-panel .mb-toggle {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #dedbd4;
      }

      #minibia-bot-panel .mb-toggle input[type="checkbox"] {
        width: auto;
        margin: 0;
      }

      #minibia-bot-panel .mb-row {
        display: grid;
        grid-template-columns: auto 1fr;
        align-items: center;
        gap: 8px;
      }

      #minibia-bot-panel .mb-row-compact {
        grid-template-columns: auto auto;
        justify-content: start;
      }

      #minibia-bot-panel .mb-row .mb-toggle {
        white-space: nowrap;
      }

      #minibia-bot-panel .mb-row input[type="text"] {
        min-width: 0;
      }

      #minibia-bot-panel .mb-row-three {
        display: grid;
        grid-template-columns: auto minmax(120px, 1fr) 72px;
        align-items: center;
        gap: 8px;
      }

      #minibia-bot-panel .mb-row-three input[type="text"],
      #minibia-bot-panel .mb-row-three input[type="number"] {
        min-width: 0;
      }

      #minibia-bot-panel .mb-row-five {
        display: grid;
        grid-template-columns: auto 82px 72px 82px 72px;
        align-items: center;
        gap: 8px;
      }

      #minibia-bot-panel .mb-row-five input[type="number"] {
        min-width: 0;
      }

      #minibia-bot-panel .mb-field-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      #minibia-bot-panel .mb-field {
        display: grid;
        gap: 4px;
      }

      #minibia-bot-panel .mb-field-compact {
        width: 96px;
        justify-self: end;
      }

      #minibia-bot-panel .mb-field-label {
        color: #d3c49d;
        font-size: 11px;
      }

      #minibia-bot-panel .mb-stack {
        display: grid;
        gap: 8px;
      }

      #minibia-bot-panel .mb-inline {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 6px;
        align-items: center;
      }

      #minibia-bot-panel .mb-list {
        display: grid;
        gap: 6px;
      }

      #minibia-bot-panel .mb-list-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 6px;
        align-items: center;
        color: #d3c49d;
      }

      #minibia-bot-panel .mb-creature-row {
        padding: 6px 8px;
        border: 1px solid rgba(224, 200, 148, 0.14);
        border-radius: 8px;
        background: rgba(255, 244, 212, 0.04);
      }

      #minibia-bot-panel .mb-creature-name {
        color: #f7eccf;
        word-break: break-word;
      }

      #minibia-bot-panel .mb-floor-label {
        margin-top: 4px;
        color: #e2cf9c;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      #minibia-bot-panel #minibia-bot-visible-creatures-list {
        max-height: 150px;
        overflow-y: auto;
        padding-right: 2px;
      }

      #minibia-bot-panel #minibia-bot-panic-trusted-list {
        max-height: 140px;
        overflow-y: auto;
        padding-right: 2px;
      }

      #minibia-bot-panel .mb-small-button {
        width: auto;
        padding: 4px 8px;
        border-radius: 6px;
      }

      #minibia-bot-panel .mb-small-note {
        color: #b3b0aa;
        font-size: 11px;
      }

      #minibia-bot-panel .mb-note {
        margin-top: 8px;
        color: #b7a67d;
        font-size: 11px;
      }

      #minibia-bot-panel.mb-mobile {
        box-sizing: border-box;
        width: min(340px, calc(100vw - 16px));
        max-width: calc(100vw - 16px);
        padding: 10px;
        font-size: 14px;
      }
      #minibia-bot-panel.mb-mobile[data-collapsed="true"] {
        width: max-content;
        max-width: calc(100vw - 16px);
      }
      #minibia-bot-panel.mb-mobile .mb-mobile-tabs {
        display: flex;
        gap: 4px;
        overflow-x: auto;
        margin-bottom: 8px;
        scrollbar-width: none;
        -webkit-overflow-scrolling: touch;
      }
      #minibia-bot-panel.mb-mobile .mb-mobile-tabs button {
        width: auto;
        min-width: max-content;
        min-height: 36px;
        padding: 6px 11px;
        border-radius: 8px;
        background: #25282a;
        border-color: rgba(255,255,255,.09);
        color: #cbc8c1;
        font-size: 11px;
      }
      #minibia-bot-panel.mb-mobile .mb-mobile-tabs button[aria-selected="true"] {
        background: #8e6c38;
        border-color: #bd985a;
        color: #fff;
      }
      #minibia-bot-panel.mb-mobile[data-collapsed="true"] .mb-mobile-tabs { display: none; }
      #minibia-bot-panel.mb-mobile .mb-body {
        display: block;
        box-sizing: border-box;
        max-height: min(40dvh, 360px);
        overflow-y: auto;
        overflow-x: hidden;
        overscroll-behavior: contain;
        -webkit-overflow-scrolling: touch;
        touch-action: pan-y;
      }
      #minibia-bot-panel.mb-mobile .mb-body[hidden] { display: none; }
      #minibia-bot-panel.mb-mobile .mb-mobile-summary {
        display: block;
        line-height: 1.6;
        padding: 8px 0;
        white-space: pre-line;
      }
      #minibia-bot-panel.mb-mobile .mb-main-column,
      #minibia-bot-panel.mb-mobile .mb-side-column,
      #minibia-bot-panel.mb-mobile .mb-cave-column,
      #minibia-bot-panel.mb-mobile .mb-healing-column { display: contents; }
      #minibia-bot-panel.mb-mobile .mb-column-section { display: none; }
      #minibia-bot-panel.mb-mobile[data-mobile-tab="status"] [data-mobile-tab="status"],
      #minibia-bot-panel.mb-mobile[data-mobile-tab="cave"] [data-mobile-tab="cave"],
      #minibia-bot-panel.mb-mobile[data-mobile-tab="combat"] [data-mobile-tab="combat"],
      #minibia-bot-panel.mb-mobile[data-mobile-tab="healing"] [data-mobile-tab="healing"],
      #minibia-bot-panel.mb-mobile[data-mobile-tab="safety"] [data-mobile-tab="safety"],
      #minibia-bot-panel.mb-mobile[data-mobile-tab="more"] [data-mobile-tab="more"] { display: block; }
      #minibia-bot-panel.mb-mobile .mb-field-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      #minibia-bot-panel.mb-mobile .mb-heal-layout { grid-template-columns: minmax(0,1fr); gap: 6px; }
       #minibia-bot-panel.mb-mobile .mb-heal-group,
       #minibia-bot-panel.mb-mobile .mb-heal-conditions { padding: 6px; border-radius: 8px; }
       #minibia-bot-panel.mb-mobile .mb-heal-group-title { margin-bottom: 4px; font-size: 10px; }
       #minibia-bot-panel.mb-mobile .mb-heal-rule-list { gap: 4px; }
       #minibia-bot-panel.mb-mobile .mb-heal-rule { padding: 4px 5px; border-radius: 7px; }
       #minibia-bot-panel.mb-mobile .mb-heal-rule-head { gap: 3px; }
       #minibia-bot-panel.mb-mobile .mb-heal-rule-head button { min-height: 26px; padding: 2px 5px; font-size: 10px; }
       #minibia-bot-panel.mb-mobile .mb-heal-rule-toggle { min-height: 30px; padding: 2px; }
       #minibia-bot-panel.mb-mobile .mb-heal-rule-toggle strong { font-size: 11px; }
       #minibia-bot-panel.mb-mobile .mb-heal-rule-summary { font-size: 9px; }
       #minibia-bot-panel.mb-mobile .mb-heal-rule-details { margin-top: 4px; }
       #minibia-bot-panel.mb-mobile .mb-heal-rule-grid { gap: 4px; }
       #minibia-bot-panel.mb-mobile .mb-heal-rule-grid input,
       #minibia-bot-panel.mb-mobile .mb-heal-rule-grid select { min-height: 30px; padding: 4px 6px; font-size: 11px; }
       #minibia-bot-panel.mb-mobile .mb-heal-add { min-height: 30px; padding: 4px 7px; font-size: 10px; }
       #minibia-bot-panel.mb-mobile .mb-heal-group .mb-small-note,
       #minibia-bot-panel.mb-mobile .mb-heal-conditions .mb-small-note { font-size: 9px; line-height: 1.25; }
      #minibia-bot-panel.mb-mobile .mb-heal-rule { padding: 6px 7px; }
      #minibia-bot-panel.mb-mobile .mb-heal-rule-head { grid-template-columns: auto minmax(0,1fr) auto auto auto auto; gap: 4px; }
      #minibia-bot-panel.mb-mobile .mb-heal-rule-head button { min-height: 34px; padding: 4px 7px; }
      #minibia-bot-panel.mb-mobile .mb-heal-rule-toggle { min-height: 38px; }
      #minibia-bot-panel.mb-mobile .mb-heal-priority { font-size: 9px; }
      #minibia-bot-panel.mb-mobile .mb-heal-rule-grid { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 6px; }
      #minibia-bot-panel.mb-mobile button,
      #minibia-bot-panel.mb-mobile select { min-height: 44px; }
      #minibia-bot-panel.mb-mobile input,
      #minibia-bot-panel.mb-mobile textarea,
      #minibia-bot-panel.mb-mobile select { font-size: 16px; }
      #minibia-bot-panel.mb-mobile .mb-toggle { font-size: 14px; min-height: 44px; }
      #minibia-bot-panel.mb-mobile .mb-note,
      #minibia-bot-panel.mb-mobile .mb-small-note { font-size: 12px; }
      #minibia-bot-panel.mb-mobile .mb-titlebar button { min-height: 38px; padding: 5px 8px; }
      #minibia-bot-panel.mb-mobile .mb-mobile-tabs button { min-height: 38px; padding: 6px 9px; }
      #minibia-bot-panel.mb-mobile .mb-cave-column .mb-section { padding: 11px; }
      #minibia-bot-panel.mb-mobile .mb-cave-column .mb-stack { gap: 6px; }
      #minibia-bot-panel.mb-mobile .mb-cave-column button,
      #minibia-bot-panel.mb-mobile .mb-cave-column select { min-height: 38px; padding: 6px 8px; }
      #minibia-bot-panel.mb-mobile .mb-cave-column .mb-label { margin-bottom: 5px; }
      #minibia-bot-panel.mb-mobile .mb-cave-column .mb-small-note { margin: 0; line-height: 1.3; }
      #minibia-bot-panel.mb-mobile .mb-cave-column .mb-field { gap: 3px; }
      #minibia-bot-panel.mb-mobile .mb-attack-layout { gap: 8px; }
      #minibia-bot-panel.mb-mobile .mb-attack-card { padding: 10px; gap: 7px; }
      #minibia-bot-panel.mb-mobile .mb-attack-card .mb-small-note { font-size: 11px; line-height: 1.35; }
      #minibia-bot-panel.mb-mobile .mb-attack-target-list { max-height: 126px; }
      #minibia-bot-panel.mb-mobile .mb-attack-hotkeys { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      #minibia-bot-panel.mb-mobile .mb-attack-visible-list button { min-height: 34px; }
      #minibia-bot-panel .mb-cave-undo { justify-self: start; width: auto; min-height: 34px; padding: 5px 10px; }
      #minibia-bot-panel .mb-cave-route-details { width: 100%; box-sizing: border-box; }
      #minibia-bot-panel .mb-cave-route-details { border: 1px solid rgba(224,200,148,.25); border-radius: 7px; padding: 6px 8px; }
      #minibia-bot-panel .mb-cave-route-details summary { cursor: pointer; color: #d3c49d; }
      #minibia-bot-panel .mb-cave-route-details pre { max-height: 150px; overflow: auto; white-space: pre-wrap; font-size: 11px; margin: 6px 0 0; }
      #minibia-bot-panel .mb-cave-transfer[hidden] { display: none; }
      #minibia-bot-panel .mb-cave-transfer textarea { min-height: 90px; font-size: 12px; font-family: monospace; }
      #minibia-bot-panel .mb-cave-choice-group { display: flex; flex-wrap: wrap; gap: 5px; }
      #minibia-bot-panel .mb-cave-choice-group button { width: auto; min-height: 34px; padding: 5px 9px; border-radius: 7px; font-size: 12px; }
      #minibia-bot-panel .mb-cave-choice-group button[aria-pressed="true"] { background: #a17a39; border-color: #e3c17d; color: #fff; }
      #minibia-bot-panel .mb-cave-choice-group button:focus-visible { outline: 2px solid #f4d48c; outline-offset: 2px; }
      #minibia-bot-panel .mb-cave-preset-actions { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 5px; }
      #minibia-bot-panel .mb-cave-preset-actions button { min-height: 36px; padding: 4px 3px; font-size: 11px; }
      #minibia-bot-panel .mb-cave-card { display: grid; gap: 9px; padding: 11px; border: 1px solid rgba(255,255,255,.075); border-radius: 10px; background: #202224; }
      #minibia-bot-panel .mb-cave-card-title { color: #f0d4a0; font-size: 12px; font-weight: 750; }
      #minibia-bot-panel .mb-cave-intro { margin: -3px 0 2px; }
      #minibia-bot-panel .mb-attack-intro { margin: -3px 0 2px; }
      #minibia-bot-panel .mb-attack-layout { display: grid; gap: 9px; }
      #minibia-bot-panel .mb-attack-card { display: grid; gap: 8px; padding: 11px; border: 1px solid rgba(255,255,255,.075); border-radius: 10px; background: #202224; }
      #minibia-bot-panel .mb-attack-card-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
      #minibia-bot-panel .mb-attack-card-title { color: #f0d4a0; font-size: 12px; font-weight: 750; }
      #minibia-bot-panel .mb-attack-status { flex: 0 0 auto; padding: 3px 8px; border: 1px solid rgba(255,255,255,.12); border-radius: 999px; background: #292b2d; color: #c3c0b9; font-size: 10px; line-height: 1.4; }
      #minibia-bot-panel .mb-attack-status[data-active="true"] { border-color: rgba(113,155,121,.65); background: rgba(69,107,77,.3); color: #c8e8ce; }
      #minibia-bot-panel .mb-attack-enable { padding-top: 8px; border-top: 1px solid rgba(255,255,255,.08); font-weight: 650; }
      #minibia-bot-panel .mb-attack-hotkeys { gap: 8px; }
      #minibia-bot-panel .mb-attack-count { min-width: 24px; padding: 2px 7px; border-radius: 999px; background: rgba(255,255,255,.08); color: #d9c397; text-align: center; font-size: 10px; }
      #minibia-bot-panel .mb-attack-add-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px; }
      #minibia-bot-panel .mb-attack-add-row input { min-width: 0; min-height: 36px; padding: 6px 9px; }
      #minibia-bot-panel .mb-attack-add-row button { width: auto; min-height: 36px; padding: 6px 11px; }
      #minibia-bot-panel .mb-attack-detected-label { margin-top: 1px; }
      #minibia-bot-panel .mb-attack-visible-list { display: flex; gap: 5px; max-width: 100%; overflow-x: auto; padding: 1px 1px 4px; }
      #minibia-bot-panel .mb-attack-visible-list button { width: auto; flex: 0 0 auto; min-height: 30px; padding: 4px 8px; border-radius: 999px; background: #292b2d; font-size: 11px; }
      #minibia-bot-panel .mb-attack-visible-empty { flex: 0 0 auto; padding: 5px 2px; color: #92908b; font-size: 11px; }
      #minibia-bot-panel .mb-attack-target-list { display: grid; gap: 4px; max-height: 156px; overflow: auto; }
      #minibia-bot-panel .mb-attack-empty { padding: 7px 8px; border: 1px dashed rgba(255,255,255,.12); border-radius: 7px; color: #9d9b96; font-size: 11px; }
      #minibia-bot-panel .mb-attack-target-row { display: grid; grid-template-columns: 22px minmax(70px, 1fr) auto auto; align-items: center; gap: 6px; min-height: 34px; padding: 3px 5px; border: 1px solid rgba(255,255,255,.08); border-radius: 7px; background: rgba(255,255,255,.025); }
      #minibia-bot-panel .mb-attack-target-rank { color: #c8b17f; text-align: center; font-size: 10px; }
      #minibia-bot-panel .mb-attack-target-name { overflow: hidden; color: #e8e3d8; text-overflow: ellipsis; white-space: nowrap; }
      #minibia-bot-panel .mb-attack-target-stance { width: auto; min-width: 78px; min-height: 28px; padding: 2px 18px 2px 6px; border-radius: 6px; font-size: 10px; }
      #minibia-bot-panel .mb-attack-target-controls { display: flex; gap: 3px; }
      #minibia-bot-panel .mb-attack-target-controls .mb-attack-row-action { width: 28px; min-width: 28px; min-height: 28px; padding: 2px; border-radius: 6px; font-size: 13px; }
      #minibia-bot-panel .mb-attack-only-listed { padding-top: 6px; border-top: 1px solid rgba(255,255,255,.07); font-size: 11px; }
      #minibia-bot-panel .mb-attack-selection-field { gap: 3px; }
      #minibia-bot-panel .mb-attack-selection-field select { min-height: 34px; padding: 5px 8px; font-size: 12px; }
      #minibia-bot-panel .mb-cave-diagnostics { padding: 8px 10px; border: 1px solid rgba(255,255,255,.08); border-radius: 8px; color: #c2beb6; font-size: 11px; }
      #minibia-bot-panel .mb-cave-diagnostics summary { cursor: pointer; color: #cfc7b8; }
      #minibia-bot-panel .mb-cave-diagnostics[open] { display: grid; gap: 6px; }
      #minibia-bot-panel .mb-primary-button { background: #456b4d; border-color: #719b79; color: #fff; font-weight: 650; }
      #minibia-bot-panel .mb-primary-button:hover { background: #527b5a; }
      #minibia-bot-panel .mb-cave-legend { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px 8px; padding: 7px 8px; border: 1px solid rgba(224,200,148,.18); border-radius: 7px; background: rgba(12,9,6,.25); color: #c7b990; font-size: 10px; line-height: 1.3; }
      #minibia-bot-panel .mb-cave-legend b { color: #f0d69a; font-weight: 700; }
      #minibia-bot-panel .mb-cave-description { border: 1px solid rgba(224,200,148,.25); border-radius: 7px; padding: 6px 8px; background: rgba(12,9,6,.18); }
      #minibia-bot-panel .mb-cave-description summary { cursor: pointer; color: #f0d69a; font-size: 11px; font-weight: 700; padding: 5px 6px; border-radius: 5px; background: rgba(12,9,6,.48); }
      #minibia-bot-panel .mb-cave-description[open] { display: grid; gap: 6px; }
      #minibia-bot-panel .mb-cave-description .mb-cave-legend { margin-top: 0; }
      #minibia-bot-panel .mb-cave-description .mb-small-note { margin-top: 5px; }
      #minibia-bot-panel .mb-cave-column .mb-cave-choice-group button { min-height: 28px; padding: 3px 6px; font-size: 10px; }
      #minibia-bot-panel .mb-cave-column .mb-cave-preset-actions button { min-height: 29px; padding: 3px 4px; font-size: 10px; }
      #minibia-bot-panel .mb-cave-column .mb-cave-undo { min-height: 27px; padding: 3px 7px; font-size: 10px; }
       #minibia-bot-panel .mb-cave-column .mb-cave-choice-group .mb-cave-undo { min-height: 28px; padding: 3px 7px; font-size: 10px; background: rgba(12,9,6,.42); border-color: rgba(224,200,148,.3); color: #f0d69a; white-space: nowrap; }
      #minibia-bot-panel .mb-cave-column .mb-actions button { min-height: 32px; padding: 4px 7px; font-size: 11px; }
    `;
    document.head.appendChild(style);

    const panel = document.createElement("div");
    panel.id = "minibia-bot-panel";
    panel.innerHTML = `
      <div class="mb-titlebar" role="toolbar" aria-label="Controles del bot">
        <span class="mb-brand"><span class="mb-brand-mark">MB</span><span>MINIBIA BOT</span></span>
        <button type="button" id="minibia-bot-start-all" aria-label="Iniciar todos los módulos">START</button>
        <button type="button" id="minibia-bot-stop-all" aria-label="Pausar todos los módulos">STOP</button>
        <button type="button" class="mb-icon-button" id="minibia-bot-collapse" aria-label="Abrir menú" title="Abrir menú">☰</button>
        <button type="button" class="mb-icon-button mb-drag-handle" aria-label="Arrastrar barra" title="Mantén presionado para mover">✥</button>
      </div>
      <div class="mb-safety-status" aria-live="off">🛡️ Protección lista · Sin regreso pendiente</div>
      <div class="mb-mobile-tabs" role="tablist" aria-label="Secciones del bot">
        <button type="button" role="tab" data-tab="status">Inicio</button>
        <button type="button" role="tab" data-tab="cave">Cueva</button>
        <button type="button" role="tab" data-tab="combat">Combate</button>
        <button type="button" role="tab" data-tab="healing">Curación</button>
        <button type="button" role="tab" data-tab="safety">Seguridad</button>
        <button type="button" role="tab" data-tab="more">Más</button>
      </div>
      <div class="mb-body">
        <div class="mb-main-column">
          <div class="mb-actions mb-section mb-column-section">
            <div class="mb-mobile-summary" aria-live="off">Cargando estado…</div>
            <button type="button" id="minibia-bot-reload">Reiniciar bot</button>
            <button type="button" id="minibia-bot-copy-setup">Exportar mi configuración</button>
          </div>
          <div class="mb-section mb-column-section">
            <div class="mb-label">Regreso seguro</div>
            <div class="mb-small-note" id="minibia-bot-home">Punto de regreso: sin configurar</div>
            <div class="mb-stack">
              <button type="button" id="minibia-bot-set-home">Guardar punto de regreso aquí</button>
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-panic-unknown" />
                <span>Entrar en protección si aparece otro jugador</span>
              </label>
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-panic-health" />
                <span>Entrar en protección si baja la vida</span>
              </label>
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-panic-return" />
                <span>Regresar automáticamente al origen</span>
              </label>
              <div class="mb-inline">
                <input type="text" id="minibia-bot-panic-trusted-input" placeholder="Nombre de jugador de confianza" />
                <button type="button" class="mb-small-button" id="minibia-bot-panic-trusted-add">Agregar</button>
              </div>
              <div class="mb-list" id="minibia-bot-panic-trusted-list"></div>
            </div>
          </div>
          <div class="mb-section mb-column-section">
            <div class="mb-label">Protección ante Game Masters</div>
            <div class="mb-stack">
              <div class="mb-inline">
                <input type="text" id="minibia-bot-panic-gm-input" placeholder="Nombre del Game Master" />
                <button type="button" class="mb-small-button" id="minibia-bot-panic-gm-add">Agregar</button>
              </div>
              <div class="mb-list" id="minibia-bot-panic-gm-list"></div>
            </div>
          </div>
          <div class="mb-section mb-column-section">
            <div class="mb-actions">
              <div class="mb-row-three">
                <label class="mb-toggle">
                  <input type="checkbox" id="minibia-bot-rune-enabled" />
                  <span>Entrenar nivel mágico</span>
                </label>
                <input type="text" id="minibia-bot-rune-spell" placeholder="Palabras del hechizo" />
                <input type="number" id="minibia-bot-rune-mana" min="0" placeholder="Mana mínima" />
              </div>
              <div class="mb-row mb-row-compact">
                <label class="mb-toggle">
                  <input type="checkbox" id="minibia-bot-auto-eat-enabled" />
                  <span>Comer automáticamente</span>
                </label>
                <label class="mb-field mb-field-compact" for="minibia-bot-auto-eat-hotkey">
                  <span class="mb-field-label">Tecla para comer (1-12)</span>
                  <input type="number" id="minibia-bot-auto-eat-hotkey" min="1" max="12" placeholder="10" />
                </label>
              </div>
              <div class="mb-row">
                <label class="mb-toggle">
                  <input type="checkbox" id="minibia-bot-auto-invisible-enabled" />
                  <span>Invisibilidad automática</span>
                </label>
                <div class="mb-small-note">Lanza utana vid cuando se termina la invisibilidad.</div>
              </div>
              <div class="mb-row">
                <label class="mb-toggle">
                  <input type="checkbox" id="minibia-bot-auto-magic-shield-enabled" />
                  <span>Escudo mágico automático</span>
                </label>
                <div class="mb-small-note">Lanza utamo vita cuando se termina el escudo mágico.</div>
              </div>
              <div class="mb-row">
                <label class="mb-toggle">
                  <input type="checkbox" id="minibia-bot-equip-ring-enabled" />
                  <span>Equipar anillo automáticamente</span>
                </label>
                <div></div>
              </div>
            </div>
          </div>
          <div class="mb-section mb-column-section">
            <div class="mb-note">Módulos disponibles: protección, runas, comida, invisibilidad, escudo, anillo, curación, combate y respuestas.</div>
          </div>
        </div>
        <div class="mb-side-column">
          <div class="mb-section mb-column-section">
            <div class="mb-label">Radar de criaturas</div>
            <button type="button" class="mb-small-button" id="minibia-bot-xray-overlay-toggle">Ocultar radar</button>
            <div class="mb-small-note" id="minibia-bot-xray-overlay-status">Radar: activo</div>
            <label class="mb-field" for="minibia-bot-xray-floor-select">
              <span class="mb-field-label">Filtrar por piso</span>
              <select id="minibia-bot-xray-floor-select">
                <option value="all">Todos los pisos</option>
              </select>
            </label>
            <div class="mb-list" id="minibia-bot-visible-creatures-list"></div>
          </div>
          <div class="mb-section mb-column-section">
            <div class="mb-label">Respuestas automáticas</div>
            <div class="mb-stack">
              <label class="mb-toggle">
                <input type="checkbox" id="minibia-bot-talk-enabled" />
                <span>Activar respuestas</span>
              </label>
              <input type="password" id="minibia-bot-talk-api-key" placeholder="Clave API de Gemini" />
              <textarea id="minibia-bot-talk-prompt" placeholder="Cómo quieres que responda"></textarea>
              <div class="mb-small-note" id="minibia-bot-talk-status">Estado: inactivo</div>
              <div class="mb-small-note">Responde al mensaje nuevo más reciente del chat Default.</div>
              <div class="mb-small-note">Ignora sus propios mensajes.</div>
            </div>
          </div>
        </div>
        <div class="mb-cave-column">
          <div class="mb-section mb-column-section">
            <div class="mb-label">Cavebot</div>
            <div class="mb-small-note mb-cave-intro">Crea una ruta, guarda puntos y ejecútala automáticamente.</div>
            <div class="mb-stack">
              <div class="mb-cave-card">
                <label class="mb-field" for="minibia-bot-cave-preset-select">
                  <span class="mb-field-label">Ruta guardada</span>
                  <select id="minibia-bot-cave-preset-select"></select>
                </label>
              <div class="mb-cave-preset-actions">
                <button type="button" class="mb-small-button" id="minibia-bot-cave-preset-new">Nuevo</button>
                <button type="button" class="mb-small-button" id="minibia-bot-cave-preset-delete">Borrar</button>
                <button type="button" class="mb-small-button" id="minibia-bot-cave-import">Importar</button>
                <button type="button" class="mb-small-button" id="minibia-bot-cave-export">Exportar</button>
              </div>
              <div class="mb-cave-transfer mb-stack" id="minibia-bot-cave-transfer" hidden>
                <label class="mb-field" for="minibia-bot-cave-transfer-text" id="minibia-bot-cave-transfer-label"></label>
                <textarea id="minibia-bot-cave-transfer-text" spellcheck="false"></textarea>
                <div class="mb-actions mb-actions-inline-two">
                  <button type="button" id="minibia-bot-cave-transfer-primary"></button>
                  <button type="button" id="minibia-bot-cave-transfer-secondary"></button>
                </div>
                <div class="mb-small-note" id="minibia-bot-cave-transfer-status" role="status"></div>
              </div>
              </div>
              <div class="mb-cave-card">
                <div class="mb-cave-card-title">1 · Grabar puntos</div>
                <div class="mb-small-note">Toca un tipo para guardar la casilla donde estás.</div>
              <div class="mb-field"><span>Tipo de punto</span>
                <input type="hidden" id="minibia-bot-cave-type" value="node" />
                <div class="mb-cave-choice-group" id="minibia-bot-cave-type-options" role="group" aria-label="Tipo de punto">
                  <button type="button" data-cave-type="node" aria-label="Añadir punto Node">Node</button>
                  <button type="button" data-cave-type="stand" aria-label="Añadir punto Stand">Stand</button>
                  <button type="button" data-cave-type="walk" aria-label="Añadir punto Walk">Walk</button>
                  <button type="button" data-cave-type="label" aria-label="Añadir punto Label">Label</button>
                  <button type="button" data-cave-type="action" aria-label="Añadir punto Acción">Acción</button>
                  <button type="button" class="mb-small-button mb-cave-undo" id="minibia-bot-cave-remove-last">Deshacer último punto</button>
                </div>
                <details class="mb-cave-description">
                  <summary>Descripción · tipos de punto</summary>
                  <div class="mb-cave-legend" aria-label="Qué hace cada tipo de punto">
                    <span><b>Node / Walk</b> · Punto flexible de paso</span>
                    <span><b>Stand</b> · Llega a esa casilla exacta</span>
                    <span><b>Label</b> · Marca con nombre para saltos</span>
                    <span><b>Acción</b> · Esperar, omitir o ir a una marca</span>
                  </div>
                </details>
              </div>
              <details class="mb-cave-route-details"><summary id="minibia-bot-cave-route-summary">Ver puntos guardados</summary><pre id="minibia-bot-cave-route"></pre></details>
              </div>
              <div class="mb-cave-card">
                <div class="mb-cave-card-title">2 · Sentido y puntos</div>
                <div class="mb-field"><span>Cómo recorrer la ruta</span>
                <input type="hidden" id="minibia-bot-cave-mode" value="pingpong" />
                <div class="mb-cave-choice-group" id="minibia-bot-cave-mode-options" role="group" aria-label="Modo de recorrido">
                  <button type="button" data-cave-mode="pingpong" aria-pressed="true">Ida y vuelta</button>
                  <button type="button" data-cave-mode="loop" aria-pressed="false">Circuito continuo</button>
                </div>
                <details class="mb-cave-description">
                  <summary>Descripción · sentido del recorrido</summary>
                  <div class="mb-cave-legend" aria-label="Qué hace cada sentido del recorrido">
                    <span><b>Ida y vuelta</b> · Recorre ambos sentidos.</span>
                    <span><b>Circuito continuo</b> · Vuelve del último punto al primero.</span>
                  </div>
                </details>
              </div>
              </div>
              <div class="mb-cave-card">
                <div class="mb-cave-card-title">3 · Ejecutar</div>
                <div class="mb-small-note" id="minibia-bot-cave-status" role="status" aria-live="polite">Sin puntos todavía</div>
              <div class="mb-actions mb-actions-inline-two">
                <button type="button" class="mb-small-button mb-primary-button" id="minibia-bot-cave-start">Iniciar ruta</button>
                <button type="button" class="mb-small-button" id="minibia-bot-cave-stop" style="background:#b91c1c;color:white;border-color:#ef4444">Detener</button>
              </div>
              </div>
              <details class="mb-cave-diagnostics">
                <summary>Detalles de navegación</summary>
                <div class="mb-small-note" id="minibia-bot-cave-closest">Inicio recomendado: sin puntos</div>
                <div class="mb-small-note" id="minibia-bot-cave-transition-status">Cambios de piso: todavía no aprendidos</div>
              </details>
            </div>
          </div>
          <section class="mb-section mb-column-section" aria-labelledby="minibia-bot-attack-title">
            <div class="mb-label" id="minibia-bot-attack-title">Attack Target</div>
            <div class="mb-small-note mb-attack-intro">Elige criaturas visibles del mismo piso. Puede funcionar junto con Cavebot.</div>
            <div class="mb-attack-layout">
              <div class="mb-attack-card mb-attack-main">
                <div class="mb-attack-card-heading">
                  <div>
                    <div class="mb-attack-card-title">Ataque automático</div>
                    <div class="mb-small-note">Busca objetivos visibles en tu mismo piso.</div>
                  </div>
                  <span class="mb-attack-status" id="minibia-bot-auto-attack-status" role="status" aria-live="polite" data-active="false">Detenido</span>
                </div>
                <label class="mb-toggle mb-attack-enable">
                  <input type="checkbox" id="minibia-bot-auto-attack-enabled" />
                  <span>Activar Attack Target</span>
                </label>
              </div>

              <div class="mb-attack-card">
                <div class="mb-attack-card-heading">
                  <div>
                    <div class="mb-attack-card-title">Monstruos prioritarios</div>
                    <div class="mb-small-note">Añade nombres y ordénalos como en Targeting.</div>
                  </div>
                  <span class="mb-attack-count" id="minibia-bot-attack-target-count">0</span>
                </div>
                <div class="mb-small-note mb-attack-detected-label">Detectados ahora · toca para priorizar</div>
                <div class="mb-attack-visible-list" id="minibia-bot-attack-visible-list" role="list" aria-label="Criaturas visibles para añadir"></div>
                <div class="mb-attack-add-row">
                  <input type="text" id="minibia-bot-attack-target-name" maxlength="48" placeholder="Nombre del monstruo" aria-label="Nombre del monstruo" />
                  <button type="button" class="mb-small-button" id="minibia-bot-attack-target-add">Añadir</button>
                </div>
                  <div class="mb-small-note">Cada criatura puede usar el modo general o tener su propio alcance.</div>
                  <div class="mb-attack-target-list" id="minibia-bot-attack-target-list" role="list" aria-label="Monstruos en orden de prioridad"></div>
                <div class="mb-small-note" id="minibia-bot-attack-target-feedback" role="status" aria-live="polite"></div>
                <label class="mb-toggle mb-attack-only-listed">
                  <input type="checkbox" id="minibia-bot-attack-only-listed" />
                  <span>Atacar solo los de esta lista</span>
                </label>
                <label class="mb-field mb-attack-selection-field" for="minibia-bot-attack-selection">
                  <span class="mb-field-label">Elegir objetivo por</span>
                  <select id="minibia-bot-attack-selection">
                    <option value="proximity">Más cercano</option>
                    <option value="list">Orden de la lista</option>
                  </select>
                </label>
                <div class="mb-small-note">La lista define la prioridad; si no hay coincidencias, se usa la criatura más cercana salvo que limites el ataque a la lista.</div>
              </div>

              <div class="mb-attack-card">
                <div class="mb-attack-card-title">Alcance y acciones</div>
                <label class="mb-field" for="minibia-bot-attack-stance">
                  <span class="mb-field-label">Modo general</span>
                  <select id="minibia-bot-attack-stance">
                    <option value="melee">Cerca · perseguir hasta 1 SQM</option>
                    <option value="ranged">Lejos · mantener distancia</option>
                  </select>
                </label>
                <label class="mb-field" for="minibia-bot-attack-range">
                  <span class="mb-field-label">Distancia máxima (2–8 SQM)</span>
                  <input type="number" id="minibia-bot-attack-range" min="2" max="8" value="3" inputmode="numeric" />
                </label>
                <div class="mb-small-note">Por defecto mantiene 2–3 SQM. Cada monstruo puede cambiar el modo general con su selector.</div>
                <div class="mb-field-grid mb-attack-hotkeys">
                  <label class="mb-field" for="minibia-bot-auto-attack-hotkey">
                    <span class="mb-field-label">Objetivo (1–12)</span>
                    <input type="number" id="minibia-bot-auto-attack-hotkey" min="1" max="12" inputmode="numeric" placeholder="3" />
                  </label>
                  <label class="mb-field" for="minibia-bot-auto-attack-rune-hotkey">
                    <span class="mb-field-label">Runa (opcional)</span>
                    <input type="number" id="minibia-bot-auto-attack-rune-hotkey" min="1" max="12" inputmode="numeric" placeholder="Sin asignar" />
                  </label>
                </div>
                <div class="mb-small-note">Coloca la acción de atacar y la runa en esas mismas casillas de la barra del juego.</div>
              </div>
            </div>
          </section>
        </div>
        <div class="mb-healing-column">
          <section class="mb-section mb-column-section" aria-labelledby="minibia-bot-heal-title">
            <div class="mb-row" style="grid-template-columns:minmax(0,1fr) auto;align-items:start">
              <div>
                <div class="mb-label" id="minibia-bot-heal-title">HealBot</div>
                <div class="mb-small-note">Crea reglas para hechizos, runas y pociones. El bot activa la casilla indicada cuando se cumple la condición.</div>
              </div>
              <label class="mb-toggle" style="white-space:nowrap">
                <input type="checkbox" id="minibia-bot-auto-heal-enabled" />
                <span>Activo</span>
              </label>
            </div>
            <div class="mb-heal-layout" style="margin-top:8px">
              <div class="mb-heal-group">
                <div class="mb-heal-group-title"><span>Acciones de curación</span><span id="minibia-bot-heal-count">0</span></div>
                <div class="mb-heal-list-summary" id="minibia-bot-heal-list-summary" hidden></div>
                <div class="mb-heal-editor" id="minibia-bot-heal-editor" hidden></div>
                <div class="mb-heal-rule-list" id="minibia-bot-heal-spells"></div>
                <div class="mb-heal-add-row" id="minibia-bot-heal-add-row">
                  <button type="button" class="mb-heal-add" data-heal-add="spell">＋ Hechizo</button>
                  <button type="button" class="mb-heal-add" data-heal-add="rune">＋ Runa</button>
                  <button type="button" class="mb-heal-add" data-heal-add="potion">＋ Poción</button>
                </div>
                <div id="minibia-bot-heal-items" hidden></div>
              </div>
              <aside class="mb-heal-conditions" id="minibia-bot-heal-conditions">
                <div class="mb-heal-group-title">Condiciones</div>
                <div class="mb-stack">
                  <label class="mb-field" for="minibia-bot-heal-min-mana"><span class="mb-field-label">Maná mínimo disponible</span><input type="number" id="minibia-bot-heal-min-mana" min="0" inputmode="numeric" /></label>
                  <label class="mb-field" for="minibia-bot-heal-wait"><span class="mb-field-label">Wait · revisión (ms)</span><input type="number" id="minibia-bot-heal-wait" min="50" max="5000" step="50" inputmode="numeric" /></label>
                  <label class="mb-field" for="minibia-bot-heal-delay"><span class="mb-field-label">Delay · pausa tras acción (ms)</span><input type="number" id="minibia-bot-heal-delay" min="0" max="60000" step="50" inputmode="numeric" /></label>
                  <div class="mb-heal-live" id="minibia-bot-heal-status" aria-live="polite">Añade y configura una acción para empezar.</div>
                  <div class="mb-small-note">Las reglas se revisan en orden. Asigna el hechizo, la runa o la poción en Minibia; aquí solo se configura el disparador y su casilla.</div>
                  <div class="mb-small-note">Curar a otro jugador requiere una función de objetivo del cliente que Minibia no expone al bot; no se simula con una tecla.</div>
                </div>
              </aside>
            </div>
          </section>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    const mobileQuery = window.matchMedia("(max-width: 760px)");
    const updateMobile = () => {
      const narrowTouchScreen = mobileQuery.matches && window.matchMedia("(pointer: coarse)").matches;
      const mobile = narrowTouchScreen || /iPhone|iPod|Android/i.test(navigator.userAgent);
      panel.classList.toggle("mb-mobile", mobile);
      panel.classList.toggle("mb-desktop", !mobile);
      if (mobile) {
        const rect = panel.getBoundingClientRect();
        const next = clampPanelPosition(panel, rect.left, rect.top);
        panel.style.left = `${next.left}px`;
        panel.style.top = `${next.top}px`;
        panel.style.right = "auto";
      }
    };
    installMobileTabs(panel);
    updateMobile();
    mobileQuery.addEventListener?.("change", updateMobile);
    window.addEventListener("resize", updateMobile);
    bot.addCleanup(() => {
      mobileQuery.removeEventListener?.("change", updateMobile);
      window.removeEventListener("resize", updateMobile);
    });

    const unlockAudio = () => {
      bot.unlockAudio?.();
    };

    panel.addEventListener("pointerdown", unlockAudio, { passive: true });
    panel.addEventListener("keydown", unlockAudio);

    bot.addCleanup(() => {
      panel.removeEventListener("pointerdown", unlockAudio);
      panel.removeEventListener("keydown", unlockAudio);
    });

    applySavedPanelPosition(panel);
    updateMobile();
    enableDrag(panel);
    setPanelCollapsed(panel, true);

    const spellInput = panel.querySelector("#minibia-bot-rune-spell");
    const manaInput = panel.querySelector("#minibia-bot-rune-mana");
    const runeEnabledInput = panel.querySelector("#minibia-bot-rune-enabled");
    const autoEatEnabledInput = panel.querySelector("#minibia-bot-auto-eat-enabled");
    const autoEatHotkeyInput = panel.querySelector("#minibia-bot-auto-eat-hotkey");
    const autoInvisibleEnabledInput = panel.querySelector("#minibia-bot-auto-invisible-enabled");
    const autoMagicShieldEnabledInput = panel.querySelector("#minibia-bot-auto-magic-shield-enabled");
    const equipRingEnabledInput = panel.querySelector("#minibia-bot-equip-ring-enabled");
    const autoHealEnabledInput = panel.querySelector("#minibia-bot-auto-heal-enabled");
    const autoHealSpellList = panel.querySelector("#minibia-bot-heal-spells");
    const autoHealItemList = panel.querySelector("#minibia-bot-heal-items");
    const autoHealWaitInput = panel.querySelector("#minibia-bot-heal-wait");
    const autoHealDelayInput = panel.querySelector("#minibia-bot-heal-delay");
    const autoHealMinManaInput = panel.querySelector("#minibia-bot-heal-min-mana");
    const autoHealStatus = panel.querySelector("#minibia-bot-heal-status");
    const autoAttackEnabledInput = panel.querySelector("#minibia-bot-auto-attack-enabled");
    const autoAttackStanceInput = panel.querySelector("#minibia-bot-attack-stance");
    const autoAttackRangeInput = panel.querySelector("#minibia-bot-attack-range");
    const autoAttackHotkeyInput = panel.querySelector("#minibia-bot-auto-attack-hotkey");
    const autoAttackRuneHotkeyInput = panel.querySelector("#minibia-bot-auto-attack-rune-hotkey");
    const autoAttackTargetNameInput = panel.querySelector("#minibia-bot-attack-target-name");
    const autoAttackTargetAddButton = panel.querySelector("#minibia-bot-attack-target-add");
    const autoAttackTargetList = panel.querySelector("#minibia-bot-attack-target-list");
    const autoAttackVisibleList = panel.querySelector("#minibia-bot-attack-visible-list");
    const autoAttackTargetOnlyInput = panel.querySelector("#minibia-bot-attack-only-listed");
    const autoAttackSelectionInput = panel.querySelector("#minibia-bot-attack-selection");
    const autoAttackTargetFeedback = panel.querySelector("#minibia-bot-attack-target-feedback");
    const talkEnabledInput = panel.querySelector("#minibia-bot-talk-enabled");
    const talkApiKeyInput = panel.querySelector("#minibia-bot-talk-api-key");
    const talkPromptInput = panel.querySelector("#minibia-bot-talk-prompt");
    const panicGmNameInput = panel.querySelector("#minibia-bot-panic-gm-input");
    const panicGmAddButton = panel.querySelector("#minibia-bot-panic-gm-add");
    const panicUnknownInput = panel.querySelector("#minibia-bot-panic-unknown");
    const panicHealthInput = panel.querySelector("#minibia-bot-panic-health");
    const panicReturnInput = panel.querySelector("#minibia-bot-panic-return");
    const panicTrustedInput = panel.querySelector("#minibia-bot-panic-trusted-input");
    const panicTrustedAddButton = panel.querySelector("#minibia-bot-panic-trusted-add");
    const xrayOverlayButton = panel.querySelector("#minibia-bot-xray-overlay-toggle");
    const xrayFloorSelect = panel.querySelector("#minibia-bot-xray-floor-select");
    const collapseButton = panel.querySelector("#minibia-bot-collapse");
    const startAllButton = panel.querySelector("#minibia-bot-start-all");
    const stopAllButton = panel.querySelector("#minibia-bot-stop-all");
    const reloadButton = panel.querySelector("#minibia-bot-reload");
    const copySetupButton = panel.querySelector("#minibia-bot-copy-setup");
    const caveRemoveLastButton = panel.querySelector("#minibia-bot-cave-remove-last");
    const caveStartButton = panel.querySelector("#minibia-bot-cave-start");
    const caveStopButton = panel.querySelector("#minibia-bot-cave-stop");
    const cavePresetSelect = panel.querySelector("#minibia-bot-cave-preset-select");
    const cavePresetNewButton = panel.querySelector("#minibia-bot-cave-preset-new");
    const cavePresetDeleteButton = panel.querySelector("#minibia-bot-cave-preset-delete");
    const caveImportButton = panel.querySelector("#minibia-bot-cave-import");
    const caveExportButton = panel.querySelector("#minibia-bot-cave-export");
    const caveTransfer = panel.querySelector("#minibia-bot-cave-transfer");
    const caveTransferText = panel.querySelector("#minibia-bot-cave-transfer-text");
    const caveTransferLabel = panel.querySelector("#minibia-bot-cave-transfer-label");
    const caveTransferPrimary = panel.querySelector("#minibia-bot-cave-transfer-primary");
    const caveTransferSecondary = panel.querySelector("#minibia-bot-cave-transfer-secondary");
    const caveTransferStatus = panel.querySelector("#minibia-bot-cave-transfer-status");
    let caveTransferMode = "";
    const openCaveTransfer = (mode) => {
      caveTransferMode = mode;
      caveTransfer.hidden = false;
      caveTransferStatus.textContent = "";
      caveTransferText.readOnly = mode === "export";
      caveTransferLabel.textContent = mode === "export" ? "Comparte este recorrido" : "Pega aquí el recorrido recibido";
      caveTransferPrimary.textContent = mode === "export" ? "Copiar" : "Guardar recorrido";
      caveTransferSecondary.textContent = mode === "export" && navigator.share ? "Compartir" : "Cerrar";
      caveTransferText.placeholder = mode === "import" ? "Pega aquí el JSON del recorrido" : "";
      caveTransferText.value = mode === "export" ? bot.cave.exportPreset() : "";
      caveTransferText.focus();
      if (mode === "export") caveTransferText.select();
    };
    caveImportButton.addEventListener("click", () => openCaveTransfer("import"));
    caveExportButton.addEventListener("click", () => {
      try { openCaveTransfer("export"); }
      catch (error) { caveTransfer.hidden = false; caveTransferStatus.textContent = error.message; }
    });
    caveTransferPrimary.addEventListener("click", async () => {
      if (caveTransferMode === "import") {
        try {
          const imported = bot.cave.importPreset(caveTransferText.value);
          refreshCavePresetControls(); refreshCaveStatus();
          refreshCaveClosestStatus(); refreshCaveTransitionStatus();
          caveTransferStatus.textContent = `Guardado: ${imported.name} (${imported.waypoints} puntos).`;
          caveTransferText.value = "";
        } catch (error) { caveTransferStatus.textContent = error.message; }
      } else {
        try {
          await navigator.clipboard.writeText(caveTransferText.value);
          caveTransferStatus.textContent = "Copiado. Envíalo a otro dispositivo o persona.";
        } catch {
          caveTransferText.focus(); caveTransferText.select();
          caveTransferStatus.textContent = "Texto seleccionado: usa Copiar en el menú del navegador.";
        }
      }
    });
    caveTransferSecondary.addEventListener("click", async () => {
      if (caveTransferMode === "export" && navigator.share) {
        try { await navigator.share({ title: cavePresetSelect.value || "Recorrido Minibia", text: caveTransferText.value }); }
        catch (error) { if (error.name !== "AbortError") caveTransferStatus.textContent = "No se pudo compartir; usa Copiar."; }
      } else { caveTransfer.hidden = true; }
    });

    const refreshMasterControls = () => {
      const paused = bot.master?.isPaused?.();
      startAllButton.dataset.active = paused ? "false" : "true";
      stopAllButton.dataset.active = paused ? "true" : "false";
      startAllButton.setAttribute("aria-pressed", String(!paused));
      stopAllButton.setAttribute("aria-pressed", String(!!paused));
    };
    const refreshModuleControls = () => {
      refreshRuneStatus();
      refreshAutoHealStatus();
      refreshAutoInvisibleStatus();
      refreshAutoMagicShieldStatus();
      refreshAutoAttackStatus();
      refreshAutoEatStatus();
      refreshCaveStatus();
      refreshEquipRingStatus();
      refreshTalkStatus();
      refreshPanicStatus();
      refreshXrayStatus();
      refreshMasterControls();
    };
    startAllButton.addEventListener("click", () => {
      bot.master.start();
      refreshModuleControls();
    });
    stopAllButton.addEventListener("click", () => {
      bot.master.stop();
      refreshModuleControls();
    });
    refreshMasterControls();

    const moduleCheckboxes = {
      "minibia-bot-rune-enabled": "rune",
      "minibia-bot-auto-heal-enabled": "heal",
      "minibia-bot-auto-invisible-enabled": "invisible",
      "minibia-bot-auto-magic-shield-enabled": "magicShield",
      "minibia-bot-auto-attack-enabled": "attack",
      "minibia-bot-equip-ring-enabled": "equipRing",
      "minibia-bot-auto-eat-enabled": "eat",
      "minibia-bot-talk-enabled": "talk",
    };
    panel.addEventListener("change", (event) => {
      const name = moduleCheckboxes[event.target?.id];
      if (name) bot.master.noteModule(name, event.target.checked);
    });
    panel.addEventListener("click", (event) => {
      if (event.target?.id === "minibia-bot-cave-start") bot.master.noteModule("cave", true);
      if (event.target?.id === "minibia-bot-cave-stop") bot.master.noteModule("cave", false);
    });

    if (collapseButton) {
      collapseButton.addEventListener("click", () => {
        const isCollapsed = panel.dataset.collapsed === "true";
        setPanelCollapsed(panel, !isCollapsed);
      });
    }

    if (reloadButton) {
      reloadButton.addEventListener("click", () => {
        window.minibiaBotReload?.();
      });
    }

    if (copySetupButton) {
      if (!window.minibiaBotSourceUrl) copySetupButton.style.display = "none";
      copySetupButton.addEventListener("click", async () => {
        try {
          const code = window.minibiaBotExportCode();
          try {
            await navigator.clipboard.writeText(code);
            copySetupButton.textContent = "Configuración copiada";
          } catch {
            const input = document.createElement("textarea");
            input.value = code;
            Object.assign(input.style, { position: "fixed", inset: "10px", width: "calc(100% - 20px)", height: "55vh", zIndex: "2147483647" });
            document.body.appendChild(input);
            input.select();
            alert("Mantén pulsado el texto y elige Copiar; luego toca fuera para cerrar.");
            input.addEventListener("blur", () => input.remove(), { once: true });
          }
        } catch (error) { alert(error.message); }
      });
    }

    function addTrustedName() {
      const rawName = panicTrustedInput?.value?.trim() || "";
      if (!rawName) {
        return;
      }

      const currentNames = bot.panic?.config?.trustedNames || [];
      const exists = currentNames.some(
        (name) => String(name).trim().toLowerCase() === rawName.toLowerCase()
      );

      if (!exists) {
        bot.panic.updateConfig({ trustedNames: [...currentNames, rawName] });
      }

      if (panicTrustedInput) {
        panicTrustedInput.value = "";
      }

      renderTrustedNames();
    }

    function addGameMasterName() {
      const rawName = panicGmNameInput?.value?.trim() || "";
      if (!rawName) {
        return;
      }

      const currentNames = bot.panic?.config?.gameMasterNames || [];
      const exists = currentNames.some(
        (name) => String(name).trim().toLowerCase() === rawName.toLowerCase()
      );

      if (!exists) {
        bot.panic.updateConfig({ gameMasterNames: [...currentNames, rawName] });
      }

      if (panicGmNameInput) {
        panicGmNameInput.value = "";
      }

      renderGameMasterNames();
    }

    if (panicGmAddButton) {
      panicGmAddButton.addEventListener("click", addGameMasterName);
    }

    if (panicGmNameInput) {
      panicGmNameInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          addGameMasterName();
        }
      });
    }

    if (panicTrustedAddButton) {
      panicTrustedAddButton.addEventListener("click", addTrustedName);
    }

    if (panicTrustedInput) {
      panicTrustedInput.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          addTrustedName();
        }
      });
    }

    if (spellInput) {
      spellInput.value = bot.rune?.config?.runeSpellWords || "";
      spellInput.addEventListener("change", () => {
        bot.rune.updateConfig({ runeSpellWords: spellInput.value.trim() });
      });
    }

    if (manaInput) {
      manaInput.value = String(bot.rune?.config?.runeManaCost ?? 0);
      manaInput.addEventListener("change", () => {
        const runeManaCost = Math.max(0, Number(manaInput.value) || 0);
        manaInput.value = String(runeManaCost);
        bot.rune.updateConfig({ runeManaCost });
      });
    }

    if (runeEnabledInput) {
      runeEnabledInput.checked = !!bot.rune?.status?.().running;
      runeEnabledInput.addEventListener("change", () => {
        const runeSpellWords = spellInput?.value?.trim() || bot.rune.config.runeSpellWords;
        const runeManaCost = Math.max(0, Number(manaInput?.value) || bot.rune.config.runeManaCost || 0);

        if (runeEnabledInput.checked) {
          bot.rune.start({ runeSpellWords, runeManaCost });
        } else {
          bot.rune.stop();
        }

        refreshRuneStatus();
      });
    }

    if (autoEatHotkeyInput) {
      autoEatHotkeyInput.value = String(bot.eat?.config?.eatHotbarSlot ?? 10);
      autoEatHotkeyInput.addEventListener("change", () => {
        const eatHotbarSlot = Math.min(12, Math.max(1, Number(autoEatHotkeyInput.value) || 1));
        autoEatHotkeyInput.value = String(eatHotbarSlot);
        bot.eat.updateConfig({ eatHotbarSlot });
      });
    }

    if (autoEatEnabledInput) {
      autoEatEnabledInput.checked = !!bot.eat?.status?.().running;
      autoEatEnabledInput.addEventListener("change", () => {
        const eatHotbarSlot = Math.min(
          12,
          Math.max(1, Number(autoEatHotkeyInput?.value) || bot.eat.config.eatHotbarSlot || 1)
        );

        if (autoEatEnabledInput.checked) {
          bot.eat.start({ eatHotbarSlot });
        } else {
          bot.eat.stop();
        }

        refreshAutoEatStatus();
      });
    }

    if (autoInvisibleEnabledInput) {
      autoInvisibleEnabledInput.checked = !!bot.invisible?.status?.().running;
      autoInvisibleEnabledInput.addEventListener("change", () => {
        if (autoInvisibleEnabledInput.checked) {
          bot.invisible.start();
        } else {
          bot.invisible.stop();
        }

        refreshAutoInvisibleStatus();
      });
    }

    if (autoMagicShieldEnabledInput) {
      autoMagicShieldEnabledInput.checked = !!bot.magicShield?.status?.().running;
      autoMagicShieldEnabledInput.addEventListener("change", () => {
        if (autoMagicShieldEnabledInput.checked) {
          bot.magicShield.start();
        } else {
          bot.magicShield.stop();
        }

        refreshAutoMagicShieldStatus();
      });
    }

    if (equipRingEnabledInput) {
      equipRingEnabledInput.checked = !!bot.equipRing?.status?.().running;
      equipRingEnabledInput.addEventListener("change", () => {
        if (equipRingEnabledInput.checked) {
          bot.equipRing.start();
        } else {
          bot.equipRing.stop();
        }

        refreshEquipRingStatus();
      });
    }

    const recordCaveWaypoint = (type) => {
      const options = { type };
      if (type === "label" || type === "action") {
        const value = window.prompt(type === "label" ? "Nombre para esta marca (ej. SALIDA):" : "Instrucción: wait:2000, skip:1 o goto:SALIDA");
        if (!value?.trim()) return;
        options[type === "label" ? "label" : "action"] = value.trim();
      }
      if (!bot.cave.addWaypointCurrentSpot(options)) window.alert("No se pudo guardar. Revisa la instrucción: wait:milisegundos, skip:entero o goto:NOMBRE.");
      refreshCaveStatus();
      refreshCavePresetControls();
      refreshCaveClosestStatus();
      refreshCaveTransitionStatus();
    };
    panel.querySelectorAll("[data-cave-type]").forEach(button => button.addEventListener("click", () => {
      panel.querySelector("#minibia-bot-cave-type").value = button.dataset.caveType;
      recordCaveWaypoint(button.dataset.caveType);
    }));
    panel.querySelectorAll("[data-cave-mode]").forEach(button => button.addEventListener("click", () => {
      const mode = button.dataset.caveMode;
      panel.querySelector("#minibia-bot-cave-mode").value = mode;
      panel.querySelectorAll("[data-cave-mode]").forEach(option => option.setAttribute("aria-pressed", String(option === button)));
      bot.cave.updateConfig({ routeMode: mode });
    }));
    if (caveRemoveLastButton) {
      caveRemoveLastButton.addEventListener("click", () => {
        bot.cave.removeLastWaypoint();
        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    if (caveStartButton) {
      caveStartButton.addEventListener("click", () => {
        bot.cave.start();
        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    if (caveStopButton) {
      caveStopButton.addEventListener("click", () => {
        bot.cave.stop();
        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    if (cavePresetSelect) {
      cavePresetSelect.addEventListener("change", () => {
        const name = cavePresetSelect.value || "";
        const activePresetName = bot.cave?.getActivePresetName?.() || "";
        if (!name || name === activePresetName) {
          refreshCavePresetControls();
          return;
        }

        const loadedPreset = bot.cave.loadPreset(name);
        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    if (cavePresetNewButton) {
      cavePresetNewButton.addEventListener("click", () => {
        const name = window.prompt("Nombre de la nueva ruta:");
        if (name == null) {
          return;
        }

        const createdPreset = bot.cave.createPreset(name);
        if (!createdPreset) {
          return;
        }

        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    if (cavePresetDeleteButton) {
      cavePresetDeleteButton.addEventListener("click", () => {
        const name = cavePresetSelect?.value || "";
        if (!name) {
          return;
        }

        const deleted = bot.cave.deletePreset(name);
        if (!deleted) {
          return;
        }

        refreshCavePresetControls();
        refreshCaveStatus();
        refreshCaveClosestStatus();
        refreshCaveTransitionStatus();
      });
    }

    const escapeHealText = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" })[char]);
    const refreshHealStatus = () => {
      if (!autoHealStatus) return;
      const status = bot.heal?.status?.();
      const rules = status?.config?.rules || [];
      if (!status?.running) {
        autoHealStatus.textContent = `${rules.length} reglas guardadas · Pausado`;
        return;
      }
      const ready = rules.filter((rule) => rule.enabled && rule.slot).length;
      const action = status.pending?.ruleName ? ` · Usando: ${status.pending.ruleName}` : status.lastAction ? ` · Última: ${status.lastAction}` : "";
      autoHealStatus.textContent = `ACTIVO · ${ready} reglas listas${action}`;
    };
    const healEditor = panel.querySelector("#minibia-bot-heal-editor");
    const healListSummary = panel.querySelector("#minibia-bot-heal-list-summary");
    const healAddRow = panel.querySelector("#minibia-bot-heal-add-row");
    const healConditions = panel.querySelector("#minibia-bot-heal-conditions");
    const healCount = panel.querySelector("#minibia-bot-heal-count");
    let editingHealRuleId = null;
    let editingHealDraft = null;
    const healRuleDefault = (kind, index) => ({ id:`heal-${kind}-${Date.now()}-${index}`, kind, name:kind==="spell"?(index?"Spell Lo":"Spell Hi"):kind==="rune"?"UH Rune":"Poción", slot:null, stat:"hp", operator:"below", value:0, unit:"percent", manaCost:0, cooldownMs:1200, enabled:false });
    const renderHealRules = () => {
      const rules = Array.isArray(bot.heal?.config?.rules) ? bot.heal.config.rules : [];
      if (healCount) healCount.textContent = String(rules.length);
      if (autoHealSpellList) autoHealSpellList.innerHTML = rules.map((rule,index)=>`<article class="mb-heal-rule" data-rule-id="${escapeHealText(rule.id)}"><div class="mb-heal-rule-head"><input type="checkbox" aria-label="Activar ${escapeHealText(rule.name)}" data-heal-enabled ${rule.enabled?"checked":""}/><button type="button" class="mb-heal-rule-toggle" data-heal-edit><strong>${escapeHealText(rule.name||"Acción de curación")}</strong><span class="mb-heal-rule-summary">${rule.kind==="spell"?"Hechizo":rule.kind==="rune"?"Runa":"Poción"} · ${rule.stat==="mana"?"MP":"HP"} ${rule.operator==="above"?">":"<"} ${escapeHealText(rule.value)}${rule.unit==="percent"?"%":" pts"} · Casilla ${rule.slot||"—"}</span></button><span class="mb-heal-priority">#${index+1}</span><button type="button" data-heal-move="up" aria-label="Subir">↑</button><button type="button" data-heal-move="down" aria-label="Bajar">↓</button><button type="button" data-heal-remove aria-label="Eliminar">×</button></div></article>`).join("") || '<div class="mb-small-note">No hay acciones. Añade un hechizo, una runa o una poción.</div>';
      if(autoHealItemList) autoHealItemList.innerHTML="";
      const editing=!!editingHealDraft;
      if(autoHealSpellList) autoHealSpellList.hidden=editing;
      if(healAddRow) healAddRow.hidden=editing;
      if(healConditions) healConditions.hidden=editing;
      if(healListSummary){healListSummary.hidden=!editing;healListSummary.textContent=editing?`Lista minimizada · ${rules.length} acciones guardadas`:"";}
      if(!healEditor)return;
      healEditor.hidden=!editing;
      if(!editing){healEditor.innerHTML="";refreshHealStatus();return;}
      const r=editingHealDraft, opt=(v,s,l)=>`<option value="${v}" ${s===v?"selected":""}>${l}</option>`;
      healEditor.innerHTML=`<div class="mb-heal-group-title">${editingHealRuleId?"Editar acción":"Nueva acción"}</div><label class="mb-field"><span class="mb-field-label">Nombre de la acción</span><input type="text" maxlength="48" value="${escapeHealText(r.name)}" data-heal-draft="name"/></label><div class="mb-heal-rule-grid"><label class="mb-field"><span class="mb-field-label">Casilla (1–12)</span><input type="number" min="1" max="12" inputmode="numeric" placeholder="Sin asignar" value="${r.slot??""}" data-heal-draft="slot"/></label><label class="mb-field"><span class="mb-field-label">Vigilar</span><select data-heal-draft="stat">${opt("hp",r.stat,"Vida · HP")}${opt("mana",r.stat,"Maná · MP")}</select></label><label class="mb-field"><span class="mb-field-label">Condición</span><select data-heal-draft="operator">${opt("below",r.operator,"Por debajo de")}${opt("above",r.operator,"Por encima de")}</select></label><label class="mb-field"><span class="mb-field-label">Umbral</span><input type="number" min="0" step="1" value="${r.value}" data-heal-draft="value"/></label><label class="mb-field"><span class="mb-field-label">Unidad</span><select data-heal-draft="unit">${opt("points",r.unit,"Puntos")}${opt("percent",r.unit,"Porcentaje")}</select></label><label class="mb-field"><span class="mb-field-label">Maná requerido</span><input type="number" min="0" value="${r.manaCost}" data-heal-draft="manaCost"/></label><label class="mb-field"><span class="mb-field-label">Delay / CD (ms)</span><input type="number" min="0" max="60000" value="${r.cooldownMs}" data-heal-draft="cooldownMs"/></label></div><div class="mb-heal-editor-actions"><button type="button" data-heal-save>Guardar</button><button type="button" data-heal-cancel>Volver a la lista</button></div>`;
      refreshHealStatus();
    };
    const saveHealRules = (rules) => { bot.heal.updateConfig({rules}); renderHealRules(); };
    const readHealDraft = () => { for(const el of healEditor.querySelectorAll("[data-heal-draft]")){const p=el.dataset.healDraft;if(p==="slot")editingHealDraft.slot=el.value===""?null:Math.min(12,Math.max(1,Number(el.value)||1));else if(p==="value"||p==="manaCost"||p==="cooldownMs")editingHealDraft[p]=Math.max(0,Number(el.value)||0);else editingHealDraft[p]=p==="name"?(el.value.trim().slice(0,48)||"Acción de curación"):el.value;} };
    panel.addEventListener("click",(event)=>{
      const add=event.target.closest("[data-heal-add]");
      if(add){const rules=[...bot.heal.config.rules];if(rules.length>=24)return;const kind=add.dataset.healAdd;editingHealRuleId=null;editingHealDraft=healRuleDefault(kind,rules.filter(x=>x.kind===kind).length);renderHealRules();return;}
      const card=event.target.closest(".mb-heal-rule");
      if(card){const rules=[...bot.heal.config.rules], index=rules.findIndex(x=>x.id===card.dataset.ruleId);if(index<0)return;
        if(event.target.closest("[data-heal-edit]")){editingHealRuleId=rules[index].id;editingHealDraft={...rules[index]};renderHealRules();return;}
        if(event.target.matches("[data-heal-enabled]")){rules[index].enabled=event.target.checked;saveHealRules(rules);return;}
        if(event.target.closest("[data-heal-remove]")){rules.splice(index,1);saveHealRules(rules);return;}
        const move=event.target.closest("[data-heal-move]")?.dataset.healMove;if(move){const dest=move==="up"?index-1:index+1;if(dest<0||dest>=rules.length)return;[rules[index],rules[dest]]=[rules[dest],rules[index]];saveHealRules(rules);}return;
      }
      if(event.target.closest("[data-heal-cancel]")){editingHealDraft=null;editingHealRuleId=null;renderHealRules();return;}
      if(event.target.closest("[data-heal-save]")){readHealDraft();const rules=[...bot.heal.config.rules],index=editingHealRuleId?rules.findIndex(x=>x.id===editingHealRuleId):-1;if(index>=0)rules[index]={...editingHealDraft};else rules.push({...editingHealDraft});editingHealDraft=null;editingHealRuleId=null;saveHealRules(rules);}
    });
    panel.addEventListener("change",(event)=>{const el=event.target.closest("[data-heal-draft]");if(el&&editingHealDraft){const p=el.dataset.healDraft;if(p==="slot")editingHealDraft.slot=el.value===""?null:Math.min(12,Math.max(1,Number(el.value)||1));else if(p==="value"||p==="manaCost"||p==="cooldownMs")editingHealDraft[p]=Math.max(0,Number(el.value)||0);else editingHealDraft[p]=p==="name"?(el.value.trim().slice(0,48)||"Acción de curación"):el.value;}});

    if (autoHealWaitInput) {
      autoHealWaitInput.value = String(bot.heal.config.tickMs ?? 100);
      autoHealWaitInput.addEventListener("change", () => bot.heal.updateConfig({ tickMs: Math.min(5000, Math.max(50, Number(autoHealWaitInput.value) || 100)) }));
    }
    if (autoHealDelayInput) {
      autoHealDelayInput.value = String(bot.heal.config.delayMs ?? 0);
      autoHealDelayInput.addEventListener("change", () => bot.heal.updateConfig({ delayMs: Math.min(60000, Math.max(0, Number(autoHealDelayInput.value) || 0)) }));
    }
    if (autoHealMinManaInput) {
      autoHealMinManaInput.value = String(bot.heal.config.minimumMana ?? 0);
      autoHealMinManaInput.addEventListener("change", () => bot.heal.updateConfig({ minimumMana: Math.max(0, Number(autoHealMinManaInput.value) || 0) }));
    }
    if (autoHealEnabledInput) {
      autoHealEnabledInput.checked = !!bot.heal.status().running;
      autoHealEnabledInput.addEventListener("change", () => {
        if (autoHealEnabledInput.checked) bot.heal.start();
        else bot.heal.stop();
        renderHealRules();
      });
    }
    renderHealRules();
    const healStatusTimerId = window.setInterval(refreshHealStatus, 500);
    bot.addCleanup(() => window.clearInterval(healStatusTimerId));

    const addAttackPriorityName = (suggestedName = null) => {
      const name = String(suggestedName ?? autoAttackTargetNameInput?.value ?? "").trim();
      const priority = Array.isArray(bot.attack?.config?.targetPriority) ? [...bot.attack.config.targetPriority] : [];
      if (!name) {
        if (autoAttackTargetFeedback) autoAttackTargetFeedback.textContent = "Escribe el nombre de una criatura.";
        autoAttackTargetNameInput?.focus();
        return;
      }
      if (priority.some((entry) => entry.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
        if (autoAttackTargetFeedback) autoAttackTargetFeedback.textContent = `${name} ya está en la lista.`;
        return;
      }
      if (priority.length >= 50) {
        if (autoAttackTargetFeedback) autoAttackTargetFeedback.textContent = "La lista admite hasta 50 criaturas.";
        return;
      }
      bot.attack.updateConfig({ targetPriority: [...priority, { name, stance: "default" }] });
      if (autoAttackTargetFeedback) autoAttackTargetFeedback.textContent = `${name} añadido.`;
      if (autoAttackTargetNameInput) autoAttackTargetNameInput.value = "";
      refreshAttackTargetList();
      refreshAttackVisibleList();
    };

    autoAttackTargetAddButton?.addEventListener("click", addAttackPriorityName);
    autoAttackVisibleList?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-attack-visible-target]");
      if (button) addAttackPriorityName(button.dataset.attackVisibleTarget);
    });
    autoAttackTargetNameInput?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        addAttackPriorityName();
      }
    });
    autoAttackTargetList?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-attack-priority-action]");
      if (!button) return;
      const priority = [...(bot.attack?.config?.targetPriority || [])];
      const index = Number(button.dataset.attackPriorityIndex);
      const action = button.dataset.attackPriorityAction;
      if (!Number.isInteger(index) || index < 0 || index >= priority.length) return;
      if (action === "remove") priority.splice(index, 1);
      else {
        const nextIndex = index + (action === "up" ? -1 : 1);
        if (nextIndex < 0 || nextIndex >= priority.length) return;
        [priority[index], priority[nextIndex]] = [priority[nextIndex], priority[index]];
      }
      bot.attack.updateConfig({ targetPriority: priority });
      if (autoAttackTargetFeedback) autoAttackTargetFeedback.textContent = "Orden actualizado.";
      refreshAttackTargetList();
      refreshAttackVisibleList();
    });
    autoAttackTargetList?.addEventListener("change", (event) => {
      const select = event.target.closest("select[data-attack-priority-stance-index]");
      if (!select) return;
      const priority = [...(bot.attack?.config?.targetPriority || [])];
      const index = Number(select.dataset.attackPriorityStanceIndex);
      if (!Number.isInteger(index) || !priority[index]) return;
      priority[index] = { ...priority[index], stance: select.value };
      bot.attack.updateConfig({ targetPriority: priority });
      if (autoAttackTargetFeedback) autoAttackTargetFeedback.textContent = `Modo de ${priority[index].name} actualizado.`;
      refreshAttackTargetList();
    });
    if (autoAttackTargetOnlyInput) {
      autoAttackTargetOnlyInput.checked = !!bot.attack?.config?.onlyPriorityTargets;
      autoAttackTargetOnlyInput.addEventListener("change", () => {
        bot.attack.updateConfig({ onlyPriorityTargets: autoAttackTargetOnlyInput.checked });
      });
    }
    if (autoAttackSelectionInput) {
      autoAttackSelectionInput.value = bot.attack?.config?.targetSelectionMode === "list" ? "list" : "proximity";
      autoAttackSelectionInput.addEventListener("change", () => {
        bot.attack.updateConfig({ targetSelectionMode: autoAttackSelectionInput.value });
      });
    }

    if (autoAttackHotkeyInput) {
      autoAttackHotkeyInput.value = String(bot.attack?.config?.targetHotbarSlot ?? 3);
      autoAttackHotkeyInput.addEventListener("change", () => {
        const targetHotbarSlot = Math.min(12, Math.max(1, Number(autoAttackHotkeyInput.value) || 1));
        autoAttackHotkeyInput.value = String(targetHotbarSlot);
        bot.attack.updateConfig({ targetHotbarSlot });
      });
    }

    if (autoAttackRuneHotkeyInput) {
      autoAttackRuneHotkeyInput.value = bot.attack?.config?.runeHotbarSlot
        ? String(bot.attack.config.runeHotbarSlot)
        : "";
      autoAttackRuneHotkeyInput.addEventListener("change", () => {
        const rawValue = Number(autoAttackRuneHotkeyInput.value);
        const runeHotbarSlot = Number.isFinite(rawValue) && rawValue >= 1 && rawValue <= 12
          ? Math.trunc(rawValue)
          : null;
        autoAttackRuneHotkeyInput.value = runeHotbarSlot ? String(runeHotbarSlot) : "";
        bot.attack.updateConfig({ runeHotbarSlot });
      });
    }

    if (autoAttackStanceInput) {
      autoAttackStanceInput.value = bot.attack?.config?.meleeMode === false ? "ranged" : "melee";
      autoAttackStanceInput.addEventListener("change", () => {
        bot.attack.updateConfig({ meleeMode: autoAttackStanceInput.value === "melee" });
      });
    }

    if (autoAttackRangeInput) {
      autoAttackRangeInput.value = String(bot.attack?.config?.rangedDistance ?? 3);
      autoAttackRangeInput.addEventListener("change", () => {
        const distance = Math.min(8, Math.max(2, Math.trunc(Number(autoAttackRangeInput.value) || 3)));
        autoAttackRangeInput.value = String(distance);
        bot.attack.updateConfig({ rangedDistance: distance });
      });
    }

    if (autoAttackEnabledInput) {
      autoAttackEnabledInput.checked = !!bot.attack?.status?.().running;
      autoAttackEnabledInput.addEventListener("change", () => {
        const targetHotbarSlot = Math.min(
          12,
          Math.max(1, Number(autoAttackHotkeyInput?.value) || bot.attack.config.targetHotbarSlot || 1)
        );
        const runeHotbarSlot = (() => {
          const rawValue = Number(autoAttackRuneHotkeyInput?.value);
          if (Number.isFinite(rawValue) && rawValue >= 1 && rawValue <= 12) {
            return Math.trunc(rawValue);
          }

          return bot.attack.config.runeHotbarSlot ?? null;
        })();
        const meleeMode = autoAttackStanceInput?.value !== "ranged";

        if (autoAttackEnabledInput.checked) {
          bot.attack.start({ targetHotbarSlot, runeHotbarSlot, meleeMode });
        } else {
          bot.attack.stop();
        }

        refreshAutoAttackStatus();
      });
    }

    if (talkApiKeyInput) {
      talkApiKeyInput.value = bot.talk?.config?.apiKey || "";
      talkApiKeyInput.addEventListener("change", () => {
        bot.talk.updateConfig({ apiKey: talkApiKeyInput.value.trim() });
        refreshTalkStatus();
      });
    }

    if (talkPromptInput) {
      talkPromptInput.value = bot.talk?.config?.systemPrompt || "";
      talkPromptInput.addEventListener("change", () => {
        bot.talk.updateConfig({ systemPrompt: talkPromptInput.value.trim() });
      });
    }

    if (talkEnabledInput) {
      talkEnabledInput.checked = !!bot.talk?.status?.().running;
      talkEnabledInput.addEventListener("change", () => {
        if (talkEnabledInput.checked) {
          bot.talk.updateConfig({
            apiKey: talkApiKeyInput?.value?.trim() || "",
            systemPrompt: talkPromptInput?.value?.trim() || bot.talk.config.systemPrompt || "",
          });
          const started = bot.talk.start();
          if (!started) {
            talkEnabledInput.checked = false;
          }
        } else {
          bot.talk.stop();
        }

        refreshTalkStatus();
      });
    }

    if (panicUnknownInput) {
      panicUnknownInput.checked = !!bot.panic?.status?.().config?.unknownPlayerEnabled;
      panicUnknownInput.addEventListener("change", () => {
        bot.panic.updateConfig({ unknownPlayerEnabled: panicUnknownInput.checked });
        refreshPanicStatus();
      });
    }

    if (panicHealthInput) {
      panicHealthInput.checked = !!bot.panic?.status?.().config?.healthLossEnabled;
      panicHealthInput.addEventListener("change", () => {
        bot.panic.updateConfig({ healthLossEnabled: panicHealthInput.checked });
        refreshPanicStatus();
      });
    }

    if (panicReturnInput) {
      panicReturnInput.checked = !!bot.panic?.status?.().config?.returnToOriginEnabled;
      panicReturnInput.addEventListener("change", () => {
        bot.panic.updateConfig({ returnToOriginEnabled: panicReturnInput.checked });
        refreshPanicStatus();
      });
    }

    if (xrayOverlayButton) {
      xrayOverlayButton.addEventListener("click", () => {
        const enabled = !!bot.xray?.status?.().config?.overlayEnabled;
        bot.xray?.setOverlayEnabled?.(!enabled);
        refreshXrayStatus();
      });
    }

    if (xrayFloorSelect) {
      xrayFloorSelect.addEventListener("change", () => {
        const rawValue = xrayFloorSelect.value;
        bot.xray?.setSelectedFloor?.(rawValue === "all" ? null : Number(rawValue));
        refreshXrayStatus();
        refreshVisibleCreatures();
      });
    }

    panel.querySelector("#minibia-bot-set-home")?.addEventListener("click", () => {
      bot.pz.setHomePzCurrentSpot();
      refreshHomeLabel();
    });

    refreshHomeLabel();
    refreshPanicStatus();
    refreshXrayStatus();
    renderGameMasterNames();
    renderTrustedNames();
    refreshRuneStatus();
    refreshAutoHealStatus();
    refreshAutoInvisibleStatus();
    refreshAutoMagicShieldStatus();
    refreshAutoAttackStatus();
    refreshAttackTargetList();
    refreshAttackVisibleList();
    refreshAutoEatStatus();
    refreshCaveStatus();
    refreshEquipRingStatus();
    refreshTalkStatus();
    refreshVisibleCreatures();
    refreshCavePresetControls();
    refreshCaveClosestStatus();
    refreshCaveTransitionStatus();

    const refreshMobileSummary = () => {
      const summary = panel.querySelector(".mb-mobile-summary");
      if (!summary || !panel.classList.contains("mb-mobile")) return;
      const state = bot.getPlayerSnapshot?.() || {};
      const value = (number) => number == null ? "?" : number;
      const cave = bot.cave?.status?.();
      summary.textContent = `HP ${value(state.health)}/${value(state.maxHealth)}  •  MP ${value(state.mana)}/${value(state.maxMana)}\n` +
        `Level ${value(state.level)}  •  Cap ${value(state.capacity)}\n` +
        `Cueva: ${cave?.running ? "activa" : "detenida"}  •  Heal: ${bot.heal?.status?.().running ? "activo" : "detenido"}`;
    };
    refreshMobileSummary();
    const summaryTimerId = window.setInterval(refreshMobileSummary, 1500);
    bot.addCleanup(() => window.clearInterval(summaryTimerId));

    const refreshSafetyStatus = () => {
      const label = panel.querySelector(".mb-safety-status");
      const pending = bot.panic?.status?.().pendingReturn;
      if (!label) return;
      if (!pending) {
        label.textContent = "🛡️ Protección lista · Sin regreso pendiente";
        return;
      }
      const players = bot.panic?.getVisiblePlayers?.() || [];
      const { x, y, z } = pending.origin;
      const seconds = Math.max(0, Math.ceil(((pending.returnNotBeforeAt || 0) - Date.now()) / 1000));
      const clock = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
      label.textContent = `📍 Volverá a ${x}, ${y}, ${z}\n` +
        (players.length ? `👀 ${players.length} jugador(es) cerca · esperando` :
          seconds ? `⏱️ Espera mínima para salir: ${clock}` : "🚶 Intentando regresar…");
    };
    refreshSafetyStatus();
    const safetyTimerId = window.setInterval(refreshSafetyStatus, 1000);
    bot.addCleanup(() => window.clearInterval(safetyTimerId));

    const visibleCreaturesTimerId = window.setInterval(refreshVisibleCreatures, 1000);
    bot.addCleanup(() => {
      window.clearInterval(visibleCreaturesTimerId);
    });

    const talkStatusTimerId = window.setInterval(refreshTalkStatus, 1000);
    bot.addCleanup(() => {
      window.clearInterval(talkStatusTimerId);
    });

    const caveStatusTimerId = window.setInterval(() => {
      refreshCaveStatus();
      refreshCavePresetControls();
      refreshCaveClosestStatus();
      refreshCaveTransitionStatus();
    }, 1000);
    bot.addCleanup(() => {
      window.clearInterval(caveStatusTimerId);
    });

    const autoAttackStatusTimerId = window.setInterval(() => {
      refreshAutoAttackStatus();
      refreshAttackVisibleList();
    }, 1000);
    bot.addCleanup(() => window.clearInterval(autoAttackStatusTimerId));

  }

  bot.ui = {
    inject,
    destroy,
    refreshHomeLabel,
    refreshPanicStatus,
    refreshXrayStatus,
    refreshRuneStatus,
    refreshAutoHealStatus,
    refreshAutoInvisibleStatus,
    refreshAutoMagicShieldStatus,
    refreshAutoAttackStatus,
    refreshAutoEatStatus,
    refreshCaveStatus,
    refreshCavePresetControls,
    refreshEquipRingStatus,
    refreshTalkStatus,
    refreshVisibleCreatures,
    refreshCaveClosestStatus,
    refreshCaveTransitionStatus,
    getSavedPanelPosition,
    getSavedPanelCollapsed,
    setPanelCollapsed: (collapsed) => {
      const panel = document.getElementById("minibia-bot-panel");
      setPanelCollapsed(panel, collapsed);
    },
  };
};
(() => {
  const bundle = window.__minibiaBotBundle || window.__minibiaBotReloadBundle || {};
  const portableKeys = [
    "minibiaBot.pz.home", "minibiaBot.panic.config", "minibiaBot.cave.config",
    "minibiaBot.cave.route", "minibiaBot.cave.transitions", "minibiaBot.cave.presets",
    "minibiaBot.attack.config", "minibiaBot.rune.config", "minibiaBot.heal.config",
    "minibiaBot.eat.config", "minibiaBot.equipRing.config", "minibiaBot.invisible.config",
    "minibiaBot.magicShield.config", "minibiaBot.xray.config"
  ];
  const importedProfile = window.minibiaBotImportProfile;
  let importedProfilePending = !!importedProfile;
  delete window.minibiaBotImportProfile;
  if (importedProfile && typeof importedProfile === "object") {
    for (const key of portableKeys) {
      if (typeof importedProfile[key] === "string") {
        window.localStorage.setItem(key, importedProfile[key]);
      }
    }
  }
  window.minibiaBotExportCode = () => {
    const url = window.minibiaBotSourceUrl;
    if (!url || !/^https:\/\//i.test(url)) {
      throw new Error("Primero publica nuestra versión y cárgala desde su enlace HTTPS.");
    }
    const profile = Object.fromEntries(portableKeys
      .map(key => [key, window.localStorage.getItem(key)])
      .filter(([, value]) => value !== null));
    return `(async()=>{window.minibiaBotImportProfile=${JSON.stringify(profile)};` +
      `window.minibiaBotSourceUrl=${JSON.stringify(url)};` +
      `const r=await fetch(window.minibiaBotSourceUrl,{cache:"no-store"});` +
      `if(!r.ok)throw Error("Bot HTTP "+r.status);const a=Uint8Array.from(atob(await r.text()),c=>c.charCodeAt(0));` +
      `const s=await new Response(new Blob([a]).stream().pipeThrough(new DecompressionStream("gzip"))).text();` +
      `(0,eval)(s)})()` +
      `.catch(e=>alert(e.message));`;
  };
  const persistedEnabledModules = [
    ["rune", "minibiaBot.rune.config"],
    ["heal", "minibiaBot.heal.config"],
    ["invisible", "minibiaBot.invisible.config"],
    ["magicShield", "minibiaBot.magicShield.config"],
    ["attack", "minibiaBot.attack.config"],
    ["cave", "minibiaBot.cave.config"],
    ["equipRing", "minibiaBot.equipRing.config"],
    ["eat", "minibiaBot.eat.config"],
    ["talk", "minibiaBot.talk.config"],
  ];
  const masterResumeKey = "minibiaBot.master.resume";

  function getPersistedEnabledSnapshot(bot) {
    const snapshot = {};
    const status = typeof bot?.status === "function" ? bot.status() : null;

    persistedEnabledModules.forEach(([moduleName]) => {
      const enabled = status?.[moduleName]?.config?.enabled;
      if (typeof enabled === "boolean") {
        snapshot[moduleName] = enabled;
      }
    });

    return snapshot;
  }

  function restorePersistedEnabledSnapshot(snapshot) {
    persistedEnabledModules.forEach(([moduleName, storageKey]) => {
      if (typeof snapshot?.[moduleName] !== "boolean") {
        return;
      }

      try {
        const rawValue = window.localStorage.getItem(storageKey);
        const config = rawValue ? JSON.parse(rawValue) : {};
        config.enabled = snapshot[moduleName];
        window.localStorage.setItem(storageKey, JSON.stringify(config));
      } catch (error) {
        console.error("[minibia-bot] failed to restore persisted enabled state", {
          module: moduleName,
          error,
        });
      }
    });
  }

  function boot(currentBundle = bundle) {
    const previousEnabledSnapshot = importedProfilePending ? {} : getPersistedEnabledSnapshot(window.minibiaBot);
    importedProfilePending = false;

    if (window.minibiaBot?.destroy) {
      window.minibiaBot.destroy();
    }

    restorePersistedEnabledSnapshot(previousEnabledSnapshot);

    const bot = currentBundle.createBot();

    currentBundle.installPzModule(bot);
    currentBundle.installXrayModule(bot);
    currentBundle.installPanicModule(bot);
    currentBundle.installRuneModule(bot);
    currentBundle.installHealModule(bot);
    currentBundle.installAutoInvisibleModule(bot);
    currentBundle.installAutoMagicShieldModule(bot);
    currentBundle.installAutoAttackModule(bot);
    currentBundle.installCaveModule(bot);
    currentBundle.installEquipRingModule(bot);
    currentBundle.installAutoEatModule(bot);
    currentBundle.installTalkModule(bot);

    const moduleNames = persistedEnabledModules.map(([name]) => name);
    bot.master = {
      isPaused: () => !!bot.storage.get(masterResumeKey, null),
      noteModule(name, enabled) {
        const saved = bot.storage.get(masterResumeKey, null);
        if (!saved || !moduleNames.includes(name)) return;
        saved.modules[name] = !!enabled;
        bot.storage.set(masterResumeKey, saved);
      },
      stop() {
        let saved = bot.storage.get(masterResumeKey, null);
        if (!saved) {
          saved = {
            modules: Object.fromEntries(moduleNames.map((name) => [
              name, !!bot[name]?.status?.().config?.enabled,
            ])),
            panic: bot.panic?.status?.().config || {},
            overlayEnabled: !!bot.xray?.status?.().config?.overlayEnabled,
          };
          bot.storage.set(masterResumeKey, saved);
        }

        moduleNames.forEach((name) => bot[name]?.stop?.());
        bot.panic?.updateConfig?.({
          unknownPlayerEnabled: false,
          healthLossEnabled: false,
          returnToOriginEnabled: false,
          gameMasterNames: [],
        });
        bot.panic?.stop?.();
        bot.xray?.setOverlayEnabled?.(false);
        bot.setReconnectWatcherEnabled?.(false);
        return true;
      },
      start() {
        const saved = bot.storage.get(masterResumeKey, null);
        bot.storage.remove(masterResumeKey);
        bot.setReconnectWatcherEnabled?.(true);

        if (saved) {
          bot.panic?.updateConfig?.(saved.panic || {});
          bot.xray?.setOverlayEnabled?.(!!saved.overlayEnabled);
        }
        moduleNames.forEach((name) => {
          if (saved ? saved.modules?.[name] : bot[name]?.status?.().config?.enabled) {
            bot[name]?.start?.();
          }
        });
        return true;
      },
    };
    currentBundle.installPanel(bot);

    bot.ui.inject();

    bot.start = () => bot.master.start();
    bot.stop = () => bot.master.stop();
    bot.reload = () => window.minibiaBotReload?.();
    bot.status = () => ({
      version: bot.version,
      pz: {
        home: bot.pz.getHomePz(),
      },
      xray: bot.xray.status(),
      panic: bot.panic.status(),
      rune: bot.rune.status(),
      heal: bot.heal.status(),
      invisible: bot.invisible.status(),
      magicShield: bot.magicShield.status(),
      attack: bot.attack.status(),
      cave: bot.cave.status(),
      equipRing: bot.equipRing.status(),
      eat: bot.eat.status(),
      talk: bot.talk.status(),
    });

    window.minibiaBot = bot;
    window.pzBot = bot.pz;

    console.log("[minibia-bot] ready", {
      version: bot.version,
      modules: ["pz", "xray", "panic", "rune", "heal", "invisible", "magicShield", "attack", "cave", "equipRing", "eat", "talk", "ui"],
    });
    console.log("minibiaBot.reload()");
    console.log("minibiaBot.xray.status()");
    console.log("minibiaBot.panic.status()");
    console.log("minibiaBot.pz.goToNearestPz()");
    console.log("minibiaBot.pz.setHomePzCurrentSpot()");
    console.log("minibiaBot.pz.goToHomePz()");
    console.log("minibiaBot.rune.start()");
    console.log("minibiaBot.rune.stop()");
    console.log("minibiaBot.heal.start()");
    console.log("minibiaBot.heal.stop()");
    console.log("minibiaBot.invisible.start()");
    console.log("minibiaBot.invisible.stop()");
    console.log("minibiaBot.magicShield.start()");
    console.log("minibiaBot.magicShield.stop()");
    console.log("minibiaBot.attack.start()");
    console.log("minibiaBot.attack.stop()");
    console.log("minibiaBot.cave.addWaypointCurrentSpot()");
    console.log("minibiaBot.cave.start()");
    console.log("minibiaBot.cave.stop()");
    console.log("minibiaBot.equipRing.start()");
    console.log("minibiaBot.equipRing.stop()");
    console.log("minibiaBot.eat.start()");
    console.log("minibiaBot.eat.stop()");
    console.log("minibiaBot.talk.updateConfig({ apiKey: \"...\" })");
    console.log("minibiaBot.talk.start()");
    console.log("minibiaBot.talk.stop()");
    return bot;
  }

  window.__minibiaBotReloadBundle = bundle;
  window.minibiaBotReload = () => boot(window.__minibiaBotReloadBundle || bundle);
  delete window.__minibiaBotBundle;
  boot(bundle);
})();
