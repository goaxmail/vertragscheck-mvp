# VertragsCheck – v1.0.4

Dieser Build enthält:

- Modernes UI mit Tabs (Schnell-Check, Verträge, Profil)
- Vertragstext-Auswertung über eine serverseitige Schnittstelle zu OpenAI
- Soft-Paywall: nur ein Teil der Hinweise ist sichtbar, zusätzliche Details sind für Pro vorgesehen
- Strukturierte Pro-Analyse im Backend über `sections` (Themenblöcke)
- Analyse-Limit (MVP):
  - **Serverseitig**: Standard 5 Auswertungen/Tag (signiertes Cookie, ohne Datenbank)
    - ENV: `DAILY_LIMIT`
    - Optional: `RATE_LIMIT_SECRET` (empfohlen)
  - **UI/Dev**: lokaler Counter (LocalStorage) für Anzeige/UX
- Text-Limit: Standard max. 15.000 Zeichen
  - ENV: `MAX_CONTRACT_CHARS`
- Kategorie-Auswahl (optional): Mobilfunk/Internet, Miete, Versicherung, Abos, Sonstiges oder Auto-Erkennung
- PWA-Basis (Manifest + Service Worker)

Neu in v1.0.4:
- Dev-Modus übermittelt jetzt ein Header-Signal an das Backend, damit **Limits im Dev-Modus wirklich komplett umgangen werden**.
- Dev-Reset setzt weiterhin Client-State zurück und kann serverseitige Quota-Cookies zurücksetzen.

In Vercel muss die Umgebungsvariable `OPENAI_API_KEY` gesetzt sein.

## Dev-Modus

- Lokal (localhost) ist Dev automatisch aktiv.
- Auf einem Deploy kannst du Dev aktivieren mit `?dev=1` (wird lokal gespeichert).
- Dev wieder aus mit `?dev=0`.
