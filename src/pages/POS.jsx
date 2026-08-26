import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api, photoUrl, formatMoney } from '../lib/api';
import { useToast } from '../lib/toast.jsx';
import { useSettings } from '../lib/settingsContext.jsx';
import { colorSwatch } from '../lib/colors';
import { PAYMENT_METHODS } from '../lib/payments';
import Receipt from '../components/Receipt.jsx';

export default function POS() {
  const [products, setProducts] = useState([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
  const [variantPicker, setVariantPicker] = useState(null); // product being picked
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState('amount'); // 'amount' | 'percent'
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
    setDiscountType('amount');
    setAmountReceived('');
  }

  const showGrouped = !category && !q;
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

  function scrollToCategory(cat) {
    const el = document.getElementById(`cat-${cat}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const total = useMemo(() => cart.reduce((s, it) => s + it.unit_price * it.quantity, 0), [cart]);
  const discountAmount = discountType === 'percent'
    ? Math.round((total * (Number(discount) || 0)) / 100)
    : Number(discount) || 0;
  const finalTotal = Math.max(0, total - discountAmount);
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
        discount: discountAmount,
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
          <div className="searchbar" style={{ marginBottom: 10 }}>
            <span>&#128269;</span>
            <input placeholder="Rechercher un article..." value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          <div className="category-chips">
            <button
              type="button"
              className={`tag-pill ${!category ? 'active' : ''}`}
              onClick={() => setCategory('')}
            >
              Toutes categories
            </button>
            {categories.map((c) => (
              <button
                type="button"
                key={c}
                className={`tag-pill ${category === c ? 'active' : ''}`}
                onClick={() => {
                  if (showGrouped) { setCategory(''); setTimeout(() => scrollToCategory(c), 50); }
                  else setCategory(category === c ? '' : c);
                }}
              >
                {c}
              </button>
            ))}
          </div>

          {showGrouped ? (
            groupedProducts.length === 0 ? (
              <div className="empty-state">Aucun article disponible</div>
            ) : (
              groupedProducts.map(([cat, items]) => (
                <div key={cat} id={`cat-${cat}`} className="pos-category-section">
                  <div className="pos-category-heading">
                    <h4>{cat}</h4>
                    <span className="count">{items.length} article{items.length > 1 ? 's' : ''}</span>
                  </div>
                  <div className="pos-grid">
                    {items.map((p) => (
                      <ProductCard key={p.id} product={p} currency={settings.currency} onClick={() => openProduct(p)} />
                    ))}
                  </div>
                </div>
              ))
            )
          ) : (
            <div className="pos-grid">
              {products.map((p) => (
                <ProductCard key={p.id} product={p} currency={settings.currency} onClick={() => openProduct(p)} />
              ))}
              {products.length === 0 && (
                <div className="empty-state" style={{ gridColumn: '1/-1' }}>Aucun article ne correspond</div>
              )}
            </div>
          )}
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
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  className="input"
                  type="number"
                  min="0"
                  style={{ width: 90, textAlign: 'right' }}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
                <div className="discount-type-toggle">
                  <button
                    type="button"
                    className={discountType === 'amount' ? 'active' : ''}
                    onClick={() => setDiscountType('amount')}
                  >
                    {settings.currency || 'Ar'}
                  </button>
                  <button
                    type="button"
                    className={discountType === 'percent' ? 'active' : ''}
                    onClick={() => setDiscountType('percent')}
                  >
                    %
                  </button>
                </div>
              </div>
            </div>
            {discountAmount > 0 && (
              <div className="cart-total-row" style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>
                <span>Remise appliquee</span>
                <span>-{formatMoney(discountAmount, settings.currency)}</span>
              </div>
            )}
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

            <button className="btn accent wide" style={{ marginTop: 8 }} disabled={loading || cart.length === 0} onClick={validateSale}>
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

function ProductCard({ product, currency, onClick }) {
  const totalQty = product.variants.reduce((s, v) => s + v.quantity, 0);
  return (
    <div className="pos-product-card" onClick={onClick}>
      {product.photo ? (
        <img className="product-photo" src={photoUrl(product.photo)} alt={product.name} loading="lazy" />
      ) : (
        <div className="product-photo placeholder">&#128092;</div>
      )}
      <div className="name">{product.name}</div>
      <div className="price">{formatMoney(product.sale_price, currency)}</div>
      <div className="stock">{totalQty} en stock &middot; {product.variants.length} var.</div>
    </div>
  );
}
