# Product

## What it is

SongPresentation runs song lyrics for a bilingual church congregation (Polish and Norwegian first, any languages possible). One operator laptop drives several screens on the local network.

## Users and scene

- **Operator:** a volunteer at the back of the hall, on a Windows laptop, during a live service. Low light, time pressure, often keyboard-only. Mistakes are visible to everyone, so state (what is live, what is next, blank or not) must be obvious at a glance.
- **Congregation:** reads the LED wall (2048×1024) from a distance. The wall reaches the floor, so text stays in its upper part.
- **Singers on stage:** read the confidence view (current + next verse) or the single-language projector.
- **Worship leader:** may move verses from a phone (`/remote`).

## Principles

- Live safety first: clear on-air state, instant blank, no surprising motion on the screens (verse changes are instant by default).
- Familiar over clever: the operator UI follows the SongTreasures look the team already knows (light, warm grey, gold accent).
- Offline in the hall: fonts and songs are local. SongTreasures is only needed to import or check for updates.
- Every display is a profile the operator can tune live, without restarting anything.

## Out of scope (for now)

- Video playback, OBS scene control, cloud sync between churches.
