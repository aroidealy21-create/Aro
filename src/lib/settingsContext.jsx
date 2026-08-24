import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api';

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState({ shop_name: 'Teens Fashion by Di', currency: 'Ar' });
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    return api.get('/settings').then((data) => {
      setSettings(data);
      setLoaded(true);
      return data;
    });
  }, []);

  useEffect(() => {
    refresh().catch(() => setLoaded(true));
  }, [refresh]);

  return (
    <SettingsContext.Provider value={{ settings, refresh, loaded }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings doit etre utilise dans SettingsProvider');
  return ctx;
}
