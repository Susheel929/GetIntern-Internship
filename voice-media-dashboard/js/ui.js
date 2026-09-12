/* ===========================================================
   UI
   All DOM rendering lives here — app.js orchestrates, ui.js
   paints. Kept separate so validation/API/speech logic never
   directly touches innerHTML (except through the escape helper
   below, which is the one deliberate write path).
   =========================================================== */

const UI = (() => {

  const els = {}; // populated in init()

  function init() {
    els.micButton = document.getElementById("micButton");
    els.micState = document.getElementById("micState");
    els.waveform = document.getElementById("waveform");
    els.transcriptBox = document.getElementById("transcriptBox");

    els.searchInput = document.getElementById("searchInput");
    els.cityInput = document.getElementById("cityInput");
    els.emailInput = document.getElementById("emailInput");
    els.searchFeedback = document.getElementById("searchFeedback");
    els.cityFeedback = document.getElementById("cityFeedback");
    els.emailFeedback = document.getElementById("emailFeedback");
    els.submitButton = document.getElementById("submitButton");

    els.newsResults = document.getElementById("newsResults");
    els.newsMeta = document.getElementById("newsMeta");
    els.weatherResults = document.getElementById("weatherResults");
    els.weatherMeta = document.getElementById("weatherMeta");
    els.spaceResults = document.getElementById("spaceResults");
    els.spaceMeta = document.getElementById("spaceMeta");

    els.toastStack = document.getElementById("toastStack");

    els.tabs = Array.from(document.querySelectorAll(".tab"));
    els.tabPanels = Array.from(document.querySelectorAll(".tab-panel"));

    els.statusNews = document.getElementById("statusNews");
    els.statusWeather = document.getElementById("statusWeather");
    els.statusSpace = document.getElementById("statusSpace");
  }

  /**
   * Every piece of API/user text that reaches innerHTML goes
   * through this first. This is the single choke point that
   * makes the dashboard safe to render third-party API content
   * (headlines, descriptions) without a templating library.
   */
  function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ---------------- tabs ----------------
  function switchTab(tabName) {
    els.tabs.forEach(tab => {
      const active = tab.dataset.tab === tabName;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    els.tabPanels.forEach(panel => {
      panel.classList.toggle("active", panel.id === `panel-${tabName}`);
    });
  }

  // ---------------- mic state ----------------
  function setMicState(state, message) {
    els.micButton.classList.remove("listening", "error", "unsupported");
    els.micState.classList.remove("is-listening", "is-error");
    els.waveform.classList.remove("active");

    const labels = {
      idle: "idle — tap to listen",
      listening: "listening…",
      error: message || "error",
      unsupported: "voice input unavailable in this browser",
    };

    els.micState.textContent = labels[state] || state;

    if (state === "listening") {
      els.micButton.classList.add("listening");
      els.micButton.setAttribute("aria-pressed", "true");
      els.micState.classList.add("is-listening");
      els.waveform.classList.add("active");
    } else {
      els.micButton.setAttribute("aria-pressed", "false");
    }

    if (state === "error") {
      els.micButton.classList.add("error");
      els.micState.classList.add("is-error");
    }

    if (state === "unsupported") {
      els.micButton.classList.add("unsupported");
      els.micButton.disabled = true;
    }
  }

  function setTranscript(text) {
    els.transcriptBox.textContent = text || "Transcript will appear here…";
  }

  // ---------------- field feedback ----------------
  function setFieldFeedback(inputEl, feedbackEl, result) {
    inputEl.classList.remove("valid", "invalid");
    feedbackEl.classList.remove("valid", "invalid");

    if (!inputEl.value.trim()) {
      feedbackEl.textContent = "";
      return;
    }

    inputEl.classList.add(result.valid ? "valid" : "invalid");
    feedbackEl.classList.add(result.valid ? "valid" : "invalid");
    feedbackEl.textContent = result.reason;
  }

  // ---------------- toasts ----------------
  function showToast(message, level = "info") {
    const toast = document.createElement("div");
    toast.className = `toast${level === "error" ? " toast-error" : ""}${level === "warn" ? " toast-warn" : ""}`;
    toast.textContent = message;
    els.toastStack.appendChild(toast);
    setTimeout(() => toast.remove(), 4200);
  }

  // ---------------- status chips ----------------
  function setStatusChip(name, state) {
    const el = { news: els.statusNews, weather: els.statusWeather, space: els.statusSpace }[name];
    if (!el) return;
    el.classList.remove("ok", "err", "pending");
    if (state) el.classList.add(state);
  }

  // ---------------- loading / error / empty states ----------------
  function renderLoading(container, label = "Fetching…") {
    container.innerHTML = `
      <div class="state-block">
        <div class="spinner"></div>
        <span>${escapeHtml(label)}</span>
      </div>`;
  }

  /**
   * onRetry is optional — existing callers that pass only
   * (container, message) keep working exactly as before and just
   * get no button. Passed a function, a "Retry" button is rendered
   * and wired to it, so a failed News/Space call can be re-run
   * without a full page reload.
   */
  function renderError(container, message, onRetry) {
    container.innerHTML = `
      <div class="state-block state-error">
        <span class="state-icon">✕</span>
        <span>${escapeHtml(message)}</span>
        ${onRetry ? `<button type="button" class="retry-button">Retry</button>` : ""}
      </div>`;

    if (onRetry) {
      container.querySelector(".retry-button").addEventListener("click", onRetry);
    }
  }

  function renderEmpty(container, message) {
    container.innerHTML = `
      <div class="state-block">
        <span class="state-icon">—</span>
        <span>${escapeHtml(message)}</span>
      </div>`;
  }

  // ---------------- news ----------------
  function renderNews(articles, meta) {
    els.newsMeta.textContent = meta || "";

    if (!articles || articles.length === 0) {
      renderEmpty(els.newsResults, "No articles found for that query.");
      return;
    }

    els.newsResults.innerHTML = articles.map(a => `
      <article class="result-card">
        ${a.urlToImage ? `<img src="${escapeHtml(a.urlToImage)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ""}
        <h3>${escapeHtml(a.title || "Untitled")}</h3>
        <p>${escapeHtml((a.description || "").slice(0, 140))}</p>
        <span class="card-meta">${escapeHtml(a.source?.name || "Unknown source")}</span>
        <a href="${escapeHtml(a.url)}" target="_blank" rel="noopener noreferrer">Read more →</a>
      </article>
    `).join("");
  }

  // ---------------- weather ----------------
  const WEATHER_CODE_LABELS = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Dense drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow",
    80: "Rain showers", 81: "Heavy rain showers",
    95: "Thunderstorm",
    96: "Thunderstorm with slight hail",
    99: "Thunderstorm with heavy hail",
  };

  function renderWeather(data, meta) {
    els.weatherMeta.textContent = meta || "";

    if (!data || !els.weatherResults) {
      return;
    }

    // Supports the current normalized Api.fetchWeather() shape,
    // while also tolerating the raw Open-Meteo response.
    const c = data.current || data;
    const code = Number(c.weather_code);
    const label = WEATHER_CODE_LABELS[code] || "Unknown conditions";

    const temperature =
      Number.isFinite(Number(c.temperature_2m))
        ? Math.round(Number(c.temperature_2m))
        : "—";

    const humidity =
      Number.isFinite(Number(c.relative_humidity_2m))
        ? Number(c.relative_humidity_2m)
        : "—";

    const windSpeed =
      Number.isFinite(Number(c.wind_speed_10m))
        ? Number(c.wind_speed_10m)
        : "—";

    const resolvedName =
      data.resolvedName ||
      data.city ||
      CONFIG.DEFAULT_CITY ||
      "Unknown location";

    const resolvedCountry =
      data.resolvedCountry ||
      data.country ||
      "";

    const timezone =
      data.timezone ||
      "—";

    const time =
      c.time ? String(c.time).slice(11, 16) : "—";

    els.weatherResults.innerHTML = `
      <div class="weather-hero">
        <span class="weather-temp">${escapeHtml(temperature)}°C</span>
        <span>
          ${escapeHtml(label)} ·
          ${escapeHtml(resolvedName)}
          ${resolvedCountry ? ", " + escapeHtml(resolvedCountry) : ""}
        </span>
      </div>

      <div class="weather-grid">
        <div class="weather-stat">
          <div class="stat-label">Humidity</div>
          <div class="stat-value">${escapeHtml(humidity)}%</div>
        </div>

        <div class="weather-stat">
          <div class="stat-label">Wind speed</div>
          <div class="stat-value">${escapeHtml(windSpeed)} km/h</div>
        </div>

        <div class="weather-stat">
          <div class="stat-label">Timezone</div>
          <div class="stat-value">${escapeHtml(timezone)}</div>
        </div>

        <div class="weather-stat">
          <div class="stat-label">As of</div>
          <div class="stat-value">${escapeHtml(time)}</div>
        </div>
      </div>
    `;
  }

  // ---------------- space (APOD) ----------------
  function renderApod(data) {
    els.spaceMeta.textContent = data.date || "";
    const mediaBlock = data.media_type === "video"
      ? `<p><a href="${escapeHtml(data.url)}" target="_blank" rel="noopener noreferrer">▶ View video (external)</a></p>`
      : `<img class="apod-image" src="${escapeHtml(data.url)}" alt="${escapeHtml(data.title)}" loading="lazy">`;

    els.spaceResults.innerHTML = `
      ${mediaBlock}
      <h3>${escapeHtml(data.title)}</h3>
      <p>${escapeHtml(data.explanation)}</p>
    `;
  }

  return {
    init, escapeHtml, switchTab, setMicState, setTranscript,
    setFieldFeedback, showToast, setStatusChip,
    renderLoading, renderError, renderEmpty,
    renderNews, renderWeather, renderApod,
    els,
  };
})();
