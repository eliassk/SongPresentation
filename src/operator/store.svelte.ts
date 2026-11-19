import { connect } from '../shared/ws';
import type { AppState, Song, SongSummary } from '../shared/types';

export const app = $state({
  state: null as AppState | null,
  online: false,
  songs: [] as SongSummary[],
});

let songsVersion = -1;
export const link = connect(
  (s) => {
    app.state = s;
    if (s.songsVersion !== songsVersion) {
      if (songsVersion !== -1) loadSongs();
      songsVersion = s.songsVersion;
    }
  },
  (ok) => (app.online = ok),
);

export async function loadSongs() {
  app.songs = await (await fetch('/api/songs')).json();
  app.songs.sort((a, b) => a.collection.localeCompare(b.collection) || (a.number ?? 1e9) - (b.number ?? 1e9));
}

export async function getSong(id: string): Promise<Song> {
  return (await fetch('/api/songs/' + encodeURIComponent(id))).json();
}

export async function saveSong(song: Song): Promise<Song> {
  const res = await fetch('/api/songs', { method: 'POST', body: JSON.stringify(song) });
  const saved = await res.json();
  await loadSongs();
  return saved;
}

export async function deleteSong(id: string) {
  await fetch('/api/songs/' + encodeURIComponent(id), { method: 'DELETE' });
  await loadSongs();
}

export function songName(s: { number?: number | null; title: Record<string, string> }, lang?: string) {
  const t = (lang && s.title[lang]) || Object.values(s.title)[0] || '(untitled)';
  return s.number != null ? `${s.number}. ${t}` : t;
}

export function displayUrls(profileId: string): string[] {
  const srv = app.state?.server;
  if (!srv) return [];
  // name.local survives IP changes where mDNS works (macOS, Windows 10+). The IP is the safe default.
  const local = srv.hostname ? `${srv.hostname.replace(/\.local$/i, '').toLowerCase()}.local` : null;
  const hosts = [...srv.ips, ...(local ? [local] : []), 'localhost'];
  return hosts.map((h) => `http://${h}:${srv.port}/display/${encodeURIComponent(profileId)}`);
}
