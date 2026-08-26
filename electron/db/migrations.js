// Migrations idempotentes appliquees a chaque demarrage : ne touchent jamais
// aux donnees existantes de l'utilisateur, ajoutent seulement ce qui manque.
function columnExists(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

function runMigrations(db) {
  if (!columnExists(db, 'sale_items', 'unit_cost')) {
    db.exec('ALTER TABLE sale_items ADD COLUMN unit_cost REAL');
  }

  // Repare les variantes touchees par un bug ou l'edition d'une variante (couleur/taille/
  // seuil d'alerte) remettait accidentellement son "prix particulier" a 0 au lieu de le
  // laisser vide, ce qui la faisait vendre a 0 Ar en caisse. Aucune variante legitime n'a
  // de prix particulier a 0 (ce serait l'offrir gratuitement), donc c'est sans risque.
  db.exec('UPDATE variants SET price_override = NULL WHERE price_override = 0');
}

module.exports = { runMigrations };
