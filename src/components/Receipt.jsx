import React from 'react';
import { formatMoney } from '../lib/api';
import { paymentLabel } from '../lib/payments';

export default function Receipt({ sale, settings }) {
  return (
    <div className="receipt">
      <div className="center">
        <strong>{settings.shop_name || 'Teens Fashion by Di'}</strong><br />
        {settings.shop_address}<br />
        {settings.shop_phone}
      </div>
      <hr />
      <div>Ticket : {sale.ticket_number}</div>
      <div>Date : {new Date(sale.created_at).toLocaleString('fr-FR')}</div>
      {sale.seller && <div>Vendeur : {sale.seller}</div>}
      {sale.status === 'annulee' && <div style={{ fontWeight: 'bold' }}>*** VENTE ANNULEE ***</div>}
      <hr />
      {sale.items.map((it) => (
        <div key={it.id}>
          <div>{it.product_name} {it.color} {it.size}</div>
          <div className="row">
            <span>{it.quantity} x {formatMoney(it.unit_price, settings.currency)}</span>
            <span>{formatMoney(it.subtotal, settings.currency)}</span>
          </div>
        </div>
      ))}
      <hr />
      {sale.discount > 0 && (
        <div className="row"><span>Remise</span><span>-{formatMoney(sale.discount, settings.currency)}</span></div>
      )}
      <div className="row"><strong>TOTAL</strong><strong>{formatMoney(sale.total, settings.currency)}</strong></div>
      <div className="row"><span>Paiement</span><span>{paymentLabel(sale.payment_method)}</span></div>
      {sale.amount_received != null && (
        <div className="row"><span>Recu</span><span>{formatMoney(sale.amount_received, settings.currency)}</span></div>
      )}
      {sale.change_given != null && (
        <div className="row"><span>Monnaie</span><span>{formatMoney(sale.change_given, settings.currency)}</span></div>
      )}
      <hr />
      <div className="center">{settings.receipt_footer || 'Merci de votre visite !'}</div>
    </div>
  );
}
