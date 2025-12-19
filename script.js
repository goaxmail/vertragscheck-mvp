
document.addEventListener("DOMContentLoaded", () => {
  const DAILY_LIMIT = 3;
  const DEV_IGNORE_LIMIT = true; // Dev-Only: Limit deaktiviert. Vor Release anpassen.
  const STORAGE_KEY_USAGE = "vc_analysis_usage";
  const STORAGE_KEY_CONTRACTS = "vc_saved_contracts";

  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabViews = document.querySelectorAll(".tab-view");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const contractInput = document.getElementById("contract");
  const output = document.getElementById("output");
  const limitInfo = document.getElementById("limitInfo");
  const contractsListEl = document.getElementById("contractsList");
  const contractsEmptyEl = document.getElementById("contractsEmpty");
  const devResetBtn = document.getElementById("devResetBtn");

  const detailOverlay = document.getElementById("detailOverlay");
  const detailCloseBtn = document.getElementById("detailCloseBtn");
  const detailTitle = document.getElementById("detailTitle");
  const detailMeta = document.getElementById("detailMeta");
  const detailRiskBadge = document.getElementById("detailRiskBadge");
  const detailSummary = document.getElementById("detailSummary");
  const detailPoints = document.getElementById("detailPoints");
  const detailFullText = document.getElementById("detailFullText");

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function loadUsage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USAGE);
      if (!raw) return { date: todayKey(), count: 0 };
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.date !== todayKey()) {
        return { date: todayKey(), count: 0 };
      }
      return { date: parsed.date, count: Number(parsed.count) || 0 };
    } catch {
      return { date: todayKey(), count: 0 };
    }
  }

  function saveUsage(usage) {
    try {
      localStorage.setItem(STORAGE_KEY_USAGE, JSON.stringify(usage));
    } catch {}
  }

  function updateLimitInfo() {
    if (!limitInfo) return;
    const usage = loadUsage();
    if (DEV_IGNORE_LIMIT) {
      limitInfo.textContent = `Dev-Modus: ${usage.count} Analysen heute (Limit deaktiviert).`;
    } else if (usage.count >= DAILY_LIMIT) {
      limitInfo.textContent = `Tageslimit erreicht: ${usage.count} von ${DAILY_LIMIT} Analysen genutzt.`;
    } else {
      limitInfo.textContent = `Heutige Analysen: ${usage.count} von ${DAILY_LIMIT}.`;
    }
  }

  function loadContracts() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CONTRACTS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed;
    } catch {
      return [];
    }
  }

  function saveContracts(list) {
    try {
      localStorage.setItem(STORAGE_KEY_CONTRACTS, JSON.stringify(list));
    } catch {}
  }

  function createContractEntry({ text, level, summary, points }) {
    const now = new Date();
    const id = `${now.getTime()}-${Math.random().toString(16).slice(2)}`;

    const dateStr = now.toLocaleDateString("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    const timeStr = now.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit"
    });

    const firstLine = text.split("\n").map(t => t.trim()).filter(Boolean)[0] || "Vertrag";
    const titleSnippet = firstLine.length > 60 ? firstLine.slice(0, 57) + "…" : firstLine;

    const snippet = text.replace(/\s+/g, " ").trim().slice(0, 160);

    return {
      id,
      createdAt: now.toISOString(),
      dateLabel: `${dateStr}, ${timeStr} Uhr`,
      title: titleSnippet,
      level,
      summary,
      snippet,
      points,
      text
    };
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function renderContracts() {
    if (!contractsListEl || !contractsEmptyEl) return;
    const contracts = loadContracts();

    if (!contracts.length) {
      contractsEmptyEl.style.display = "block";
      contractsListEl.innerHTML = "";
      return;
    }

    contractsEmptyEl.style.display = "none";

    const itemsHtml = contracts
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .map((c) => {
        let riskClass = "";
        let riskLabel = "Risiko: k.A.";
        if (c.level === "low") {
          riskClass = "risk-low";
          riskLabel = "Risiko: niedrig";
        } else if (c.level === "medium") {
          riskClass = "risk-medium";
          riskLabel = "Risiko: mittel";
        } else if (c.level === "high") {
          riskClass = "risk-high";
          riskLabel = "Risiko: erhöht";
        }

        const safeSummary = c.summary || "Keine Zusammenfassung verfügbar.";
        const safeSnippet = c.snippet || "";

        return `
          <article class="contract-card" data-id="${c.id}">
            <button class="contract-card-main" type="button">
              <div class="contract-card-header">
                <div>
                  <div class="contract-card-title">${escapeHtml(c.title)}</div>
                  <div class="contract-card-meta">${escapeHtml(c.dateLabel)}</div>
                </div>
                <div class="contract-card-risk ${riskClass}">${riskLabel}</div>
              </div>
              <p class="contract-card-summary">${escapeHtml(safeSummary)}</p>
              ${
                safeSnippet
                  ? `<p class="contract-card-snippet">${escapeHtml(safeSnippet)}${c.snippet && c.snippet.length >= 160 ? "…" : ""}</p>`
                  : ""
              }
            </button>
            <div class="contract-card-actions">
              <button class="contract-card-btn delete" type="button">Löschen</button>
            </div>
          </article>
        `;
      })
      .join("");

    contractsListEl.innerHTML = itemsHtml;

    contractsListEl.querySelectorAll(".contract-card-main").forEach((btn) => {
      btn.addEventListener("click", () => {
        const card = btn.closest(".contract-card");
        if (!card) return;
        const id = card.getAttribute("data-id");
        if (!id) return;
        openDetail(id);
      });
    });

    contractsListEl.querySelectorAll(".contract-card-btn.delete").forEach((btn) => {
      btn.addEventListener("click", (event) => {
        event.stopPropagation();
        const card = btn.closest(".contract-card");
        if (!card) return;
        const id = card.getAttribute("data-id");
        if (!id) return;
        const current = loadContracts();
        const next = current.filter((c) => c.id !== id);
        saveContracts(next);
        renderContracts();
      });
    });
  }

  function setActiveTab(tabKey) {
    tabButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabKey);
    });

    tabViews.forEach((view) => {
      const isTarget = view.id === `tab-${tabKey}`;
      view.classList.toggle("active", isTarget);
    });

    if (tabKey === "contracts") {
      renderContracts();
    }
  }

  function openDetail(id) {
    if (!detailOverlay) return;
    const contracts = loadContracts();
    const entry = contracts.find((c) => c.id === id);
    if (!entry) return;

    const level = entry.level || "unknown";
    let riskLabel = "Risiko: k.A.";
    let riskClass = "";
    if (level === "low") {
      riskLabel = "Risiko: niedrig";
      riskClass = "risk-low";
    } else if (level === "medium") {
      riskLabel = "Risiko: mittel";
      riskClass = "risk-medium";
    } else if (level === "high") {
      riskLabel = "Risiko: erhöht";
      riskClass = "risk-high";
    }

    if (detailTitle) detailTitle.textContent = entry.title || "Vertrag";
    if (detailMeta) detailMeta.textContent = entry.dateLabel || "";
    if (detailRiskBadge) {
      detailRiskBadge.textContent = riskLabel;
      detailRiskBadge.classList.remove("risk-low", "risk-medium", "risk-high");
      if (riskClass) detailRiskBadge.classList.add(riskClass);
    }
    if (detailSummary) {
      detailSummary.textContent = entry.summary || "Keine Zusammenfassung verfügbar.";
    }
    if (detailPoints) {
      const pts = Array.isArray(entry.points) ? entry.points : [];
      detailPoints.innerHTML = pts
        .slice(0, 8)
        .map((p) => `<li>${escapeHtml(p)}</li>`)
        .join("");
    }
    if (detailFullText) {
      detailFullText.textContent = entry.text || "";
    }

    detailOverlay.classList.add("visible");
    detailOverlay.setAttribute("aria-hidden", "false");
  }

  function closeDetail() {
    if (!detailOverlay) return;
    detailOverlay.classList.remove("visible");
    detailOverlay.setAttribute("aria-hidden", "true");
  }

  if (detailCloseBtn) {
    detailCloseBtn.addEventListener("click", () => {
      closeDetail();
    });
  }

  if (detailOverlay) {
    detailOverlay.addEventListener("click", (event) => {
      if (event.target === detailOverlay) {
        closeDetail();
      }
    });
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabKey = btn.dataset.tab;
      closeDetail();
      setActiveTab(tabKey);
    });
  });

  if (devResetBtn) {
    devResetBtn.addEventListener("click", () => {
      try {
        localStorage.removeItem(STORAGE_KEY_USAGE);
        localStorage.removeItem(STORAGE_KEY_CONTRACTS);
      } catch {}
      if (contractInput) contractInput.value = "";
      if (output) {
        output.innerHTML = '<p class="output-placeholder">Hier erscheint das Ergebnis deiner Analyse.</p>';
      }
      updateLimitInfo();
      renderContracts();
    });
  }

  async function analyzeContract() {
    const usage = loadUsage();
    if (!DEV_IGNORE_LIMIT && usage.count >= DAILY_LIMIT) {
      if (output) {
        output.innerHTML = `
          <p class="risk-summary">
            Du hast dein Tageskontingent von ${DAILY_LIMIT} Analysen bereits genutzt.
          </p>
          <p class="disclaimer">
            Für eine häufigere Nutzung ist eine erweiterte Pro-Version von VertragsCheck geplant.
          </p>
        `;
      }
      updateLimitInfo();
      return;
    }

    const text = (contractInput?.value || "").trim();
    if (!output) return;

    if (!text) {
      output.innerHTML = '<p class="output-placeholder">Bitte füge zuerst einen Vertragstext ein.</p>';
      return;
    }

    const newUsage = { date: todayKey(), count: usage.count + 1 };
    saveUsage(newUsage);
    updateLimitInfo();

    if (analyzeBtn) {
      analyzeBtn.disabled = true;
      analyzeBtn.classList.add("loading");
      analyzeBtn.textContent = "Analyse läuft…";
    }

    output.innerHTML = '<p class="output-placeholder">Analyse läuft…</p>';

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        throw new Error("API error");
      }

      const data = await response.json();
      const level = data.level || "unknown";
      const summary =
        data.summary ||
        "Es gab ein Problem bei der Auswertung oder es liegen zu wenige Informationen vor.";
      const points = Array.isArray(data.points) ? data.points : [];
      const sections = Array.isArray(data.sections) ? data.sections : [];

      const baseFallbackPoints = [
        "Prüfe Laufzeit, automatische Verlängerung und Kündigungsfristen besonders sorgfältig.",
        "Achte auf zusätzliche Gebühren oder versteckte Kosten im Kleingedruckten.",
        "Vergleiche die Konditionen mit ähnlichen Angeboten, um ein Gefühl für das Übliche zu bekommen."
      ];

      const effectivePoints = points.length > 0 ? points : baseFallbackPoints;

      let riskLevelClass = "risk-low";
      let badgeText = "Risiko-Einschätzung: niedrig";

      if (level === "medium") {
        riskLevelClass = "risk-medium";
        badgeText = "Risiko-Einschätzung: mittel";
      } else if (level === "high") {
        riskLevelClass = "risk-high";
        badgeText = "Risiko-Einschätzung: erhöht";
      } else if (level === "unknown") {
        badgeText = "Risiko-Einschätzung: Demo";
      }

      const visiblePoints = effectivePoints.slice(0, 3);
      const sectionCount = sections.length;
      const hiddenPointCount = Math.max(effectivePoints.length - visiblePoints.length, 0);
      const hasProExtras = hiddenPointCount > 0 || sectionCount > 0;

      const listItems = visiblePoints.map((note) => `<li>${escapeHtml(note)}</li>`).join("");

      const lockedLine = hasProExtras
        ? '<li class="pro-locked">🔒 Zusätzliche Hinweise und eine Detail-Auswertung nach Themen sind für VertragsCheck&nbsp;Pro vorgesehen.</li>'
        : "";

      output.innerHTML = `
        <div class="risk-header ${riskLevelClass}">
          <div>
            <div class="risk-label">Erste Einschätzung (Beta)</div>
            <div class="risk-badge">${badgeText}</div>
          </div>
          <div class="risk-score">Tool</div>
        </div>
        <p class="risk-summary">${escapeHtml(summary)}</p>
        <ul class="risk-points">
          ${listItems}
          ${lockedLine}
        </ul>
        <div class="pro-upsell">
          <div class="pro-upsell-tag">Pro (geplant)</div>
          <p class="pro-upsell-text">
            In der Pro-Version soll die Auswertung ausführlicher werden – mit Detail-Scores je Themenblock
            (z.&nbsp;B. Laufzeit, Kündigung, Kosten, Haftung) und Export als PDF-Report. Diese Vorschau speichert deine Texte nicht dauerhaft.
          </p>
        </div>
      `;

      const contractEntry = createContractEntry({
        text,
        level,
        summary,
        points: effectivePoints
      });
      const currentContracts = loadContracts();
      currentContracts.push(contractEntry);
      saveContracts(currentContracts);
      renderContracts();
    } catch (err) {
      output.innerHTML = `
        <p class="risk-summary">
          Die Auswertung ist aktuell nicht erreichbar. Bitte versuche es später erneut.
        </p>
        <p class="disclaimer">
          Technischer Hinweis: Prüfe, ob der Server korrekt konfiguriert ist oder kontaktiere den Betreiber der App.
        </p>
      `;
    } finally {
      if (analyzeBtn) {
        analyzeBtn.disabled = false;
        analyzeBtn.classList.remove("loading");
        analyzeBtn.textContent = "Analyse starten";
      }
    }
  }

  if (analyzeBtn) {
    analyzeBtn.addEventListener("click", analyzeContract);
  }

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }

  setActiveTab("quick");
  updateLimitInfo();
  renderContracts();
});
