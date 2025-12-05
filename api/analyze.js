
// Vercel Serverless Function: /api/analyze
// Erwartet: POST { contractText: string }
// Nutzt: OpenAI Chat Completions API (API-Key aus process.env.OPENAI_API_KEY)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY ist nicht gesetzt. Bitte in den Vercel-Umgebungsvariablen konfigurieren." });
  }

  const { contractText } = req.body || {};
  if (!contractText || typeof contractText !== "string" || contractText.trim().length < 40) {
    return res.status(400).json({ error: "Bitte gib einen ausreichenden Vertragstext an (mind. 40 Zeichen)." });
  }

  try {
    const prompt = `
Du bist ein deutscher Vertrags-Experte. Du bekommst unten einen Vertragstext.
Analysiere ihn und gib eine Antwort *nur als JSON-Objekt* mit folgenden Feldern zurück:

{
  "contract_type": "z.B. Handyvertrag, Fitnessstudio, Strom, Internet, Mietvertrag, Sonstiges",
  "monthly_cost": "z.B. 39,99 € / Monat oder \"unklar\"",
  "term": "z.B. Mindestlaufzeit 24 Monate, vom 01.01.2025 bis 31.12.2026, oder \"unklar\"",
  "cancellation_period": "z.B. 1 Monat zum Laufzeitende, 3 Monate Kündigungsfrist, oder \"unklar\"",
  "renewal": "z.B. Verlängert sich um 12 Monate, wenn nicht fristgerecht gekündigt, oder \"keine automatische Verlängerung\" oder \"unklar\"",
  "plain_explanation": "Kurze, leicht verständliche Erklärung in 2–5 Sätzen. In \"Du\"-Form.",
  "risks": [
    "Liste von konkreten Risiken oder Nachteilen in einem Satz pro Eintrag. Falls keine klaren Risiken, gib eine kurze Info wie \"Keine besonderen Risiken erkennbar\"."
  ],
  "cancellation_status": "Einschätzung, ob der Vertrag grundsätzlich kündbar ist und worauf man achten muss. Keine Rechtsberatung, nur Orientierung.",
  "termination_letter": "Ein vollständiger Kündigungstext auf Deutsch. Enthält: Name / Adresse als Platzhalter, Vertragsbezeichnung, Kundennummer als Platzhalter, eindeutige Kündigungserklärung, Datum und Unterschriftszeile."
}

Gib wirklich nur das JSON zurück, ohne zusätzliche Erklärungen.

VERTRAGSTEXT:
${contractText}
`.trim();

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: "Du bist ein deutscher Vertrags- und Verbraucherschutz-Experte. Antworte immer in deutscher Sprache."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      console.error("OpenAI API Fehler:", response.status, errText);
      return res.status(500).json({ error: "Fehler bei der Kommunikation mit der OpenAI-API." });
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content || "";

    let parsed;
    try {
      const trimmed = raw.trim().replace(/```json|```/g, "");
      parsed = JSON.parse(trimmed);
    } catch (parseErr) {
      console.error("JSON Parse Fehler:", parseErr, raw);
      return res.status(500).json({ error: "Die Antwort der KI konnte nicht als JSON interpretiert werden." });
    }

    return res.status(200).json({ result: parsed });
  } catch (err) {
    console.error("Handler-Fehler:", err);
    return res.status(500).json({ error: "Interner Fehler bei der Analyse." });
  }
}
