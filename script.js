
async function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Datei konnte nicht gelesen werden."));
    reader.onload = () => resolve(reader.result);
    reader.readAsText(file, "utf-8");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("fileInput");
  const contractTextEl = document.getElementById("contractText");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const resultCard = document.getElementById("resultCard");
  const loadingEl = document.getElementById("loading");
  const errorBox = document.getElementById("errorBox");
  const resultContent = document.getElementById("resultContent");

  const newContractBtn = document.getElementById("newContractBtn");
  const infoBtn = document.getElementById("infoBtn");

  const contractTypeEl = document.getElementById("contractType");
  const monthlyCostEl = document.getElementById("monthlyCost");
  const termEl = document.getElementById("term");
  const cancellationPeriodEl = document.getElementById("cancellationPeriod");
  const renewalEl = document.getElementById("renewal");
  const plainExplanationEl = document.getElementById("plainExplanation");
  const risksListEl = document.getElementById("risksList");
  const cancellationStatusEl = document.getElementById("cancellationStatus");
  const terminationLetterEl = document.getElementById("terminationLetter");
  const copyLetterBtn = document.getElementById("copyLetterBtn");

  fileInput.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".txt")) {
      alert("Für das MVP werden nur .txt-Dateien unterstützt.");
      fileInput.value = "";
      return;
    }
    try {
      const text = await readTextFile(file);
      contractTextEl.value = text;
    } catch (err) {
      console.error(err);
      alert("Die Datei konnte nicht gelesen werden.");
    }
  });

  function showError(message) {
    errorBox.textContent = message;
    errorBox.classList.remove("hidden");
  }

  function clearError() {
    errorBox.textContent = "";
    errorBox.classList.add("hidden");
  }

  function setLoading(isLoading) {
    if (isLoading) {
      analyzeBtn.disabled = true;
      analyzeBtn.textContent = "Wird analysiert...";
      loadingEl.classList.remove("hidden");
      resultContent.classList.add("hidden");
    } else {
      analyzeBtn.disabled = false;
      analyzeBtn.textContent = "Vertrag analysieren";
      loadingEl.classList.add("hidden");
    }
  }

  analyzeBtn.addEventListener("click", async () => {
    clearError();
    const text = contractTextEl.value.trim();
    if (!text) {
      showError("Bitte gib zuerst einen Vertragstext ein oder lade eine Datei hoch.");
      return;
    }

    if (text.length < 40) {
      showError("Bitte gib einen Vertragstext mit mindestens 40 Zeichen ein.");
      return;
    }

    resultCard.classList.remove("hidden");
    setLoading(true);

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ contractText: text })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        const msg = data.error || `Fehler bei der Analyse (Status ${response.status}).`;
        throw new Error(msg);
      }

      const data = await response.json();
      if (!data || !data.result) {
        throw new Error("Die Antwort der KI konnte nicht verarbeitet werden.");
      }

      const r = data.result;

      contractTypeEl.textContent = r.contract_type || "–";
      monthlyCostEl.textContent = r.monthly_cost || "–";
      termEl.textContent = r.term || "–";
      cancellationPeriodEl.textContent = r.cancellation_period || "–";
      renewalEl.textContent = r.renewal || "–";
      plainExplanationEl.textContent = r.plain_explanation || "";

      risksListEl.innerHTML = "";
      if (Array.isArray(r.risks) && r.risks.length > 0) {
        r.risks.forEach((risk) => {
          const li = document.createElement("li");
          li.textContent = risk;
          risksListEl.appendChild(li);
        });
      } else {
        const li = document.createElement("li");
        li.textContent = "Keine besonderen Risiken erkannt oder nicht eindeutig.";
        risksListEl.appendChild(li);
      }

      cancellationStatusEl.textContent = r.cancellation_status || "";
      terminationLetterEl.value = r.termination_letter || "";

      resultContent.classList.remove("hidden");
    } catch (err) {
      console.error(err);
      showError(err.message || "Unbekannter Fehler bei der Analyse.");
    } finally {
      setLoading(false);
    }
  });

  copyLetterBtn.addEventListener("click", async () => {
    const text = terminationLetterEl.value.trim();
    if (!text) {
      alert("Es gibt derzeit keinen Kündigungstext zum Kopieren.");
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      copyLetterBtn.textContent = "Kopiert!";
      setTimeout(() => {
        copyLetterBtn.textContent = "Text kopieren";
      }, 2000);
    } catch (err) {
      console.error(err);
      alert("Kopieren nicht möglich. Bitte markiere den Text manuell.");
    }
  });

  if (newContractBtn) {
    newContractBtn.addEventListener("click", () => {
      fileInput.value = "";
      contractTextEl.value = "";
      resultCard.classList.add("hidden");
      resultContent.classList.add("hidden");
      errorBox.classList.add("hidden");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if (infoBtn) {
    infoBtn.addEventListener("click", () => {
      const footer = document.querySelector(".app-footer");
      if (footer) {
        footer.scrollIntoView({ behavior: "smooth" });
      }
    });
  }

});
