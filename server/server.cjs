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
      const song = collectionSongs(collectionKey).find((s) => String(s.number) === String(number));
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
        if (importStatus.running) return sendJson(res, 409, { error: 'Import already running.' });
        const { collections, languages, languageNames = {} } = await readBody(req);
        const token = await stTokenGet(false);
        for (const code of languages)
          if (!state.languages.some((l) => l.code === code)) state.languages.push({ code, name: languageNames[code] ?? code });
        db.saveState();
        importStatus = { running: true, done: 0, total: 0, message: 'Starting…', error: '' };
        broadcast();
        songtreasures
          .importCollections({
            token,
            collections,
            languages,
            dataDir,
            save: (song) => db.saveSong(song),
            progress: (p) => {
              importStatus = { ...importStatus, ...p };
              broadcast();
            },
          })
          .then((r) => {
            importStatus = { running: false, done: r.total, total: r.total, message: `Imported ${r.imported} of ${r.total} songs.`, error: '' };
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

  function serveStatic(res, pathname) {
    let file = pathname === '/' ? 'index.html' : pathname.startsWith('/display') ? 'display.html' : pathname.slice(1);
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
