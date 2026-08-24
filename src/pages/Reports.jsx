import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts';
import { api, formatMoney } from '../lib/api';
import { useSettings } from '../lib/settingsContext.jsx';
import { useToast } from '../lib/toast.jsx';

const PERIODS = [
  { key: 'day', label: 'Jour' },
  { key: 'month', label: 'Mois' },
  { key: 'year', label: 'Annee' }
];

const PIE_COLORS = ['#ff6b9b', '#d6336c', '#f4c430', '#2a9d5c', '#3a6ea5', '#7b2cbf', '#e08a1b'];

function bucketLabel(period, bucket) {
  if (period === 'day') return `${bucket}h`;
  if (period === 'month') return dayjs(bucket).format('DD/MM');
  return dayjs(`${bucket}-01`).format('MMM YYYY');
}

export default function Reports() {
  const [period, setPeriod] = useState('day');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [ca, setCa] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [worstProducts, setWorstProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [payments, setPayments] = useState([]);
  const { settings } = useSettings();
  const toast = useToast();

  useEffect(() => {
    api.get(`/reports/ca?period=${period}&date=${date}`).then(setCa).catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, date]);

  useEffect(() => {
    if (!ca) return;
    const from = ca.start;
    const to = ca.end;
    api.get(`/reports/produits?from=${from}&to=${to}&limit=10&order=desc`).then(setTopProducts).catch(() => {});
    api.get(`/reports/produits?from=${from}&to=${to}&limit=10&order=asc`).then(setWorstProducts).catch(() => {});
    api.get(`/reports/categories?from=${from}&to=${to}`).then(setCategories).catch(() => {});
    api.get(`/reports/paiements?from=${from}&to=${to}`).then(setPayments).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ca]);

  function exportCsv() {
    const rows = [['Article', 'Couleur', 'Taille', 'Quantite vendue', 'CA genere']];
    topProducts.forEach((p) => rows.push([p.product_name, p.color, p.size, p.quantite_vendue, p.ca_genere]));
    const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapport-${period}-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const chartData = ca ? ca.rows.map((r) => ({ ...r, label: bucketLabel(period, r.bucket) })) : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Rapports</h1>
          <div className="subtitle">Chiffre d'affaires et statistiques de ventes</div>
        </div>
        <button className="btn secondary" onClick={exportCsv}>&#11015;&#65039; Exporter en CSV</button>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="tabs" style={{ marginBottom: 0, border: 'none' }}>
            {PERIODS.map((p) => (
              <button key={p.key} className={`tab-btn ${period === p.key ? 'active' : ''}`} onClick={() => setPeriod(p.key)}>
                {p.label}
              </button>
            ))}
          </div>
          <input
            className="input"
            style={{ width: 180 }}
            type={period === 'year' ? 'number' : 'date'}
            value={period === 'year' ? dayjs(date).year() : date}
            onChange={(e) => {
              if (period === 'year') setDate(dayjs(date).year(Number(e.target.value)).format('YYYY-MM-DD'));
              else setDate(e.target.value);
            }}
          />
        </div>
      </div>

      {ca && (
        <>
          <div className="grid grid-2" style={{ marginBottom: 18 }}>
            <div className="stat-card">
              <div className="label">Chiffre d'affaires ({PERIODS.find((p) => p.key === period).label.toLowerCase()})</div>
              <div className="value">{formatMoney(ca.totals.ca, settings.currency)}</div>
              <div className="subtitle">{ca.totals.nb_ventes} vente(s)</div>
            </div>
            <div className="stat-card">
              <div className="label">Panier moyen</div>
              <div className="value">
                {formatMoney(ca.totals.nb_ventes ? ca.totals.ca / ca.totals.nb_ventes : 0, settings.currency)}
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 18 }}>
            <h3>Evolution du chiffre d'affaires</h3>
            {chartData.length === 0 ? (
              <p style={{ color: 'var(--ink-soft)' }}>Aucune vente sur cette periode.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(v) => formatMoney(v, settings.currency)} />
                  <Bar dataKey="ca" fill="#ff6b9b" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="grid grid-2" style={{ alignItems: 'start', marginBottom: 18 }}>
            <div className="card">
              <h3>&#127942; Meilleures ventes</h3>
              <RankTable rows={topProducts} currency={settings.currency} />
            </div>
            <div className="card">
              <h3>&#128202; Ventes les plus faibles</h3>
              <RankTable rows={worstProducts} currency={settings.currency} />
            </div>
          </div>

          <div className="grid grid-2" style={{ alignItems: 'start' }}>
            <div className="card">
              <h3>Ventes par categorie</h3>
              {categories.length === 0 ? <p style={{ color: 'var(--ink-soft)' }}>Aucune donnee.</p> : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={categories} dataKey="ca_genere" nameKey="category" outerRadius={90} label={(d) => d.category} isAnimationActive={false}>
                      {categories.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatMoney(v, settings.currency)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="card">
              <h3>Modes de paiement</h3>
              <table className="table">
                <thead><tr><th>Mode</th><th>Ventes</th><th>CA</th></tr></thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.payment_method}>
                      <td style={{ textTransform: 'capitalize' }}>{p.payment_method.replace('_', ' ')}</td>
                      <td>{p.nb}</td>
                      <td>{formatMoney(p.ca, settings.currency)}</td>
                    </tr>
                  ))}
                  {payments.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>Aucune donnee</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function RankTable({ rows, currency }) {
  if (rows.length === 0) return <p style={{ color: 'var(--ink-soft)' }}>Aucune donnee sur cette periode.</p>;
  return (
    <table className="table">
      <thead><tr><th>Article</th><th>Qte</th><th>CA</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>
              <div style={{ fontSize: 13 }}>{r.product_name}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{r.color} {r.size}</div>
            </td>
            <td>{r.quantite_vendue}</td>
            <td>{formatMoney(r.ca_genere, currency)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
