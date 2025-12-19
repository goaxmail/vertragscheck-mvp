
/* VertragsCheck – Detail-Ansicht v2 (Mobile-Fix)
   - Header + BottomNav fixed
   - Main content scrolls
   - Detail is a real screen (not modal)
*/

document.addEventListener("DOMContentLoaded", () => {
  // Desktop-Frame aktivieren (damit die PWA auch im Browser wie eine App wirkt)
  const applyDesktopFrame = () => {
    document.body.classList.toggle("desktop", window.innerWidth >= 520);
  };
  applyDesktopFrame();
  window.addEventListener("resize", applyDesktopFrame, { passive: true });

  // --- Config ---
  const DAILY_LIMIT = 3;
  const DEV_IGNORE_LIMIT = true; // Dev only (remove for release)

  // Storage keys
  const KEY_LIMIT = "vc_limit_state_v1";
  const KEY_CONTRACTS = "vc_saved_contracts_v1";

  // UI nodes
  const bottomNavBtns = Array.from(document.querySelectorAll(".nav-btn"));
  const views = {
    check: document.getElementById("tab-check"),
    contracts: document.getElementById("tab-contracts"),
    profile: document.getElementById("tab-profile"),
    detail: document.getElementById("tab-contract-detail"),
  };

  const backBtn = document.getElementById("backBtn");
  const proBtn = document.getElementById("proBtn");
  const devResetBtn = document.getElementById("devResetBtn");

  const contractText = document.getElementById("contractText");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const categoryChipsWrap = document.getElementById("categoryChips");
  const categoryChips = categoryChipsWrap ? Array.from(categoryChipsWrap.querySelectorAll(".chip")) : [];



  const limitText = document.getElementById("limitText");
  const devModeText = document.getElementById("devModeText");

  const outputBody = document.getElementById("outputBody");
  const outputBadge = document.getElementById("outputBadge");

  

  categoryChips.forEach((btn) => {
    btn.addEventListener("click", () => {
      categoryChips.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
  });

  const contractsEmpty = document.getElementById("contractsEmpty");
  const contractsList = document.getElementById("contractsList");

  // Kategorie-Auswahl (UX: ein klarer Modus, Backend kann trotzdem Auto erkennen)
  const setActiveChip = (btn) => {
    categoryChips.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  };
  if (categoryChips.length) {
    categoryChips.forEach(btn => {
      btn.addEventListener("click", () => setActiveChip(btn));
    });
  }
  const getSelectedCategory = () => {
    const active = categoryChips.find(b => b.classList.contains("active"));
    return active?.dataset?.cat || "auto";
  };

  // Detail
  const detailTitle = document.getElementById("detailTitle");
  const detailRisk = document.getElementById("detailRisk");
  const detailMeta = document.getElementById("detailMeta");
  const detailSummary = document.getElementById("detailSummary");
  const detailBullets = document.getElementById("detailBullets");
  const detailRaw = document.getElementById("detailRaw");

  // State
  let activeBottomTab = "check";
  let currentView = "check";
  let lastContractsListScrollTop = 0;

  // Category state
  let selectedCategory = "auto";
  function setCategory(cat) {
    selectedCategory = cat || "auto";
    categoryChips.forEach(btn => {
      const isActive = (btn.dataset.cat || "auto") === selectedCategory;
      btn.classList.toggle("active", isActive);
    });
  }

  if (categoryChips.length) {
    categoryChips.forEach(btn => {
      btn.addEventListener("click", () => setCategory(btn.dataset.cat || "auto"));
    });
    // Ensure correct initial
    const initial = categoryChips.find(b => b.classList.contains("active"))?.dataset?.cat || "auto";
    setCategory(initial);
  }

  // --- Helpers ---
  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function loadLimitState() {
    try {
      const raw = localStorage.getItem(KEY_LIMIT);
      if (!raw) return { day: todayKey(), used: 0 };
      const st = JSON.parse(raw);
      if (st.day !== todayKey()) return { day: todayKey(), used: 0 };
      return { day: st.day, used: Number(st.used || 0) };
    } catch {
      return { day: todayKey(), used: 0 };
    }
  }

  function saveLimitState(st) {
    localStorage.setItem(KEY_LIMIT, JSON.stringify(st));
  }

  function loadContracts() {
    try {
      const raw = localStorage.getItem(KEY_CONTRACTS);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveContracts(arr) {
    localStorage.setItem(KEY_CONTRACTS, JSON.stringify(arr));
  }

  function setActiveView(viewKey, opts = {}) {
    // Persist list scroll when leaving contracts
    if (currentView === "contracts") {
      lastContractsListScrollTop = document.getElementById("appMain").scrollTop;
    }

    // Hide all
    Object.values(views).forEach(v => v.classList.remove("active"));

    // Show
    const map = { "check":"check", "contracts":"contracts", "profile":"profile", "contract-detail":"detail" };
    const resolved = map[viewKey] || "check";
    views[resolved].classList.add("active");

    currentView = resolved;

    // Back button logic
    if (resolved === "detail") backBtn.classList.add("show");
    else backBtn.classList.remove("show");

    // Scroll behavior
    const main = document.getElementById("appMain");
    if (resolved === "contracts") {
      // restore list scroll
      main.scrollTop = opts.restoreScroll ? lastContractsListScrollTop : 0;
    } else {
      main.scrollTop = 0;
    }
  }

  function setBottomActive(tabKey) {
    activeBottomTab = tabKey;
    bottomNavBtns.forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tabKey);
    });
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
    }[c]));
  }

  function clamp(s, n) {
    const t = String(s || "").trim();
    if (t.length <= n) return t;
    return t.slice(0, n - 1) + "…";
  }

  function riskClass(level) {
    const v = String(level || "").toLowerCase();
    if (v.includes("niedrig")) return "good";
    if (v.includes("hoch")) return "bad";
    return "mid";
  }

  function updateLimitUI() {
    const st = loadLimitState();
    if (DEV_IGNORE_LIMIT) {
      limitText.textContent = "";
      devModeText.textContent = `Dev-Modus: ${st.used} Analysen heute (Limit deaktiviert).`;
      return;
    }
    devModeText.textContent = "";
    limitText.textContent = `Heutige Analysen: ${st.used} von ${DAILY_LIMIT}.`;
  }

  function canAnalyze() {
    if (DEV_IGNORE_LIMIT) return true;
    const st = loadLimitState();
    return st.used < DAILY_LIMIT;
  }

  function incAnalyze() {
    if (DEV_IGNORE_LIMIT) return;
    const st = loadLimitState();
    st.used += 1;
    saveLimitState(st);
  }

  function setOutputPlaceholder() {
    outputBadge.textContent = "Tool";
    outputBody.classList.add("muted");
    outputBody.textContent = "Hier erscheint das Ergebnis deiner Analyse.";
  }

  // --- Contracts rendering ---
  function renderContracts() {
    const items = loadContracts();
    contractsList.innerHTML = "";

    if (!items.length) {
      contractsEmpty.style.display = "block";
      contractsList.style.display = "none";
      return;
    }
    contractsEmpty.style.display = "none";
    contractsList.style.display = "flex";

    for (const item of items) {
      const card = document.createElement("div");
      card.className = "contract-card";

      const titleRow = document.createElement("div");
      titleRow.className = "contract-title";

      const title = document.createElement("div");
      title.textContent = item.title || "Vertrag";

      const badge = document.createElement("span");
      badge.className = `badge risk ${riskClass(item.riskLevel)}`;
      badge.textContent = `Risiko: ${item.riskLevel || "mittel"}`;

      titleRow.appendChild(title);
      titleRow.appendChild(badge);

      const meta = document.createElement("div");
      meta.className = "contract-meta";
      meta.textContent = item.meta || "";

      const snippet = document.createElement("div");
      snippet.className = "contract-snippet";
      snippet.textContent = item.snippet || "";

      const actions = document.createElement("div");
      actions.className = "contract-actions";

      const delBtn = document.createElement("button");
      delBtn.className = "small-btn";
      delBtn.type = "button";
      delBtn.textContent = "Löschen";
      delBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        deleteContract(item.id);
      });

      actions.appendChild(delBtn);

      card.appendChild(titleRow);
      card.appendChild(meta);
      card.appendChild(snippet);
      card.appendChild(actions);

      card.addEventListener("click", () => openDetail(item.id));
      contractsList.appendChild(card);
    }
  }

  function deleteContract(id) {
    const items = loadContracts().filter(x => x.id !== id);
    saveContracts(items);
    renderContracts();
  }

  function openDetail(id) {
    const items = loadContracts();
    const item = items.find(x => x.id === id);
    if (!item) return;

    detailTitle.textContent = item.title || "Vertrag";
    detailRisk.className = `badge risk ${riskClass(item.riskLevel)}`;
    detailRisk.textContent = `Risiko: ${item.riskLevel || "mittel"}`;
    detailMeta.textContent = item.meta || "";

    detailSummary.textContent = item.summary || item.snippet || "—";

    // bullets
    detailBullets.innerHTML = "";
    const bullets = Array.isArray(item.bullets) ? item.bullets : [];
    if (bullets.length) {
      bullets.forEach(b => {
        const li = document.createElement("li");
        li.textContent = b;
        detailBullets.appendChild(li);
      });
    } else {
      const li = document.createElement("li");
      li.textContent = "Keine weiteren Punkte erkannt.";
      detailBullets.appendChild(li);
    }

    detailRaw.textContent = item.raw || "";

    // show detail screen, keep bottom tab on contracts
    setBottomActive("contracts");
    setActiveView("contract-detail");
  }

  function backToContracts() {
    setBottomActive("contracts");
    setActiveView("contracts", { restoreScroll: true });
  }

  // --- Analysis ---
  async function runAnalysis() {
    const text = (contractText.value || "").trim();
    if (!text) {
      outputBadge.textContent = "Hinweis";
      outputBody.classList.remove("muted");
      outputBody.textContent = "Bitte füge zuerst einen Vertragstext ein.";
      return;
    }

    updateLimitUI();
    if (!canAnalyze()) {
      outputBadge.textContent = "Limit";
      outputBody.classList.remove("muted");
      outputBody.textContent =
        `Tageslimit erreicht: ${DAILY_LIMIT} von ${DAILY_LIMIT} Analysen genutzt.\n\n` +
        `Du hast dein Tageskontingent bereits genutzt. Für eine häufigere Nutzung ist eine erweiterte Pro-Version geplant.`;
      return;
    }

    analyzeBtn.disabled = true;
    analyzeBtn.textContent = "Analyse läuft…";
    outputBadge.textContent = "Tool";
    outputBody.classList.remove("muted");
    outputBody.textContent = "Analyse läuft…";

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, category: selectedCategory })
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(err || `HTTP ${res.status}`);
      }

      const data = await res.json();

      // Expected shape (our api): { title, categoryLabel, riskLevel, summary, bullets, redFlags, nextSteps }
      const title = data.title || clamp(text.split("\n")[0], 46) || "Vertrag";
      const riskLevel = data.riskLevel || "mittel";
      const categoryLabel = data.categoryLabel || "Auto";
      const summary = data.summary || "";
      const bullets = Array.isArray(data.bullets) ? data.bullets : [];
      const redFlags = Array.isArray(data.redFlags) ? data.redFlags : [];
      const nextSteps = Array.isArray(data.nextSteps) ? data.nextSteps : [];

      // output render (simple)
      outputBadge.textContent = (riskLevel === "hoch" ? "Rot" : riskLevel === "niedrig" ? "Grün" : "Gelb");
      const parts = [];
      parts.push(`Kategorie: ${categoryLabel}`);
      if (summary) parts.push(`\n${summary}`);
      if (bullets.length) {
        parts.push(`\nWichtig:`);
        parts.push(bullets.map(b => `• ${b}`).join("\n"));
      }
      if (redFlags.length) {
        parts.push(`\nWarnungen:`);
        parts.push(redFlags.map(b => `• ${b}`).join("\n"));
      }
      if (nextSteps.length) {
        parts.push(`\nNächste Schritte:`);
        parts.push(nextSteps.map(b => `• ${b}`).join("\n"));
      }
      outputBody.textContent = parts.join("\n");

      incAnalyze();
      updateLimitUI();

      // Save local contract entry
      const d = new Date();
      const meta = `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}, ` +
                   `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")} Uhr`;

      const entry = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + "-" + Math.random().toString(16).slice(2),
        title,
        categoryLabel,
        riskLevel,
        meta,
        summary: summary || "—",
        bullets,
        redFlags,
        nextSteps,
        snippet: clamp(summary || text, 160),
        raw: text
      };

      const items = loadContracts();
      items.unshift(entry);
      saveContracts(items);
      renderContracts();

    } catch (e) {
      outputBadge.textContent = "Fehler";
      outputBody.textContent =
        "Die Analyse konnte nicht durchgeführt werden.\n" +
        "Bitte prüfe später erneut oder kontrolliere die Server-Konfiguration.";
      console.error(e);
    } finally {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = "Analyse starten";
    }
  }

  // --- Dev Reset ---
  function devResetAll() {
    // Clear limit + contracts + output
    localStorage.removeItem(KEY_LIMIT);
    localStorage.removeItem(KEY_CONTRACTS);
    updateLimitUI();
    renderContracts();
    setOutputPlaceholder();
  }

  // --- Events ---
  bottomNavBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      setBottomActive(tab);
      if (tab === "check") setActiveView("check");
      if (tab === "contracts") setActiveView("contracts");
      if (tab === "profile") setActiveView("profile");
    });
  });

  backBtn.addEventListener("click", backToContracts);
  analyzeBtn.addEventListener("click", runAnalysis);

  proBtn.addEventListener("click", () => {
    // Keep simple for now
    setBottomActive("profile");
    setActiveView("profile");
  });

  devResetBtn.addEventListener("click", () => {
    devResetAll();
  });

  // --- SW register ---
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }

  // Init
  updateLimitUI();
  renderContracts();
  setOutputPlaceholder();
  setBottomActive("check");
  setActiveView("check");
});
