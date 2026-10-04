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
