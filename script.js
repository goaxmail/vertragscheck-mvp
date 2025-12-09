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

  
  function analyzeContract() {
    const text = (contractInput?.value || "").trim();
    if (!output) return;

    if (!text) {
      output.innerHTML = '<p class="output-placeholder">Bitte füge zuerst einen Vertragstext ein.</p>';
      return;
    }

    const normalized = text.toLowerCase();

    const keywordRules = [
      { key: "automatische verlängerung", score: 3, note: "Automatische Verlängerung kann zu langen Laufzeiten führen, wenn du die Kündigungsfrist verpasst." },
      { key: "mindestvertragslaufzeit", score: 2, note: "Mindestvertragslaufzeit schränkt deine Flexibilität, schnell zu wechseln, deutlich ein." },
      { key: "kündigungsfrist", score: 2, note: "Kündigungsfristen sollten klar und fair formuliert sein – sonst droht eine ungewollte Verlängerung." },
      { key: "gebühr", score: 2, note: "Zusätzliche Gebühren können den Vertrag teurer machen als erwartet." },
      { key: "bearbeitungsgebühr", score: 2, note: "Einmalige Bearbeitungsgebühren sind oft schwer nachzuvollziehen." },
      { key: "schadensersatz", score: 2, note: "Schadensersatzklauseln können teuer werden, wenn sie sehr weit gefasst sind." },
      { key: "widerrufsrecht", score: 1, note: "Das Widerrufsrecht ist wichtig – achte auf die genaue Frist und Bedingungen." },
      { key: "bonität", score: 1, note: "Bonitätsklauseln betreffen deine Kreditwürdigkeit und sollten transparent sein." },
      { key: "preisänderung", score: 2, note: "Preisänderungsklauseln können zukünftige Kosten erhöhen." },
      { key: "indexierung", score: 2, note: "Indexierungen koppeln Preise an einen Index – das kann Vor- und Nachteile haben." }
    ];

    let score = 0;
    const notes = [];

    keywordRules.forEach((rule) => {
      if (normalized.includes(rule.key)) {
        score += rule.score;
        notes.push(rule.note);
      }
    });

    let level = "low";
    let label = "Niedriges Vertragsrisiko (Demo)";
    let summary = "Auf den ersten Blick wirkt dieser Vertrag relativ unkritisch. Einzelne Punkte solltest du trotzdem aufmerksam lesen.";
    let badgeText = "Risiko-Level: niedrig";

    if (score >= 4 && score <= 7) {
      level = "medium";
      label = "Mittleres Vertragsrisiko (Demo)";
      summary = "Es gibt einige Stellen im Vertrag, die genauer geprüft werden sollten – insbesondere zu Laufzeit, Kündigung und Kosten.";
      badgeText = "Risiko-Level: mittel";
    } else if (score > 7) {
      level = "high";
      label = "Erhöhtes Vertragsrisiko (Demo)";
      summary = "Der Vertrag enthält mehrere potenziell kritische Punkte. Lies alle Klauseln sehr genau und vergleiche gegebenenfalls Alternativen.";
      badgeText = "Risiko-Level: erhöht";
    }

    if (notes.length === 0) {
      notes.push(
        "Prüfe besonders Laufzeit, Verlängerung und Kündigungsfristen – hier verstecken sich oft Nachteile.",
        "Achte auf zusätzliche Gebühren oder Paketpreise, die erst im Kleingedruckten auftauchen.",
        "Vergleiche den Vertrag mit ähnlichen Angeboten, um ein Gefühl für übliche Konditionen zu bekommen."
      );
    }

    if (analyzeBtn) {
      analyzeBtn.disabled = true;
      analyzeBtn.classList.add("loading");
      analyzeBtn.textContent = "Analyse läuft…";
    }

    output.innerHTML = '<p class="output-placeholder">Analyse läuft…</p>';

    setTimeout(() => {
      const listItems = notes
        .slice(0, 4)
        .map((note) => `<li>${note}</li>`)
        .join("");

      output.innerHTML = `
        <div class="risk-header risk-${level}">
          <div>
            <div class="risk-label">${label}</div>
            <div class="risk-badge">${badgeText}</div>
          </div>
          <div class="risk-score">Demo</div>
        </div>
        <p class="risk-summary">${summary}</p>
        <ul class="risk-points">
          ${listItems}
        </ul>
        <div class="pro-upsell">
          <div class="pro-upsell-tag">Pro (geplant)</div>
          <p class="pro-upsell-text">
            In der Pro-Version soll die Analyse detaillierter werden – mit feineren Risiko-Scores,
            Kapitel-Übersicht und Export als PDF-Report. Diese Demo speichert keine Daten.
          </p>
        </div>
      `;

      if (analyzeBtn) {
        analyzeBtn.disabled = false;
        analyzeBtn.classList.remove("loading");
        analyzeBtn.textContent = "Analyse starten";
      }
    }, 900);
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
