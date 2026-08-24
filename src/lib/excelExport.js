import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { paymentLabel } from './payments';

function autoWidth(rows) {
  if (!rows.length) return [];
  return Object.keys(rows[0]).map((key) => {
    const maxLen = Math.max(key.length, ...rows.map((r) => String(r[key] ?? '').length));
    return { wch: Math.min(Math.max(maxLen + 2, 10), 42) };
  });
}

function sheetFromRows(rows) {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = autoWidth(rows);
  return ws;
}

export function buildAndDownloadExcel(data, { shopName, currency, periodLabel }) {
  const wb = XLSX.utils.book_new();

  const marge = data.resume.ca ? (data.resume.benefice / data.resume.ca) * 100 : 0;
  const resumeRows = [
    { Indicateur: 'Boutique', Valeur: shopName || '' },
    { Indicateur: 'Periode', Valeur: periodLabel },
    { Indicateur: 'Genere le', Valeur: dayjs().format('DD/MM/YYYY HH:mm') },
    { Indicateur: '', Valeur: '' },
    { Indicateur: 'Nombre de ventes', Valeur: data.resume.nb_ventes },
    { Indicateur: `Chiffre d'affaires (${currency})`, Valeur: Math.round(data.resume.ca) },
    { Indicateur: `Remises totales (${currency})`, Valeur: Math.round(data.resume.remises) },
    { Indicateur: `Cout total (${currency})`, Valeur: Math.round(data.resume.cout) },
    { Indicateur: `Benefice (${currency})`, Valeur: Math.round(data.resume.benefice) },
    { Indicateur: 'Marge (%)', Valeur: Math.round(marge * 10) / 10 },
    { Indicateur: `Panier moyen (${currency})`, Valeur: Math.round(data.resume.panier_moyen) }
  ];
  const wsResume = XLSX.utils.json_to_sheet(resumeRows, { skipHeader: true });
  wsResume['!cols'] = [{ wch: 30 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsResume, 'Resume');

  const ventesRows = data.ventes.map((v) => ({
    Ticket: v.ticket_number,
    Date: dayjs(v.created_at).format('DD/MM/YYYY HH:mm'),
    "Nb articles": v.nb_articles,
    [`Total (${currency})`]: Math.round(v.total),
    [`Remise (${currency})`]: Math.round(v.discount || 0),
    'Moyen de paiement': paymentLabel(v.payment_method),
    Vendeur: v.seller || '',
    Statut: v.status === 'annulee' ? 'Annulee' : 'Validee'
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(ventesRows), 'Ventes');

  const articlesRows = data.articles.map((a) => ({
    Ticket: a.ticket_number,
    Date: dayjs(a.created_at).format('DD/MM/YYYY HH:mm'),
    Produit: a.product_name,
    Couleur: a.color || '',
    Taille: a.size || '',
    Quantite: a.quantity,
    [`Prix unitaire (${currency})`]: Math.round(a.unit_price),
    [`Cout unitaire (${currency})`]: Math.round(a.unit_cost),
    [`Sous-total (${currency})`]: Math.round(a.subtotal),
    [`Benefice (${currency})`]: Math.round(a.benefice),
    Statut: a.status === 'annulee' ? 'Annulee' : 'Validee'
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(articlesRows), 'Detail articles');

  const produitsRows = data.produits.map((p) => ({
    Produit: p.product_name,
    Couleur: p.color || '',
    Taille: p.size || '',
    'Quantite vendue': p.quantite_vendue,
    [`CA genere (${currency})`]: Math.round(p.ca_genere),
    [`Cout total (${currency})`]: Math.round(p.cout_total),
    [`Benefice (${currency})`]: Math.round(p.benefice),
    'Marge (%)': p.ca_genere ? Math.round((p.benefice / p.ca_genere) * 1000) / 10 : 0
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(produitsRows), 'Produits');

  const caParJourRows = data.caParJour.map((j) => ({
    Date: dayjs(j.jour).format('DD/MM/YYYY'),
    [`CA (${currency})`]: Math.round(j.ca),
    [`Cout (${currency})`]: Math.round(j.cout),
    [`Benefice (${currency})`]: Math.round(j.benefice)
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(caParJourRows), 'CA par jour');

  const paiementsRows = data.paiements.map((p) => ({
    'Moyen de paiement': paymentLabel(p.payment_method),
    'Nombre de ventes': p.nb,
    [`CA (${currency})`]: Math.round(p.ca)
  }));
  XLSX.utils.book_append_sheet(wb, sheetFromRows(paiementsRows), 'Paiements');

  const filename = `comptabilite-${(shopName || 'boutique').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${dayjs().format('YYYY-MM-DD')}.xlsx`;
  XLSX.writeFile(wb, filename);
}
