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
