const { app, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');

// Checks GitHub Releases for a newer version and asks before downloading and installing.
// Packaged builds only: a dev run has no release feed.
function initUpdater(getWindow) {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', async (info) => {
    const { response } = await dialog.showMessageBox(getWindow(), {
      type: 'info',
      title: 'Update available',
      message: `SongPresentation ${info.version} is available.`,
      detail: `You have ${app.getVersion()}. Download it now? You can keep working while it downloads.`,
      buttons: ['Download', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) autoUpdater.downloadUpdate().catch(showError);
  });

  autoUpdater.on('update-downloaded', async (info) => {
    const { response } = await dialog.showMessageBox(getWindow(), {
      type: 'info',
      title: 'Update ready',
      message: `SongPresentation ${info.version} is ready to install.`,
      detail: 'Restart now, or it installs when you quit the app. Displays reconnect after the restart.',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  // A failed check MUST NOT bother the operator during a service; only a failed download is shown.
  autoUpdater.on('error', (e) => console.error('Update check failed:', e && e.message));

  function showError(e) {
    dialog.showErrorBox('Update failed', String((e && e.message) || e));
  }

  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, 4 * 60 * 60e3);
}

module.exports = { initUpdater };
