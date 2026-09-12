/* ===========================================================
   LOGGER
   Writes timestamped entries to the activity log panel.
   Kept separate from ui.js so api.js and speech.js can log
   without pulling in the full UI module.
   =========================================================== */

const Logger = (() => {
  const MAX_ENTRIES = 60;
  let listEl = null;

  function init() {
    listEl = document.getElementById("activityLog");
  }

  function timestamp() {
    const d = new Date();
    return d.toLocaleTimeString("en-US", { hour12: false });
  }

  /**
   * level: "ok" | "warn" | "err" | "voice" | "info"
   */
  function log(message, level = "info") {
    console.log(`[${level}] ${message}`);
    if (!listEl) return;

    const li = document.createElement("li");
    li.className = level === "info" ? "" : `log-${level}`;

    const time = document.createElement("span");
    time.className = "log-time";
    time.textContent = timestamp();

    li.appendChild(time);
    li.appendChild(document.createTextNode(message));

    listEl.prepend(li);

    while (listEl.children.length > MAX_ENTRIES) {
      listEl.removeChild(listEl.lastChild);
    }
  }

  return { init, log };
})();
