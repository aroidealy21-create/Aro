const express = require('express');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../db/db');

module.exports = function buildSettingsRouter(dbPath) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const obj = {};
    rows.forEach((r) => { obj[r.key] = r.value; });
    res.json(obj);
  });

  router.put('/', (req, res) => {
    const db = getDb();
    const upsert = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    const tx = db.transaction((entries) => {
      for (const [key, value] of entries) upsert.run(key, String(value ?? ''));
    });
    tx(Object.entries(req.body || {}));
    const rows = db.prepare('SELECT key, value FROM settings').all();
    const obj = {};
    rows.forEach((r) => { obj[r.key] = r.value; });
    res.json(obj);
  });

  router.post('/backup', (req, res) => {
    try {
      const db = getDb();
      const backupDir = path.join(path.dirname(dbPath), '..', 'backups');
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      const filename = `sauvegarde-${new Date().toISOString().replace(/[:.]/g, '-')}.db`;
      const dest = path.join(backupDir, filename);
      db.backup(dest)
        .then(() => res.json({ ok: true, file: dest }))
        .catch((err) => res.status(500).json({ error: err.message }));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.get('/backups', (req, res) => {
    const backupDir = path.join(path.dirname(dbPath), '..', 'backups');
    if (!fs.existsSync(backupDir)) return res.json([]);
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => f.endsWith('.db'))
      .map((f) => {
        const stat = fs.statSync(path.join(backupDir, f));
        return { name: f, size: stat.size, date: stat.mtime };
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(files);
  });

  return router;
};
