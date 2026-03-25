# Zelda RPG Tracker

Ein leistungsstarker **Roguelike RPG Tracker** für Zelda-Streams, entwickelt mit **Electron**, **Express** und **Socket.io**. Dieses Tool ermöglicht es Streamern, ihren Fortschritt in Echtzeit zu verfolgen, XP zu sammeln, Level aufzusteigen und Upgrades zu wählen – alles mit einer eleganten, Apple-ähnlichen Ästhetik.

## 🚀 Features

- **Echtzeit-Tracking:** Erfasse Kills (verschiedene Tiers), Truhen, Krogs, Quests und Kochen über eine API.
- **Roguelike-System:** Sammle XP, steige Level auf und wähle aus einem Pool von Upgrades.
- **OBS-Integration:** Ein spezialisiertes Overlay (`/overlay`) für die direkte Einbindung in OBS als Browserquelle.
- **Dynamisches UI:** Hauptsteuerungsfenster (`/ui`) mit dunklem Design (#0d0d14), Gold-Akzenten und flüssigen Animationen.
- **Persistenz:** Der aktuelle Run-Zustand wird automatisch in `data/run.json` gespeichert und überlebt Neustarts.
- **Schrein-Timer:** Automatisches Tracking von Schrein-Zeiten.

## 🛠 Tech Stack

- **Frontend:** HTML5, Vanilla CSS, JavaScript (ES6+)
- **Backend:** Node.js, Express (API & Webserver)
- **Kommunikation:** Socket.io für Echtzeit-Updates zwischen Server, UI und Overlay
- **Desktop:** Electron für die native App-Erfahrung

## 📦 Installation & Start

### Voraussetzungen

- [Node.js](https://nodejs.org/) (LTS empfohlen)

### Schritte

1. Repository klonen oder herunterladen.
2. Abhängigkeiten installieren:
   ```bash
   npm install
   ```
3. Die Anwendung starten:
   ```bash
   npm start
   ```

Für Entwicklungszwecke kann ein spezifischer Port genutzt werden:
```bash
npm run dev
```

## 📐 Architektur

- **`main.js`**: Der Electron-Einstiegspunkt. Startet den Express-Server und verwaltet das Hauptfenster.
- **`src/server.js`**: Express-API-Routen und Socket.io-Setup.
- **`src/gameState.js`**: Die "Single Source of Truth" für XP, Level, Streaks und Schrein-Logik.
- **`ui/`**: Das Haupt-Dashboard für den Streamer (läuft standardmäßig auf `http://localhost:3000/ui`).
- **`overlay/`**: Das HUD für OBS (1920×120px Strip, `http://localhost:3000/overlay`).

## 🔌 API Endpoints (Auszug)

Die Steuerung des Trackers erfolgt über HTTP POST Requests (z.B. via Stream Deck oder Scripte):

- `POST /api/kill/:tier` — (klein|normal|stark|miniboss|boss)
- `POST /api/shrine/start` — Startet den Schrein-Timer
- `POST /api/levelup/choose/:upgradeId` — Wählt ein Upgrade aus
- `POST /api/run/reset` — Setzt den aktuellen Run zurück

## 📁 Datenstruktur

- `data/run.json`: Speichert den aktuellen Zustand (XP, Level, Upgrades, aktive Schreine).
- `src/data/`: Enthält statische Definitionen für Schreine und Türme.

---
*Entwickelt für eine immersive Zelda-Streaming-Experience.*
