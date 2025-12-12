export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { text } = req.body || {};
    const input = String(text || "").trim();
    if (!input) {
      res.status(400).json({ error: "Missing text" });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      // Fallback: deterministic local demo so UI stays testable
      res.status(200).json({
        title: input.split("\n")[0]?.slice(0, 46) || "Vertrag",
        riskLevel: "mittel",
        summary: "Kurze Einschätzung (Demo): Bitte API-Key setzen, um echte Auswertung zu erhalten.",
        bullets: ["API-Key fehlt in Vercel Umgebungsvariablen.", "Diese Antwort ist nur ein Platzhalter."]
      });
      return;
    }

    const system = "Du bist ein präziser Assistent, der Vertragsabschnitte kurz zusammenfasst und Risiken erkennt. Keine Rechtsberatung.";
    const user = `Analysiere den folgenden Vertragstext und gib strikt JSON zurück mit Feldern:
title (kurz), riskLevel (niedrig|mittel|hoch), summary (2-3 Sätze), bullets (3-6 Stichpunkte).
Text:\n\n${input}`;

    const r = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      res.status(500).json({ error: "OpenAI request failed", detail: t });
      return;
    }

    const data = await r.json();
    // responses API: JSON is typically in output_text, but with json_object it will be parseable in output_text
    let out = data.output_text || "";
    let parsed = null;
    try { parsed = JSON.parse(out); } catch {}

    if (!parsed) {
      // attempt to find first JSON object
      const m = out.match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch {}
      }
    }

    if (!parsed) {
      res.status(500).json({ error: "Could not parse model output" });
      return;
    }

    res.status(200).json({
      title: parsed.title || "Vertrag",
      riskLevel: parsed.riskLevel || "mittel",
      summary: parsed.summary || "",
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets : []
    });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
}
