# VertragsCheck – MVP

Dieses Projekt ist ein minimaler Prototyp für eine KI-gestützte Vertragsanalyse-App.

## Features

- Vertragstext per .txt-Upload oder Copy & Paste eingeben
- Aufruf einer OpenAI-API (gpt-4o-mini) über eine Vercel Serverless Function
- Ausgabe:
  - Vertragsart
  - Monatliche Kosten
  - Laufzeit
  - Kündigungsfrist
  - Verlängerung
  - Klartext-Erklärung
  - Risiken & Hinweise
  - Kündigungsstatus
  - Kündigungsschreiben

## Struktur

- `index.html` – UI
- `style.css` – Styling
- `script.js` – Frontend-Logik
- `api/analyze.js` – Vercel-Serverless-Function (Backend, OpenAI-Aufruf)
- `vercel.json` – Vercel-Konfiguration
- `package.json` – Projekt-Metadaten

## Deployment auf Vercel (Kurzfassung)

1. Repository / Ordner zu GitHub hochladen **oder** Vercel-CLI nutzen.
2. In Vercel ein neues Projekt erstellen und dieses Verzeichnis verbinden.
3. In den Projekteinstellungen Umgebungsvariable setzen:

   - `OPENAI_API_KEY` = dein geheimer OpenAI-API-Key

4. Deploy auslösen.

Danach kannst du die App im Browser öffnen, Vertragstext eingeben und die Analyse testen.

**Wichtig:** Dieses MVP speichert keine Dokumente. Alles wird nur zur Analyse an die OpenAI-API gesendet.
