const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const { createServer } = require('./server');

const isDev = process.env.NODE_ENV === 'development';

let mainWindow = null;
let serverInfo = null;

async function createWindow() {
  const userDataDir = app.getPath('userData');
  const staticDir = isDev ? null : path.join(__dirname, '..', 'dist');

  try {
    serverInfo = await createServer(userDataDir, staticDir);
  } catch (err) {
    dialog.showErrorBox('Erreur de demarrage', `Impossible de demarrer le serveur local: ${err.message}`);
    app.quit();
    return;
  }

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1000,
    minHeight: 700,
    backgroundColor: '#fdf5f8',
    icon: path.join(__dirname, '..', 'public', 'icons', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  Menu.setApplicationMenu(buildMenu());

  const targetUrl = isDev ? 'http://localhost:5173' : `http://localhost:${serverInfo.port}`;
  mainWindow.loadURL(targetUrl);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const template = [
    {
      label: 'Fichier',
      submenu: [{ role: 'reload', label: 'Actualiser' }, { role: 'quit', label: 'Quitter' }]
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'zoomIn', label: 'Zoom +' },
        { role: 'zoomOut', label: 'Zoom -' },
        { role: 'resetZoom', label: 'Zoom reel' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Plein ecran' },
        { role: 'toggleDevTools', label: 'Outils de developpement' }
      ]
    }
  ];
  return Menu.buildFromTemplate(template);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
