import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, photoUrl, formatMoney } from '../lib/api';
import { useToast } from '../lib/toast.jsx';
import { useSettings } from '../lib/settingsContext.jsx';
import { colorSwatch } from '../lib/colors';

export default function Inventory() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [categories, setCategories] = useState([]);
  const toast = useToast();
  const { settings } = useSettings();

  function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    if (lowStockOnly) params.set('lowstock', '1');
    api
      .get(`/products?${params.toString()}`)
      .then(setProducts)
      .catch((e) => toast.error(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    api.get('/products/categories').then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, category, lowStockOnly]);

  async function handleDelete(p) {
    if (!confirm(`Retirer "${p.name}" de l'inventaire actif ?`)) return;
    try {
      await api.delete(`/products/${p.id}`);
      toast.success('Article retire');
      load();
    } catch (e) {
      toast.error(e.message);
    }
  }

  const totalPieces = useMemo(
    () => products.reduce((sum, p) => sum + p.variants.reduce((s, v) => s + v.quantity, 0), 0),
    [products]
  );

  const showGrouped = !category && !q && !lowStockOnly;
  const groupedProducts = useMemo(() => {
    if (!showGrouped) return null;
    const groups = new Map();
    products.forEach((p) => {
      const key = p.category || 'Sans categorie';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(p);
    });
    return [...groups.entries()].sort((a, b) => {
      if (a[0] === 'Sans categorie') return 1;
      if (b[0] === 'Sans categorie') return -1;
      return a[0].localeCompare(b[0], 'fr');
    });
  }, [products, showGrouped]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Inventaire</h1>
          <div className="subtitle">{products.length} article(s) &middot; {totalPieces} piece(s) en stock</div>
        </div>
        <Link to="/inventaire/nouveau" className="btn">+ Nouvel article</Link>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="searchbar" style={{ flex: 1, minWidth: 220 }}>
            <span>&#128269;</span>
            <input placeholder="Rechercher un article..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="input" style={{ width: 200 }} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Toutes categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <label className="tag-pill" style={{ userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              style={{ marginRight: 4 }}
            />
            Stock bas uniquement
          </label>
        </div>
      </div>

      {loading ? (
        <div className="spinner" />
      ) : products.length === 0 ? (
        <div className="empty-state card">
          <div className="emoji">&#128717;&#65039;</div>
          <p>Aucun article trouve. Ajoutez votre premier article !</p>
          <Link to="/inventaire/nouveau" className="btn">+ Nouvel article</Link>
        </div>
      ) : showGrouped ? (
        groupedProducts.map(([cat, items]) => (
          <div key={cat} className="pos-category-section">
            <div className="pos-category-heading">
              <h4>{cat}</h4>
              <span className="count">{items.length} article{items.length > 1 ? 's' : ''}</span>
            </div>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
              {items.map((p) => (
                <InventoryCard key={p.id} product={p} currency={settings.currency} onDelete={handleDelete} />
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {products.map((p) => (
            <InventoryCard key={p.id} product={p} currency={settings.currency} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function InventoryCard({ product: p, currency, onDelete }) {
  const totalQty = p.variants.reduce((s, v) => s + v.quantity, 0);
  const isLow = p.variants.some((v) => v.quantity <= v.alert_threshold);
  return (
    <div className="card" style={{ padding: 12 }}>
      <Link to={`/inventaire/${p.id}`}>
        {p.photo ? (
          <img className="product-photo" src={photoUrl(p.photo)} alt={p.name} loading="lazy" />
        ) : (
          <div className="product-photo placeholder">&#128092;</div>
        )}
      </Link>
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
          <Link to={`/inventaire/${p.id}`} style={{ color: 'inherit' }}>
            <strong style={{ fontSize: 14 }}>{p.name}</strong>
          </Link>
          {isLow && <span className="badge warning">Stock bas</span>}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{p.category || 'Sans categorie'}</div>
        <div style={{ fontWeight: 700, color: 'var(--pink-dark)', marginTop: 4 }}>
          {formatMoney(p.sale_price, currency)}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
          {[...new Set(p.variants.map((v) => v.color))].filter(Boolean).slice(0, 6).map((c) => (
            <span key={c} className="swatch" title={c} style={{ background: colorSwatch(c) || '#ddd' }} />
          ))}
        </div>
        <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 6 }}>
          {totalQty} piece(s) &middot; {p.variants.length} variante(s)
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          <Link to={`/inventaire/${p.id}`} className="btn secondary small" style={{ flex: 1, justifyContent: 'center' }}>
            Modifier
          </Link>
          <button className="btn ghost small" onClick={() => onDelete(p)}>Retirer</button>
        </div>
      </div>
    </div>
  );
}
