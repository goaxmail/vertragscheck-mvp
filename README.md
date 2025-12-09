# VertragsCheck – Pro-Analyse v1

Dieser Build enthält:

- Modernes UI mit Tabs (Schnell-Check, Verträge, Profil)
- Vertragstext-Auswertung über OpenAI
- Soft-Paywall: nur ein Teil der Hinweise ist sichtbar, zusätzliche Details sind für Pro vorgesehen
- Backend liefert bereits strukturierte Themen-Blöcke unter `sections` (Laufzeit, Kosten, etc.) für zukünftige Pro-Features
- PWA-Basis (Manifest + Service Worker)

In Vercel muss die Umgebungsvariable `OPENAI_API_KEY` gesetzt sein.
