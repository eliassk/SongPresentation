# SongPresentation

Operator app for showing song lyrics on LAN displays, with **bilingual** output (e.g. Polish | Norwegian on a 2048×1024 LED wall) and single-language output for the stage projector.

## How it works

- Electron starts a local server on port **4000** (`0.0.0.0`, reachable on the LAN).
- The operator UI and every display are web pages served by that server and kept in sync over WebSocket (`/ws`).
- A display is a **profile** (resolution, languages, layout, fonts, colours). Open it at `http://<operator-ip>:4000/display/<profile-id>`.
- Edits in the **Displays** tab go live on all screens immediately.

## Run

```bash
npm install
npm run dev        # rebuilds UI on change + starts Electron (reload window after edits)
npm run server     # server only, no Electron (open http://localhost:4000)
npm run dist:win   # Windows installer
npm run dist:mac   # macOS dmg
```

Data (songs, profiles, setlist) is stored as JSON in the Electron user-data folder. `npm run server` uses `./.data`.

## OBS setup (LED wall PC)

1. Add **Browser** source → URL `http://<operator-ip>:4000/display/led-wall`.
2. Width **2048**, height **1024** (match the profile).
3. Turn **off** "Shutdown source when not visible" and "Refresh browser when scene becomes active".
4. Background `Transparent` in the profile overlays lyrics on the mixer AUX video.

Give the operator laptop a DHCP reservation so the URL does not change. On Windows, allow the app through the firewall on first start.

## Keyboard (Live tab)

| Key | Action |
|---|---|
| → ↓ Space PgDn | Next slide |
| ← ↑ PgUp | Previous slide |
| B or . | Blank toggle |
| N / P | Next / previous song in setlist |
| / | Focus search (Enter selects first hit) |

## Song text format

```
[1]
First verse line
Second line

[c]
Chorus line

[2]
...

[c]
```

`[c]` repeated alone repeats the chorus. Keys line up across languages.

## Status

- Done: LAN server, display profiles + live designer, bilingual renderer with auto-fit, operator live view, setlist, song editor, language list.
- Pending: SongTreasures sync (`server/sources/songtreasures.cjs`). Needs the publisher's permission and API mapping first.
- Ideas: phone remote, Bible verses / announcements, OBS WebSocket scene control, bundled fonts, SQLite.
