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

    if (analyzeBtn) {
      analyzeBtn.disabled = true;
      analyzeBtn.classList.add("loading");
      analyzeBtn.textContent = "Analyse läuft…";
    }

    output.innerHTML = '<p class="output-placeholder">Analyse läuft…</p>';

    setTimeout(() => {
      output.innerHTML = `
        <h3>Erste Einschätzung (Demo)</h3>
        <ul>
          <li>Mögliche unklare Klauseln erkannt (z. B. Laufzeit, automatische Verlängerung).</li>
          <li>Empfehlung: Vertrag vollständig lesen und auf versteckte Gebühren achten.</li>
          <li>Für eine verbindliche Einschätzung sollte ein Rechtsanwalt hinzugezogen werden.</li>
        </ul>
        <p class="disclaimer">Diese Analyse ist nur eine Demo und ersetzt keine Rechtsberatung.</p>
      `;

      if (analyzeBtn) {
        analyzeBtn.disabled = false;
        analyzeBtn.classList.remove("loading");
        analyzeBtn.textContent = "Analyse starten";
      }
    }, 1200);
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
