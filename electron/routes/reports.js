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

  function beneficeBetween(db, startISO, endISO) {
    const row = db
      .prepare(
        `SELECT COALESCE(SUM(si.subtotal - si.quantity * COALESCE(si.unit_cost, p.cost_price, 0)), 0) AS benefice
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         JOIN variants v ON v.id = si.variant_id
         JOIN products p ON p.id = v.product_id
         WHERE s.status = 'validee' AND s.created_at >= ? AND s.created_at < ?`
      )
      .get(startISO, endISO);
    return row.benefice;
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

    today.benefice = beneficeBetween(db, dayStart, dayEnd);
    month.benefice = beneficeBetween(db, monthStart, monthEnd);
    year.benefice = beneficeBetween(db, yearStart, yearEnd);

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

  // Benefice (CA - cout) sur une periode + regroupement (pour graphique)
  router.get('/benefices', (req, res) => {
    const db = getDb();
    const { period, date } = req.query; // period: day|week|month|year
    const ref = date ? dayjs(date) : dayjs();
    let start;
    let end;
    let groupFormat;

    if (period === 'year') {
      start = ref.startOf('year');
      end = ref.add(1, 'year').startOf('year');
      groupFormat = '%Y-%m';
    } else if (period === 'month') {
      start = ref.startOf('month');
      end = ref.add(1, 'month').startOf('month');
      groupFormat = '%Y-%m-%d';
    } else if (period === 'week') {
      start = ref.startOf('week');
      end = ref.add(1, 'week').startOf('week');
      groupFormat = '%Y-%m-%d';
    } else {
      start = ref.startOf('day');
      end = ref.add(1, 'day').startOf('day');
      groupFormat = '%H';
    }

    const startStr = start.format('YYYY-MM-DD HH:mm:ss');
    const endStr = end.format('YYYY-MM-DD HH:mm:ss');

    const baseSelect = `SUM(si.subtotal) AS ca,
                         SUM(si.quantity * COALESCE(si.unit_cost, p.cost_price, 0)) AS cout,
                         SUM(si.subtotal - si.quantity * COALESCE(si.unit_cost, p.cost_price, 0)) AS benefice`;
    const baseFrom = `FROM sale_items si
                       JOIN sales s ON s.id = si.sale_id
                       JOIN variants v ON v.id = si.variant_id
                       JOIN products p ON p.id = v.product_id
                       WHERE s.status = 'validee' AND s.created_at >= ? AND s.created_at < ?`;

    const rows = db
      .prepare(`SELECT strftime('${groupFormat}', s.created_at) AS bucket, ${baseSelect} ${baseFrom} GROUP BY bucket ORDER BY bucket ASC`)
      .all(startStr, endStr);

    const totals = db.prepare(`SELECT ${baseSelect} ${baseFrom}`).get(startStr, endStr);

    res.json({
      period,
      start: startStr,
      end: endStr,
      rows: rows.map((r) => ({ ...r, ca: r.ca || 0, cout: r.cout || 0, benefice: r.benefice || 0 })),
      totals: { ca: totals.ca || 0, cout: totals.cout || 0, benefice: totals.benefice || 0 }
    });
  });

  // Meilleures / moins bonnes ventes (avec cout et benefice)
  router.get('/produits', (req, res) => {
    const db = getDb();
    const { from, to, limit, order, payment_method } = req.query;
    let sql = `SELECT si.product_name, si.color, si.size,
                      SUM(si.quantity) AS quantite_vendue,
                      SUM(si.subtotal) AS ca_genere,
                      SUM(si.quantity * COALESCE(si.unit_cost, p.cost_price, 0)) AS cout_total,
                      SUM(si.subtotal - si.quantity * COALESCE(si.unit_cost, p.cost_price, 0)) AS benefice
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
    if (payment_method) {
      sql += ' AND s.payment_method = ?';
      params.push(payment_method);
    }
    sql += ' GROUP BY si.product_name, si.color, si.size';
    sql += order === 'asc' ? ' ORDER BY quantite_vendue ASC' : ' ORDER BY quantite_vendue DESC';
    sql += ` LIMIT ${Number(limit) || 10}`;

    res.json(db.prepare(sql).all(...params));
  });

  // Statistiques par taille (toutes categories confondues)
  router.get('/tailles', (req, res) => {
    const db = getDb();
    const { from, to, order } = req.query;
    let sql = `SELECT si.size,
                      SUM(si.quantity) AS quantite_vendue,
                      SUM(si.subtotal) AS ca_genere
               FROM sale_items si
               JOIN sales s ON s.id = si.sale_id
               WHERE s.status = 'validee' AND si.size != ''`;
    const params = [];
    if (from) {
      sql += ' AND s.created_at >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND s.created_at <= ?';
      params.push(to);
    }
    sql += ' GROUP BY si.size';
    sql += order === 'asc' ? ' ORDER BY quantite_vendue ASC' : ' ORDER BY quantite_vendue DESC';
    res.json(db.prepare(sql).all(...params));
  });

  // Repartition des ventes par heure de la journee (toutes dates confondues sur la periode)
  router.get('/heures', (req, res) => {
    const db = getDb();
    const { from, to } = req.query;
    let sql = `SELECT strftime('%H', created_at) AS heure, COUNT(*) AS nb_ventes, COALESCE(SUM(total),0) AS ca
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
    sql += ' GROUP BY heure ORDER BY heure ASC';
    const rows = db.prepare(sql).all(...params);
    // Complete les 24h meme sans ventes, pour un graphique regulier
    const byHour = {};
    rows.forEach((r) => { byHour[r.heure] = r; });
    const complete = [];
    for (let h = 0; h < 24; h++) {
      const key = String(h).padStart(2, '0');
      complete.push(byHour[key] || { heure: key, nb_ventes: 0, ca: 0 });
    }
    res.json(complete);
  });

  // Boutique vs vente en ligne
  router.get('/canal', (req, res) => {
    const db = getDb();
    const { from, to } = req.query;
    let sql = `SELECT CASE WHEN payment_method = 'en_ligne' THEN 'en_ligne' ELSE 'boutique' END AS canal,
                      COUNT(*) AS nb_ventes, COALESCE(SUM(total),0) AS ca
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
    sql += ' GROUP BY canal';
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

  // Donnees consolidees pour l'export comptable complet (Excel)
  router.get('/export', (req, res) => {
    const db = getDb();
    const from = req.query.from || '2000-01-01 00:00:00';
    const to = req.query.to || '2999-12-31 23:59:59';

    const resume = db
      .prepare(
        `SELECT COUNT(*) AS nb_ventes, COALESCE(SUM(total),0) AS ca,
                COALESCE(SUM(discount),0) AS remises
         FROM sales WHERE status = 'validee' AND created_at >= ? AND created_at <= ?`
      )
      .get(from, to);

    const beneficeRow = db
      .prepare(
        `SELECT COALESCE(SUM(si.quantity * COALESCE(si.unit_cost, p.cost_price, 0)),0) AS cout,
                COALESCE(SUM(si.subtotal - si.quantity * COALESCE(si.unit_cost, p.cost_price, 0)),0) AS benefice
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         JOIN variants v ON v.id = si.variant_id
         JOIN products p ON p.id = v.product_id
         WHERE s.status = 'validee' AND s.created_at >= ? AND s.created_at <= ?`
      )
      .get(from, to);

    const ventes = db
      .prepare(
        `SELECT s.ticket_number, s.created_at, s.total, s.discount, s.payment_method, s.seller, s.status,
                (SELECT COUNT(*) FROM sale_items si WHERE si.sale_id = s.id) AS nb_articles
         FROM sales s WHERE s.created_at >= ? AND s.created_at <= ? ORDER BY s.created_at ASC`
      )
      .all(from, to);

    const articles = db
      .prepare(
        `SELECT s.ticket_number, s.created_at, s.status, si.product_name, si.color, si.size, si.quantity,
                si.unit_price, COALESCE(si.unit_cost, p.cost_price, 0) AS unit_cost, si.subtotal,
                (si.subtotal - si.quantity * COALESCE(si.unit_cost, p.cost_price, 0)) AS benefice
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         JOIN variants v ON v.id = si.variant_id
         JOIN products p ON p.id = v.product_id
         WHERE s.created_at >= ? AND s.created_at <= ? ORDER BY s.created_at ASC`
      )
      .all(from, to);

    const produits = db
      .prepare(
        `SELECT si.product_name, si.color, si.size,
                SUM(si.quantity) AS quantite_vendue,
                SUM(si.subtotal) AS ca_genere,
                SUM(si.quantity * COALESCE(si.unit_cost, p.cost_price, 0)) AS cout_total,
                SUM(si.subtotal - si.quantity * COALESCE(si.unit_cost, p.cost_price, 0)) AS benefice
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         JOIN variants v ON v.id = si.variant_id
         JOIN products p ON p.id = v.product_id
         WHERE s.status = 'validee' AND s.created_at >= ? AND s.created_at <= ?
         GROUP BY si.product_name, si.color, si.size ORDER BY ca_genere DESC`
      )
      .all(from, to);

    const caParJour = db
      .prepare(
        `SELECT strftime('%Y-%m-%d', s.created_at) AS jour,
                COALESCE(SUM(si.subtotal),0) AS ca,
                COALESCE(SUM(si.quantity * COALESCE(si.unit_cost, p.cost_price, 0)),0) AS cout,
                COALESCE(SUM(si.subtotal - si.quantity * COALESCE(si.unit_cost, p.cost_price, 0)),0) AS benefice
         FROM sale_items si
         JOIN sales s ON s.id = si.sale_id
         JOIN variants v ON v.id = si.variant_id
         JOIN products p ON p.id = v.product_id
         WHERE s.status = 'validee' AND s.created_at >= ? AND s.created_at <= ?
         GROUP BY jour ORDER BY jour ASC`
      )
      .all(from, to);

    const paiements = db
      .prepare(
        `SELECT payment_method, COUNT(*) AS nb, COALESCE(SUM(total),0) AS ca
         FROM sales WHERE status = 'validee' AND created_at >= ? AND created_at <= ?
         GROUP BY payment_method ORDER BY ca DESC`
      )
      .all(from, to);

    res.json({
      periode: { from, to },
      resume: {
        nb_ventes: resume.nb_ventes,
        ca: resume.ca,
        remises: resume.remises,
        cout: beneficeRow.cout,
        benefice: beneficeRow.benefice,
        panier_moyen: resume.nb_ventes ? resume.ca / resume.nb_ventes : 0
      },
      ventes,
      articles,
      produits,
      caParJour,
      paiements
    });
  });

  return router;
};
