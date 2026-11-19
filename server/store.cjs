const fs = require('fs');
const path = require('path');
const defaults = require('./defaults.cjs');

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback();
  }
}

// Atomic write. A crash mid-write MUST NOT corrupt the file.
function writeJson(file, data) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

// Fills fields added in newer versions. Saved values win.
function merge(base, saved) {
  if (!isObj(base) || !isObj(saved)) return saved ?? base;
  const out = { ...base };
  for (const k of Object.keys(saved)) out[k] = merge(base[k], saved[k]);
  return out;
}

function open(dataDir) {
  fs.mkdirSync(dataDir, { recursive: true });
  const stateFile = path.join(dataDir, 'state.json');
  const songsFile = path.join(dataDir, 'songs.json');

  const state = merge(defaults.state(), readJson(stateFile, defaults.state));
  const base = defaults.baseProfile({});
  state.profiles = state.profiles.map((p) => merge(base, p));
  // Added once for installs from before the confidence view existed.
  if (!state.confidenceAdded) {
    if (!state.profiles.some((p) => p.mode === 'confidence')) state.profiles.push(defaults.confidenceProfile());
    state.confidenceAdded = true;
  }
  const songs = new Map(readJson(songsFile, defaults.songs).map((s) => [s.id, s]));

  let stateTimer = null;
  let songsTimer = null;
  const writeSongs = () => {
    clearTimeout(songsTimer);
    songsTimer = setTimeout(() => writeJson(songsFile, [...songs.values()]), 300);
  };
  return {
    dataDir,
    state,
    listSongs: () => [...songs.values()],
    getSong: (id) => songs.get(id) ?? null,
    saveSong(song) {
      songs.set(song.id, song);
      writeSongs();
    },
    deleteSong(id) {
      songs.delete(id);
      writeSongs();
    },
    saveState() {
      clearTimeout(stateTimer);
      stateTimer = setTimeout(() => writeJson(stateFile, state), 300);
    },
  };
}

module.exports = { open };
