# VertragsCheck – Analyse-Limit v1

Dieser Build enthält:

- Modernes UI mit Tabs (Schnell-Check, Verträge, Profil)
- Vertragstext-Auswertung über eine serverseitige Schnittstelle zu OpenAI
- Soft-Paywall: nur ein Teil der Hinweise ist sichtbar, zusätzliche Details sind für Pro vorgesehen
- Strukturierte Pro-Analyse im Backend über `sections` (Themenblöcke)
- Analyse-Limit: 3 Auswertungen pro Tag und Gerät (lokal per LocalStorage)
- PWA-Basis (Manifest + Service Worker)

In Vercel muss die Umgebungsvariable `OPENAI_API_KEY` gesetzt sein.
