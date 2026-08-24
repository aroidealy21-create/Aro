const express = require('express');
const path = require('path');
const os = require('os');
const { initDb } = require('./db/db');

const buildProductsRouter = require('./routes/products');
const buildStockRouter = require('./routes/stock');
const buildSalesRouter = require('./routes/sales');
const buildReportsRouter = require('./routes/reports');
const buildSettingsRouter = require('./routes/settings');

const PORT = 4173;

function getLocalIPs() {
  const nets = os.networkInterfaces();
  const results = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        results.push({ name, address: net.address });
      }
    }
  }
  return results;
}

function createServer(userDataDir, staticDir) {
  const { dbPath, photosDir } = initDb(userDataDir);

  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/photos', express.static(photosDir));
  app.use('/api/products', buildProductsRouter(photosDir));
  app.use('/api/stock', buildStockRouter());
  app.use('/api/sales', buildSalesRouter());
  app.use('/api/reports', buildReportsRouter());
  app.use('/api/settings', buildSettingsRouter(dbPath));

  app.get('/api/network-info', (req, res) => {
    res.json({ port: PORT, addresses: getLocalIPs() });
  });

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  if (staticDir) {
    app.use(express.static(staticDir));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/photos')) return next();
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  return new Promise((resolve, reject) => {
    const server = app.listen(PORT, '0.0.0.0', () => {
      resolve({ server, port: PORT, addresses: getLocalIPs(), dbPath, photosDir });
    });
    server.on('error', reject);
  });
}

module.exports = { createServer, getLocalIPs, PORT };
