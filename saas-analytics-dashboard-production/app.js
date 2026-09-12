(() => {
  "use strict";

  const KEYS = Object.freeze({ data: "pulseboard-data-v2", theme: "pulseboard-theme-v2", settings: "pulseboard-settings-v2" });
  const DEFAULT_ROUTE = "/dashboard";
  const USE_HASH_ROUTER = location.protocol === "file:" || ((location.hostname === "localhost" || location.hostname === "127.0.0.1") && location.port === "5501");
  const routes = Object.freeze({
    "/dashboard": { title: "Dashboard", eyebrow: "Overview" },
    "/analytics": { title: "Analytics", eyebrow: "Performance" },
    "/customers": { title: "Customers", eyebrow: "Customer base" },
    "/settings": { title: "Settings", eyebrow: "Workspace" }
  });

  const todayISO = () => new Date().toISOString().slice(0, 10);
  const uid = () => {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };

  const sampleRecords = [
    { id: uid(), name: "Aarav Mehta", email: "aarav@example.com", plan: "Growth", mrr: 12900, status: "Active", joined: "2026-08-24" },
    { id: uid(), name: "Maya Singh", email: "maya@example.com", plan: "Scale", mrr: 32900, status: "Active", joined: "2026-08-12" },
    { id: uid(), name: "Karan Rao", email: "karan@example.com", plan: "Starter", mrr: 4900, status: "Trial", joined: "2026-09-01" },
    { id: uid(), name: "Nisha Shah", email: "nisha@example.com", plan: "Growth", mrr: 15900, status: "Active", joined: "2026-07-21" },
    { id: uid(), name: "Dev Patel", email: "dev@example.com", plan: "Starter", mrr: 3900, status: "Churned", joined: "2026-06-18" },
    { id: uid(), name: "Ira Kapoor", email: "ira@example.com", plan: "Scale", mrr: 24900, status: "Active", joined: "2026-08-29" }
  ];

  const state = {
    route: normalizePath(USE_HASH_ROUTER ? (location.hash.slice(1) || "/dashboard") : location.pathname),
    theme: loadTheme(),
    records: normalizeRecords(loadJSON(KEYS.data, [])),
    settings: normalizeSettings(loadJSON(KEYS.settings, { currency: "INR", compactNumbers: false })),
    customerSearch: "",
    customerStatus: "All",
    editingId: null
  };

  const app = document.getElementById("app");
  const toastRegion = document.getElementById("toast-region");
  const dialog = document.getElementById("record-dialog");
  const csvInput = document.getElementById("csv-input");
  const recordForm = document.getElementById("record-form");

  function normalizePath(path) {
    const clean = (path || "/").replace(/\/+$/, "") || "/";
    return routes[clean] ? clean : DEFAULT_ROUTE;
  }
  function loadJSON(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; } catch { return fallback; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
  }

  function normalizeSettings(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      currency: source.currency === "USD" ? "USD" : "INR",
      compactNumbers: Boolean(source.compactNumbers)
    };
  }

  function normalizeRecords(value) {
    if (!Array.isArray(value)) return [];
    return value.map(record => ({
      id: String(record?.id || uid()),
      name: String(record?.name || "").trim(),
      email: String(record?.email || "").trim(),
      plan: ["Starter", "Growth", "Scale"].includes(record?.plan) ? record.plan : "Starter",
      mrr: Number.isFinite(Number(record?.mrr)) ? Number(record.mrr) : 0,
      status: ["Active", "Trial", "Churned"].includes(record?.status) ? record.status : "Active",
      joined: /^\d{4}-\d{2}-\d{2}$/.test(String(record?.joined || "")) ? String(record.joined) : todayISO()
    })).filter(record => record.name && /^\S+@\S+\.\S+$/.test(record.email));
  }
  function loadTheme() {
    try {
      const value = localStorage.getItem(KEYS.theme);
      return ["light", "dark", "system"].includes(value) ? value : "system";
    } catch { return "system"; }
  }
  function effectiveTheme(theme) {
    return theme === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : theme;
  }
  function applyTheme(theme, persist = true) {
    const selected = ["light", "dark", "system"].includes(theme) ? theme : "system";
    state.theme = selected;
    const effective = effectiveTheme(selected);
    document.documentElement.dataset.theme = effective;
    document.documentElement.style.colorScheme = effective;
    const toggle = document.getElementById("theme-toggle");
    if (toggle) {
      toggle.textContent = effective === "dark" ? "☀" : "☾";
      toggle.setAttribute("aria-label", effective === "dark" ? "Switch to light theme" : "Switch to dark theme");
      toggle.setAttribute("title", effective === "dark" ? "Switch to light theme" : "Switch to dark theme");
    }
    if (persist) { try { localStorage.setItem(KEYS.theme, selected); } catch {} }
  }
  function escapeCSV(value) {
    const string = String(value ?? "");
    return /[",\n]/.test(string) ? `"${string.replaceAll('"', '""')}"` : string;
  }
  function currency(value) {
    const locale = state.settings.currency === "INR" ? "en-IN" : "en-US";
    return new Intl.NumberFormat(locale, { style: "currency", currency: state.settings.currency, maximumFractionDigits: 0 }).format(value);
  }
  function compact(value) {
    return state.settings.compactNumbers ? new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 }).format(value) : new Intl.NumberFormat("en-IN").format(value);
  }
  function dateText(iso) {
    if (!iso) return "—";
    return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(`${iso}T00:00:00`));
  }
  function totalMRR(records = state.records) { return records.reduce((sum, r) => sum + Number(r.mrr || 0), 0); }
  function activeRecords(records = state.records) { return records.filter(r => r.status === "Active"); }

  function el(tag, { className = "", text, attrs = {}, on } = {}, children = []) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;

    const booleanAttrs = new Set(["checked", "selected", "disabled", "required", "multiple", "hidden"]);
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;
      if (booleanAttrs.has(key)) node.toggleAttribute(key, true);
      else node.setAttribute(key, String(value));
    }

    if (on) {
      Object.entries(on).forEach(([event, handler]) => node.addEventListener(event, handler));
    }
    children.forEach(child => node.append(child));
    return node;
  }

  function icon(symbol, label) { return el("span", { className: "nav-icon", text: symbol, attrs: { "aria-hidden": "true", title: label } }); }

  function routeHref(path) {
    return USE_HASH_ROUTER ? `#${path}` : path;
  }

  function shell() {
    const fragment = document.createDocumentFragment();
    const aside = el("aside", { className: "sidebar", attrs: { "aria-label": "Primary navigation" } });
    aside.append(el("a", { className: "brand", attrs: { href: routeHref("/dashboard"), "data-route": "/dashboard", "aria-label": "PulseBoard home" } }, [
      el("span", { className: "brand-mark", text: "P" }),
      el("span", {}, [el("strong", { text: "PulseBoard" }), el("small", { text: "Analytics workspace" })])
    ]));

    const nav = el("nav", { className: "nav-list" });
    const navItems = [["/dashboard", "⌂", "Dashboard"], ["/analytics", "◒", "Analytics"], ["/customers", "◎", "Customers"], ["/settings", "⚙", "Settings"]];
    navItems.forEach(([href, symbol, label]) => nav.append(el("a", { className: "nav-link", attrs: { href: routeHref(href), "data-route": href } }, [icon(symbol, label), el("span", { text: label })])));
    aside.append(nav);

    const workspace = el("div", { className: "workspace-mini" }, [
      el("span", { className: "workspace-pulse" }),
      el("span", {}, [el("strong", { text: state.records.length ? "Workspace active" : "Ready for data" }), el("small", { text: state.records.length ? `${state.records.length} customer records` : "Import a CSV or add a customer" })])
    ]);
    aside.append(workspace);

    const main = el("main", { className: "main-content" });
    const header = el("header", { className: "topbar" }, [
      el("div", {}, [el("p", { className: "eyebrow", text: routes[state.route].eyebrow }), el("h1", { id: "page-title", text: routes[state.route].title })]),
      el("div", { className: "topbar-actions" }, [
        el("button", { className: "icon-button", text: effectiveTheme(state.theme) === "dark" ? "☀" : "☾", attrs: { type: "button", id: "theme-toggle", title: "Toggle theme" } }),
        el("button", { className: "avatar", text: "SK", attrs: { type: "button", title: "Workspace profile" } })
      ])
    ]);
    const view = el("section", { className: "view-container", attrs: { id: "app-view", "aria-live": "polite" } });
    main.append(header, view);
    fragment.append(aside, main);
    app.replaceChildren(fragment);

    updateNav();
    document.getElementById("theme-toggle").addEventListener("click", () => applyTheme(effectiveTheme(state.theme) === "dark" ? "light" : "dark"));
  }

  function metricCard(label, value, trend, tone = "positive") {
    return el("article", { className: "metric-card" }, [
      el("div", { className: "metric-top" }, [el("span", { text: label }), el("span", { className: "metric-dot" })]),
      el("strong", { className: "metric-value", text: value }),
      el("span", { className: `delta ${tone}`, text: trend })
    ]);
  }

  function sectionHeading(title, subtitle, actions = []) {
    const header = el("div", { className: "panel-header" }, [
      el("div", {}, [el("h2", { className: "panel-title", text: title }), el("p", { className: "panel-subtitle", text: subtitle })])
    ]);
    if (actions.length) header.append(el("div", { className: "panel-actions" }, actions));
    return header;
  }

  function emptyState(title, copy, actions = []) {
    return el("div", { className: "empty-state" }, [
      el("div", { className: "empty-icon", text: "↗" }),
      el("h2", { text: title }),
      el("p", { text: copy }),
      el("div", { className: "empty-actions" }, actions)
    ]);
  }

  function renderDashboard(view) {
    const hasData = state.records.length > 0;
    const active = activeRecords();
    const mrr = totalMRR(active);
    const total = state.records.length;
    const trials = state.records.filter(r => r.status === "Trial").length;
    const churned = state.records.filter(r => r.status === "Churned").length;

    const fragment = document.createDocumentFragment();
    fragment.append(el("section", { className: "hero" }, [
      el("div", {}, [el("h2", { text: hasData ? "Your workspace, at a glance." : "Start with real customer data." }), el("p", { text: hasData ? "Every metric below is calculated from the customer records stored in this workspace." : "Import your customer CSV or create records manually. The dashboard will calculate your KPIs from that data." })]),
      el("div", { className: "hero-actions" }, [
        el("button", { className: "button secondary", text: "Import CSV", attrs: { type: "button", "data-action": "import" } }),
        el("button", { className: "button primary", text: "Add customer", attrs: { type: "button", "data-action": "add" } })
      ])
    ]));

    if (!hasData) {
      fragment.append(emptyState("No customer data yet", "Use your own CSV or start manually. Nothing is hard-coded into the KPI cards.", [
        el("button", { className: "button secondary", text: "Load sample workspace", attrs: { type: "button", "data-action": "sample" } }),
        el("button", { className: "button primary", text: "Add first customer", attrs: { type: "button", "data-action": "add" } })
      ]));
      view.replaceChildren(fragment);
      return;
    }

    const metrics = el("section", { className: "grid metrics-grid" });
    metrics.append(
      metricCard("Monthly recurring revenue", currency(mrr), `${compact(active.length)} active accounts`, "positive"),
      metricCard("Customer count", compact(total), `${compact(active.length)} active`, "positive"),
      metricCard("Trial pipeline", compact(trials), trials ? `${((trials / total) * 100).toFixed(1)}% of accounts` : "No active trials", trials ? "neutral" : "positive"),
      metricCard("Churned accounts", compact(churned), total ? `${((churned / total) * 100).toFixed(1)}% of accounts` : "0%", churned ? "negative" : "positive")
    );
    fragment.append(metrics);

    const recent = [...state.records].sort((a, b) => b.joined.localeCompare(a.joined)).slice(0, 6);
    const activity = el("section", { className: "panel" });
    activity.append(sectionHeading("Latest customer records", "Real records in this browser workspace", [el("a", { className: "text-button", text: "Manage customers →", attrs: { href: routeHref("/customers"), "data-route": "/customers" } })]));
    const list = el("div", { className: "activity-list" });
    recent.forEach(r => list.append(el("div", { className: "activity-item" }, [
      el("div", { className: "activity-avatar", text: initials(r.name) }),
      el("div", { className: "activity-copy" }, [el("strong", { text: r.name }), el("span", { text: `${r.plan} · ${currency(r.mrr)} MRR · ${r.status}` })]),
      el("time", { className: "activity-time", text: dateText(r.joined), attrs: { datetime: r.joined } })
    ])));
    activity.append(list);

    const health = el("section", { className: "panel" });
    health.append(sectionHeading("Plan mix", "MRR by subscription tier"));
    const plans = ["Starter", "Growth", "Scale"];
    const maxPlan = Math.max(1, ...plans.map(p => totalMRR(active.filter(r => r.plan === p))));
    const planList = el("div", { className: "progress-list" });
    plans.forEach(plan => {
      const value = totalMRR(active.filter(r => r.plan === plan));
      const row = el("div", { className: "progress-row" }, [
        el("div", { className: "progress-meta" }, [el("strong", { text: plan }), el("span", { text: currency(value) })]),
        el("div", { className: "progress-track" }, [el("div", { className: "progress-fill", attrs: { style: `width:${Math.max(2, (value / maxPlan) * 100)}%` } })])
      ]);
      planList.append(row);
    });
    health.append(planList);

    fragment.append(el("div", { className: "grid two-col" }, [activity, health]));
    view.replaceChildren(fragment);
  }

  function renderAnalytics(view) {
    const active = activeRecords();
    const mrr = totalMRR(active);
    const planMetrics = ["Starter", "Growth", "Scale"].map(plan => ({ plan, count: state.records.filter(r => r.plan === plan).length, mrr: totalMRR(active.filter(r => r.plan === plan)) }));
    const max = Math.max(1, ...planMetrics.map(x => x.mrr));
    const frag = document.createDocumentFragment();
    frag.append(el("section", { className: "hero" }, [el("div", {}, [el("h2", { text: "Understand the business behind the numbers." }), el("p", { text: "This view is computed from the same records used by the dashboard—no separate mock dataset." })]), el("span", { className: "badge", text: `${state.records.length} records` })]));

    const summary = el("section", { className: "grid metrics-grid" });
    summary.append(metricCard("Active MRR", currency(mrr), `${active.length} accounts`, "positive"), metricCard("Average MRR", active.length ? currency(mrr / active.length) : currency(0), "Per active customer", "neutral"));
    const growth = state.records.filter(r => r.joined >= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)).length;
    summary.append(metricCard("New in 30 days", compact(growth), "Joined recently", growth ? "positive" : "neutral"), metricCard("Retention proxy", state.records.length ? `${((active.length / state.records.length) * 100).toFixed(1)}%` : "0%", "Active / total accounts", active.length ? "positive" : "negative"));
    frag.append(summary);

    const planPanel = el("section", { className: "panel" });
    planPanel.append(sectionHeading("Revenue concentration", "Active MRR contribution by plan"));
    const chart = el("div", { className: "horizontal-bars" });
    planMetrics.forEach(item => chart.append(el("div", { className: "hbar-row" }, [
      el("div", { className: "progress-meta" }, [el("strong", { text: item.plan }), el("span", { text: `${currency(item.mrr)} · ${item.count} accounts` })]),
      el("div", { className: "progress-track", attrs: { "aria-label": `${item.plan} revenue ${currency(item.mrr)}` } }, [el("div", { className: "progress-fill", attrs: { style: `width:${Math.max(2, item.mrr / max * 100)}%` } })])
    ])));
    planPanel.append(chart);

    const insights = el("section", { className: "panel" });
    insights.append(sectionHeading("Operating signals", "Useful checks derived from current records"));
    const signals = [
      ["Largest plan", planMetrics.slice().sort((a, b) => b.mrr - a.mrr)[0]?.plan || "—", "Highest active MRR"],
      ["Top account", [...active].sort((a, b) => b.mrr - a.mrr)[0]?.name || "—", active.length ? currency(Math.max(...active.map(x => x.mrr))) : "No active accounts"],
      ["Churn exposure", `${state.records.filter(r => r.status === "Churned").length}`, "Accounts marked churned"],
      ["Data source", "Local workspace", "Stored in browser localStorage"]
    ];
    const signalList = el("div", { className: "signal-list" });
    signals.forEach(([label, value, detail]) => signalList.append(el("div", { className: "signal-card" }, [el("span", { text: label }), el("strong", { text: value }), el("small", { text: detail })])));
    insights.append(signalList);
    frag.append(el("div", { className: "grid two-col" }, [planPanel, insights]));
    view.replaceChildren(frag);
  }

  function renderCustomers(view) {
    const filtered = state.records.filter(r => {
      const q = state.customerSearch.trim().toLowerCase();
      const searchOk = !q || [r.name, r.email, r.plan].some(v => v.toLowerCase().includes(q));
      const statusOk = state.customerStatus === "All" || r.status === state.customerStatus;
      return searchOk && statusOk;
    }).sort((a, b) => b.joined.localeCompare(a.joined));

    const frag = document.createDocumentFragment();
    frag.append(el("section", { className: "hero" }, [el("div", {}, [el("h2", { text: "Customer records you control." }), el("p", { text: "Create, edit, delete, search, filter, export, and import your real records." })]), el("div", { className: "hero-actions" }, [el("button", { className: "button secondary", text: "Export CSV", attrs: { type: "button", "data-action": "export" } }), el("button", { className: "button primary", text: "Add customer", attrs: { type: "button", "data-action": "add" } })])]));

    const toolbar = el("section", { className: "panel toolbar" }, [
      el("label", { className: "search-wrap", attrs: { for: "customer-search" } }, [el("span", { text: "⌕", attrs: { "aria-hidden": "true" } }), el("input", { className: "search-input", attrs: { id: "customer-search", placeholder: "Search name, email, plan…", value: state.customerSearch } })]),
      el("select", { className: "select", attrs: { id: "customer-status", "aria-label": "Filter by status" } }, ["All", "Active", "Trial", "Churned"].map(s => el("option", { text: s, attrs: { value: s, selected: state.customerStatus === s } })))
    ]);
    frag.append(toolbar);

    const panel = el("section", { className: "panel table-panel" });
    panel.append(sectionHeading("Customers", `${filtered.length} matching of ${state.records.length}`));
    if (!filtered.length) {
      panel.append(emptyState("No matching records", "Change the filters or add a new customer.", [el("button", { className: "button primary", text: "Add customer", attrs: { type: "button", "data-action": "add" } })]));
    } else {
      const wrap = el("div", { className: "table-wrap" });
      const table = el("table");
      const headers = ["Customer", "Plan", "MRR", "Status", "Joined", "Actions"];
      table.append(el("thead", {}, [el("tr", {}, headers.map(h => el("th", { text: h }))) ]));
      const body = el("tbody");
      filtered.forEach(r => body.append(el("tr", {}, [
        el("td", {}, [el("div", { className: "customer-cell" }, [el("div", { className: "activity-avatar", text: initials(r.name) }), el("span", {}, [el("strong", { text: r.name }), el("small", { text: r.email })])])]),
        el("td", { text: r.plan }),
        el("td", { text: currency(r.mrr) }),
        el("td", {}, [el("span", { className: `status ${r.status.toLowerCase()}`, text: r.status })]),
        el("td", { text: dateText(r.joined) }),
        el("td", {}, [el("div", { className: "table-actions" }, [el("button", { className: "text-button", text: "Edit", attrs: { type: "button", "data-edit": r.id } }), el("button", { className: "text-button danger", text: "Delete", attrs: { type: "button", "data-delete": r.id } })])])
      ])));
      table.append(body); wrap.append(table); panel.append(wrap);
    }
    frag.append(panel);
    view.replaceChildren(frag);
  }

  function renderSettings(view) {
    const frag = document.createDocumentFragment();
    frag.append(el("section", { className: "hero" }, [el("div", {}, [el("h2", { text: "Workspace settings." }), el("p", { text: "These preferences are stored locally and applied instantly." })]), el("span", { className: "badge", text: "No framework required" })]));
    const preferences = el("section", { className: "panel settings-card" });
    const themeSelect = el("select", { className: "select", attrs: { id: "theme-select" } }, ["system", "light", "dark"].map(v => el("option", { text: v[0].toUpperCase() + v.slice(1), attrs: { value: v, selected: state.theme === v } })));
    const currencySelect = el("select", { className: "select", attrs: { id: "currency-select" } }, ["INR", "USD"].map(v => el("option", { text: v, attrs: { value: v, selected: state.settings.currency === v } })));
    const compactToggle = el("input", { attrs: { id: "compact-toggle", type: "checkbox", checked: state.settings.compactNumbers ? "checked" : null } });
    preferences.append(sectionHeading("Preferences", "Display options for this browser"));
    preferences.append(settingRow("Color theme", "System follows your OS preference.", themeSelect));
    preferences.append(settingRow("Currency", "Controls how revenue and MRR values are formatted.", currencySelect));
    preferences.append(settingRow("Compact numbers", "Show 1.2K instead of 1,200 in count cards.", toggleControl(compactToggle)));

    const dataPanel = el("section", { className: "panel settings-card" });
    dataPanel.append(sectionHeading("Data operations", "Your current workspace can be backed up or reset"));
    dataPanel.append(el("div", { className: "data-actions" }, [
      el("button", { className: "button secondary", text: "Import CSV", attrs: { type: "button", "data-action": "import" } }),
      el("button", { className: "button secondary", text: "Export CSV", attrs: { type: "button", "data-action": "export" } }),
      el("button", { className: "button danger-fill", text: "Reset workspace", attrs: { type: "button", "data-action": "reset" } })
    ]));
    dataPanel.append(el("div", { className: "security-note" }, [el("strong", { text: "Privacy note" }), el("p", { text: "This static version stores customer data only in this browser's localStorage. It does not send your records to a server." })]));
    frag.append(el("div", { className: "grid two-col" }, [preferences, dataPanel]));
    view.replaceChildren(frag);
  }

  function settingRow(title, description, control) {
    return el("div", { className: "setting-row" }, [el("div", { className: "setting-copy" }, [el("strong", { text: title }), el("span", { text: description })]), control]);
  }
  function toggleControl(input) { return el("label", { className: "switch", attrs: { for: input.id } }, [input, el("span", { className: "switch-ui" })]); }
  function initials(name) { return name.split(/\s+/).slice(0, 2).map(x => x[0]).join("").toUpperCase(); }

  function updateNav() {
    document.querySelectorAll("a[data-route]").forEach(link => {
      const active = link.getAttribute("data-route") === state.route;
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
    });
  }

  function render() {
    shell();
    const view = document.getElementById("app-view");
    const title = routes[state.route].title;
    document.title = `PulseBoard — ${title}`;
    requestAnimationFrame(() => {
      if (state.route === "/analytics") renderAnalytics(view);
      else if (state.route === "/customers") renderCustomers(view);
      else if (state.route === "/settings") renderSettings(view);
      else renderDashboard(view);
      updateNav();
      scrollTo({ top: 0, behavior: "auto" });
    });
  }

  function navigate(path, replace = false) {
    const next = normalizePath(path);
    if (USE_HASH_ROUTER) {
      const hash = `#${next}`;
      if (replace) history.replaceState({ route: next }, "", `${location.pathname}${hash}`);
      else if (next !== state.route) location.hash = next;
      state.route = next;
    } else {
      if (replace) history.replaceState({ route: next }, "", next);
      else if (next !== state.route) history.pushState({ route: next }, "", next);
      state.route = next;
    }
    render();
  }

  function openRecordDialog(id = null) {
    state.editingId = id;
    const record = id ? state.records.find(r => r.id === id) : null;
    document.getElementById("record-dialog-title").textContent = record ? "Edit customer" : "Add customer";
    document.getElementById("record-error").textContent = "";
    document.getElementById("record-id").value = record?.id || "";
    document.getElementById("record-name").value = record?.name || "";
    document.getElementById("record-email").value = record?.email || "";
    document.getElementById("record-plan").value = record?.plan || "Starter";
    document.getElementById("record-mrr").value = record?.mrr ?? "";
    document.getElementById("record-status").value = record?.status || "Active";
    document.getElementById("record-joined").value = record?.joined || todayISO();
    dialog.showModal();
    requestAnimationFrame(() => document.getElementById("record-name").focus());
  }

  function saveRecord(event) {
    event.preventDefault();
    const form = new FormData(recordForm);
    const record = {
      id: String(form.get("id") || state.editingId || uid()),
      name: String(form.get("name") || "").trim(),
      email: String(form.get("email") || "").trim(),
      plan: String(form.get("plan") || "Starter"),
      mrr: Number(form.get("mrr")),
      status: String(form.get("status") || "Active"),
      joined: String(form.get("joined") || todayISO())
    };
    const error = validateRecord(record);
    if (error) { document.getElementById("record-error").textContent = error; return; }
    if (state.editingId) state.records = state.records.map(item => item.id === state.editingId ? record : item);
    else state.records = [record, ...state.records];
    saveJSON(KEYS.data, state.records);
    dialog.close();
    showToast(state.editingId ? "Customer updated." : "Customer added.");
    render();
  }
  function validateRecord(r) {
    if (!r.name || r.name.length < 2) return "Enter a valid customer name.";
    if (!/^\S+@\S+\.\S+$/.test(r.email)) return "Enter a valid email address.";
    if (!Number.isFinite(r.mrr) || r.mrr < 0) return "MRR must be a non-negative number.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.joined)) return "Choose a valid joined date.";
    return "";
  }

  function parseCSV(text) {
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i < text.length; i += 1) {
      const ch = text[i];
      const next = text[i + 1];
      if (ch === '"' && quoted && next === '"') { field += '"'; i += 1; continue; }
      if (ch === '"') { quoted = !quoted; continue; }
      if (ch === "," && !quoted) { row.push(field); field = ""; continue; }
      if ((ch === "\n" || ch === "\r") && !quoted) {
        if (ch === "\r" && next === "\n") i += 1;
        row.push(field); field = "";
        if (row.some(v => v.trim() !== "")) rows.push(row);
        row = []; continue;
      }
      field += ch;
    }
    if (field || row.length) { row.push(field); if (row.some(v => v.trim() !== "")) rows.push(row); }
    return rows;
  }

  function importCSV(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCSV(String(reader.result || ""));
        if (rows.length < 2) throw new Error("CSV needs a header row and at least one record.");
        const headers = rows[0].map(h => h.trim().toLowerCase());
        const needed = ["name", "email", "plan", "mrr", "status", "joined"];
        const missing = needed.filter(h => !headers.includes(h));
        if (missing.length) throw new Error(`Missing columns: ${missing.join(", ")}`);
        const imported = rows.slice(1).map(values => {
          const obj = {}; headers.forEach((h, i) => { obj[h] = (values[i] || "").trim(); });
          const record = { id: uid(), name: obj.name, email: obj.email, plan: obj.plan || "Starter", mrr: Number(obj.mrr), status: obj.status || "Active", joined: obj.joined || todayISO() };
          const error = validateRecord(record); if (error) throw new Error(`${obj.name || "Record"}: ${error}`); return record;
        });
        state.records = [...imported, ...state.records];
        saveJSON(KEYS.data, state.records);
        showToast(`${imported.length} customer${imported.length === 1 ? "" : "s"} imported.`);
        render();
      } catch (error) { showToast(error.message || "Could not import CSV.", true); }
      csvInput.value = "";
    };
    reader.readAsText(file);
  }

  function exportCSV() {
    const header = ["name", "email", "plan", "mrr", "status", "joined"];
    const lines = [header.join(","), ...state.records.map(r => header.map(h => escapeCSV(r[h])).join(","))];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pulseboard-customers-${todayISO()}.csv`;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    showToast("CSV export started.");
  }

  let toastTimer;
  function showToast(message, error = false) {
    toastRegion.replaceChildren();
    const toast = el("div", { className: `toast ${error ? "error" : ""}`, text: message, attrs: { role: "status" } });
    toastRegion.append(toast);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.remove(), 2600);
  }

  document.addEventListener("click", event => {
    const routeLink = event.target.closest("a[data-route]");
    if (routeLink && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
      event.preventDefault(); navigate(routeLink.getAttribute("data-route")); return;
    }
    const action = event.target.closest("[data-action]")?.getAttribute("data-action");
    if (action === "add") openRecordDialog();
    if (action === "edit") openRecordDialog(event.target.closest("[data-edit]")?.getAttribute("data-edit"));
    if (action === "import") csvInput.click();
    if (action === "export") exportCSV();
    if (action === "sample") { state.records = sampleRecords.map(r => ({ ...r, id: uid() })); saveJSON(KEYS.data, state.records); showToast("Sample workspace loaded."); render(); }
    if (action === "reset") {
      if (confirm("Reset all local customer data? This cannot be undone.")) { state.records = []; saveJSON(KEYS.data, state.records); showToast("Workspace reset."); render(); }
    }
  });

  document.addEventListener("change", event => {
    if (event.target.id === "customer-status") { state.customerStatus = event.target.value; renderCustomers(document.getElementById("app-view")); }
    if (event.target.id === "csv-input" && event.target.files?.[0]) importCSV(event.target.files[0]);
    if (event.target.id === "theme-select") { applyTheme(event.target.value); showToast("Theme preference saved."); }
    if (event.target.id === "currency-select") { state.settings.currency = event.target.value; saveJSON(KEYS.settings, state.settings); showToast("Currency updated."); render(); }
    if (event.target.id === "compact-toggle") { state.settings.compactNumbers = event.target.checked; saveJSON(KEYS.settings, state.settings); showToast("Number formatting updated."); render(); }
  });

  document.addEventListener("input", event => {
    if (event.target.id === "customer-search") { state.customerSearch = event.target.value; renderCustomers(document.getElementById("app-view")); requestAnimationFrame(() => { const input = document.getElementById("customer-search"); input?.focus(); input?.setSelectionRange(state.customerSearch.length, state.customerSearch.length); }); }
  });

  document.addEventListener("click", event => {
    const edit = event.target.closest("[data-edit]");
    if (edit) openRecordDialog(edit.getAttribute("data-edit"));
    const del = event.target.closest("[data-delete]");
    if (del) {
      const id = del.getAttribute("data-delete");
      const record = state.records.find(r => r.id === id);
      if (record && confirm(`Delete ${record.name}?`)) { state.records = state.records.filter(r => r.id !== id); saveJSON(KEYS.data, state.records); showToast("Customer deleted."); render(); }
    }
  });


  recordForm.addEventListener("submit", saveRecord);
  document.querySelectorAll("[data-dialog-close]").forEach(button => button.addEventListener("click", () => dialog.close()));
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  window.addEventListener("popstate", () => {
    state.route = USE_HASH_ROUTER ? normalizePath(location.hash.slice(1)) : normalizePath(location.pathname);
    render();
  });
  window.addEventListener("hashchange", () => {
    if (!USE_HASH_ROUTER) return;
    state.route = normalizePath(location.hash.slice(1));
    render();
  });
  matchMedia("(prefers-color-scheme: light)").addEventListener?.("change", () => {
    if (state.theme === "system") applyTheme("system", false);
  });

  applyTheme(state.theme, false);
  if (!USE_HASH_ROUTER && location.pathname !== state.route) {
    history.replaceState({ route: state.route }, "", state.route);
  }
  render();
})();
