const { app, BrowserWindow } = require('electron');
const { startServer } = require('./src/server');

const PORT = process.env.PORT || 3000;
let mainWindow;

app.whenReady().then(async () => {
  await startServer(PORT);

  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    backgroundColor: '#0d0d14',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    titleBarStyle: 'hidden',
    frame: false
  });

  mainWindow.loadURL(`http://localhost:${PORT}/ui`);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = new BrowserWindow({ width: 1920, height: 1080 });
      mainWindow.loadURL(`http://localhost:${PORT}/ui`);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
