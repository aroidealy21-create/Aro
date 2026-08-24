const express = require('express');
const dayjs = require('dayjs');
const { getDb } = require('../db/db');

function generateTicketNumber(db) {
  const today = dayjs().format('YYYYMMDD');
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM sales WHERE ticket_number LIKE ?")
    .get(`${today}-%`);
  const seq = String((row.n || 0) + 1).padStart(4, '0');
  return `${today}-${seq}`;
}

module.exports = function buildSalesRouter() {
  const router = express.Router();

  router.post('/', (req, res) => {
    const db = getDb();
    const { items, payment_method, discount, amount_received, seller, note } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Le panier est vide' });
    }

    try {
      const result = db.transaction(() => {
        let total = 0;
        const preparedItems = [];

        for (const it of items) {
          const variant = db.prepare('SELECT * FROM variants WHERE id = ?').get(it.variant_id);
          if (!variant) throw new Error(`Variante ${it.variant_id} introuvable`);
          const qty = Number(it.quantity) || 0;
          if (qty <= 0) throw new Error('Quantite invalide');
          if (variant.quantity < qty) {
            const product = db.prepare('SELECT name FROM products WHERE id = ?').get(variant.product_id);
            throw new Error(`Stock insuffisant pour ${product ? product.name : 'un article'} (${variant.color}/${variant.size})`);
          }
          const product = db.prepare('SELECT name, sale_price FROM products WHERE id = ?').get(variant.product_id);
          const unitPrice = it.unit_price !== undefined ? Number(it.unit_price) : (variant.price_override ?? product.sale_price);
          const subtotal = unitPrice * qty;
          total += subtotal;
          preparedItems.push({
            variant_id: variant.id,
            product_name: product.name,
            color: variant.color,
            size: variant.size,
            quantity: qty,
            unit_price: unitPrice,
            subtotal
          });
        }

        const disc = Number(discount) || 0;
        const finalTotal = Math.max(0, total - disc);
        const ticketNumber = generateTicketNumber(db);

        const saleInfo = db
          .prepare(
            `INSERT INTO sales (ticket_number, total, discount, payment_method, amount_received, change_given, seller, note)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            ticketNumber,
            finalTotal,
            disc,
            payment_method || 'especes',
            amount_received !== undefined && amount_received !== null && amount_received !== '' ? Number(amount_received) : null,
            amount_received ? Math.max(0, Number(amount_received) - finalTotal) : null,
            seller || '',
            note || ''
          );

        const saleId = saleInfo.lastInsertRowid;
        const insertItem = db.prepare(
          `INSERT INTO sale_items (sale_id, variant_id, product_name, color, size, quantity, unit_price, subtotal)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        );
        const insertMovement = db.prepare(
          `INSERT INTO stock_movements (variant_id, type, quantity, note, source) VALUES (?, 'vente', ?, ?, 'pc')`
        );
        const updateStock = db.prepare('UPDATE variants SET quantity = quantity - ? WHERE id = ?');

        for (const pi of preparedItems) {
          insertItem.run(saleId, pi.variant_id, pi.product_name, pi.color, pi.size, pi.quantity, pi.unit_price, pi.subtotal);
          updateStock.run(pi.quantity, pi.variant_id);
          insertMovement.run(pi.variant_id, -pi.quantity, `Vente ${ticketNumber}`);
        }

        return db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
      })();

      const items_ = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(result.id);
      res.status(201).json({ ...result, items: items_ });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.get('/', (req, res) => {
    const db = getDb();
    const { from, to, status } = req.query;
    let sql = 'SELECT * FROM sales WHERE 1=1';
    const params = [];
    if (from) {
      sql += ' AND created_at >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND created_at <= ?';
      params.push(to);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    res.json(db.prepare(sql).all(...params));
  });

  router.get('/:id', (req, res) => {
    const db = getDb();
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Vente introuvable' });
    sale.items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
    res.json(sale);
  });

  router.post('/:id/void', (req, res) => {
    const db = getDb();
    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
    if (!sale) return res.status(404).json({ error: 'Vente introuvable' });
    if (sale.status === 'annulee') return res.status(400).json({ error: 'Vente deja annulee' });

    const tx = db.transaction(() => {
      const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(sale.id);
      const restock = db.prepare('UPDATE variants SET quantity = quantity + ? WHERE id = ?');
      const insertMovement = db.prepare(
        `INSERT INTO stock_movements (variant_id, type, quantity, note, source) VALUES (?, 'annulation', ?, ?, 'pc')`
      );
      for (const it of items) {
        restock.run(it.quantity, it.variant_id);
        insertMovement.run(it.variant_id, it.quantity, `Annulation vente ${sale.ticket_number}`);
      }
      db.prepare("UPDATE sales SET status = 'annulee' WHERE id = ?").run(sale.id);
    });
    tx();

    res.json({ ok: true });
  });

  return router;
};
