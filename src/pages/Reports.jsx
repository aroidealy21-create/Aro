import React, { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { api, formatMoney } from '../lib/api';
import { useSettings } from '../lib/settingsContext.jsx';
import { useToast } from '../lib/toast.jsx';
import { paymentLabel } from '../lib/payments';
import { buildAndDownloadExcel } from '../lib/excelExport';

const PERIODS = [
  { key: 'day', label: 'Jour' },
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
  { key: 'year', label: 'Annee' }
];

const PIE_COLORS = ['#c81e2c', '#111114', '#6b6570', '#e3a13a', '#3a6ea5', '#7b2cbf', '#2a9d5c'];

function bucketLabel(period, bucket) {
  if (period === 'day') return `${bucket}h`;
  if (period === 'week' || period === 'month') return dayjs(bucket).format('DD/MM');
  return dayjs(`${bucket}-01`).format('MMM YYYY');
}

export default function Reports() {
  const [period, setPeriod] = useState('day');
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [ca, setCa] = useState(null);
  const [benefices, setBenefices] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const [worstProducts, setWorstProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [payments, setPayments] = useState([]);
  const [tailles, setTailles] = useState([]);
  const [heures, setHeures] = useState([]);
  const [canal, setCanal] = useState([]);
  const [onlineTop, setOnlineTop] = useState([]);
  const [exporting, setExporting] = useState(false);
  const { settings } = useSettings();
  const toast = useToast();

  useEffect(() => {
    api.get(`/reports/ca?period=${period}&date=${date}`).then(setCa).catch((e) => toast.error(e.message));
    api.get(`/reports/benefices?period=${period}&date=${date}`).then(setBenefices).catch(() => {});
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
    api.get(`/reports/tailles?from=${from}&to=${to}&order=desc`).then(setTailles).catch(() => {});
    api.get(`/reports/heures?from=${from}&to=${to}`).then(setHeures).catch(() => {});
    api.get(`/reports/canal?from=${from}&to=${to}`).then(setCanal).catch(() => {});
    api.get(`/reports/produits?from=${from}&to=${to}&limit=5&order=desc&payment_method=en_ligne`).then(setOnlineTop).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ca]);

  async function exportExcel() {
    if (!ca) return;
    setExporting(true);
    try {
      const data = await api.get(`/reports/export?from=${ca.start}&to=${ca.end}`);
      const periodLabel = `${PERIODS.find((p) => p.key === period).label} — ${dayjs(ca.start).format('DD/MM/YYYY')} au ${dayjs(ca.end).format('DD/MM/YYYY')}`;
      buildAndDownloadExcel(data, { shopName: settings.shop_name, currency: settings.currency, periodLabel });
      toast.success('Export Excel telecharge');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setExporting(false);
    }
  }

  const chartData = ca ? ca.rows.map((r) => ({ ...r, label: bucketLabel(period, r.bucket) })) : [];
  const beneficeChartData = benefices ? benefices.rows.map((r) => ({ ...r, label: bucketLabel(period, r.bucket) })) : [];
  const marge = benefices && benefices.totals.ca ? (benefices.totals.benefice / benefices.totals.ca) * 100 : 0;
  const heuresData = heures.map((h) => ({ ...h, label: `${h.heure}h` }));
  const enLigne = canal.find((c) => c.canal === 'en_ligne') || { nb_ventes: 0, ca: 0 };
  const boutique = canal.find((c) => c.canal === 'boutique') || { nb_ventes: 0, ca: 0 };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Rapports</h1>
          <div className="subtitle">Chiffre d'affaires, benefices et statistiques de ventes</div>
        </div>
        <button className="btn accent" onClick={exportExcel} disabled={exporting || !ca}>
          {exporting ? 'Preparation...' : <>&#128202; Exporter toute la compta (Excel)</>}
        </button>
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
          <div className="grid grid-4" style={{ marginBottom: 18 }}>
            <div className="stat-card">
              <div className="label">Chiffre d'affaires ({PERIODS.find((p) => p.key === period).label.toLowerCase()})</div>
              <div className="value">{formatMoney(ca.totals.ca, settings.currency)}</div>
              <div className="subtitle">{ca.totals.nb_ventes} vente(s)</div>
            </div>
            <div className="stat-card accent">
              <div className="label">Benefice</div>
              <div className="value">{formatMoney(benefices?.totals.benefice || 0, settings.currency)}</div>
              <div className="subtitle">Marge {marge.toFixed(1)}%</div>
            </div>
            <div className="stat-card">
              <div className="label">Panier moyen</div>
              <div className="value">
                {formatMoney(ca.totals.nb_ventes ? ca.totals.ca / ca.totals.nb_ventes : 0, settings.currency)}
              </div>
            </div>
            <div className="stat-card">
              <div className="label">Ventes en ligne</div>
              <div className="value">{formatMoney(enLigne.ca, settings.currency)}</div>
              <div className="subtitle">{enLigne.nb_ventes} vente(s) &middot; boutique {formatMoney(boutique.ca, settings.currency)}</div>
            </div>
          </div>

          <div className="grid grid-2" style={{ marginBottom: 18, alignItems: 'start' }}>
            <div className="card">
              <h3>Evolution du chiffre d'affaires</h3>
              {chartData.length === 0 ? (
                <p style={{ color: 'var(--ink-soft)' }}>Aucune vente sur cette periode.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => formatMoney(v, settings.currency)} />
                    <Bar dataKey="ca" fill="#111114" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="card">
              <h3>Evolution du benefice</h3>
              {beneficeChartData.length === 0 ? (
                <p style={{ color: 'var(--ink-soft)' }}>Aucune vente sur cette periode.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={beneficeChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v) => formatMoney(v, settings.currency)} />
                    <Bar dataKey="benefice" fill="#c81e2c" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
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

          <div className="grid grid-2" style={{ alignItems: 'start', marginBottom: 18 }}>
            <div className="card">
              <h3>Ventes par heure de la journee</h3>
              <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: -6 }}>Cumul sur la periode selectionnee</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={heuresData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={1} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip formatter={(v) => [`${v} vente(s)`, 'Ventes']} />
                  <Bar dataKey="nb_ventes" fill="#111114" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <h3>Tailles qui se vendent le mieux</h3>
              {tailles.length === 0 ? <p style={{ color: 'var(--ink-soft)' }}>Aucune donnee.</p> : (
                <table className="table">
                  <thead><tr><th>Taille</th><th>Quantite vendue</th><th>CA</th></tr></thead>
                  <tbody>
                    {tailles.map((t) => (
                      <tr key={t.size}>
                        <td><span className="badge">{t.size}</span></td>
                        <td>{t.quantite_vendue}</td>
                        <td>{formatMoney(t.ca_genere, settings.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="grid grid-2" style={{ alignItems: 'start', marginBottom: 18 }}>
            <div className="card">
              <h3>Boutique vs En ligne</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={[{ name: 'Boutique', value: boutique.ca }, { name: 'En ligne', value: enLigne.ca }]}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={80}
                    label={(d) => d.name}
                    isAnimationActive={false}
                  >
                    <Cell fill="#111114" />
                    <Cell fill="#c81e2c" />
                  </Pie>
                  <Tooltip formatter={(v) => formatMoney(v, settings.currency)} />
                </PieChart>
              </ResponsiveContainer>
              {onlineTop.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}>Meilleur vendeur en ligne</div>
                  <div style={{ fontSize: 13 }}>
                    {onlineTop[0].product_name} {onlineTop[0].color} {onlineTop[0].size} — {onlineTop[0].quantite_vendue} vendu(s)
                  </div>
                </div>
              )}
            </div>
            <div className="card">
              <h3>Ventes par categorie</h3>
              {categories.length === 0 ? <p style={{ color: 'var(--ink-soft)' }}>Aucune donnee.</p> : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={categories} dataKey="ca_genere" nameKey="category" outerRadius={80} label={(d) => d.category} isAnimationActive={false}>
                      {categories.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatMoney(v, settings.currency)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="card">
            <h3>Modes de paiement</h3>
            <table className="table">
              <thead><tr><th>Mode</th><th>Ventes</th><th>CA</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.payment_method}>
                    <td>{paymentLabel(p.payment_method)}</td>
                    <td>{p.nb}</td>
                    <td>{formatMoney(p.ca, settings.currency)}</td>
                  </tr>
                ))}
                {payments.length === 0 && <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>Aucune donnee</td></tr>}
              </tbody>
            </table>
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
      <thead><tr><th>Article</th><th>Qte</th><th>CA</th><th>Benefice</th></tr></thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>
              <div style={{ fontSize: 13 }}>{r.product_name}</div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{r.color} {r.size}</div>
            </td>
            <td>{r.quantite_vendue}</td>
            <td>{formatMoney(r.ca_genere, currency)}</td>
            <td>{formatMoney(r.benefice, currency)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
