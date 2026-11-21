import type { LangStyle, Song, SongMeta } from './types';

// Keep in sync with slideKeys in server/server.cjs.
export function slideKeys(song: Song | null): string[] {
  if (!song) return [];
  return song.order.filter((k) => Object.values(song.lyrics).some((l) => l[k]?.length));
}

/** Part index of a medley slide key "<part>:<verse>", or -1. */
export function partIndex(key: string | null): number {
  const m = key?.match(/^(\d+):/);
  return m ? Number(m[1]) : -1;
}

/** Title and credits for the slide: the source song inside a medley, else the song itself. */
export function metaFor(song: Song, key: string | null): Song | SongMeta {
  return song.parts?.[partIndex(key)] ?? song;
}

/** Languages to show for a verse. Only a one-language display follows the sung language; multi-column displays keep theirs. */
export function sungLanguages(song: Song, key: string | null, langs: string[]): string[] {
  const sung = (key && song.sung?.[key]) || song.sung?.['*'];
  if (!sung || langs.length !== 1) return langs;
  return [sung];
}

export function verseLabel(key: string): string {
  key = key.replace(/^\d+:/, '');
  if (/^\d+$/.test(key)) return key + '.';
  if (/^c\d*$/.test(key)) return 'Ref.';
  if (/^b\d*$/.test(key)) return 'Bridge';
  return key;
}

export const defaultLangStyle = (): LangStyle => ({ color: '#ffffff', italic: false, scale: 1, weight: 600 });

/** Editor text format: "[1]" starts a verse, blank lines separate nothing special. */
export function parseLyrics(text: string): { order: string[]; verses: Record<string, string[]> } {
  const order: string[] = [];
  const verses: Record<string, string[]> = {};
  let key: string | null = null;
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    const m = line.match(/^\[(.+)\]$/);
    if (m) {
      key = m[1].trim();
      order.push(key);
      verses[key] ??= [];
      continue;
    }
    if (!line) continue;
    if (key === null) {
      key = String(order.length + 1);
      order.push(key);
      verses[key] = [];
    }
    if (order.filter((k) => k === key).length === 1) verses[key].push(line);
  }
  return { order, verses };
}

export function formatLyrics(song: Song, lang: string): string {
  const v = song.lyrics[lang] ?? {};
  const seen = new Set<string>();
  return song.order
    .map((k) => {
      if (seen.has(k) || !v[k]) return `[${k}]`;
      seen.add(k);
      return `[${k}]\n${v[k].join('\n')}`;
    })
    .join('\n\n');
}

const LABELS: Record<string, { author: string; composer: string; text: string }> = {
  pl: { author: 'Autor', composer: 'Kompozytor', text: 'Tekst' },
  no: { author: 'Forfatter', composer: 'Komponist', text: 'Tekst' },
  en: { author: 'Author', composer: 'Composer', text: 'Text' },
};

export function verseCount(song: Pick<Song, 'order'>): number {
  return new Set(song.order.filter((k) => /^\d+$/.test(k))).size;
}

/** Two credit lines, labelled in the given language. */
export function credits(song: Song | SongMeta, lang: string): [string, string] {
  const L = LABELS[lang] ?? LABELS.en;
  const a = [
    song.author && `${L.author}: ${song.author}${song.year ? ` (${song.year})` : ''}`,
    song.composer && `${L.composer}: ${song.composer}`,
  ].filter(Boolean);
  const b = [song.key, ('order' in song && verseCount(song)) || null, song.copyright && `${L.text} © ${song.copyright}`].filter(Boolean);
  return [a.join(' · '), b.join(' · ')];
}
