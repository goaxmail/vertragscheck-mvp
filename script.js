/*
  VertragsCheck – Build v1.3
  Fixes:
  - removed duplicate const/function declarations that broke parsing
  - single source of truth for category + tab navigation
  - buttons/tabs work again
*/

document.addEventListener("DOMContentLoaded", () => {
  // --- Config ---
  const DAILY_LIMIT = 3;
  const DEV_IGNORE_LIMIT = true; // set false for release

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
  const categoryChips = categoryChipsWrap
    ? Array.from(categoryChipsWrap.querySelectorAll(".chip"))
    : [];

  const limitText = document.getElementById("limitText");
  const devModeText = document.getElementById("devModeText");

  const outputBody = document.getElementById("outputBody");
  const outputBadge = document.getElementById("outputBadge");

  const contractsEmpty = document.getElementById("contractsEmpty");
  const contractsList = document.getElementById("contractsList");

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

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
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

  function incrementUsage() {
    const st = loadLimitState();
    st.used = Number(st.used || 0) + 1;
    saveLimitState(st);
    updateLimitUI();
  }

  function setActiveView(viewKey, opts = {}) {
    // Persist list scroll when leaving contracts
    if (currentView === "contracts") {
      lastContractsListScrollTop = document.getElementById("appMain").scrollTop;
    }

    Object.values(views).forEach((v) => v.classList.remove("active"));

    const map = {
      check: "check",
      contracts: "contracts",
      profile: "profile",
      "contract-detail": "detail",
      detail: "detail",
    };
    const resolved = map[viewKey] || "check";
    views[resolved].classList.add("active");
    currentView = resolved;

    if (resolved === "detail") backBtn.classList.add("show");
    else backBtn.classList.remove("show");

    const main = document.getElementById("appMain");
    if (resolved === "contracts") {
      main.scrollTop = opts.restoreScroll ? lastContractsListScrollTop : 0;
    } else {
      main.scrollTop = 0;
    }
  }

  function setBottomActive(tabKey) {
    activeBottomTab = tabKey;
    bottomNavBtns.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabKey);
    });
  }

  function setCategory(cat) {
    selectedCategory = cat || "auto";
    categoryChips.forEach((btn) => {
      const isActive = (btn.dataset.cat || "auto") === selectedCategory;
      btn.classList.toggle("active", isActive);
    });
  }

  function getSelectedCategory() {
    return selectedCategory || "auto";
  }

  function categoryLabel(cat) {
    const map = {
      auto: "Auto",
      mobilfunk: "Mobilfunk/Internet",
      strom: "Strom/Gas",
      versicherung: "Versicherung",
      miete: "Miete",
      sonstiges: "Sonstiges",
    };
    return map[cat] || "Auto";
  }

  function renderContracts() {
    const arr = loadContracts();
    if (!arr.length) {
      contractsEmpty.style.display = "block";
      contractsList.innerHTML = "";
      return;
    }
    contractsEmpty.style.display = "none";

    contractsList.innerHTML = arr
      .map((c, idx) => {
        const rc = riskClass(c.riskLevel);
        return `
          <button class="contract-item glass" type="button" data-idx="${idx}">
            <div class="ci-top">
              <div class="ci-title">${escapeHTML(c.title || "Vertrag")}</div>
              <span class="badge ${rc}">${escapeHTML(c.riskLevel || "Mittel")}</span>
            </div>
            <div class="ci-meta muted">${escapeHTML(c.categoryLabel || categoryLabel(c.category || "auto"))} • ${escapeHTML(c.date || "")}</div>
            <div class="ci-snippet muted">${escapeHTML(clamp(c.summary || "", 120))}</div>
          </button>
        `;
      })
      .join("");

    contractsList.querySelectorAll(".contract-item").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        openDetail(idx);
      });
    });
  }

  function openDetail(idx) {
    const arr = loadContracts();
    const c = arr[idx];
    if (!c) return;

    detailTitle.textContent = c.title || "Vertrag";
    detailRisk.textContent = c.riskLevel || "Mittel";
    detailRisk.className = `badge ${riskClass(c.riskLevel)}`;
    detailMeta.textContent = `${c.categoryLabel || categoryLabel(c.category || "auto")} • ${c.date || ""}`;

    detailSummary.textContent = c.summary || "";

    detailBullets.innerHTML = "";
    (c.bullets || []).forEach((b) => {
      const li = document.createElement("li");
      li.textContent = b;
      detailBullets.appendChild(li);
    });

    detailRaw.textContent = c.rawText || "";

    // keep bottom tab highlight on contracts when opening detail from list
    setActiveView("contract-detail");
  }

  function setOutputLoading(isLoading) {
    if (isLoading) {
      outputBody.innerHTML = `<div class="muted">Analyse läuft…</div>`;
      outputBadge.textContent = "…";
    } else {
      outputBadge.textContent = "Tool";
    }
  }

  function renderAnalysisToOutput(res) {
    const rc = riskClass(res.riskLevel);
    outputBadge.className = `badge ${rc}`;
    outputBadge.textContent = res.riskLevel || "Mittel";

    const bullets = (res.bullets || []).map((b) => `<li>${escapeHTML(b)}</li>`).join("");
    const red = (res.redFlags || []).map((b) => `<li>${escapeHTML(b)}</li>`).join("");
    const next = (res.nextSteps || []).map((b) => `<li>${escapeHTML(b)}</li>`).join("");

    outputBody.innerHTML = `
      <div class="out-row"><span class="muted">Kategorie:</span> <strong>${escapeHTML(res.categoryLabel || categoryLabel(res.category || getSelectedCategory()))}</strong></div>
      <div class="out-block"><div class="out-title">Kurzfazit</div><div>${escapeHTML(res.summary || "")}</div></div>
      ${bullets ? `<div class="out-block"><div class="out-title">Wichtige Punkte</div><ul>${bullets}</ul></div>` : ""}
      ${red ? `<div class="out-block"><div class="out-title">Risiken / Red Flags</div><ul>${red}</ul></div>` : ""}
      ${next ? `<div class="out-block"><div class="out-title">Nächste Schritte</div><ul>${next}</ul></div>` : ""}
    `;
  }

  // --- Wiring ---

  // Chips
  if (categoryChips.length) {
    categoryChips.forEach((btn) => {
      btn.addEventListener("click", () => setCategory(btn.dataset.cat || "auto"));
    });
    const initial = categoryChips.find((b) => b.classList.contains("active"))?.dataset?.cat || "auto";
    setCategory(initial);
  } else {
    setCategory("auto");
  }

  // Bottom nav
  bottomNavBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabKey = btn.dataset.tab;
      if (!tabKey) return;
      setBottomActive(tabKey);
      setActiveView(tabKey);
      if (tabKey === "contracts") renderContracts();
    });
  });

  // Back button from detail
  backBtn?.addEventListener("click", () => {
    setBottomActive("contracts");
    setActiveView("contracts", { restoreScroll: true });
    renderContracts();
  });

  // Pro button (placeholder)
  proBtn?.addEventListener("click", () => {
    alert("Pro ist geplant. In v1.3 noch nicht aktiv.");
  });

  // Dev reset
  devResetBtn?.addEventListener("click", () => {
    if (!confirm("Alles lokal gespeicherte löschen? (Analysen + Limit)")) return;
    localStorage.removeItem(KEY_CONTRACTS);
    localStorage.removeItem(KEY_LIMIT);
    updateLimitUI();
    renderContracts();
    outputBody.textContent = "Hier erscheint das Ergebnis deiner Analyse.";
    outputBadge.className = "badge tool";
    outputBadge.textContent = "Tool";
  });

  // Analyze
  analyzeBtn?.addEventListener("click", async () => {
    const text = String(contractText?.value || "").trim();
    if (!text) {
      alert("Bitte Vertragstext einfügen.");
      return;
    }

    if (!canAnalyze()) {
      alert("Tageslimit erreicht. Morgen wieder.");
      return;
    }

    setOutputLoading(true);
    analyzeBtn.disabled = true;

    try {
      const payload = {
        text,
        category: getSelectedCategory(),
      };

      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(data?.error || `HTTP ${r.status}`);
      }

      // Normalize for UI
      const res = {
        title: data.title || "Vertrag",
        category: data.category || payload.category || "auto",
        categoryLabel: data.categoryLabel || categoryLabel(data.category || payload.category || "auto"),
        riskLevel: data.riskLevel || "Mittel",
        summary: data.summary || "",
        bullets: Array.isArray(data.bullets) ? data.bullets : [],
        redFlags: Array.isArray(data.redFlags) ? data.redFlags : [],
        nextSteps: Array.isArray(data.nextSteps) ? data.nextSteps : [],
      };

      renderAnalysisToOutput(res);

      // Save to history
      const now = new Date();
      const dateStr = now.toLocaleDateString("de-DE");
      const item = {
        ...res,
        date: dateStr,
        rawText: text,
      };

      const arr = loadContracts();
      arr.unshift(item);
      saveContracts(arr);

      incrementUsage();

    } catch (e) {
      outputBody.innerHTML = `<div class="muted">Fehler: ${escapeHTML(e?.message || String(e))}</div>`;
      outputBadge.className = "badge bad";
      outputBadge.textContent = "Fehler";
    } finally {
      setOutputLoading(false);
      analyzeBtn.disabled = false;
    }
  });

  // Initial UI
  updateLimitUI();
  renderContracts();
  setBottomActive("check");
  setActiveView("check");
});
