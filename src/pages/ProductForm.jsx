import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { api, photoUrl } from '../lib/api';
import { useToast } from '../lib/toast.jsx';
import { colorSwatch, KNOWN_COLORS, COMMON_SIZES } from '../lib/colors';
import { LockedField } from '../components/Locked.jsx';

const emptyVariant = () => ({ color: '', size: '', quantity: 0, alert_threshold: 3 });

export default function ProductForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [existingPhoto, setExistingPhoto] = useState('');
  const [variants, setVariants] = useState([emptyVariant()]);
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [newVariant, setNewVariant] = useState(emptyVariant());

  useEffect(() => {
    api.get('/products/categories').then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/products/${id}`)
      .then((p) => {
        setName(p.name);
        setCategory(p.category || '');
        setDescription(p.description || '');
        setCostPrice(p.cost_price ?? '');
        setSalePrice(p.sale_price ?? '');
        setExistingPhoto(p.photo || '');
        setVariants(p.variants && p.variants.length ? p.variants : []);
      })
      .catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function updateDraftVariant(idx, patch) {
    setVariants((vs) => vs.map((v, i) => (i === idx ? { ...v, ...patch } : v)));
  }

  function removeDraftVariant(idx) {
    setVariants((vs) => vs.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return toast.error('Le nom est obligatoire');
    if (!isEdit && variants.filter((v) => v.color || v.size).length === 0) {
      if (!confirm('Aucune couleur/taille ajoutee. Continuer sans variante ?')) return;
    }
    setSaving(true);
    try {
      const form = new FormData();
      form.append('name', name.trim());
      form.append('category', category.trim());
      form.append('description', description);
      form.append('cost_price', costPrice || 0);
      form.append('sale_price', salePrice || 0);
      if (photoFile) form.append('photo', photoFile);

      if (isEdit) {
        await api.putForm(`/products/${id}`, form);
        toast.success('Article mis a jour');
      } else {
        form.append('variants', JSON.stringify(variants.map((v) => ({
          color: v.color, size: v.size, quantity: Number(v.quantity) || 0, alert_threshold: Number(v.alert_threshold) || 3
        }))));
        const created = await api.postForm('/products', form);
        toast.success('Article cree');
        navigate(`/inventaire/${created.id}`);
        return;
      }
      navigate('/inventaire');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleAddVariantExisting() {
    if (!newVariant.color && !newVariant.size) return toast.error('Indiquez au moins une couleur ou une taille');
    try {
      const v = await api.post(`/products/${id}/variants`, newVariant);
      setVariants((vs) => [...vs, v]);
      setNewVariant(emptyVariant());
      toast.success('Variante ajoutee');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleUpdateVariantExisting(v) {
    try {
      // On n'envoie que les champs reellement edites par ce tableau : ne jamais renvoyer
      // price_override ici, sous peine d'ecraser le prix particulier de la variante.
      const { color, size, alert_threshold } = v;
      const updated = await api.put(`/products/variants/${v.id}`, { color, size, alert_threshold });
      setVariants((vs) => vs.map((x) => (x.id === v.id ? updated : x)));
      toast.success('Variante mise a jour');
    } catch (err) {
      toast.error(err.message);
    }
  }

  async function handleDeleteVariantExisting(v) {
    if (!confirm(`Supprimer la variante ${v.color || ''} ${v.size || ''} ?`)) return;
    try {
      await api.delete(`/products/variants/${v.id}`);
      setVariants((vs) => vs.filter((x) => x.id !== v.id));
      toast.success('Variante supprimee');
    } catch (err) {
      toast.error(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{isEdit ? 'Modifier l’article' : 'Nouvel article'}</h1>
          <div className="subtitle"><Link to="/inventaire">&larr; Retour a l'inventaire</Link></div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <h3>Informations generales</h3>
            <label className="field">
              Nom de l'article *
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: T-shirt oversize" required />
            </label>
            <label className="field">
              Categorie
              <input className="input" list="categories-list" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Ex: T-shirts, Pantalons, Robes..." />
              <datalist id="categories-list">
                {categories.map((c) => <option key={c} value={c} />)}
              </datalist>
            </label>
            <label className="field">
              Description
              <textarea className="input" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <div className="grid grid-2">
              <LockedField label="Prix d'achat (cout)">
                <label className="field">
                  Prix d'achat (cout)
                  <input className="input" type="number" min="0" step="any" value={costPrice} onChange={(e) => setCostPrice(e.target.value)} />
                </label>
              </LockedField>
              <label className="field">
                Prix de vente *
                <input className="input" type="number" min="0" step="any" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} required />
              </label>
            </div>
          </div>

          <div className="card">
            <h3>Photo</h3>
            <div style={{ marginBottom: 10 }}>
              {photoPreview ? (
                <img src={photoPreview} className="product-photo" alt="apercu" style={{ maxWidth: 220 }} />
              ) : existingPhoto ? (
                <img src={photoUrl(existingPhoto)} className="product-photo" alt="actuelle" style={{ maxWidth: 220 }} />
              ) : (
                <div className="product-photo placeholder" style={{ maxWidth: 220 }}>&#128247;</div>
              )}
            </div>
            <input type="file" accept="image/*" onChange={handlePhotoChange} />
            <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 8 }}>
              Astuce : prenez la photo directement depuis la tablette pour un article ajoute en boutique.
            </p>
          </div>
        </div>

        {!isEdit && (
          <div className="card" style={{ marginTop: 16 }}>
            <h3>Couleurs / Tailles disponibles</h3>
            <p style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Ajoutez une ligne par combinaison couleur + taille, avec la quantite en stock.</p>
            <table className="table">
              <thead>
                <tr><th>Couleur</th><th>Taille</th><th>Quantite</th><th>Alerte stock bas</th><th></th></tr>
              </thead>
              <tbody>
                {variants.map((v, idx) => (
                  <tr key={idx}>
                    <td>
                      <input className="input" list="known-colors" value={v.color} onChange={(e) => updateDraftVariant(idx, { color: e.target.value })} placeholder="Rouge" />
                    </td>
                    <td>
                      <input className="input" list="known-sizes" value={v.size} onChange={(e) => updateDraftVariant(idx, { size: e.target.value })} placeholder="M" />
                    </td>
                    <td style={{ width: 100 }}>
                      <input className="input" type="number" min="0" value={v.quantity} onChange={(e) => updateDraftVariant(idx, { quantity: e.target.value })} />
                    </td>
                    <td style={{ width: 100 }}>
                      <input className="input" type="number" min="0" value={v.alert_threshold} onChange={(e) => updateDraftVariant(idx, { alert_threshold: e.target.value })} />
                    </td>
                    <td>
                      <button type="button" className="btn ghost small" onClick={() => removeDraftVariant(idx)}>&#10005;</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <datalist id="known-colors">{KNOWN_COLORS.map((c) => <option key={c} value={c} />)}</datalist>
            <datalist id="known-sizes">{COMMON_SIZES.map((s) => <option key={s} value={s} />)}</datalist>
            <button type="button" className="btn secondary small" onClick={() => setVariants((vs) => [...vs, emptyVariant()])} style={{ marginTop: 8 }}>
              + Ajouter une ligne
            </button>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="btn wide" type="submit" disabled={saving}>
            {saving ? 'Enregistrement...' : isEdit ? 'Enregistrer les modifications' : 'Creer l’article'}
          </button>
          <Link to="/inventaire" className="btn secondary wide">Annuler</Link>
        </div>
      </form>

      {isEdit && (
        <div className="card" style={{ marginTop: 18 }}>
          <h3>Couleurs / Tailles (variantes)</h3>
          <table className="table">
            <thead>
              <tr><th>Couleur</th><th>Taille</th><th>SKU</th><th>Stock</th><th>Alerte</th><th></th></tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <VariantRow key={v.id} variant={v} onSave={handleUpdateVariantExisting} onDelete={handleDeleteVariantExisting} />
              ))}
              <tr>
                <td>
                  <input className="input" list="known-colors" value={newVariant.color} onChange={(e) => setNewVariant((n) => ({ ...n, color: e.target.value }))} placeholder="Nouvelle couleur" />
                </td>
                <td>
                  <input className="input" list="known-sizes" value={newVariant.size} onChange={(e) => setNewVariant((n) => ({ ...n, size: e.target.value }))} placeholder="Nouvelle taille" />
                </td>
                <td colSpan={1} style={{ color: 'var(--ink-soft)', fontSize: 12 }}>auto</td>
                <td style={{ width: 90 }}>
                  <input className="input" type="number" min="0" value={newVariant.quantity} onChange={(e) => setNewVariant((n) => ({ ...n, quantity: e.target.value }))} />
                </td>
                <td style={{ width: 90 }}>
                  <input className="input" type="number" min="0" value={newVariant.alert_threshold} onChange={(e) => setNewVariant((n) => ({ ...n, alert_threshold: e.target.value }))} />
                </td>
                <td>
                  <button type="button" className="btn small" onClick={handleAddVariantExisting}>+ Ajouter</button>
                </td>
              </tr>
            </tbody>
          </table>
          <datalist id="known-colors">{KNOWN_COLORS.map((c) => <option key={c} value={c} />)}</datalist>
          <datalist id="known-sizes">{COMMON_SIZES.map((s) => <option key={s} value={s} />)}</datalist>
          <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 10 }}>
            Pour ajouter du stock recu sur une variante existante, utilisez plutot la page <Link to="/reception">Reception stock</Link>.
          </p>
        </div>
      )}
    </div>
  );
}

function VariantRow({ variant, onSave, onDelete }) {
  const [color, setColor] = useState(variant.color || '');
  const [size, setSize] = useState(variant.size || '');
  const [threshold, setThreshold] = useState(variant.alert_threshold);
  const dirty = color !== (variant.color || '') || size !== (variant.size || '') || Number(threshold) !== variant.alert_threshold;

  return (
    <tr>
      <td style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span className="swatch" style={{ background: colorSwatch(color) || '#ddd' }} />
        <input className="input" value={color} onChange={(e) => setColor(e.target.value)} />
      </td>
      <td><input className="input" value={size} onChange={(e) => setSize(e.target.value)} /></td>
      <td style={{ fontSize: 11.5, color: 'var(--ink-soft)' }}>{variant.sku}</td>
      <td>
        <span className={`badge ${variant.quantity <= variant.alert_threshold ? 'warning' : 'neutral'}`}>{variant.quantity}</span>
      </td>
      <td style={{ width: 90 }}>
        <input className="input" type="number" min="0" value={threshold} onChange={(e) => setThreshold(e.target.value)} />
      </td>
      <td style={{ display: 'flex', gap: 4 }}>
        {dirty && (
          <button type="button" className="btn small" onClick={() => onSave({ ...variant, color, size, alert_threshold: Number(threshold) })}>
            &#10003;
          </button>
        )}
        <button type="button" className="btn ghost small" onClick={() => onDelete(variant)}>&#10005;</button>
      </td>
    </tr>
  );
}
