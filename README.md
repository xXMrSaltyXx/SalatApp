# Salatrunde

Kleine Full‑Stack‑App, um eine wöchentliche Salatrunde zu koordinieren: Teilnehmer:innen eintragen, Rezept-Vorlage pflegen und automatisch eine Einkaufsliste hochskalieren.

## Features
- E-Mail-basierte Anmeldung ohne Passwörter, persistente Sitzungen per Token
- Teilnehmerverwaltung mit wöchentlichem Auto-Reset (konfigurierbarer Wochentag/Uhrzeit)
- Rezept-Templates mit Zutaten und Portionen, Aktivierung & Historie
- Einkaufsliste, die die Zutatenmenge an die aktuelle Gruppengröße anpasst

## Tech-Stack
- Frontend: React 19 + Vite + TypeScript
- Backend: Express 5 + better-sqlite3, SQLite-DB unter `server/data/salat.db`
- Tooling: Vite Dev-Server mit Proxy für `/api`, Nodemon im Backend

## Projektstruktur
- `client/` – Vite/React-Frontend
- `server/` – Express-API + SQLite-Persistence
- `.gitignore` – Ignoriert `node_modules`, Builds und lokale Datenbank

## Schnellstart (Lokal)
Voraussetzung: Node.js 20+.

1. Abhängigkeiten installieren  
   - `cd server && npm install`  
   - `cd client && npm install`
2. Umgebungsvariablen setzen  
   - `cp server/.env.example server/.env` und bei Bedarf `PORT` / `CLIENT_ORIGIN` anpassen  
   - `cp client/.env.example client/.env` wenn du einen anderen API-Host nutzen willst
3. Entwicklung starten  
   - Terminal 1: `cd server && npm run dev` (läuft per default auf `http://localhost:4000`)  
   - Terminal 2: `cd client && npm run dev` (öffnet `http://localhost:5173`)  
   - Der Vite-Proxy leitet `/api` an den Backend-Port weiter.

## Builds & Deployment
- Frontend-Build: `cd client && npm run build` → Output in `client/dist/`
- Backend-Start (ohne Hot-Reload): `cd server && npm start`
- Falls Frontend und Backend getrennt deployt werden, setze `VITE_API_BASE_URL` auf die API-URL (z. B. `https://deine-domain/api`) und baue das Frontend neu.
- SQLite-Daten liegen in `server/data/salat.db`; sichere oder ersetze die Datei pro Umgebung.

## Nützliche Skripte
- `server`: `npm run dev` (mit Nodemon), `npm start`
- `client`: `npm run dev`, `npm run build`, `npm run preview`
