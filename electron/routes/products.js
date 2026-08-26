const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getDb } = require('../db/db');
const { optimizeBuffer } = require('../lib/imageOptim');

function makeSku(productId, color, size) {
  const clean = (s) => (s || '').toString().trim().toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 6);
  const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `P${productId}-${clean(color) || 'STD'}-${clean(size) || 'U'}-${suffix}`;
}

module.exports = function buildProductsRouter(photosDir) {
  const router = express.Router();

  // La photo est d'abord recue en memoire, puis compressee/redimensionnee avant d'etre
  // ecrite sur le disque : les photos prises depuis la tablette (plusieurs Mo) ne doivent
  // jamais etre stockees telles quelles, sinon Inventaire et Caisse deviennent tres lents
  // des que le nombre d'articles augmente.
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
      else cb(new Error('Format image non supporte'));
    }
  });

  async function optimizeUploadedPhoto(req, res, next) {
    if (!req.file) return next();
    try {
      const optimized = await optimizeBuffer(req.file.buffer);
      const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.jpg`;
      fs.writeFileSync(path.join(photosDir, filename), optimized);
      req.file.filename = filename;
      next();
    } catch (err) {
      next(new Error("Impossible de traiter la photo : " + err.message));
    }
  }

  function attachVariants(product) {
    const db = getDb();
    product.variants = db
      .prepare('SELECT * FROM variants WHERE product_id = ? ORDER BY color, size')
      .all(product.id);
    return product;
  }

  router.get('/', (req, res) => {
    const db = getDb();
    const { q, category, lowstock, active } = req.query;
    let rows = db.prepare('SELECT * FROM products ORDER BY updated_at DESC').all();

    if (active === '1' || active === undefined) rows = rows.filter((p) => p.active === 1);
    if (category) rows = rows.filter((p) => p.category === category);
    if (q) {
      const needle = q.toLowerCase();
      rows = rows.filter((p) => p.name.toLowerCase().includes(needle) || (p.category || '').toLowerCase().includes(needle));
    }

    rows = rows.map(attachVariants);

    if (lowstock === '1') {
      rows = rows.filter((p) => p.variants.some((v) => v.quantity <= v.alert_threshold));
    }

    res.json(rows);
  });

  router.get('/categories', (req, res) => {
    const db = getDb();
    const rows = db
      .prepare("SELECT DISTINCT category FROM products WHERE category != '' ORDER BY category")
      .all();
    res.json(rows.map((r) => r.category));
  });

  router.get('/:id', (req, res) => {
    const db = getDb();
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ error: 'Article introuvable' });
    res.json(attachVariants(product));
  });

  router.post('/', upload.single('photo'), optimizeUploadedPhoto, (req, res) => {
    const db = getDb();
    const { name, category, description, cost_price, sale_price } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Le nom est obligatoire' });

    const photo = req.file ? req.file.filename : '';
    const info = db
      .prepare(
        `INSERT INTO products (name, category, description, cost_price, sale_price, photo)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(name.trim(), category || '', description || '', Number(cost_price) || 0, Number(sale_price) || 0, photo);

    const productId = info.lastInsertRowid;

    let variants = [];
    if (req.body.variants) {
      try {
        variants = JSON.parse(req.body.variants);
      } catch (e) {
        variants = [];
      }
    }
    const insertVariant = db.prepare(
      `INSERT INTO variants (product_id, color, size, sku, quantity, alert_threshold)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    const insertMovement = db.prepare(
      `INSERT INTO stock_movements (variant_id, type, quantity, note, source) VALUES (?, 'reception', ?, ?, ?)`
    );

    const tx = db.transaction((vs) => {
      for (const v of vs) {
        const sku = makeSku(productId, v.color, v.size);
        const qty = Number(v.quantity) || 0;
        const result = insertVariant.run(
          productId,
          v.color || '',
          v.size || '',
          sku,
          qty,
          Number(v.alert_threshold) || 3
        );
        if (qty > 0) {
          insertMovement.run(result.lastInsertRowid, qty, 'Stock initial', 'pc');
        }
      }
    });
    if (variants.length) tx(variants);

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    res.status(201).json(attachVariants(product));
  });

  router.put('/:id', upload.single('photo'), optimizeUploadedPhoto, (req, res) => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Article introuvable' });

    const { name, category, description, cost_price, sale_price, active } = req.body;
    let photo = existing.photo;
    if (req.file) {
      photo = req.file.filename;
      if (existing.photo) {
        const oldPath = path.join(photosDir, existing.photo);
        if (fs.existsSync(oldPath)) fs.unlink(oldPath, () => {});
      }
    }

    db.prepare(
      `UPDATE products SET name = ?, category = ?, description = ?, cost_price = ?, sale_price = ?, photo = ?, active = ?, updated_at = datetime('now','localtime')
       WHERE id = ?`
    ).run(
      name ?? existing.name,
      category ?? existing.category,
      description ?? existing.description,
      cost_price !== undefined ? Number(cost_price) : existing.cost_price,
      sale_price !== undefined ? Number(sale_price) : existing.sale_price,
      photo,
      active !== undefined ? Number(active) : existing.active,
      req.params.id
    );

    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    res.json(attachVariants(product));
  });

  router.delete('/:id', (req, res) => {
    const db = getDb();
    db.prepare("UPDATE products SET active = 0, updated_at = datetime('now','localtime') WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  });

  // --- Variants ---
  router.post('/:id/variants', (req, res) => {
    const db = getDb();
    const productId = req.params.id;
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!product) return res.status(404).json({ error: 'Article introuvable' });

    const { color, size, quantity, alert_threshold } = req.body;
    const sku = makeSku(productId, color, size);
    const qty = Number(quantity) || 0;
    const info = db
      .prepare(
        `INSERT INTO variants (product_id, color, size, sku, quantity, alert_threshold) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(productId, color || '', size || '', sku, qty, Number(alert_threshold) || 3);

    if (qty > 0) {
      db.prepare(`INSERT INTO stock_movements (variant_id, type, quantity, note, source) VALUES (?, 'reception', ?, 'Nouvelle variante', 'pc')`).run(
        info.lastInsertRowid,
        qty
      );
    }

    const variant = db.prepare('SELECT * FROM variants WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(variant);
  });

  router.put('/variants/:variantId', (req, res) => {
    const db = getDb();
    const existing = db.prepare('SELECT * FROM variants WHERE id = ?').get(req.params.variantId);
    if (!existing) return res.status(404).json({ error: 'Variante introuvable' });
    const { color, size, alert_threshold } = req.body;
    // price_override n'est modifie que si la cle est explicitement envoyee : une valeur
    // absente ou nulle ne doit jamais ecraser le prix (sinon la variante retombe a 0 Ar).
    const hasPriceOverride = Object.prototype.hasOwnProperty.call(req.body, 'price_override');
    const rawPriceOverride = req.body.price_override;
    const nextPriceOverride = hasPriceOverride
      ? (rawPriceOverride === '' || rawPriceOverride === null ? null : Number(rawPriceOverride))
      : existing.price_override;
    db.prepare(
      `UPDATE variants SET color = ?, size = ?, alert_threshold = ?, price_override = ? WHERE id = ?`
    ).run(
      color ?? existing.color,
      size ?? existing.size,
      alert_threshold !== undefined ? Number(alert_threshold) : existing.alert_threshold,
      nextPriceOverride,
      req.params.variantId
    );
    res.json(db.prepare('SELECT * FROM variants WHERE id = ?').get(req.params.variantId));
  });

  router.delete('/variants/:variantId', (req, res) => {
    const db = getDb();
    try {
      db.prepare('DELETE FROM variants WHERE id = ?').run(req.params.variantId);
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: "Impossible de supprimer : cette variante a deja des ventes enregistrees. Vous pouvez remettre sa quantite a 0 a la place." });
    }
  });

  return router;
};
