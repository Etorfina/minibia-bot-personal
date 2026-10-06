window.__minibiaBotBundle = window.__minibiaBotBundle || {};

window.__minibiaBotBundle.installProfileModule = function installProfileModule(bot) {
  const storageKey = "minibiaBot.profiles.v1";
  const masterResumeKey = "minibiaBot.master.resume";
  const moduleNames = ["rune", "heal", "invisible", "magicShield", "attack", "cave", "equipRing", "eat", "talk"];

  function clone(value) {
    if (value == null) return value;
    try { return JSON.parse(JSON.stringify(value)); }
    catch { return null; }
  }

  function normalizeCharacterName(value) {
    return String(value || "").trim().toLocaleLowerCase();
  }

  function normalizeName(value) {
    return String(value || "").trim().replace(/\s+/g, " ").slice(0, 60);
  }

  function readRegistry() {
    const saved = bot.storage.get(storageKey, null);
    if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
      return { version: 1, profiles: [], characters: {}, currentProfileId: null, defaultConfig: null };
    }
    return {
      version: 1,
      profiles: Array.isArray(saved.profiles) ? saved.profiles.filter((profile) => profile && typeof profile === "object") : [],
      characters: saved.characters && typeof saved.characters === "object" ? saved.characters : {},
      currentProfileId: typeof saved.currentProfileId === "string" ? saved.currentProfileId : null,
      defaultConfig: saved.defaultConfig && typeof saved.defaultConfig === "object" ? saved.defaultConfig : null,
    };
  }

  let registry = readRegistry();
  let activeCharacterName = null;
  let lastMessage = "";
  let nextProfileNumber = 1;

  function persist() {
    bot.storage.set(storageKey, registry);
  }

  function profileById(id) {
    return registry.profiles.find((profile) => profile.id === id) || null;
  }

  function moduleConfig(name) {
    const module = bot[name];
    const status = module?.status?.();
    const config = status?.config || module?.config || {};
    const safeConfig = clone(config) || {};
    if (name === "talk") delete safeConfig.apiKey;
    return safeConfig;
  }

  function captureConfig() {
    const caveStatus = bot.cave?.status?.() || {};
    const caveConfig = clone(caveStatus.config || bot.cave?.config || {}) || {};
    const talkConfig = moduleConfig("talk");

    return {
      pzHome: clone(bot.pz?.getHomePz?.() || null),
      xray: clone(bot.xray?.config || {}) || {},
      panic: clone(bot.panic?.status?.().config || {}) || {},
      rune: moduleConfig("rune"),
      heal: moduleConfig("heal"),
      invisible: moduleConfig("invisible"),
      magicShield: moduleConfig("magicShield"),
      attack: moduleConfig("attack"),
      cave: {
        config: caveConfig,
        route: clone(bot.cave?.getRoute?.() || caveStatus.route || []) || [],
        transitions: clone(bot.cave?.getTransitions?.() || caveStatus.transitions || []) || [],
        routeMode: caveConfig.routeMode === "loop" ? "loop" : "pingpong",
        presetName: caveStatus.activePresetName || caveConfig.activePresetName || "Default",
      },
      equipRing: moduleConfig("equipRing"),
      eat: moduleConfig("eat"),
      talk: talkConfig,
    };
  }

  function makeProfileId() {
    const randomPart = Math.random().toString(36).slice(2, 7);
    return `profile-${Date.now().toString(36)}-${nextProfileNumber++}-${randomPart}`;
  }

  function saveCurrentProfile() {
    const current = profileById(registry.currentProfileId);
    if (!current) return null;
    current.config = captureConfig();
    current.updatedAt = Date.now();
    persist();
    return current;
  }

  function stopModules() {
    bot.panic?.stop?.();
    bot.xray?.stopOverlay?.();
    moduleNames.forEach((name) => bot[name]?.stop?.({ persistEnabled: false }));
  }

  function applyConfig(config = {}, profileName = "") {
    const paused = !!bot.master?.isPaused?.();
    stopModules();

    if (config.pzHome && bot.pz?.setHomePz) {
      bot.pz.setHomePz(config.pzHome.x, config.pzHome.y, config.pzHome.z);
    } else {
      bot.pz?.clearHomePz?.();
    }

    const xray = clone(config.xray) || {};
    bot.xray?.setSelectedFloor?.(xray.selectedFloor ?? null);
    bot.xray?.setOverlayEnabled?.(paused ? false : !!xray.overlayEnabled);

    const panic = clone(config.panic) || {};
    bot.panic?.updateConfig?.(paused ? {
      ...panic,
      unknownPlayerEnabled: false,
      healthLossEnabled: false,
      returnToOriginEnabled: false,
      gameMasterNames: [],
    } : panic);

    const cave = clone(config.cave) || {};
    const caveConfig = clone(cave.config) || {};
    if (cave.route || cave.transitions) {
      bot.cave?.applyProfilePreset?.({
        name: profileName || cave.presetName || caveConfig.activePresetName || "Default",
        route: cave.route || [],
        transitions: cave.transitions || [],
        routeMode: cave.routeMode || caveConfig.routeMode,
      });
    }

    const nextConfigs = {
      rune: config.rune,
      heal: config.heal,
      invisible: config.invisible,
      magicShield: config.magicShield,
      attack: config.attack,
      cave: { ...caveConfig, activePresetName: profileName || cave.presetName || caveConfig.activePresetName },
      equipRing: config.equipRing,
      eat: config.eat,
      talk: config.talk,
    };

    moduleNames.forEach((name) => {
      const module = bot[name];
      if (!module?.updateConfig || !nextConfigs[name] || typeof nextConfigs[name] !== "object") return;
      const next = clone(nextConfigs[name]) || {};
      if (name === "talk") next.apiKey = module.config?.apiKey || "";
      module.updateConfig(next);
    });

    if (paused) {
      const resume = bot.storage.get(masterResumeKey, null);
      if (resume && typeof resume === "object") {
        resume.modules = Object.fromEntries(moduleNames.map((name) => [
          name,
          !!nextConfigs[name]?.enabled,
        ]));
        resume.panic = clone(config.panic) || {};
        resume.overlayEnabled = !!xray.overlayEnabled;
        bot.storage.set(masterResumeKey, resume);
      }
      return;
    }

    moduleNames.forEach((name) => {
      if (nextConfigs[name]?.enabled) bot[name]?.start?.();
    });
  }

  function createProfile(name, config, characterKey = "") {
    const profile = {
      id: makeProfileId(),
      name: normalizeName(name) || `Perfil ${nextProfileNumber}`,
      config: clone(config) || captureConfig(),
      updatedAt: Date.now(),
    };
    registry.profiles.push(profile);
    if (characterKey) registry.characters[characterKey] = profile.id;
    return profile;
  }

  function profileViews() {
    return registry.profiles.map(({ id, name, updatedAt }) => ({ id, name, updatedAt }));
  }

  function getStatus() {
    const current = profileById(registry.currentProfileId);
    return {
      profiles: profileViews(),
      currentProfileId: current?.id || null,
      currentProfileName: current?.name || "",
      characterName: activeCharacterName || bot.getPlayerName?.() || "",
      message: lastMessage,
    };
  }

  function save(name = "") {
    const requestedName = normalizeName(name) ||
      profileById(registry.currentProfileId)?.name ||
      normalizeName(activeCharacterName) || "Mi perfil";
    let profile = registry.profiles.find((entry) =>
      normalizeName(entry.name).toLocaleLowerCase() === requestedName.toLocaleLowerCase()
    );
    if (!profile) profile = createProfile(requestedName, captureConfig());
    profile.name = requestedName;
    profile.config = captureConfig();
    profile.updatedAt = Date.now();
    registry.currentProfileId = profile.id;
    const key = normalizeCharacterName(activeCharacterName);
    if (key) registry.characters[key] = profile.id;
    lastMessage = `Perfil “${profile.name}” guardado.`;
    persist();
    return { ...profile, config: clone(profile.config) };
  }

  function use(id) {
    const profile = profileById(id);
    if (!profile) return false;
    if (registry.currentProfileId && registry.currentProfileId !== id) saveCurrentProfile();
    registry.currentProfileId = id;
    const key = normalizeCharacterName(activeCharacterName);
    if (key) registry.characters[key] = id;
    applyConfig(profile.config, profile.name);
    lastMessage = `Perfil “${profile.name}” aplicado.`;
    persist();
    return true;
  }

  function createForCharacter(name, characterKey) {
    if (!registry.defaultConfig) registry.defaultConfig = captureConfig();
    const profile = createProfile(name, registry.defaultConfig, characterKey);
    registry.currentProfileId = profile.id;
    applyConfig(profile.config, profile.name);
    lastMessage = `Perfil creado para ${name}. Ajusta los módulos y pulsa Guardar perfil.`;
    persist();
  }

  function refreshCharacter() {
    const name = normalizeName(bot.getPlayerName?.());
    const key = normalizeCharacterName(name);
    if (!key || key === normalizeCharacterName(activeCharacterName)) return false;

    if (activeCharacterName && registry.currentProfileId) saveCurrentProfile();
    activeCharacterName = name;
    if (!registry.defaultConfig) registry.defaultConfig = captureConfig();

    const profileId = registry.characters[key];
    const profile = profileById(profileId);
    if (profile) {
      registry.currentProfileId = profile.id;
      applyConfig(profile.config, profile.name);
      lastMessage = `Perfil “${profile.name}” cargado para ${name}.`;
      persist();
    } else {
      createForCharacter(name, key);
    }
    return true;
  }

  const characterTimerId = window.setInterval(refreshCharacter, 1500);
  bot.addCleanup?.(() => window.clearInterval(characterTimerId));

  bot.profiles = {
    getProfiles: profileViews,
    getStatus,
    save,
    use,
    refreshCharacter,
  };
};
