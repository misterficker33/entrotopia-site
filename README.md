# entrotopia-site

Öffentliche, statische Landingpage für **entrotopia.de**. Wird über Cloudflare Pages aus dem Branch `main` bereitgestellt (Details und Anleitung: `CLOUDFLARE.md`).

## Inhalt

| Datei/Pfad | Zweck |
| --- | --- |
| `index.html` | Zusammengeführte Startseite (ENTROTOPIA Labs + Handwerker-Anfragen-Set); alte Version liegt in `archive/` |
| `public/app.js` | Lokales Lead-Tracking-Tool (Normalisierung, Filter, Risiko-Bewertung, CSV-Export, Follow-up-Entwürfe) |
| `tests/app.test.js` | Node-Tests für das Lead-Tracking (`node tests/app.test.js`) |
| `datenschutz.html`, `impressum.html` | Rechtliche Pflichtseiten |
| `CNAME` | Custom Domain `entrotopia.de` |
| `wrangler.toml` | Cloudflare-Konfiguration |
| `archive/` | Sicherung der Seite vor dem Redesign vom 06.11.2026 |

## Status

- Statisch, kein Build-Schritt, keine Datenbank, kein Admin-Backend in diesem Repo.
- Die Seite bleibt vorerst auf `noindex,nofollow` und ohne Shop (siehe `CLOUDFLARE.md`).
- Ein GitHub-Update ist **nicht** automatisch eine bestätigte Cloudflare-Veröffentlichung; Deployments in Cloudflare separat prüfen.
- Die spätere volle Plattform (Worker + D1 + Admin) ist noch nicht eingebunden; Anforderungsschritte stehen in `CLOUDFLARE.md`.

## Verwandte Projekte

- [ENTROTOPIA](https://github.com/misterficker33/ENTROTOPIA) – lokale Forschungsplattform und DAEDALUS-Produktkern.
