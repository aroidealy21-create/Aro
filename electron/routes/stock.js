const express = require('express');
const { getDb } = require('../db/db');

module.exports = function buildStockRouter() {
  const router = express.Router();

  // Reception de nouvelles marchandises (utilisable depuis la tablette)
  router.post('/reception', (req, res) => {
    const db = getDb();
    const { variant_id, quantity, note, source } = req.body;
    const qty = Number(quantity);
    if (!variant_id || !qty || qty <= 0) {
      return res.status(400).json({ error: 'Variante et quantite (positive) requises' });
    }
    const variant = db.prepare('SELECT * FROM variants WHERE id = ?').get(variant_id);
    if (!variant) return res.status(404).json({ error: 'Variante introuvable' });

    const tx = db.transaction(() => {
      db.prepare('UPDATE variants SET quantity = quantity + ? WHERE id = ?').run(qty, variant_id);
      db.prepare(
        `INSERT INTO stock_movements (variant_id, type, quantity, note, source) VALUES (?, 'reception', ?, ?, ?)`
      ).run(variant_id, qty, note || '', source === 'tablette' ? 'tablette' : 'pc');
    });
    tx();

    const updated = db.prepare('SELECT * FROM variants WHERE id = ?').get(variant_id);
    res.status(201).json(updated);
  });

  // Ajustement manuel (inventaire, casse, perte...)
  router.post('/adjustment', (req, res) => {
    const db = getDb();
    const { variant_id, quantity, note } = req.body;
    const delta = Number(quantity);
    if (!variant_id || !delta) return res.status(400).json({ error: 'Variante et quantite (delta) requises' });
    const variant = db.prepare('SELECT * FROM variants WHERE id = ?').get(variant_id);
    if (!variant) return res.status(404).json({ error: 'Variante introuvable' });
    if (variant.quantity + delta < 0) return res.status(400).json({ error: 'Stock insuffisant' });

    const tx = db.transaction(() => {
      db.prepare('UPDATE variants SET quantity = quantity + ? WHERE id = ?').run(delta, variant_id);
      db.prepare(
        `INSERT INTO stock_movements (variant_id, type, quantity, note, source) VALUES (?, 'ajustement', ?, ?, 'pc')`
      ).run(variant_id, delta, note || '');
    });
    tx();

    res.json(db.prepare('SELECT * FROM variants WHERE id = ?').get(variant_id));
  });

  router.get('/movements', (req, res) => {
    const db = getDb();
    const { variant_id, from, to, limit } = req.query;
    let sql = `SELECT m.*, v.color, v.size, v.sku, p.name AS product_name, p.id AS product_id
               FROM stock_movements m
               JOIN variants v ON v.id = m.variant_id
               JOIN products p ON p.id = v.product_id
               WHERE 1=1`;
    const params = [];
    if (variant_id) {
      sql += ' AND m.variant_id = ?';
      params.push(variant_id);
    }
    if (from) {
      sql += ' AND m.created_at >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND m.created_at <= ?';
      params.push(to);
    }
    sql += ' ORDER BY m.created_at DESC';
    if (limit) sql += ` LIMIT ${Number(limit) || 100}`;
    res.json(db.prepare(sql).all(...params));
  });

  // Liste plate des variantes (utile pour recherche rapide reception/POS)
  router.get('/variants', (req, res) => {
    const db = getDb();
    const { q } = req.query;
    let sql = `SELECT v.*, p.name AS product_name, p.category, p.photo, p.sale_price AS product_price, p.active
               FROM variants v JOIN products p ON p.id = v.product_id WHERE p.active = 1`;
    const params = [];
    if (q) {
      sql += ' AND (p.name LIKE ? OR v.sku LIKE ? OR v.color LIKE ? OR v.size LIKE ?)';
      const needle = `%${q}%`;
      params.push(needle, needle, needle, needle);
    }
    sql += ' ORDER BY p.name, v.color, v.size';
    res.json(db.prepare(sql).all(...params));
  });

  return router;
};
