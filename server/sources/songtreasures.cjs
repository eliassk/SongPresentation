// SongTreasures importer.
// Uses the operator's own SongTreasures account. Imported songs MUST stay within the church's licence.
// Shapes verified 2026-11-19 against API v4.0. Samples are dumped to <dataDir>/songtreasures-raw.

const fs = require('fs');
const path = require('path');

const BASE = 'https://api.songtreasures.app/';

async function call(token, method, apiPath, body) {
  const res = await fetch(BASE + apiPath, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'X-Api-Version': '4.0', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw Object.assign(new Error('Not signed in to SongTreasures, or the session expired.'), { code: 401 });
  if (!res.ok) throw new Error(`SongTreasures ${apiPath}: HTTP ${res.status}`);
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return text;
  }
  return json && typeof json === 'object' && !Array.isArray(json) && 'result' in json ? json.result : json;
}

/** Picks a localized value. Accepts a plain string or a { lang: text } map. */
function loc(v, langs = []) {
  if (!v) return '';
  if (typeof v === 'string') return v;
  for (const l of [...langs, 'en', 'no']) if (v[l]) return v[l];
  const first = Object.values(v).find((x) => typeof x === 'string');
  return first ?? '';
}

function dumper(dataDir) {
  const dir = path.join(dataDir, 'songtreasures-raw');
  fs.mkdirSync(dir, { recursive: true });
  const seen = new Set();
  return (name, data) => {
    if (seen.has(name)) return;
    seen.add(name);
    fs.writeFileSync(path.join(dir, name + '.json'), JSON.stringify(data, null, 2));
  };
}

async function listCollections(token, dataDir) {
  const raw = await call(token, 'GET', 'api/Collections');
  dumper(dataDir)('collections', raw);
  return (Array.isArray(raw) ? raw : [])
    .filter((c) => c.type === 'song')
    .map((c) => ({
      id: c.id,
      key: c.key ?? '',
      keys: c.keys ?? {},
      languages: c.languages ?? [],
      name: loc(c.title ?? c.name, ['pl', 'no', 'en']),
    }));
}

/** Lyrics content is { verse_1: { name, content[] }, chorus_1: {...}, ... }. */
function versesFrom(raw) {
  const content = raw?.content;
  if (!content || typeof content !== 'object') return null;
  const order = [];
  const verses = {};
  for (const [k, v] of Object.entries(content)) {
    const lines = (Array.isArray(v?.content) ? v.content : []).map((l) => String(l).trim()).filter(Boolean);
    if (!lines.length) continue;
    const [, type, n] = k.match(/^([a-z]+)_(\d+)$/i) ?? [null, k, '1'];
    const key = type === 'verse' ? n : type === 'chorus' ? (n === '1' ? 'c' : 'c' + n) : type[0] + (n === '1' ? '' : n);
    order.push(key);
    verses[key] = lines;
  }
  return order.length ? { order, verses } : null;
}

/** A single chorus listed once is sung after every verse. */
function expandChorus(order) {
  const choruses = order.filter((k) => /^c/.test(k));
  if (choruses.length !== 1 || order.indexOf('c') !== 1) return order;
  const out = [];
  for (const k of order) {
    if (k === 'c') continue;
    out.push(k);
    if (/^\d+$/.test(k)) out.push('c');
  }
  return out;
}

async function importCollections({ token, collections, languages, dataDir, save, progress }) {
  const dump = dumper(dataDir);
  const contributors = new Map();
  const copyrights = new Map();
  for (const c of (await call(token, 'GET', 'api/Contributors').catch(() => [])) ?? []) contributors.set(c.id, c.name);
  for (const c of (await call(token, 'GET', 'api/Copyrights').catch(() => [])) ?? []) copyrights.set(c.id, c.name);
  const primary = languages[0] ?? 'pl';

  let done = 0;
  let total = 0;
  let imported = 0;
  for (const col of collections) {
    // Titles come back in the requested language, so fetch the list once per language.
    const byLang = {};
    for (const lang of languages) byLang[lang] = (await call(token, 'POST', `api/Songs?language=${lang}`, { parentIds: [col.id] })) ?? [];
    const songs = byLang[primary] ?? Object.values(byLang)[0] ?? [];
    dump('songs-sample', songs.slice(0, 3));
    total += songs.length;
    progress({ done, total, message: `${col.name}: ${songs.length} songs` });

    const queue = [...songs];
    const worker = async () => {
      for (let s = queue.shift(); s; s = queue.shift()) {
        try {
          if (s.hasLyrics === false) continue;
          const lyrics = {};
          let order = [];
          const available = new Set(s.languages ?? languages);
          for (const lang of languages.filter((l) => available.has(l))) {
            try {
              const raw = await call(token, 'POST', `api/Songs/${s.id}/Lyrics`, {
                language: lang,
                format: 'json',
                transposition: 0,
                newMelody: false,
              });
              dump(`lyrics-sample-${lang}`, raw);
              const parsed = versesFrom(raw);
              if (!parsed) continue;
              lyrics[lang] = parsed.verses;
              if (parsed.order.length > order.length) order = parsed.order;
            } catch {}
          }
          if (!order.length) continue;
          const number = s.collections?.find((c) => c.collectionId === col.id)?.number ?? null;
          const people = (type) =>
            (s.participants ?? [])
              .filter((p) => p.type === type)
              .map((p) => contributors.get(p.contributorId))
              .filter(Boolean)
              .join(', ');
          const melodyOrigin = (s.origins ?? []).find((o) => o.type === 'melody')?.description;
          const title = {};
          for (const lang of languages) {
            const t = byLang[lang]?.find((x) => x.id === s.id)?.title;
            if (t) title[lang] = t;
          }
          save({
            id: `st:${s.id}`,
            number: number != null ? Number(number) : null,
            collection: col.name,
            collectionKey: col.keys?.[primary] ?? col.key ?? col.name,
            title,
            author: people('author'),
            composer: people('composer') || melodyOrigin || '',
            year: s.yearWritten ?? s.yearPublished ?? null,
            copyright: (s.copyrights ?? [])
              .filter((c) => c.type === 'text')
              .map((c) => copyrights.get(c.referenceId))
              .filter(Boolean)
              .join(', '),
            key: s.originalKey ?? '',
            order: expandChorus(order),
            lyrics,
            source: 'songtreasures',
          });
          imported++;
        } finally {
          done++;
          if (done % 5 === 0 || done === total) progress({ done, total, message: `${col.name}: ${done}/${total}` });
        }
      }
    };
    await Promise.all(Array.from({ length: 8 }, worker));
  }
  return { imported, total };
}

module.exports = { listCollections, importCollections };
