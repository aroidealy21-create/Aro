import React, { createContext, useContext, useState } from 'react';
import { useSettings } from './settingsContext.jsx';

const PinContext = createContext(null);

export function PinProvider({ children }) {
  const { settings } = useSettings();
  const [unlocked, setUnlocked] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalError, setModalError] = useState('');

  const pin = settings.manager_pin || '';
  const hasPin = pin.length > 0;

  function requestUnlock() {
    if (!hasPin || unlocked) return;
    setModalError('');
    setModalOpen(true);
  }

  function tryUnlock(code) {
    if (code === pin) {
      setUnlocked(true);
      setModalOpen(false);
      setModalError('');
      return true;
    }
    setModalError('Code incorrect');
    return false;
  }

  function lock() {
    setUnlocked(false);
  }

  const value = { hasPin, unlocked, requestUnlock, lock };

  return (
    <PinContext.Provider value={value}>
      {children}
      {modalOpen && (
        <PinPad
          error={modalError}
          onSubmit={tryUnlock}
          onClose={() => setModalOpen(false)}
        />
      )}
    </PinContext.Provider>
  );
}

export function usePin() {
  const ctx = useContext(PinContext);
  if (!ctx) throw new Error('usePin doit etre utilise dans PinProvider');
  return ctx;
}

function PinPad({ onSubmit, onClose, error }) {
  const [digits, setDigits] = useState([]);

  function press(d) {
    setDigits((cur) => {
      const next = [...cur, d].slice(0, 4);
      if (next.length === 4) {
        setTimeout(() => {
          const ok = onSubmit(next.join(''));
          if (!ok) setDigits([]);
        }, 80);
      }
      return next;
    });
  }

  function backspace() {
    setDigits((cur) => cur.slice(0, -1));
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal pin-modal" onClick={(e) => e.stopPropagation()}>
        <div className="pin-card">
          <div className="pin-lock-icon">&#128274;</div>
          <h3>Acces reserve</h3>
          <div className="pin-sub">Entrez le code gerant</div>
          <div className="pin-dots">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={digits.length > i ? 'filled' : ''} />
            ))}
          </div>
          {error && <div className="pin-error">{error}</div>}
          <div className="pin-keys">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
              <button type="button" key={k} onClick={() => press(k)}>{k}</button>
            ))}
            <button type="button" className="ghost-key" onClick={onClose}>Annuler</button>
            <button type="button" onClick={() => press('0')}>0</button>
            <button type="button" className="ghost-key" onClick={backspace}>&#9003;</button>
          </div>
        </div>
      </div>
    </div>
  );
}
