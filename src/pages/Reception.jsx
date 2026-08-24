import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, photoUrl } from '../lib/api';
import { useToast } from '../lib/toast.jsx';
import { colorSwatch } from '../lib/colors';

export default function Reception() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 900;

  function loadMovements() {
    api.get('/stock/movements?limit=25').then(setMovements).catch(() => {});
  }

  useEffect(() => { loadMovements(); }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!q.trim()) { setResults([]); return; }
      api.get(`/stock/variants?q=${encodeURIComponent(q)}`).then(setResults).catch(() => {});
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selected) return toast.error('Selectionnez un article');
    const qty = Number(quantity);
    if (!qty || qty <= 0) return toast.error('Quantite invalide');
    setLoading(true);
    try {
      await api.post('/stock/reception', {
        variant_id: selected.id,
        quantity: qty,
        note,
        source: isSmallScreen ? 'tablette' : 'pc'
      });
      toast.success(`+${qty} ajoute a ${selected.product_name} (${selected.color || ''} ${selected.size || ''})`);
      setSelected(null);
      setQ('');
      setResults([]);
      setQuantity(1);
      setNote('');
      loadMovements();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Reception de stock</h1>
          <div className="subtitle">Ajoutez les quantites recues pour un article deja existant</div>
        </div>
      </div>

      <div className="mobile-banner">
        &#128241; Cette page fonctionne aussi depuis la tablette : connectez-la au Wi-Fi de la boutique et ouvrez l'adresse indiquee dans <Link to="/parametres">Parametres</Link>.
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h3>1. Rechercher l'article</h3>
          <div className="searchbar">
            <span>&#128269;</span>
            <input
              autoFocus
              placeholder="Nom de l'article, couleur, taille..."
              value={q}
              onChange={(e) => { setQ(e.target.value); setSelected(null); }}
            />
          </div>

          {results.length > 0 && !selected && (
            <div style={{ marginTop: 10, maxHeight: 340, overflowY: 'auto' }}>
              {results.map((v) => (
                <div
                  key={v.id}
                  className="low-stock-row"
                  style={{ cursor: 'pointer' }}
                  onClick={() => setSelected(v)}
                >
                  {v.photo ? (
                    <img src={photoUrl(v.photo)} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8 }} />
                  ) : (
                    <div className="product-photo placeholder" style={{ width: 40, height: 40 }}>&#128092;</div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13.5 }}>{v.product_name}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink-soft)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span className="swatch" style={{ background: colorSwatch(v.color) || '#ddd' }} />
                      {v.color || 'Sans couleur'} &middot; {v.size || 'Taille unique'} &middot; stock actuel : {v.quantity}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {selected && (
            <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
              <div className="card" style={{ background: 'var(--pink-light)', border: 'none', marginBottom: 14 }}>
                <strong>{selected.product_name}</strong>
                <div style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
                  {selected.color || 'Sans couleur'} &middot; {selected.size || 'Taille unique'} &middot; SKU {selected.sku}
                </div>
                <div style={{ marginTop: 4 }}>Stock actuel : <strong>{selected.quantity}</strong></div>
                <button type="button" className="btn ghost small" style={{ marginTop: 8 }} onClick={() => setSelected(null)}>Changer d'article</button>
              </div>
              <label className="field">
                Quantite recue *
                <input className="input" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
              </label>
              <label className="field">
                Note (fournisseur, reference...)
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex: Livraison fournisseur Antananarivo" />
              </label>
              <button className="btn wide" type="submit" disabled={loading}>
                {loading ? 'Ajout en cours...' : `Confirmer +${quantity || 0} en stock`}
              </button>
            </form>
          )}
        </div>

        <div className="card">
          <h3>Derniers mouvements</h3>
          <table className="table">
            <thead>
              <tr><th>Date</th><th>Article</th><th>Type</th><th>Qte</th></tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontSize: 12 }}>{m.created_at.slice(5, 16).replace('T', ' ')}</td>
                  <td>
                    <div style={{ fontSize: 13 }}>{m.product_name}</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{m.color} {m.size}</div>
                  </td>
                  <td>
                    <span className={`badge ${m.type === 'reception' ? 'success' : m.type === 'vente' ? 'neutral' : 'warning'}`}>
                      {m.type}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: m.quantity > 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                  </td>
                </tr>
              ))}
              {movements.length === 0 && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>Aucun mouvement</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
