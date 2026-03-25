const { app, BrowserWindow } = require('electron');
const { startServer } = require('./src/server');

const PORT = process.env.PORT || 3000;
let mainWindow;

app.whenReady().then(async () => {
  await startServer(PORT);

  mainWindow = new BrowserWindow({
<<<<<<< HEAD
    width: 1200,
    height: 800,
=======
    width: 1440,
    height: 900,
>>>>>>> 349a50b (map integration)
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
<<<<<<< HEAD
      mainWindow = new BrowserWindow({ width: 1200, height: 800 });
=======
      mainWindow = new BrowserWindow({ width: 1440, height: 900 });
>>>>>>> 349a50b (map integration)
      mainWindow.loadURL(`http://localhost:${PORT}/ui`);
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
