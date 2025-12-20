import crypto from "crypto";

// --- Config (override via Vercel env vars) ---
const DAILY_LIMIT = Number(process.env.DAILY_LIMIT || 5);
const MAX_CHARS = Number(process.env.MAX_CONTRACT_CHARS || 15000);

// Signed cookie to keep a *server-side* daily quota without a database.
// (Users could clear cookies, but it prevents trivial client-side bypassing
// and protects you from accidental cost spikes.)
const COOKIE_NAME = "vc_rl";
const SECRET =
  process.env.RATE_LIMIT_SECRET ||
  process.env.OPENAI_API_KEY || // fallback (better than nothing for MVP)
  "dev-secret-change-me";

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function base64urlEncode(str) {
  return Buffer.from(str, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64urlDecode(str) {
  const normalized = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4 ? "=".repeat(4 - (normalized.length % 4)) : "";
  return Buffer.from(normalized + pad, "base64").toString("utf8");
}

function sign(payloadB64) {
  return crypto.createHmac("sha256", SECRET).update(payloadB64).digest("base64url");
}

function parseCookies(req) {
  const header = req.headers?.cookie || "";
  const out = {};
  header.split(";").forEach((part) => {
    const [k, ...v] = part.trim().split("=");
    if (!k) return;
    out[k] = decodeURIComponent(v.join("=") || "");
  });
  return out;
}

function readQuota(req) {
  const cookies = parseCookies(req);
  const raw = cookies[COOKIE_NAME];
  if (!raw) return { date: todayKey(), count: 0 };

  const [payloadB64, sig] = raw.split(".");
  if (!payloadB64 || !sig) return { date: todayKey(), count: 0 };

  const expected = sign(payloadB64);
  try {
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return { date: todayKey(), count: 0 };
    }
  } catch {
    return { date: todayKey(), count: 0 };
  }
  try {
    const decoded = JSON.parse(base64urlDecode(payloadB64));
    if (!decoded || decoded.date !== todayKey()) return { date: todayKey(), count: 0 };
    return { date: decoded.date, count: Number(decoded.count) || 0 };
  } catch {
    return { date: todayKey(), count: 0 };
  }
}

function setQuotaCookie(res, quota) {
  const payload = base64urlEncode(JSON.stringify(quota));
  const sig = sign(payload);

  const isProd = process.env.VERCEL_ENV === "production";
  const parts = [
    `${COOKIE_NAME}=${payload}.${sig}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${60 * 60 * 24 * 2}` // 2 days
  ];
  if (isProd) parts.push("Secure");

  res.setHeader("Set-Cookie", parts.join("; "));
}

export default async function handler(req, res) {
  // Avoid caching responses with personal content.
  res.setHeader("Cache-Control", "no-store");

  // --- Dev mode controls ---
  // In dev mode we deliberately bypass rate limits so you can test freely.
  // Dev mode is enabled either via explicit header from the frontend or on localhost.
  const host = String(req.headers?.host || "");
  const DEV_MODE = String(req.headers["x-dev-mode"] || "") === "1" || host.includes("localhost");
  const DEV_RESET = String(req.headers["x-dev-reset"] || "") === "1";

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text, category } = req.body || {};
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Missing contract text" });
    }

    const trimmed = text.trim();
    if (!trimmed) {
      return res.status(400).json({ error: "Empty contract text" });
    }

    if (trimmed.length > MAX_CHARS) {
      return res.status(413).json({
        error: "Contract text too long",
        max_chars: MAX_CHARS
      });
    }

    // Dev-only helper: reset the server-side daily quota cookie.
    // This is honored ONLY when DEV_MODE is active.
    if (DEV_MODE && DEV_RESET) {
      setQuotaCookie(res, { date: todayKey(), count: 0 });
      return res.status(200).json({ ok: true, reset: true });
    }

    // --- Server-side daily quota ---
    const quota = DEV_MODE ? { date: todayKey(), count: 0 } : readQuota(req);
    if (!DEV_MODE && quota.count >= DAILY_LIMIT) {
      return res.status(429).json({ error: "Daily limit reached", limit: DAILY_LIMIT });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY on server" });
    }

    const categoryKey = typeof category === "string" ? category.trim() : "auto";
    const allowedCategories = new Set([
      "auto",
      "mobilfunk",
      "miete",
      "versicherung",
      "abo",
      "sonstiges"
    ]);
    const safeCategory = allowedCategories.has(categoryKey) ? categoryKey : "auto";

    const categoryHint =
      safeCategory !== "auto"
        ? `Der Nutzer hat die Kategorie vorgewählt: ${safeCategory}. Fokussiere deine Prüfung auf typische Risiken dieser Kategorie (z. B. Laufzeit/Kündigung, Kosten, automatische Verlängerung, Preisänderungen, Widerruf, Haftung).`
        : "Erkenne zuerst grob, um welche Vertragsart es sich handelt (eine der Kategorien: mobilfunk, miete, versicherung, abo, sonstiges).";

    const prompt = [
      "Du bist ein Vertrags-Check-Assistent für Verbraucher.",
      "Aufgabe: Erkenne die wichtigsten Risiken/Fallen im Vertrag und gib konkrete, nachvollziehbare To-dos.",
      "WICHTIG: Keine Rechtsberatung. Keine erfundenen Paragraphen oder Behauptungen. Wenn etwas nicht im Text steht: sag es.",
      "Schreibe klar, kurz, konkret. Keine Panikmache. Keine absoluten Aussagen.",
      categoryHint,
      "",
      "Gib ausschließlich JSON zurück (kein Text außerhalb).",
      "JSON-Regeln:",
      "- Verwende nur Informationen aus dem Text.",
      "- Wenn möglich: nenne kurze Textstellen als Beleg (max. 1–2 Sätze) und markiere sie als 'Zitat: ...'.",
      "",
      "Antwortformat (zwingend als JSON):",
      "{",
      '  "category": "mobilfunk" | "miete" | "versicherung" | "abo" | "sonstiges",',
      '  "level": "low" | "medium" | "high",',
      '  "summary": "1–3 Sätze: worum geht es und wo liegt das Haupt-Risiko?",',
      '  "points": [',
      '    "Top-Risiko 1 – konkrete Konsequenz (was passiert, wenn man nichts tut)",',
      '    "Top-Risiko 2 – konkrete Konsequenz",',
      '    "Top-Risiko 3 – konkrete Konsequenz",',
      '    "To-do: Konkrete Handlung (z.B. kündigen bis X / nachfragen / Vergleich prüfen)",',
      '    "To-do: ...",',
      '    "... (insgesamt 8–12 Punkte)"',
      "  ],",
      '  "sections": [',
      "    {",
      '      "title": "Laufzeit & Kündigung",',
      '      "risk": "low" | "medium" | "high",',
      '      "notes": ["kurze Fakten + Zitat-Beleg falls möglich", "To-do in 1 Satz"]',
      "    },",
      "    {",
      '      "title": "Kosten & Gebühren",',
      '      "risk": "low" | "medium" | "high",',
      '      "notes": ["kurze Fakten + Zitat-Beleg falls möglich", "Hinweise zu Preisänderungen/Extras"]',
      "    },",
      "    {",
      '      "title": "Einschränkungen & Ausschlüsse",',
      '      "risk": "low" | "medium" | "high",',
      '      "notes": ["z.B. Leistungs-Ausschlüsse, Wartezeiten, Selbstbehalt, Bedingungen", "Zitat: ..."]',
      "    },",
      "    {",
      '      "title": "Deine nächsten Schritte",',
      '      "risk": "low" | "medium" | "high",',
      '      "notes": ["3 konkrete To-dos in Stichpunkten", "Fragen an den Anbieter (copy-paste-ready)"]',
      "    }",
      "  ]",
      "}",
      "",
      "Text:",
      trimmed
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0.2,
        max_tokens: 700,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Du hilfst Verbrauchern, Verträge besser einzuschätzen. Sei neutral, klar und vorsichtig mit Formulierungen. Keine Rechtsberatung."
          },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("OpenAI API error:", errorText);
      return res.status(502).json({ error: "OpenAI API error" });
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

    // Increment quota ONLY on successful AI response (not in dev mode)
    const nextQuota = DEV_MODE ? quota : { date: todayKey(), count: quota.count + 1 };
    if (!DEV_MODE) setQuotaCookie(res, nextQuota);

    return res.status(200).json({
      category: parsed.category || (safeCategory !== "auto" ? safeCategory : ""),
      level: parsed.level || "unknown",
      summary: parsed.summary || "",
      points: Array.isArray(parsed.points) ? parsed.points : [],
      sections: Array.isArray(parsed.sections) ? parsed.sections : [],
      meta: {
        daily_limit: DAILY_LIMIT,
        used_today: nextQuota.count,
        max_chars: MAX_CHARS,
        category_selected: safeCategory
      }
    });
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
