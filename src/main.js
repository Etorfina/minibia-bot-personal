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
    currentBundle.installPanel(bot);

    bot.ui.inject();

    bot.start = (...args) => bot.rune.start(...args);
    bot.stop = (...args) => bot.rune.stop(...args);
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
