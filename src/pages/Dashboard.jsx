import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api, photoUrl, formatMoney } from '../lib/api';
import { useSettings } from '../lib/settingsContext.jsx';
import { useToast } from '../lib/toast.jsx';

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [topProducts, setTopProducts] = useState([]);
  const { settings } = useSettings();
  const toast = useToast();

  useEffect(() => {
    api.get('/reports/summary').then(setSummary).catch((e) => toast.error(e.message));
    api.get('/reports/produits?limit=6').then(setTopProducts).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const delta = summary && summary.yesterday.ca > 0
    ? Math.round(((summary.today.ca - summary.yesterday.ca) / summary.yesterday.ca) * 100)
    : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Tableau de bord</h1>
          <div className="subtitle">Vue d'ensemble de {settings.shop_name || 'votre boutique'}</div>
        </div>
        <Link to="/vente" className="btn">&#128722; Ouvrir la caisse</Link>
      </div>

      {!summary ? (
        <div className="spinner" />
      ) : (
        <>
          <div className="grid grid-4">
            <div className="stat-card">
              <div className="label">CA aujourd'hui</div>
              <div className="value">{formatMoney(summary.today.ca, settings.currency)}</div>
              <div className="subtitle">{summary.today.nb_ventes} vente(s)</div>
              {delta !== null && (
                <div className={`delta ${delta >= 0 ? 'up' : 'down'}`}>
                  {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}% vs hier
                </div>
              )}
            </div>
            <div className="stat-card">
              <div className="label">CA du mois</div>
              <div className="value">{formatMoney(summary.month.ca, settings.currency)}</div>
              <div className="subtitle">{summary.month.nb_ventes} vente(s)</div>
            </div>
            <div className="stat-card">
              <div className="label">CA de l'annee</div>
              <div className="value">{formatMoney(summary.year.ca, settings.currency)}</div>
              <div className="subtitle">{summary.year.nb_ventes} vente(s)</div>
            </div>
            <div className="stat-card">
              <div className="label">Valeur du stock</div>
              <div className="value">{formatMoney(summary.stockValue.value_sale, settings.currency)}</div>
              <div className="subtitle">{summary.stockValue.total_pieces} piece(s)</div>
            </div>
          </div>

          <div className="grid grid-2" style={{ marginTop: 18, alignItems: 'start' }}>
            <div className="card">
              <h3>Articles les plus vendus</h3>
              {topProducts.length === 0 ? (
                <p style={{ color: 'var(--ink-soft)' }}>Pas encore de ventes enregistrees.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={topProducts}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="product_name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => [`${v} vendu(s)`, 'Quantite']} />
                    <Bar dataKey="quantite_vendue" fill="#ff6b9b" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              )}
              <Link to="/rapports" className="btn secondary small" style={{ marginTop: 10 }}>Voir tous les rapports</Link>
            </div>

            <div className="card">
              <h3>Alertes stock bas</h3>
              {summary.lowStock.length === 0 ? (
                <p style={{ color: 'var(--ink-soft)' }}>Aucune alerte, tout va bien ! &#127881;</p>
              ) : (
                <div>
                  {summary.lowStock.map((v) => (
                    <div className="low-stock-row" key={v.id}>
                      {v.photo ? (
                        <img src={photoUrl(v.photo)} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover' }} />
                      ) : (
                        <div className="product-photo placeholder" style={{ width: 36, height: 36 }}>&#128092;</div>
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{v.product_name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{v.color} {v.size}</div>
                      </div>
                      <span className="badge danger">{v.quantity} restant(s)</span>
                    </div>
                  ))}
                </div>
              )}
              <Link to="/reception" className="btn secondary small" style={{ marginTop: 10 }}>Reapprovisionner</Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
