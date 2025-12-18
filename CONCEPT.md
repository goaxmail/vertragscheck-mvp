# VertragsCheck – App-Master Konzept (MVP → Geld)

## Ziel
Eine PWA, die aus Vertragstexten in Sekunden einen **Ampel-Report** macht (Grün/Gelb/Rot) und dem Nutzer **konkrete nächste Schritte** gibt.

## MVP (was wir JETZT shippen)
1. **Text rein** (Copy/Paste) + optional Kategorie-Chip
2. **Auto-Kategorie-Erkennung** (wenn auf Auto)
3. **Analyse-Report**
   - Kategorie
   - Risiko-Level: niedrig|mittel|hoch
   - Kurze Summary (2–3 Sätze)
   - Wichtigste Punkte (3–6)
   - Warnungen (0–5)
   - Nächste Schritte (2–4)
4. **Lokale Historie** (auf dem Gerät)

## Paywall / Monetarisierung (Phase 1)
- Start: **Credits** (z.B. 5 Analysen / 9,99€) – niedrigere Abo-Hürde
- Später: **Abo** + **B2B Packs** (Makler/Anwälte/Agenturen)

## Architektur (so ist das Projekt gebaut)
- Frontend: `index.html`, `style.css`, `script.js` (Mobile-First)
- PWA: `manifest.json`, `service-worker.js`
- Backend (Vercel Serverless): `api/analyze.js`
  - nutzt OpenAI Responses API
  - Env:
    - `OPENAI_API_KEY` (required)
    - `OPENAI_MODEL` (optional, default `gpt-4.1-mini`)

## UX-Entscheidung: Kategorien
- **Frontend** wirkt spezialisiert (Vertrauen + Conversion)
- **Backend** bleibt flexibel (GPT kann alles)
- Modus:
  - Chip = Auto → GPT erkennt Kategorie
  - Chip = gesetzt → Prompt fokussiert auf die Kategorie

## Nächste Schritte (Step-by-Step)
1. Live deployen (GitHub → Vercel) + `OPENAI_API_KEY` setzen
2. 20 echte Testverträge durchjagen (verschiedene Kategorien)
3. Output-Qualität finetunen:
   - Prompts
   - Scoring-Regeln
   - UI-Text (klarer, härter)
4. Paywall (Stripe) + Limitierung (Free: 1/Tag)
5. PDF-Export + Share-Link
