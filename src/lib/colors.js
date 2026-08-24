// Association couleur (texte libre en francais) -> code hexadecimal
// Utilise pour afficher une pastille visuelle a cote du nom de la couleur.
const COLOR_MAP = {
  rouge: '#e63946',
  bleu: '#3a6ea5',
  'bleu marine': '#1d2d50',
  marine: '#1d2d50',
  'bleu ciel': '#89c2ff',
  vert: '#2a9d5c',
  kaki: '#6b7a3a',
  jaune: '#f4c430',
  moutarde: '#c9a227',
  orange: '#f77f00',
  rose: '#ff6b9b',
  fuchsia: '#e0218a',
  violet: '#7b2cbf',
  mauve: '#9d7fbd',
  noir: '#151515',
  blanc: '#f6f6f6',
  gris: '#8a8a8a',
  'gris clair': '#c7c7c7',
  'gris fonce': '#4a4a4a',
  marron: '#7b4b2a',
  beige: '#e8d8c3',
  camel: '#c19a6b',
  bordeaux: '#6d1b2e',
  turquoise: '#2ec4b6',
  argent: '#c0c0c0',
  or: '#d4af37',
  corail: '#ff7f6b',
  lavande: '#c9b6e4',
  multicolore: 'linear-gradient(90deg,#e63946,#f4c430,#2a9d5c,#3a6ea5,#7b2cbf)'
};

export function colorSwatch(name) {
  if (!name) return '#dddddd';
  const key = name.trim().toLowerCase();
  return COLOR_MAP[key] || null;
}

export const KNOWN_COLORS = Object.keys(COLOR_MAP);

export const COMMON_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'Unique', '6 ans', '8 ans', '10 ans', '12 ans', '14 ans', '16 ans'];
