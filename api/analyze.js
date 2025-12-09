
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text } = req.body || {};
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing contract text" });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY on server" });
    }

    const prompt = [
      "Du bist ein Assistent, der Vertragsklauseln für Endverbraucher erklärt.",
      "Analysiere den folgenden Vertragstext grob auf Risiko für den Kunden.",
      "Gib eine knappe Einschätzung zurück – nur als JSON, kein Fließtext außen herum.",
      "",
      "Antwortformat (zwingend als JSON):",
      "{",
      '  "level": "low" | "medium" | "high",',
      '  "summary": "kurze Zusammenfassung in 1-3 Sätzen",',
      '  "points": ["Stichpunkt 1", "Stichpunkt 2", "…"]',
      "}",
      "",
      "Text:",
      text
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Du bist ein deutscher Vertrags-Assistent, der Verbrauchern bei der Einschätzung von Risiken hilft." },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", errorText);
      return res.status(500).json({ error: "OpenAI API error" });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content || "{}";

    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (e) {
      console.error("JSON parse error:", e, "content:", content);
      return res.status(500).json({ error: "Failed to parse AI response" });
    }

    return res.status(200).json({
      level: parsed.level || "unknown",
      summary: parsed.summary || "",
      points: Array.isArray(parsed.points) ? parsed.points : []
    });
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
