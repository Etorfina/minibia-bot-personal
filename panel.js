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
      const rect = panel.getBoundingClientRect();
      const next = clampPanelPosition(panel, rect.left, rect.top);
      panel.style.left = `${next.left}px`;
      panel.style.top = `${next.top}px`;
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
        width: 960px;
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
      const mobile = mobileQuery.matches || /iPhone|iPod/i.test(navigator.userAgent);
      panel.classList.toggle("mb-mobile", mobile);
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
