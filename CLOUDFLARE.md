# ENTROTOPIA: Cloudflare-Anbindung

## Stand 06.11.2026

Die statische, zusammengeführte Startseite ist auf dem GitHub-Branch `main` in `index.html` aktualisiert. Die ursprüngliche Seite ist unter `archive/index-vor-entrotopia-labs-2026-11-06.html` gesichert.

**GitHub-Update ist NICHT automatisch eine bestätigte Cloudflare-Veröffentlichung.** Prüfe Cloudflare separat. Keine Datenbank und kein Admin-Backend sind in diesem statischen Repo aktiv.

## Bestehende Cloudflare-Pages-Seite mit GitHub verbinden

1. https://dash.cloudflare.com/ öffnen.
2. Zu **Workers & Pages** wechseln, das bestehende Pages-Projekt auswählen.
3. Unter **Settings → Builds / Git** kontrollieren, ob `misterficker33/entrotopia-site` verbunden ist und `main` als Produktionsbranch eingestellt ist.
4. Falls bereits verbunden: **Deployments** auf aktuellen erfolgreichen Build prüfen. Falls nicht verbunden, Git-Integration einrichten oder die neue statische `index.html` über Cloudflare Pages als statische Website deployen.
5. Für die statische `index.html` braucht es keinen Build: Build Command leer, Ausgabeordner `.`, sofern Cloudflare danach fragt. Bestehende projektspezifische Einstellungen vor dem Ändern prüfen.
6. Produktions-URL aufrufen und sicherstellen, dass ENTROTOPIA Labs **und** das Handwerker-Anfragen-Set sichtbar sind.
7. Die öffentliche Seite bleibt vorerst auf `noindex,nofollow` und ohne Shop. Vor aktivem Vermarkten Impressum, Datenschutz und Krankengeld-Folgen prüfen.

## Spätere volle Plattform mit Admin + D1

Die lokale Version `ENTROTOPIA_v0.5_Zusammengefuehrt.zip` enthält einen Worker mit Datenbank und Adminbereich. Sie ist **noch nicht** in dieses öffentliche Repo eingebunden. Für ihre Veröffentlichung brauchst du zusätzlich:
- D1-Datenbank anlegen und `database_id` in `wrangler.toml` eintragen,
- Migrationen ausführen,
- `ADMIN_PASSWORD` als Cloudflare-Secret setzen,
- rechtliche Pflichtseiten prüfen,
- getrennten Workers-Deployment-Test durchführen, bevor die bestehende Domain umgeschaltet wird.

Keinesfalls echte Passwörter oder API-Tokens in GitHub-Dateien speichern.
