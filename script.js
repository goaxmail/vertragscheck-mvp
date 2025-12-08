
function analyzeContract() {
  const text = document.getElementById('contract').value.trim();
  const out = document.getElementById('output');
  const btn = document.getElementById('analyze-btn');

  if (!text) {
    out.textContent = "Bitte Vertragstext eingeben.";
    return;
  }

  out.textContent = "Analyse läuft…";
  btn.disabled = true;

  setTimeout(() => {
    out.textContent = "Analyse abgeschlossen (Demo). In der Vollversion erhältst du ein detailliertes Risiko‑Profil und klare Erklärungen zu kritischen Klauseln.";
    btn.disabled = false;
  }, 1500);
}

function initTabs() {
  const buttons = Array.from(document.querySelectorAll('.tab-btn'));
  const sections = {
    schnellcheck: document.getElementById('tab-schnellcheck'),
    vertraege: document.getElementById('tab-vertraege'),
    profil: document.getElementById('tab-profil'),
  };

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      buttons.forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      Object.entries(sections).forEach(([key, el]) => {
        if (!el) return;
        el.classList.toggle('is-hidden', key !== tab);
      });
    });
  });
}

if (typeof window !== "undefined") {
  window.addEventListener('DOMContentLoaded', () => {
    initTabs();
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js');
  });
}
