# VertragsCheck – MVP mit Soft-Paywall

Dieser Build enthält:

- Modernes UI mit Tabs (Schnell-Check, Verträge, Profil)
- Auswertung des Vertragstextes über eine serverseitige Schnittstelle zu OpenAI
- Soft-Paywall im Analyse-Output (ein Teil der Hinweise bleibt Pro vorbehalten)
- PWA-Basis (Manifest + Service Worker)

In Vercel muss die Umgebungsvariable `OPENAI_API_KEY` gesetzt sein.
