
document.addEventListener("DOMContentLoaded", () => {
  const DAILY_LIMIT = 5;
  const MAX_CHARS = 15000;
  // Dev-Mode:
  // - localhost is always dev
  // - add ?dev=1 once to enable on a deployed URL (stored in localStorage)
  // - add ?dev=0 to disable again
  const params = new URLSearchParams(window.location.search);
  if (params.get("dev") === "1") localStorage.setItem("vc_dev_mode", "true");
  if (params.get("dev") === "0") localStorage.removeItem("vc_dev_mode");
  const DEV_MODE = true;
  const DEV_IGNORE_LIMIT = true;
  const DEV_IGNORE_LIMIT = DEV_MODE;
  const STORAGE_KEY = "vc_analysis_usage";

  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabViews = document.querySelectorAll(".tab-view");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const contractInput = document.getElementById("contract");
  const categorySelect = document.getElementById("contractCategory");
  const output = document.getElementById("output");
  const limitInfo = document.getElementById("limitInfo");
  const devResetBtn = document.getElementById("devResetBtn");

  const CATEGORY_LABELS = {
    auto: "Automatisch",
    mobilfunk: "Mobilfunk & Internet",
    miete: "Miete & Wohnen",
    versicherung: "Versicherung",
    abo: "Abos & Mitgliedschaften",
    sonstiges: "Sonstiger Vertrag"
  };

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function loadUsage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { date: todayKey(), count: 0 };
      }
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.date !== todayKey()) {
        return { date: todayKey(), count: 0 };
      }
      return { date: parsed.date, count: Number(parsed.count) || 0 };
    } catch (e) {
      return { date: todayKey(), count: 0 };
    }
  }

  function saveUsage(usage) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
    } catch (e) {
      // ignore
    }
  }

  function updateLimitInfo() {
    if (!limitInfo) return;
    const usage = loadUsage();
    if (DEV_IGNORE_LIMIT) {
      limitInfo.textContent = `Dev-Modus aktiv (Limit deaktiviert).`;
    } else if (usage.count >= DAILY_LIMIT) {
      limitInfo.textContent = `Tageslimit erreicht: ${usage.count} von ${DAILY_LIMIT} Analysen genutzt.`;
    } else {
      limitInfo.textContent = `Heutige Analysen: ${usage.count} von ${DAILY_LIMIT}.`;
    }
  }

  function applyDevUi() {
    if (!devResetBtn) return;
    devResetBtn.style.display = DEV_MODE ? "inline-flex" : "none";
  }

  function setActiveTab(tabKey) {
    tabButtons.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabKey);
    });

    tabViews.forEach((view) => {
      const isTarget = view.id === `tab-${tabKey}`;
      view.classList.toggle("active", isTarget);
    });
  }

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tabKey = btn.dataset.tab;
      setActiveTab(tabKey);
    });
  });

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

    if (text.length > MAX_CHARS) {
      output.innerHTML = `
        <p class="risk-summary">Der Vertragstext ist zu lang (max. ${MAX_CHARS.toLocaleString("de-DE")} Zeichen).</p>
        <p class="disclaimer">Tipp: Füge nur die relevanten Abschnitte ein (Laufzeit, Kündigung, Kosten, Haftung).</p>
      `;
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

    const selectedCategory = (categorySelect?.value || "auto").trim() || "auto";

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-DEV-MODE": DEV_MODE ? "1" : "0"
        },
        body: JSON.stringify({ text, category: selectedCategory })
      });

      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        const status = response.status;

        if (status === 429) {
          output.innerHTML = `
            <p class="risk-summary">Tageslimit erreicht.</p>
            <p class="disclaimer">Bitte versuche es morgen erneut. Eine Pro-Version mit mehr Analysen ist geplant.</p>
          `;
          return;
        }

        if (status === 413) {
          const max = errPayload?.max_chars || MAX_CHARS;
          output.innerHTML = `
            <p class="risk-summary">Der Vertragstext ist zu lang (max. ${Number(max).toLocaleString("de-DE")} Zeichen).</p>
            <p class="disclaimer">Tipp: Füge nur die relevanten Abschnitte ein (Laufzeit, Kündigung, Kosten, Haftung).</p>
          `;
          return;
        }

        throw new Error(errPayload?.error || "API error");
      }

      const data = await response.json();

      // Sync local counter with server meta (if available)
      const usedToday = Number(data?.meta?.used_today);
      const dailyLimit = Number(data?.meta?.daily_limit);
      if (!Number.isNaN(usedToday) && !Number.isNaN(dailyLimit) && !DEV_IGNORE_LIMIT) {
        saveUsage({ date: todayKey(), count: usedToday });
      }
      updateLimitInfo();

      const level = data.level || "unknown";
      const summary = data.summary || "Es gab ein Problem bei der Auswertung oder es liegen zu wenige Informationen vor.";
      const points = Array.isArray(data.points) ? data.points : [];
      const sections = Array.isArray(data.sections) ? data.sections : [];

      const categoryMap = {
        auto: "Automatisch",
        mobilfunk: "Mobilfunk & Internet",
        miete: "Miete & Wohnen",
        versicherung: "Versicherung",
        abo: "Abos & Mitgliedschaften",
        sonstiges: "Sonstiger Vertrag"
      };
      const selectedKey = String(data?.meta?.category_selected || selectedCategory || "auto");
      const detectedKey = String(data?.category || "");
      const usedKey = String(data?.meta?.category_used || detectedKey || "");
      const corrected = Boolean(data?.meta?.category_corrected);
      const selectedLabel = categoryMap[selectedKey] || "Automatisch";
      const detectedLabel = categoryMap[detectedKey] || (detectedKey ? detectedKey : "");
      const usedLabel = categoryMap[usedKey] || (usedKey ? usedKey : "");
      const showCategory = corrected
        ? { label: usedLabel, mode: "corrected", original: selectedLabel }
        : selectedKey !== "auto"
          ? { label: selectedLabel, mode: "selected" }
          : detectedKey
            ? { label: detectedLabel, mode: "detected" }
            : null;

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
      const hiddenPointCount = Math.max(effectivePoints.length - visiblePoints.length, 0);
      const sectionCount = sections.length;
      const hasProExtras = false;

      const listItems = visiblePoints
        .map((note) => `<li>${note}</li>`)
        .join("");

      const lockedLine = hasProExtras
        ? `<li class="pro-locked">🔒 Zusätzliche Hinweise und eine Detail-Auswertung nach Themen sind für VertragsCheck&nbsp;Pro <strong>(geplant)</strong>.</li>`
        : "";

      const categoryLine = showCategory
        ? `<div class="risk-meta">Kategorie: <strong>${showCategory.label}</strong>${showCategory.mode === "detected" ? " (erkannt)" : showCategory.mode === "corrected" ? " (korrigiert)" : ""}</div>`
        : "";

      output.innerHTML = `
        <div class="risk-header ${riskLevelClass}">
          <div>
            <div class="risk-label">Erste Einschätzung (Beta)</div>
            <div class="risk-badge">${badgeText}</div>
            ${categoryLine}
          </div>
          <div class="risk-score">Tool</div>
        </div>
        <p class="risk-summary">${summary}</p>
        <ul class="risk-points">
          ${listItems}
          ${lockedLine}
        </ul>
        <div class="conversion-box">
          <h3>Top-Risiken</h3>
          <ul class="conversion-risks">${listItems}</ul>
        </div>
        <div class="conversion-box">
          <h3>Was bedeutet das für dich?</h3>
          <p>Diese Punkte können zu unerwarteten Kosten, langen Bindungen oder eingeschränkten Rechten führen.</p>
        </div>
        <div class="conversion-box">
          <h3>Nächste Schritte</h3>
          <ol>
            <li>Kritische Stellen im Vertrag markieren</li>
            <li>Kündigungs- und Laufzeit prüfen</li>
            <li>Bei Unsicherheit rechtlichen Rat einholen</li>
          </ol>
        </div>

        <div class="pro-upsell">
          <div class="pro-upsell-tag">Pro (geplant)</div>
          <p class="pro-upsell-text">
            In der Pro-Version soll die Auswertung ausführlicher werden – mit Detail-Scores je Themenblock
            (z.&nbsp;B. Laufzeit, Kündigung, Kosten, Haftung) und Export als PDF-Report. Diese Vorschau speichert deine Texte nicht dauerhaft.
          </p>
        </div>
      `;
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

  if (devResetBtn) {
    devResetBtn.addEventListener("click", async () => {
      // Reset client-side counter + request the server to reset its signed quota cookie.
      try {
        await fetch("/api/analyze", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-DEV-MODE": DEV_MODE ? "1" : "0",
            "X-DEV-RESET": "1"
          },
          body: JSON.stringify({ text: "dev-reset", category: "auto" })
        });
      } catch (_) {
        // Even if the request fails, still reset the local UI for convenience.
      }

      localStorage.removeItem(STORAGE_KEY);
      if (contractInput) contractInput.value = "";
      if (output) {
        output.innerHTML = '<p class="output-placeholder">Hier erscheint das Ergebnis deiner Analyse.</p>';
      }
      updateLimitInfo();
    });
}

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }

  setActiveTab("quick");
  applyDevUi();
  updateLimitInfo();
});
