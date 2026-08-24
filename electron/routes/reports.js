const express = require('express');
const dayjs = require('dayjs');
const { getDb } = require('../db/db');

module.exports = function buildReportsRouter() {
  const router = express.Router();

  function caBetween(db, startISO, endISO) {
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(total), 0) AS ca, COUNT(*) AS nb_ventes
         FROM sales WHERE status = 'validee' AND created_at >= ? AND created_at < ?`
      )
      .get(startISO, endISO);
    return { ca: row.ca, nb_ventes: row.nb_ventes };
  }

  // CA du jour / mois / annee en cours + comparaison periode precedente
  router.get('/summary', (req, res) => {
    const db = getDb();
    const now = dayjs();

    const dayStart = now.startOf('day').format('YYYY-MM-DD HH:mm:ss');
    const dayEnd = now.add(1, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss');
    const monthStart = now.startOf('month').format('YYYY-MM-DD HH:mm:ss');
    const monthEnd = now.add(1, 'month').startOf('month').format('YYYY-MM-DD HH:mm:ss');
    const yearStart = now.startOf('year').format('YYYY-MM-DD HH:mm:ss');
    const yearEnd = now.add(1, 'year').startOf('year').format('YYYY-MM-DD HH:mm:ss');

    const yesterdayStart = now.subtract(1, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss');

    const today = caBetween(db, dayStart, dayEnd);
    const yesterday = caBetween(db, yesterdayStart, dayStart);
    const month = caBetween(db, monthStart, monthEnd);
    const year = caBetween(db, yearStart, yearEnd);

    const lowStock = db
      .prepare(
        `SELECT v.id, v.color, v.size, v.quantity, v.alert_threshold, p.name AS product_name, p.photo
         FROM variants v JOIN products p ON p.id = v.product_id
         WHERE p.active = 1 AND v.quantity <= v.alert_threshold ORDER BY v.quantity ASC LIMIT 20`
      )
      .all();

    const stockValue = db
      .prepare(
        `SELECT COALESCE(SUM(v.quantity * p.sale_price), 0) AS value_sale,
                COALESCE(SUM(v.quantity * p.cost_price), 0) AS value_cost,
                COALESCE(SUM(v.quantity), 0) AS total_pieces
         FROM variants v JOIN products p ON p.id = v.product_id WHERE p.active = 1`
      )
      .get();

    res.json({ today, yesterday, month, year, lowStock, stockValue });
  });

  // CA sur une periode + regroupement par jour (pour graphique)
  router.get('/ca', (req, res) => {
    const db = getDb();
    const { period, date } = req.query; // period: day|month|year
    const ref = date ? dayjs(date) : dayjs();
    let groupFormat;
    let start;
    let end;

    if (period === 'year') {
      start = ref.startOf('year');
      end = ref.add(1, 'year').startOf('year');
      groupFormat = '%Y-%m';
    } else if (period === 'month') {
      start = ref.startOf('month');
      end = ref.add(1, 'month').startOf('month');
      groupFormat = '%Y-%m-%d';
    } else {
      start = ref.startOf('day');
      end = ref.add(1, 'day').startOf('day');
      groupFormat = '%H';
    }

    const rows = db
      .prepare(
        `SELECT strftime('${groupFormat}', created_at) AS bucket, COALESCE(SUM(total),0) AS ca, COUNT(*) AS nb_ventes
         FROM sales WHERE status = 'validee' AND created_at >= ? AND created_at < ?
         GROUP BY bucket ORDER BY bucket ASC`
      )
      .all(start.format('YYYY-MM-DD HH:mm:ss'), end.format('YYYY-MM-DD HH:mm:ss'));

    const totals = caBetween(db, start.format('YYYY-MM-DD HH:mm:ss'), end.format('YYYY-MM-DD HH:mm:ss'));

    res.json({
      period,
      start: start.format('YYYY-MM-DD HH:mm:ss'),
      end: end.format('YYYY-MM-DD HH:mm:ss'),
      rows,
      totals
    });
  });

  // Meilleures / moins bonnes ventes
  router.get('/produits', (req, res) => {
    const db = getDb();
    const { from, to, limit, order } = req.query;
    let sql = `SELECT si.product_name, si.color, si.size,
                      SUM(si.quantity) AS quantite_vendue,
                      SUM(si.subtotal) AS ca_genere
               FROM sale_items si
               JOIN sales s ON s.id = si.sale_id
               WHERE s.status = 'validee'`;
    const params = [];
    if (from) {
      sql += ' AND s.created_at >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND s.created_at <= ?';
      params.push(to);
    }
    sql += ' GROUP BY si.product_name, si.color, si.size';
    sql += order === 'asc' ? ' ORDER BY quantite_vendue ASC' : ' ORDER BY quantite_vendue DESC';
    sql += ` LIMIT ${Number(limit) || 10}`;

    res.json(db.prepare(sql).all(...params));
  });

  router.get('/categories', (req, res) => {
    const db = getDb();
    const { from, to } = req.query;
    let sql = `SELECT COALESCE(p.category, 'Sans categorie') AS category,
                      SUM(si.quantity) AS quantite_vendue,
                      SUM(si.subtotal) AS ca_genere
               FROM sale_items si
               JOIN sales s ON s.id = si.sale_id
               JOIN variants v ON v.id = si.variant_id
               JOIN products p ON p.id = v.product_id
               WHERE s.status = 'validee'`;
    const params = [];
    if (from) {
      sql += ' AND s.created_at >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND s.created_at <= ?';
      params.push(to);
    }
    sql += ' GROUP BY category ORDER BY ca_genere DESC';
    res.json(db.prepare(sql).all(...params));
  });

  router.get('/paiements', (req, res) => {
    const db = getDb();
    const { from, to } = req.query;
    let sql = `SELECT payment_method, COUNT(*) AS nb, COALESCE(SUM(total),0) AS ca
               FROM sales WHERE status = 'validee'`;
    const params = [];
    if (from) {
      sql += ' AND created_at >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND created_at <= ?';
      params.push(to);
    }
    sql += ' GROUP BY payment_method ORDER BY ca DESC';
    res.json(db.prepare(sql).all(...params));
  });

  return router;
};
