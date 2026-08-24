import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useToast } from '../lib/toast.jsx';
import { useSettings } from '../lib/settingsContext.jsx';

export default function Settings() {
  const { settings, refresh } = useSettings();
  const [form, setForm] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [network, setNetwork] = useState(null);
  const [backups, setBackups] = useState([]);
  const toast = useToast();

  useEffect(() => setForm(settings), [settings]);

  useEffect(() => {
    api.get('/network-info').then(setNetwork).catch(() => {});
    loadBackups();
  }, []);

  function loadBackups() {
    api.get('/settings/backups').then(setBackups).catch(() => {});
  }

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/settings', form);
      await refresh();
      toast.success('Parametres enregistres');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleBackup() {
    try {
      const res = await api.post('/settings/backup');
      toast.success('Sauvegarde creee');
      loadBackups();
    } catch (err) {
      toast.error(err.message);
    }
  }

  const address = network && network.addresses.length > 0 ? network.addresses[0].address : null;
  const tabletUrl = address ? `http://${address}:${network.port}` : null;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Parametres</h1>
          <div className="subtitle">Informations boutique, connexion tablette et sauvegardes</div>
        </div>
      </div>

      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <h3>Informations de la boutique</h3>
          <form onSubmit={handleSave}>
            <label className="field">
              Nom de la boutique
              <input className="input" value={form.shop_name || ''} onChange={(e) => update('shop_name', e.target.value)} />
            </label>
            <label className="field">
              Adresse
              <input className="input" value={form.shop_address || ''} onChange={(e) => update('shop_address', e.target.value)} />
            </label>
            <label className="field">
              Telephone
              <input className="input" value={form.shop_phone || ''} onChange={(e) => update('shop_phone', e.target.value)} />
            </label>
            <label className="field">
              Devise
              <input className="input" value={form.currency || ''} onChange={(e) => update('currency', e.target.value)} placeholder="Ar" />
            </label>
            <label className="field">
              Seuil d'alerte stock bas par defaut
              <input className="input" type="number" min="0" value={form.low_stock_threshold || ''} onChange={(e) => update('low_stock_threshold', e.target.value)} />
            </label>
            <label className="field">
              Message en bas du ticket de caisse
              <input className="input" value={form.receipt_footer || ''} onChange={(e) => update('receipt_footer', e.target.value)} />
            </label>
            <button className="btn wide" type="submit" disabled={saving}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
          </form>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <h3>&#128241; Connecter la tablette</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              1. Connectez la tablette au meme reseau Wi-Fi que cet ordinateur (aucun acces internet requis).<br />
              2. Ouvrez un navigateur sur la tablette et saisissez l'adresse ci-dessous.<br />
              3. Allez sur la page <strong>Reception stock</strong> pour ajouter les nouveaux articles / photos.
            </p>
            {tabletUrl ? (
              <div className="card" style={{ background: 'var(--pink-light)', border: 'none', textAlign: 'center' }}>
                <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Adresse a saisir sur la tablette</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--pink-dark)', marginTop: 4 }}>{tabletUrl}</div>
              </div>
            ) : (
              <p style={{ color: 'var(--warning)' }}>
                Aucun reseau Wi-Fi/local detecte. Connectez cet ordinateur a votre reseau Wi-Fi de boutique (une box/routeur sans internet fonctionne aussi).
              </p>
            )}
            {network && network.addresses.length > 1 && (
              <p style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 8 }}>
                Autres adresses detectees : {network.addresses.map((a) => a.address).join(', ')}
              </p>
            )}
          </div>

          <div className="card">
            <h3>&#128190; Sauvegarde des donnees</h3>
            <p style={{ fontSize: 13, color: 'var(--ink-soft)' }}>
              Toutes vos donnees (articles, stock, ventes) sont stockees uniquement sur cet ordinateur. Faites une sauvegarde reguliere, surtout avant une mise a jour.
            </p>
            <button className="btn secondary" onClick={handleBackup}>Creer une sauvegarde maintenant</button>
            <div style={{ marginTop: 12 }}>
              {backups.length === 0 ? (
                <p style={{ fontSize: 12.5, color: 'var(--ink-soft)' }}>Aucune sauvegarde pour le moment.</p>
              ) : (
                <table className="table">
                  <thead><tr><th>Fichier</th><th>Date</th></tr></thead>
                  <tbody>
                    {backups.slice(0, 8).map((b) => (
                      <tr key={b.name}>
                        <td style={{ fontSize: 12 }}>{b.name}</td>
                        <td style={{ fontSize: 12 }}>{new Date(b.date).toLocaleString('fr-FR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
