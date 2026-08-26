import React from 'react';
import { usePin } from '../lib/pinContext.jsx';

// Enveloppe une carte de statistique (CA, benefice, valeur du stock...) : floute son
// contenu et affiche un cadenas tant que le gerant n'a pas saisi son code.
export function LockedCard({ children }) {
  const { hasPin, unlocked, requestUnlock } = usePin();
  if (!hasPin || unlocked) return children;
  return (
    <div className="locked-card" onClick={requestUnlock} role="button" tabIndex={0}>
      <div className="locked-card-content">{children}</div>
      <div className="locked-card-badge">
        <span className="icon">&#128274;</span>
        <span>Reserve au gerant</span>
      </div>
    </div>
  );
}

// Enveloppe une page entiere (Rapports) : n'affiche rien tant que le code n'a pas ete
// saisi, avec un ecran d'accueil explicite a la place.
export function LockedPage({ title = 'Acces reserve', children }) {
  const { hasPin, unlocked, requestUnlock } = usePin();
  if (!hasPin || unlocked) return children;
  return (
    <div className="empty-state card" style={{ maxWidth: 420, margin: '60px auto', textAlign: 'center' }}>
      <div className="emoji">&#128274;</div>
      <h3 style={{ marginBottom: 6 }}>{title}</h3>
      <p>Cette page est reservee au gerant.</p>
      <button className="btn accent" onClick={requestUnlock}>Deverrouiller</button>
    </div>
  );
}

// Enveloppe un champ de formulaire (prix d'achat) : le remplace par un champ verrouille
// tant que le code n'a pas ete saisi.
export function LockedField({ label, children }) {
  const { hasPin, unlocked, requestUnlock } = usePin();
  if (!hasPin || unlocked) return children;
  return (
    <label className="field">
      {label}
      <button type="button" className="locked-field" onClick={requestUnlock}>
        <span>&#128274;</span> Reserve au gerant — cliquer pour deverrouiller
      </button>
    </label>
  );
}
