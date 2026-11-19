const { app, BrowserWindow, dialog, shell, session } = require('electron');
const path = require('path');
const { startServer } = require('../server/server.cjs');

const PORT = Number(process.env.SP_PORT) || 4000;

// Reads the Firebase ID token that the SongTreasures web app stores in IndexedDB.
// MUST NOT create the database or keep it open: that blocks Firebase from storing the session.
const READ_TOKEN = `new Promise((res) => {
  const r = indexedDB.open('firebaseLocalStorageDb');
  r.onupgradeneeded = () => r.transaction.abort();
  r.onerror = () => res(null);
  r.onsuccess = () => {
    const db = r.result;
    try {
      const g = db.transaction('firebaseLocalStorage', 'readonly').objectStore('firebaseLocalStorage').getAll();
      g.onsuccess = () => {
        db.close();
        const u = (g.result || []).find((x) => String(x.fbase_key || '').startsWith('firebase:authUser'));
        const t = u && u.value && u.value.stsTokenManager;
        res(t ? { token: t.accessToken, exp: t.expirationTime } : null);
      };
      g.onerror = () => { db.close(); res(null); };
    } catch (e) { db.close(); res(null); }
  };
})`;

// Opens SongTreasures in its own persistent session. Interactive shows the window so the user can sign in.
let signInWin = null;

async function getSongTreasuresToken({ interactive, cancel }) {
  if (cancel) {
    if (signInWin && !signInWin.isDestroyed()) signInWin.close();
    return null;
  }
  if (interactive && signInWin && !signInWin.isDestroyed()) {
    signInWin.show();
    signInWin.focus();
    return null;
  }
  const win = new BrowserWindow({
    width: 520,
    height: 780,
    show: false,
    title: 'Sign in to SongTreasures, then wait',
    alwaysOnTop: interactive,
    webPreferences: { partition: 'persist:songtreasures' },
  });
  // Google/Apple sign-in opens a pop-up. It MUST appear above the always-on-top sign-in window.
  win.webContents.setWindowOpenHandler(() => ({
    action: 'allow',
    overrideBrowserWindowOptions: {
      parent: win,
      alwaysOnTop: true,
      width: 500,
      height: 700,
      webPreferences: { partition: 'persist:songtreasures' },
    },
  }));
  if (interactive) {
    signInWin = win;
    win.center();
    win.show();
    win.focus();
    app.focus({ steal: true });
  }
  try {
    win.loadURL('https://presentation.songtreasures.app/').catch(() => {});
    const deadline = Date.now() + (interactive ? 5 * 60e3 : 20e3);
    while (Date.now() < deadline && !win.isDestroyed()) {
      const t = await win.webContents.executeJavaScript(READ_TOKEN).catch(() => null);
      if (t && t.exp > Date.now() + 60e3) return t.token;
      await new Promise((r) => setTimeout(r, 1000));
    }
    return null;
  } finally {
    if (signInWin === win) signInWin = null;
    if (!win.isDestroyed()) win.close();
  }
}

app.whenReady().then(async () => {
  // Google refuses sign-in from user agents that name Electron.
  const st = session.fromPartition('persist:songtreasures');
  st.setUserAgent(st.getUserAgent().replace(/\s?(Electron|SongPresentation|song-presentation)\/\S+/g, ''));

  // A failed start MUST be shown and quit the app; otherwise it hangs with no window.
  try {
    await startServer({
      port: PORT,
      dataDir: app.getPath('userData'),
      distDir: path.join(__dirname, '..', 'dist'),
      getSongTreasuresToken,
    });
  } catch (e) {
    const busy = e && e.code === 'EADDRINUSE';
    dialog.showErrorBox(
      'SongPresentation could not start',
      busy ? `Port ${PORT} is already in use. Another SongPresentation may still be running.` : String((e && e.stack) || e),
    );
    app.quit();
    return;
  }

  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    title: 'SongPresentation',
    backgroundColor: '#ebe9e5',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
  });
  win.loadURL(`http://localhost:${PORT}/`);

  // Display links open in the system browser, so they can be dragged to another screen.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
});

app.on('window-all-closed', () => app.quit());
