import React, { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';
import { api, formatMoney } from '../lib/api';
import { useToast } from '../lib/toast.jsx';
import { useSettings } from '../lib/settingsContext.jsx';
import { PAYMENT_METHODS, paymentLabel } from '../lib/payments';
import Receipt from '../components/Receipt.jsx';

export default function SalesHistory() {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [to, setTo] = useState(dayjs().format('YYYY-MM-DD'));
  const [paymentMethod, setPaymentMethod] = useState('');
  const [q, setQ] = useState('');
  const [detail, setDetail] = useState(null);
  const toast = useToast();
  const { settings } = useSettings();
  const printRef = useRef(null);

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set('from', `${from} 00:00:00`);
    if (to) params.set('to', `${to} 23:59:59`);
    if (paymentMethod) params.set('payment_method', paymentMethod);
    if (q) params.set('q', q);
    api.get(`/sales?${params.toString()}`).then(setSales).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  }

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, paymentMethod, q]);

  async function openDetail(sale) {
    try {
      const full = await api.get(`/sales/${sale.id}`);
      setDetail(full);
    } catch (e) {
      toast.error(e.message);
    }
  }

  async function voidSale(sale) {
    if (!confirm(`Annuler la vente ${sale.ticket_number} ? Le stock sera remis a jour.`)) return;
    try {
      await api.post(`/sales/${sale.id}/void`);
      toast.success('Vente annulee, stock remis a jour');
      setDetail(null);
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const totals = sales.reduce(
    (acc, s) => {
      if (s.status === 'validee') {
        acc.ca += s.total;
        acc.nb += 1;
      }
      return acc;
    },
    { ca: 0, nb: 0 }
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Historique des ventes</h1>
          <div className="subtitle">{totals.nb} vente(s) valide(s) &middot; {formatMoney(totals.ca, settings.currency)}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <label className="field" style={{ margin: 0 }}>
            Du
            <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="field" style={{ margin: 0 }}>
            Au
            <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
          <select className="input" style={{ width: 180 }} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            <option value="">Tous moyens de paiement</option>
            {PAYMENT_METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
          <div className="searchbar" style={{ flex: 1, minWidth: 180 }}>
            <span>&#128269;</span>
            <input placeholder="N° ticket, vendeur..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : sales.length === 0 ? (
        <div className="empty-state card">
          <div className="emoji">&#128722;</div>
          <p>Aucune vente sur cette periode.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="table">
            <thead>
              <tr>
                <th>Ticket</th>
                <th>Date</th>
                <th>Articles</th>
                <th>Paiement</th>
                <th>Vendeur</th>
                <th>Total</th>
                <th>Statut</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {sales.map((s) => (
                <tr key={s.id} style={{ cursor: 'pointer' }} onClick={() => openDetail(s)}>
                  <td>{s.ticket_number}</td>
                  <td style={{ fontSize: 12.5 }}>{new Date(s.created_at).toLocaleString('fr-FR')}</td>
                  <td>{s.nb_articles}</td>
                  <td>
                    <span className={`badge ${s.payment_method === 'en_ligne' ? 'neutral' : 'success'}`}>
                      {paymentLabel(s.payment_method)}
                    </span>
                  </td>
                  <td>{s.seller || '-'}</td>
                  <td style={{ fontWeight: 700 }}>{formatMoney(s.total, settings.currency)}</td>
                  <td>
                    {s.status === 'annulee' ? <span className="badge danger">Annulee</span> : <span className="badge success">Validee</span>}
                  </td>
                  <td>
                    <button className="btn ghost small" onClick={(e) => { e.stopPropagation(); openDetail(s); }}>Voir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div id="print-area" ref={printRef}>
              <Receipt sale={detail} settings={settings} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
              <button className="btn wide" onClick={() => window.print()}>&#128424;&#65039; Reimprimer</button>
              {detail.status !== 'annulee' && (
                <button className="btn danger wide" onClick={() => voidSale(detail)}>Annuler la vente</button>
              )}
              <button className="btn secondary wide" onClick={() => setDetail(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
