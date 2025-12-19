const CATEGORY = {
  auto: { key: "auto", label: "Auto" },
  mobilfunk: { key: "mobilfunk", label: "Mobilfunk/Internet" },
  strom: { key: "strom", label: "Strom/Gas" },
  versicherung: { key: "versicherung", label: "Versicherung" },
  miete: { key: "miete", label: "Miete" },
  sonstiges: { key: "sonstiges", label: "Sonstiges" },
};

function clamp(str, n) {
  const s = String(str || "");
  if (!n) return s;
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

async function openaiJson({ apiKey, model, input, schema }) {
  const r = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input,
      response_format: schema ? { type: "json_schema", json_schema: schema } : { type: "json_object" },
    }),
  });

  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(t || `OpenAI HTTP ${r.status}`);
  }

  const data = await r.json();
  const out = data.output_text || "";
  try {
    return JSON.parse(out);
  } catch {
    // fallback: grab first JSON object
    const m = out.match(/\{[\s\S]*\}/);
    if (m) {
      return JSON.parse(m[0]);
    }
    throw new Error("Could not parse model JSON");
  }
}

async function detectCategory(apiKey, text, model) {
  const schema = {
    name: "contract_category",
    schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        category: { type: "string", enum: ["mobilfunk", "strom", "versicherung", "miete", "sonstiges"] },
        confidence: { type: "number" },
        reason: { type: "string" },
      },
      required: ["category", "confidence", "reason"],
    },
  };

  const inputArr = [
    {
      role: "system",
      content:
        "Du klassifizierst Vertragstexte in eine Kategorie. Antworte NUR nach dem JSON-Schema.",
    },
    {
      role: "user",
      content:
        "Klassifiziere den folgenden Vertragstext.

" +
        "Wähle die passendste Kategorie: mobilfunk, strom, versicherung, miete, sonstiges.
" +
        "Gib confidence als Zahl 0..1.

" +
        "Text:
" +
        text,
    },
  ];

  const j = await openaiJson({ apiKey, model, input: inputArr, schema });
  const key = String(j?.category || "sonstiges").trim();
  return {
    category: CATEGORY[key] ? key : "sonstiges",
    confidence: Number(j?.confidence || 0),
    reason: String(j?.reason || ""),
  };
}

function analysisPrompt(categoryKey) {
  const common =
    "Du bist ein präziser Vertrags-Checker. Keine Rechtsberatung. " +
    "Sei konkret, kurz, und nenne harte Fakten (Laufzeit, Kündigung, Kosten), wenn im Text vorhanden.";

  const focus = {
    mobilfunk:
      "Fokus: Laufzeit, Kündigungsfrist, Verlängerung, Preissteigerungen, Zusatzkosten, Datenvolumen/Leistung, Widerruf.",
    strom:
      "Fokus: Arbeitspreis/Grundpreis, Preisgarantie, Preisanpassungsklauseln, Laufzeit, Kündigung, Boni, Abschläge.",
    versicherung:
      "Fokus: Selbstbeteiligung, Ausschlüsse, Wartezeiten, Beitragserhöhung, Laufzeit, Kündigung, Leistungspflichten.",
    miete:
      "Fokus: Kaltmiete/NK, Staffelmiete/Indexmiete, Kaution, Kündigungsfristen, Schönheitsreparaturen, Nebenkosten.",
    sonstiges:
      "Fokus: Laufzeit, Kündigung, Kosten, automatische Verlängerung, Preisänderungen, Widerruf, Vertragsstrafen.",
  };

  return common + " " + (focus[categoryKey] || focus.sonstiges);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { text, category } = req.body || {};
    const input = String(text || "").trim();
    const requested = String(category || "auto").trim() || "auto";

    if (!input) {
      res.status(400).json({ error: "Missing text" });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      res.status(200).json({
        title: clamp(input.split("\n")[0] || "Vertrag", 46),
        categoryLabel: "Auto",
        riskLevel: "mittel",
        summary:
          "Demo-Antwort: Bitte OPENAI_API_KEY in Vercel setzen, damit echte Analyse läuft.",
        bullets: [
          "API-Key fehlt in Vercel Umgebungsvariablen.",
          "Diese Ausgabe ist nur ein Platzhalter.",
        ],
        redFlags: [],
        nextSteps: ["OPENAI_API_KEY setzen", "Erneut analysieren"],
      });
      return;
    }

    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";

    // 1) Determine category
    let finalCat = requested;
    let catLabel = CATEGORY[finalCat]?.label || "Auto";

    if (requested === "auto" || !CATEGORY[requested]) {
      const detected = await detectCategory(apiKey, input, model);
      finalCat = detected.category;
      catLabel = CATEGORY[finalCat]?.label || "Sonstiges";
    }

    // 2) Analyze
    const schema = {
      name: "contract_analysis",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          riskLevel: { type: "string", enum: ["niedrig", "mittel", "hoch"] },
          summary: { type: "string" },
          bullets: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 6 },
          redFlags: { type: "array", items: { type: "string" }, minItems: 0, maxItems: 5 },
          nextSteps: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
        },
        required: ["title", "riskLevel", "summary", "bullets", "redFlags", "nextSteps"],
      },
    };

    const prompt = analysisPrompt(finalCat);

    const inputArr = [
      { role: "system", content: prompt },
      {
        role: "user",
        content:
          "Analysiere den Vertragstext und gib NUR JSON nach Schema zurück.
" +
          "Kategorie: " +
          catLabel +
          "

Text:
" +
          input,
      },
    ];

    const parsed = await openaiJson({ apiKey, model, input: inputArr, schema });

    res.status(200).json({
      title: String(parsed.title || clamp(input.split("\n")[0] || "Vertrag", 46)),
      category: finalCat,
      categoryLabel: catLabel,
      riskLevel: parsed.riskLevel || "mittel",
      summary: String(parsed.summary || ""),
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets : [],
      redFlags: Array.isArray(parsed.redFlags) ? parsed.redFlags : [],
      nextSteps: Array.isArray(parsed.nextSteps) ? parsed.nextSteps : [],
    });
  } catch (e) {
    res.status(500).json({ error: "Server error", detail: String(e?.message || e || "") });
  }
}
