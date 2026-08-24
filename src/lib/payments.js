export const PAYMENT_METHODS = [
  { key: 'especes', label: 'Especes', icon: '\u{1F4B5}' },
  { key: 'mvola', label: 'Mvola', icon: '\u{1F4F1}' },
  { key: 'orange_money', label: 'Orange Money', icon: '\u{1F4F1}' },
  { key: 'airtel_money', label: 'Airtel Money', icon: '\u{1F4F1}' },
  { key: 'carte', label: 'Carte bancaire', icon: '\u{1F4B3}' },
  { key: 'en_ligne', label: 'Achat en ligne', icon: '\u{1F310}' }
];

export function paymentLabel(key) {
  return PAYMENT_METHODS.find((m) => m.key === key)?.label || key;
}
