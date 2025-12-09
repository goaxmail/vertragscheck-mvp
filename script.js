
document.addEventListener("DOMContentLoaded", () => {
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabViews = document.querySelectorAll(".tab-view");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const contractInput = document.getElementById("contract");
  const output = document.getElementById("output");

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
    const text = (contractInput?.value || "").trim();
    if (!output) return;

    if (!text) {
      output.innerHTML = '<p class="output-placeholder">Bitte füge zuerst einen Vertragstext ein.</p>';
      return;
    }

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
      const summary = data.summary || "Es gab ein Problem bei der Analyse oder es liegen zu wenige Informationen vor.";
      const points = Array.isArray(data.points) && data.points.length > 0
        ? data.points
        : [
            "Prüfe Laufzeit, automatische Verlängerung und Kündigungsfristen besonders sorgfältig.",
            "Achte auf zusätzliche Gebühren oder versteckte Kosten im Kleingedruckten.",
            "Vergleiche die Konditionen mit ähnlichen Angeboten, um ein Gefühl für das Marktüblich zu bekommen."
          ];

      let riskLevelClass = "risk-low";
      let badgeText = "Risiko-Level: niedrig";

      if (level === "medium") {
        riskLevelClass = "risk-medium";
        badgeText = "Risiko-Level: mittel";
      } else if (level === "high") {
        riskLevelClass = "risk-high";
        badgeText = "Risiko-Level: erhöht";
      } else if (level === "unknown") {
        badgeText = "Risiko-Level: Demo";
      }

      const listItems = points
        .slice(0, 4)
        .map((note) => `<li>${note}</li>`)
        .join("");

      output.innerHTML = `
        <div class="risk-header ${riskLevelClass}">
          <div>
            <div class="risk-label">Erste Einschätzung (KI, Beta)</div>
            <div class="risk-badge">${badgeText}</div>
          </div>
          <div class="risk-score">KI</div>
        </div>
        <p class="risk-summary">${summary}</p>
        <ul class="risk-points">
          ${listItems}
        </ul>
        <div class="pro-upsell">
          <div class="pro-upsell-tag">Pro (geplant)</div>
          <p class="pro-upsell-text">
            In der Pro-Version soll die Analyse ausführlicher sein – mit feineren Risiko-Scores,
            Kapitel-Übersicht und Export als PDF-Report. Diese Beta speichert deine Texte nicht dauerhaft.
          </p>
        </div>
      `;
    } catch (err) {
      output.innerHTML = `
        <p class="risk-summary">
          Die Analyse ist aktuell nicht erreichbar. Bitte versuche es später erneut.
        </p>
        <p class="disclaimer">
          Technischer Hinweis: Prüfe, ob dein API-Key korrekt hinterlegt ist oder kontaktiere den Betreiber der App.
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

  // PWA / Service Worker
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/service-worker.js").catch(() => {});
  }

  // Default tab
  setActiveTab("quick");
});
