import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api, photoUrl, formatMoney } from '../lib/api';
import { useToast } from '../lib/toast.jsx';
import { useSettings } from '../lib/settingsContext.jsx';
import { colorSwatch } from '../lib/colors';

const PAYMENT_METHODS = [
  { key: 'especes', label: 'Especes', icon: '\u{1F4B5}' },
  { key: 'mvola', label: 'Mvola', icon: '\u{1F4F1}' },
  { key: 'orange_money', label: 'Orange Money', icon: '\u{1F4F1}' },
  { key: 'airtel_money', label: 'Airtel Money', icon: '\u{1F4F1}' },
  { key: 'carte', label: 'Carte bancaire', icon: '\u{1F4B3}' }
];

export default function POS() {
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [variantPicker, setVariantPicker] = useState(null); // product being picked
  const [discount, setDiscount] = useState(0);
  const [payment, setPayment] = useState('especes');
  const [amountReceived, setAmountReceived] = useState('');
  const [seller, setSeller] = useState('');
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();
  const { settings } = useSettings();
  const printRef = useRef(null);

  function loadProducts() {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    api.get(`/products?${params.toString()}`).then((data) => {
      setProducts(data.filter((p) => p.variants.some((v) => v.quantity > 0) || p.variants.length === 0));
    }).catch((e) => toast.error(e.message));
  }

  useEffect(() => {
    api.get('/products/categories').then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    const t = setTimeout(loadProducts, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, category]);

  function openProduct(p) {
    if (p.variants.length === 0) {
      toast.error('Cet article n’a pas de variante avec stock');
      return;
    }
    if (p.variants.length === 1) {
      addToCart(p, p.variants[0]);
      return;
    }
    setVariantPicker(p);
  }

  function addToCart(product, variant) {
    if (variant.quantity <= 0) {
      toast.error('Rupture de stock pour cette variante');
      return;
    }
    setCart((c) => {
      const existing = c.find((it) => it.variant_id === variant.id);
      const price = variant.price_override ?? product.sale_price;
      if (existing) {
        if (existing.quantity + 1 > variant.quantity) {
          toast.error('Stock insuffisant');
          return c;
        }
        return c.map((it) => (it.variant_id === variant.id ? { ...it, quantity: it.quantity + 1 } : it));
      }
      return [...c, {
        variant_id: variant.id,
        product_name: product.name,
        color: variant.color,
        size: variant.size,
        unit_price: price,
        quantity: 1,
        max_stock: variant.quantity,
        photo: product.photo
      }];
    });
    setVariantPicker(null);
  }

  function changeQty(variantId, delta) {
    setCart((c) => c.map((it) => {
      if (it.variant_id !== variantId) return it;
      const next = it.quantity + delta;
      if (next <= 0) return it;
      if (next > it.max_stock) { toast.error('Stock insuffisant'); return it; }
      return { ...it, quantity: next };
    }));
  }

  function removeItem(variantId) {
    setCart((c) => c.filter((it) => it.variant_id !== variantId));
  }

  function clearCart() {
    setCart([]);
    setDiscount(0);
    setAmountReceived('');
  }

  const total = useMemo(() => cart.reduce((s, it) => s + it.unit_price * it.quantity, 0), [cart]);
  const finalTotal = Math.max(0, total - (Number(discount) || 0));
  const change = payment === 'especes' && amountReceived ? Math.max(0, Number(amountReceived) - finalTotal) : null;

  async function validateSale() {
    if (cart.length === 0) return toast.error('Le panier est vide');
    if (payment === 'especes' && amountReceived && Number(amountReceived) < finalTotal) {
      return toast.error('Montant recu insuffisant');
    }
    setLoading(true);
    try {
      const sale = await api.post('/sales', {
        items: cart.map((it) => ({ variant_id: it.variant_id, quantity: it.quantity, unit_price: it.unit_price })),
        payment_method: payment,
        discount: Number(discount) || 0,
        amount_received: payment === 'especes' ? (amountReceived || finalTotal) : null,
        seller
      });
      setReceipt(sale);
      clearCart();
      loadProducts();
      toast.success(`Vente enregistree - Ticket ${sale.ticket_number}`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Caisse</h1>
          <div className="subtitle">Enregistrez les ventes en temps reel</div>
        </div>
      </div>

      <div className="pos-layout">
        <div className="pos-catalog">
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
            <div className="searchbar" style={{ flex: 1, minWidth: 200 }}>
              <span>&#128269;</span>
              <input placeholder="Rechercher un article..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <select className="input" style={{ width: 180 }} value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="">Toutes categories</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="pos-grid">
            {products.map((p) => {
              const totalQty = p.variants.reduce((s, v) => s + v.quantity, 0);
              return (
                <div key={p.id} className="pos-product-card" onClick={() => openProduct(p)}>
                  {p.photo ? (
                    <img className="product-photo" src={photoUrl(p.photo)} alt={p.name} />
                  ) : (
                    <div className="product-photo placeholder">&#128092;</div>
                  )}
                  <div className="name">{p.name}</div>
                  <div className="price">{formatMoney(p.sale_price, settings.currency)}</div>
                  <div className="stock">{totalQty} en stock &middot; {p.variants.length} var.</div>
                </div>
              );
            })}
            {products.length === 0 && (
              <div className="empty-state" style={{ gridColumn: '1/-1' }}>Aucun article disponible</div>
            )}
          </div>
        </div>

        <div className="cart-panel">
          <div style={{ padding: '14px 14px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Panier ({cart.length})</h3>
            {cart.length > 0 && <button className="btn ghost small" onClick={clearCart}>Vider</button>}
          </div>
          <div className="cart-items">
            {cart.length === 0 && <div className="empty-state">Cliquez sur un article pour l'ajouter</div>}
            {cart.map((it) => (
              <div className="cart-item" key={it.variant_id}>
                {it.photo ? (
                  <img src={photoUrl(it.photo)} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover' }} />
                ) : (
                  <div className="product-photo placeholder" style={{ width: 38, height: 38 }}>&#128092;</div>
                )}
                <div className="info">
                  <div className="name">{it.product_name}</div>
                  <div className="meta">
                    <span className="swatch" style={{ background: colorSwatch(it.color) || '#ddd', marginRight: 4 }} />
                    {it.color || ''} {it.size || ''} &middot; {formatMoney(it.unit_price, settings.currency)}
                  </div>
                </div>
                <div className="qty-stepper">
                  <button onClick={() => changeQty(it.variant_id, -1)}>-</button>
                  <span>{it.quantity}</span>
                  <button onClick={() => changeQty(it.variant_id, 1)}>+</button>
                </div>
                <button className="btn ghost small" onClick={() => removeItem(it.variant_id)}>&#10005;</button>
              </div>
            ))}
          </div>
          <div className="cart-footer">
            <div className="cart-total-row">
              <span>Sous-total</span>
              <span>{formatMoney(total, settings.currency)}</span>
            </div>
            <div className="cart-total-row" style={{ alignItems: 'center' }}>
              <span>Remise</span>
              <input
                className="input"
                type="number"
                min="0"
                style={{ width: 110, textAlign: 'right' }}
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
              />
            </div>
            <div className="cart-total-row grand">
              <span>Total</span>
              <span>{formatMoney(finalTotal, settings.currency)}</span>
            </div>

            <div className="payment-methods">
              {PAYMENT_METHODS.map((m) => (
                <button
                  type="button"
                  key={m.key}
                  className={`tag-pill ${payment === m.key ? 'active' : ''}`}
                  style={{ justifyContent: 'center' }}
                  onClick={() => setPayment(m.key)}
                >
                  {m.icon} {m.label}
                </button>
              ))}
            </div>

            {payment === 'especes' && (
              <label className="field">
                Montant recu
                <input className="input" type="number" min="0" value={amountReceived} onChange={(e) => setAmountReceived(e.target.value)} placeholder={String(finalTotal)} />
              </label>
            )}
            {change !== null && (
              <div className="cart-total-row"><span>Monnaie a rendre</span><strong>{formatMoney(change, settings.currency)}</strong></div>
            )}

            <button className="btn wide" style={{ marginTop: 8 }} disabled={loading || cart.length === 0} onClick={validateSale}>
              {loading ? 'Validation...' : `Encaisser ${formatMoney(finalTotal, settings.currency)}`}
            </button>
          </div>
        </div>
      </div>

      {variantPicker && (
        <div className="modal-backdrop" onClick={() => setVariantPicker(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>{variantPicker.name}</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>Choisissez la couleur / taille</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {variantPicker.variants.map((v) => (
                <button
                  key={v.id}
                  className="btn secondary"
                  style={{ justifyContent: 'space-between' }}
                  disabled={v.quantity <= 0}
                  onClick={() => addToCart(variantPicker, v)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="swatch" style={{ background: colorSwatch(v.color) || '#ddd' }} />
                    {v.color || 'Sans couleur'} {v.size ? `- ${v.size}` : ''}
                  </span>
                  <span>{v.quantity <= 0 ? 'Rupture' : `${v.quantity} dispo`}</span>
                </button>
              ))}
            </div>
            <button className="btn ghost block" style={{ marginTop: 12 }} onClick={() => setVariantPicker(null)}>Fermer</button>
          </div>
        </div>
      )}

      {receipt && (
        <div className="modal-backdrop" onClick={() => setReceipt(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div id="print-area" ref={printRef}>
              <Receipt sale={receipt} settings={settings} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button className="btn wide" onClick={handlePrint}>&#128424;&#65039; Imprimer le ticket</button>
              <button className="btn secondary wide" onClick={() => setReceipt(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Receipt({ sale, settings }) {
  return (
    <div className="receipt">
      <div className="center">
        <strong>{settings.shop_name || 'Teens Fashion by Di'}</strong><br />
        {settings.shop_address}<br />
        {settings.shop_phone}
      </div>
      <hr />
      <div>Ticket : {sale.ticket_number}</div>
      <div>Date : {new Date(sale.created_at).toLocaleString('fr-FR')}</div>
      {sale.seller && <div>Vendeur : {sale.seller}</div>}
      <hr />
      {sale.items.map((it) => (
        <div key={it.id}>
          <div>{it.product_name} {it.color} {it.size}</div>
          <div className="row">
            <span>{it.quantity} x {formatMoney(it.unit_price, settings.currency)}</span>
            <span>{formatMoney(it.subtotal, settings.currency)}</span>
          </div>
        </div>
      ))}
      <hr />
      {sale.discount > 0 && (
        <div className="row"><span>Remise</span><span>-{formatMoney(sale.discount, settings.currency)}</span></div>
      )}
      <div className="row"><strong>TOTAL</strong><strong>{formatMoney(sale.total, settings.currency)}</strong></div>
      <div className="row"><span>Paiement</span><span>{sale.payment_method}</span></div>
      {sale.amount_received != null && (
        <div className="row"><span>Recu</span><span>{formatMoney(sale.amount_received, settings.currency)}</span></div>
      )}
      {sale.change_given != null && (
        <div className="row"><span>Monnaie</span><span>{formatMoney(sale.change_given, settings.currency)}</span></div>
      )}
      <hr />
      <div className="center">{settings.receipt_footer || 'Merci de votre visite !'}</div>
    </div>
  );
}
