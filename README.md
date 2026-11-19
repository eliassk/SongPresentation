# SongPresentation

Operator app for church services. It shows song lyrics on LAN displays: a **bilingual** LED wall (e.g. Polish | Norwegian, 2048×1024), a single-language stage projector, and a **confidence view** for singers. Songs are imported from SongTreasures.

## How it works

- Electron starts a local server on port **4000** (`0.0.0.0`, reachable on the LAN).
- The operator UI, every display and the phone remote are web pages served by that server and kept in sync over WebSocket (`/ws`).
- A display is a **profile**: resolution, languages, text area, layout, fonts, colours. Open it at `http://<operator>:4000/display/<profile-id>`.
- Edits in the **Displays** tab go live on all screens immediately.

| Page | URL |
|---|---|
| Operator | `http://localhost:4000/` (inside the app) |
| LED wall | `/display/led-wall` |
| Stage projector | `/display/stage` |
| Singers' confidence view | `/display/confidence` |
| Phone remote | `/remote` |
| Printable setlist | `/print/setlist` |

`<operator>` is the laptop's IP, or `<computer-name>.local`, which keeps working when the IP changes (needs mDNS: macOS, Windows 10+). Both are listed in the Displays tab.

## Run and build

```bash
npm install
npm run dev        # rebuilds UI on change + starts Electron (Cmd/Ctrl+R after edits)
npm run server     # server only, no Electron (open http://localhost:4000)
npm run dist:win   # Windows installer → release/
npm run dist:mac   # macOS dmg → release/
```

Data (songs, profiles, setlists) is stored as JSON in the Electron user-data folder (`%APPDATA%\SongPresentation` on Windows). `npm run server` uses `./.data`.

## OBS setup (LED wall PC)

1. Add a **Browser** source with the URL `http://<operator>:4000/display/led-wall`.
2. Width **2048**, height **1024** (match the profile).
3. Turn **off** "Shutdown source when not visible" and "Refresh browser when scene becomes active".
4. A `Transparent` background in the profile overlays lyrics on the mixer AUX video.

Give the operator laptop a DHCP reservation, or use the `.local` address. On Windows, allow the app through the firewall on first start.

## SongTreasures

Songs tab → **Sign in to SongTreasures** → pick collections and languages → **Import selected**.
**Check for updates** re-checks imported collections and downloads only new or changed songs.

- Uses the church's own SongTreasures account. Imported songs MUST stay within its licence.
- API mapping lives in `server/sources/songtreasures.cjs` (API v4.0). Raw samples land in `<data>/songtreasures-raw/`.
- The Bible collection is not available through this API. Add readings as slides (below).

## Operating

| Key (Live tab) | Action |
|---|---|
| → ↓ Space PgDn | Next verse (skips disabled verses) |
| ← ↑ PgUp | Previous verse |
| B or . | Blank toggle |
| Digits, Enter | Jump to song number in the current collection |
| Enter | Show the selected song |
| [ / ] | Previous / next song in collection |
| N / P | Next / previous song in setlist |
| / | Search all collections |

- Click a verse to skip it. ▶ shows a verse directly.
- **Screens follow selection** makes a click in the list go live immediately.
- Language buttons per display: click = only that language, Shift-click = add or remove a column.
- Setlists: name, save, load, start new, print for musicians.

## Displays tab

- Drag the song number, credits or lyrics in the preview to resize. Drag the text-area label to move it, its corners to resize.
- **Text area** keeps text off the lower part of the LED wall (default: upper 60%).
- **Reset layout** restores a profile's defaults (name is kept).

## Slides (announcements, Bible readings)

Songs tab → **New announcement** or **New Bible reading**. Slides are songs without a number: the title (e.g. `Jan 3:16`) shows in the header, and each `[1]`, `[2]`… is one screen. Add them to a setlist like any song.

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

A repeated `[c]` on its own repeats the chorus. Keys line up across languages.
