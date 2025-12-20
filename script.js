
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
  const DEV_MODE =
    ["localhost", "127.0.0.1"].includes(window.location.hostname) ||
    localStorage.getItem("vc_dev_mode") === "true";
  const DEV_IGNORE_LIMIT = DEV_MODE;
  const STORAGE_KEY = "vc_analysis_usage";

  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabViews = document.querySelectorAll(".tab-view");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const contractInput = document.getElementById("contract");
  const output = document.getElementById("output");
  const limitInfo = document.getElementById("limitInfo");
  const devResetBtn = document.getElementById("devResetBtn");

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
      limitInfo.textContent = `Dev-Modus: ${usage.count} Analysen heute (Limit deaktiviert).`;
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

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text })
      });

      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        const status = response.status;

        if (status === 429) {
          output.innerHTML = `
            <p class="risk-summary">Tageslimit erreicht.</p>
            <p class="disclaimer">Bitte versuche es morgen erneut – oder nutze später die Pro-Version für mehr Analysen.</p>
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
      const hasProExtras = hiddenPointCount > 0 || sectionCount > 0;

      const listItems = visiblePoints
        .map((note) => `<li>${note}</li>`)
        .join("");

      const lockedLine = hasProExtras
        ? `<li class="pro-locked">🔒 Zusätzliche Hinweise und eine Detail-Auswertung nach Themen sind für VertragsCheck&nbsp;Pro vorgesehen.</li>`
        : "";

      output.innerHTML = `
        <div class="risk-header ${riskLevelClass}">
          <div>
            <div class="risk-label">Erste Einschätzung (Beta)</div>
            <div class="risk-badge">${badgeText}</div>
          </div>
          <div class="risk-score">Tool</div>
        </div>
        <p class="risk-summary">${summary}</p>
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
    devResetBtn.addEventListener("click", () => {
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
