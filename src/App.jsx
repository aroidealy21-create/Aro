import React, { useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import { ToastProvider } from './lib/toast.jsx';
import { SettingsProvider, useSettings } from './lib/settingsContext.jsx';
import { PinProvider, usePin } from './lib/pinContext.jsx';

import Dashboard from './pages/Dashboard.jsx';
import Inventory from './pages/Inventory.jsx';
import ProductForm from './pages/ProductForm.jsx';
import Reception from './pages/Reception.jsx';
import POS from './pages/POS.jsx';
import SalesHistory from './pages/SalesHistory.jsx';
import Reports from './pages/Reports.jsx';
import Settings from './pages/Settings.jsx';

const NAV_ITEMS = [
  { to: '/', label: 'Tableau de bord', icon: '\u{1F3E0}', end: true },
  { to: '/vente', label: 'Caisse (Vente)', icon: '\u{1F6D2}' },
  { to: '/inventaire', label: 'Inventaire', icon: '\u{1F455}' },
  { to: '/reception', label: 'Reception stock', icon: '\u{1F4E6}' },
  { to: '/ventes', label: 'Historique ventes', icon: '\u{1F9FE}' },
  { to: '/rapports', label: 'Rapports', icon: '\u{1F4CA}' },
  { to: '/parametres', label: 'Parametres', icon: '\u{2699}\u{FE0F}' }
];

function Sidebar({ open, onNavigate }) {
  const { settings } = useSettings();
  const { hasPin, unlocked, lock, requestUnlock } = usePin();
  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="brand">
        <img src="/icons/icon.png" alt="logo" />
        <div className="brand-text">
          <strong>{settings.shop_name || 'Teens Fashion by Di'}</strong>
          <span>Gestion &amp; Caisse</span>
        </div>
      </div>
      <nav>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            onClick={onNavigate}
          >
            <span className="icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
      {hasPin && (
        <button
          type="button"
          className={`lock-status-btn ${unlocked ? 'is-unlocked' : ''}`}
          onClick={unlocked ? lock : requestUnlock}
        >
          <span>{unlocked ? '\u{1F513}' : '\u{1F512}'}</span>
          {unlocked ? 'Verrouiller les stats' : 'Deverrouiller les stats'}
        </button>
      )}
      <div className="sidebar-footer">100% hors-ligne &middot; mikata.mg</div>
    </aside>
  );
}

function Shell() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app-shell">
      <div className="mobile-topbar">
        <button className="btn ghost small" onClick={() => setMobileOpen((v) => !v)}>
          &#9776; Menu
        </button>
      </div>
      {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}
      <Sidebar open={mobileOpen} onNavigate={() => setMobileOpen(false)} />
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/vente" element={<POS />} />
          <Route path="/inventaire" element={<Inventory />} />
          <Route path="/inventaire/nouveau" element={<ProductForm />} />
          <Route path="/inventaire/:id" element={<ProductForm />} />
          <Route path="/reception" element={<Reception />} />
          <Route path="/ventes" element={<SalesHistory />} />
          <Route path="/rapports" element={<Reports />} />
          <Route path="/parametres" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <PinProvider>
        <ToastProvider>
          <Shell />
        </ToastProvider>
      </PinProvider>
    </SettingsProvider>
  );
}
