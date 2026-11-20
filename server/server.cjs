const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const store = require('./store.cjs');
const defaults = require('./defaults.cjs');
const songtreasures = require('./sources/songtreasures.cjs');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};

function lanIps() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((i) => i && i.family === 'IPv4' && !i.internal)
    .map((i) => i.address);
}

// Keep in sync with src/shared/slides.ts.
function slideKeys(song) {
  if (!song) return [];
  return song.order.filter((k) => Object.values(song.lyrics).some((l) => l[k]?.length));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (e) {
        reject(e);
      }
    });
  });
}

function sendJson(res, code, body) {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function songSummary(s) {
  const titles = Object.values(s.title ?? {});
  const firstLines = Object.values(s.lyrics ?? {}).map((l) => l[s.order[0]]?.[0] ?? '');
  return {
    id: s.id,
    number: s.number ?? null,
    collection: s.collection ?? '',
    collectionKey: s.collectionKey ?? s.collection ?? '',
    title: s.title,
    search: [s.number, s.collection, ...titles, ...firstLines].join(' ').toLowerCase(),
  };
}

function startServer({ port, dataDir, distDir, getSongTreasuresToken = null }) {
  const db = store.open(dataDir);
  const state = db.state;
  const clients = new Set();
  let songsVersion = 0;
  let importStatus = { running: false, done: 0, total: 0, message: '', error: '' };
  let stToken = null;
  let stTokenAt = 0;

  // Token MUST be refreshed well before Firebase's 1 h expiry.
  async function stTokenGet(interactive) {
    if (!getSongTreasuresToken) throw new Error('SongTreasures sign-in works only in the desktop app.');
    if (!interactive && stToken && Date.now() - stTokenAt < 40 * 60e3) return stToken;
    const t = await getSongTreasuresToken({ interactive });
    if (!t) throw Object.assign(new Error('Not signed in to SongTreasures.'), { code: 401 });
    stToken = t;
    stTokenAt = Date.now();
    return t;
  }

  const fullState = () => ({
    ...state,
    liveSong: state.live.songId ? db.getSong(state.live.songId) : null,
    songsVersion,
    importStatus,
    stImport: state.stImport ?? null,
    server: { port, ips: lanIps(), hostname: os.hostname() },
  });

  function broadcast() {
    const msg = JSON.stringify({ type: 'state', state: fullState() });
    for (const c of clients) if (c.readyState === 1) c.send(msg);
  }

  function enabledIndices(songId) {
    const n = slideKeys(db.getSong(songId)).length;
    const off = new Set(state.disabled[songId] ?? []);
    const on = [...Array(n).keys()].filter((i) => !off.has(i));
    return on.length ? on : [...Array(n).keys()];
  }

  function collectionSongs(collectionKey) {
    return db
      .listSongs()
      .filter((s) => (s.collectionKey ?? s.collection) === collectionKey)
      .sort((a, b) => (a.number ?? 1e9) - (b.number ?? 1e9));
  }

  function annotation(songId, key) {
    const song = (state.notes[songId] ??= {});
    const v = (song[key] ??= { text: '', marks: {} });
    v.marks ??= {};
    return v;
  }
  function pruneNotes(songId, key) {
    const v = state.notes[songId]?.[key];
    if (v && !v.text && !Object.keys(v.marks).length) delete state.notes[songId][key];
    if (state.notes[songId] && !Object.keys(state.notes[songId]).length) delete state.notes[songId];
  }

  const actions = {
    setLive({ songId, slideIndex = 0 }) {
      const on = enabledIndices(songId);
      const target = on.find((i) => i >= slideIndex) ?? on[on.length - 1] ?? 0;
      state.live = { songId, slideIndex: target, blank: false };
    },
    step({ delta }) {
      const on = enabledIndices(state.live.songId);
      const cur = state.live.slideIndex;
      const next = delta > 0 ? on.find((i) => i > cur) : [...on].reverse().find((i) => i < cur);
      if (next !== undefined) state.live.slideIndex = next;
    },
    toggleVerse({ songId, index }) {
      const off = new Set(state.disabled[songId] ?? []);
      off.has(index) ? off.delete(index) : off.add(index);
      state.disabled[songId] = [...off].sort((a, b) => a - b);
      if (!state.disabled[songId].length) delete state.disabled[songId];
      if (state.live.songId === songId && off.has(state.live.slideIndex)) actions.setLive({ songId, slideIndex: state.live.slideIndex });
    },
    setAllVerses({ songId, enabled }) {
      if (enabled) delete state.disabled[songId];
      else state.disabled[songId] = [...Array(Math.max(0, slideKeys(db.getSong(songId)).length - 1)).keys()].map((i) => i + 1);
    },
    songStep({ delta }) {
      const cur = db.getSong(state.live.songId);
      if (!cur) return;
      const list = collectionSongs(cur.collectionKey ?? cur.collection);
      const i = list.findIndex((s) => s.id === cur.id);
      const next = list[i + delta];
      if (next) actions.setLive({ songId: next.id });
    },
    goNumber({ collectionKey, number }) {
      const key = String(collectionKey ?? '').toLowerCase();
      const song = db
        .listSongs()
        .find((s) => String(s.collectionKey ?? s.collection ?? '').toLowerCase() === key && String(s.number) === String(number));
      if (song) actions.setLive({ songId: song.id });
    },
    blank({ value }) {
      state.live.blank = value ?? !state.live.blank;
    },
    clear() {
      state.live = { songId: null, slideIndex: 0, blank: false };
    },
    setlist({ ids }) {
      state.setlist = ids;
    },
    setlistSave({ name }) {
      const n = String(name || '').trim() || new Date().toISOString().slice(0, 10);
      const existing = state.savedSetlists.find((x) => x.name === n);
      if (existing) existing.ids = [...state.setlist];
      else state.savedSetlists.unshift({ id: crypto.randomBytes(4).toString('hex'), name: n, ids: [...state.setlist] });
      state.setlistName = n;
    },
    setlistLoad({ id }) {
      const x = state.savedSetlists.find((s) => s.id === id);
      if (!x) return;
      state.setlist = x.ids.filter((sid) => db.getSong(sid));
      state.setlistName = x.name;
    },
    setlistDelete({ id }) {
      const x = state.savedSetlists.find((s) => s.id === id);
      state.savedSetlists = state.savedSetlists.filter((s) => s.id !== id);
      if (x && x.name === state.setlistName) {
        state.setlist = [];
        state.setlistName = '';
      }
    },
    // Annotations live in state, never on the song, so imports MUST NOT overwrite them.
    noteSet({ songId, key, text }) {
      const v = annotation(songId, key);
      v.text = String(text ?? '');
      pruneNotes(songId, key);
    },
    lineMark({ songId, key, line, mark }) {
      const v = annotation(songId, key);
      if (mark) v.marks[line] = String(mark);
      else delete v.marks[line];
      pruneNotes(songId, key);
    },
    markPresetsSet({ marks }) {
      if (Array.isArray(marks)) state.markPresets = [...new Set(marks.map((m) => String(m).trim()).filter(Boolean))];
    },
    setlistRename({ name }) {
      state.setlistName = String(name ?? '');
    },
    setlistNew() {
      state.setlist = [];
      state.setlistName = '';
    },
    setlistStep({ delta }) {
      if (!state.setlist.length) return;
      const i = state.setlist.indexOf(state.live.songId);
      const next = i === -1 ? 0 : Math.max(0, Math.min(i + delta, state.setlist.length - 1));
      actions.setLive({ songId: state.setlist[next] });
    },
    profileUpdate({ profile }) {
      const i = state.profiles.findIndex((p) => p.id === profile.id);
      if (i !== -1) state.profiles[i] = profile;
    },
    profileAdd({ fromId }) {
      const src = state.profiles.find((p) => p.id === fromId) ?? defaults.baseProfile({});
      const copy = structuredClone(src);
      copy.id = 'display-' + crypto.randomBytes(3).toString('hex');
      copy.name = src.name + ' (copy)';
      state.profiles.push(copy);
    },
    profileDelete({ id }) {
      if (state.profiles.length > 1) state.profiles = state.profiles.filter((p) => p.id !== id);
    },
    profileReset({ id }) {
      const i = state.profiles.findIndex((x) => x.id === id);
      if (i === -1) return;
      const def = defaults.state().profiles.find((x) => x.id === id) ?? defaults.baseProfile({ id, name: state.profiles[i].name });
      state.profiles[i] = { ...def, name: state.profiles[i].name };
    },
    profileLanguages({ id, languages }) {
      const p = state.profiles.find((x) => x.id === id);
      if (p && Array.isArray(languages) && languages.length) p.languages = languages;
    },
    fontStep({ id, delta }) {
      const p = state.profiles.find((x) => x.id === id);
      if (!p) return;
      const k = p.text.autoFit ? 'maxSize' : 'size';
      p.text[k] = Math.max(10, p.text[k] + delta);
    },
    languagesSet({ languages }) {
      state.languages = languages;
    },
  };

  async function startImport({ collections, languages }, known, res) {
    if (importStatus.running) return sendJson(res, 409, { error: 'Import already running.' });
    const token = await stTokenGet(false);
    importStatus = { running: true, done: 0, total: 0, message: known ? 'Checking for updates…' : 'Starting…', error: '' };
    broadcast();
    songtreasures
      .importCollections({
        token,
        collections,
        languages,
        dataDir,
        known,
        save: (song) => db.saveSong(song),
        progress: (p) => {
          importStatus = { ...importStatus, ...p };
          broadcast();
        },
      })
      .then((r) => {
        const message = known
          ? r.imported
            ? `Updated ${r.imported - r.added} songs, added ${r.added} new. ${r.unchanged} unchanged.`
            : `Everything is up to date (${r.unchanged} songs).`
          : `Imported ${r.imported} of ${r.total} songs.`;
        importStatus = { running: false, done: r.total, total: r.total, message, error: '' };
        if (state.stImport) state.stImport.lastSync = new Date().toISOString();
        db.saveState();
      })
      .catch((e) => {
        importStatus = { ...importStatus, running: false, error: e.message };
      })
      .finally(() => {
        songsVersion++;
        broadcast();
      });
    return sendJson(res, 202, { ok: true });
  }

  async function handleSongTreasures(req, res, url) {
    const route = url.pathname.replace('/api/st/', '');
    try {
      if (route === 'status') return sendJson(res, 200, { available: !!getSongTreasuresToken, signedIn: !!stToken });
      if (route === 'cancel' && req.method === 'POST') {
        if (getSongTreasuresToken) await getSongTreasuresToken({ cancel: true });
        return sendJson(res, 200, { ok: true });
      }
      if (route === 'login' && req.method === 'POST') {
        await stTokenGet(true);
        return sendJson(res, 200, { ok: true });
      }
      if (route === 'collections') return sendJson(res, 200, await songtreasures.listCollections(await stTokenGet(false), dataDir));
      if (route === 'import' && req.method === 'POST') {
        const { collections, languages, languageNames = {} } = await readBody(req);
        for (const code of languages)
          if (!state.languages.some((l) => l.code === code)) state.languages.push({ code, name: languageNames[code] ?? code });
        // Remembered for "Check for updates".
        const prev = state.stImport ?? { collections: [], languages: [] };
        const cols = [...prev.collections.filter((c) => !collections.some((n) => n.id === c.id)), ...collections];
        state.stImport = { collections: cols, languages: [...new Set([...prev.languages, ...languages])], lastSync: prev.lastSync ?? null };
        db.saveState();
        return startImport({ collections, languages }, null, res);
      }
      if (route === 'resync' && req.method === 'POST') {
        let cfg = state.stImport;
        const imported = db.listSongs().filter((s) => s.source === 'songtreasures');
        if (!cfg?.collections?.length && imported.length) {
          // Imports from before stImport existed: rebuild the config from the stored songs.
          const names = new Set(imported.map((s) => s.collection));
          const all = await songtreasures.listCollections(await stTokenGet(false), dataDir);
          const langs = [...new Set(imported.flatMap((s) => Object.keys(s.lyrics)))];
          const order = state.languages.map((l) => l.code);
          langs.sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
          cfg = state.stImport = { collections: all.filter((c) => names.has(c.name)), languages: langs, lastSync: null };
          db.saveState();
        }
        if (!cfg?.collections?.length) return sendJson(res, 400, { error: 'Import a collection first.' });
        const known = new Map(db.listSongs().filter((s) => s.source === 'songtreasures').map((s) => [s.id, s.remoteUpdatedAt ?? null]));
        return startImport(cfg, known, res);
      }
      return sendJson(res, 404, { error: 'not found' });
    } catch (e) {
      if (e.code === 401) stToken = null;
      return sendJson(res, e.code === 401 ? 401 : 500, { error: e.message });
    }
  }

  async function handleApi(req, res, url) {
    if (url.pathname.startsWith('/api/st/')) return handleSongTreasures(req, res, url);
    const m = url.pathname.match(/^\/api\/songs(?:\/(.+))?$/);
    if (!m) return sendJson(res, 404, { error: 'not found' });
    const id = m[1] && decodeURIComponent(m[1]);

    if (req.method === 'GET' && !id) return sendJson(res, 200, db.listSongs().map(songSummary));
    if (req.method === 'GET') {
      const s = db.getSong(id);
      return s ? sendJson(res, 200, s) : sendJson(res, 404, { error: 'not found' });
    }
    if (req.method === 'POST' && !id) {
      const song = await readBody(req);
      if (!song.id) song.id = 'local-' + crypto.randomBytes(4).toString('hex');
      db.saveSong(song);
      broadcast();
      return sendJson(res, 200, song);
    }
    if (req.method === 'DELETE' && id) {
      db.deleteSong(id);
      state.setlist = state.setlist.filter((x) => x !== id);
      if (state.live.songId === id) actions.clear();
      db.saveState();
      broadcast();
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 405, { error: 'method not allowed' });
  }

  // Printable setlist for musicians. Opens in the system browser.
  function servePrint(res) {
    const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
    const langs = state.languages.map((l) => l.code);
    const rows = state.setlist
      .map((id) => db.getSong(id))
      .filter(Boolean)
      .map((s, i) => {
        const titles = langs.map((l) => s.title?.[l]).filter(Boolean);
        return `<tr><td class="i">${i + 1}</td><td class="c">${esc(s.collectionKey)} ${esc(s.number ?? '')}</td><td><b>${esc(titles[0] ?? '')}</b>${titles[1] ? `<br><span>${esc(titles[1])}</span>` : ''}</td><td class="k">${esc(s.key ?? '')}</td></tr>`;
      })
      .join('');
    const html = `<!doctype html><meta charset="utf-8"><title>${esc(state.setlistName || 'Setlist')}</title>
<style>body{font:15px/1.4 system-ui,sans-serif;margin:40px;color:#1d1c1a}h1{font-size:22px;margin:0 0 16px}table{border-collapse:collapse;width:100%}td{padding:10px 8px;border-bottom:1px solid #ddd;vertical-align:top}.i,.k{width:2em;color:#777}.c{width:6em;color:#8a6a32;font-weight:600}span{color:#777}@media print{body{margin:16mm}}</style>
<h1>${esc(state.setlistName || 'Setlist')}</h1><table>${rows || '<tr><td>Empty setlist</td></tr>'}</table><script>print()</script>`;
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  }

  function serveStatic(res, pathname) {
    let file =
      pathname === '/'
        ? 'index.html'
        : pathname.startsWith('/display')
          ? 'display.html'
          : pathname === '/remote'
            ? 'remote.html'
            : pathname.slice(1);
    if (pathname.startsWith('/assets/')) file = pathname.slice(1);
    const full = path.normalize(path.join(distDir, file));
    if (!full.startsWith(path.normalize(distDir))) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(full, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end('Not found. Run "npm run build" first.');
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    try {
      if (url.pathname.startsWith('/api/')) return await handleApi(req, res, url);
      if (url.pathname === '/print/setlist') return servePrint(res);
      serveStatic(res, url.pathname);
    } catch (e) {
      sendJson(res, 500, { error: String(e.message ?? e) });
    }
  });

  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    if (new URL(req.url, 'http://x').pathname !== '/ws') return socket.destroy();
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws));
  });

  wss.on('connection', (ws) => {
    clients.add(ws);
    ws.send(JSON.stringify({ type: 'state', state: fullState() }));
    ws.on('close', () => clients.delete(ws));
    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }
      const fn = actions[msg.type];
      if (!fn) return;
      fn(msg);
      db.saveState();
      broadcast();
    });
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    // 0.0.0.0 so OBS and other LAN machines can reach the displays.
    server.listen(port, '0.0.0.0', () => {
      console.log(`SongPresentation server on :${port} (${lanIps().join(', ')})`);
      resolve(server);
    });
  });
}

module.exports = { startServer };

if (require.main === module) {
  startServer({
    port: Number(process.env.SP_PORT) || 4000,
    dataDir: process.env.SP_DATA || path.join(__dirname, '..', '.data'),
    distDir: path.join(__dirname, '..', 'dist'),
  });
}
