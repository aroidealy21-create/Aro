// Migrations idempotentes appliquees a chaque demarrage : ne touchent jamais
// aux donnees existantes de l'utilisateur, ajoutent seulement ce qui manque.
function columnExists(db, table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
}

function runMigrations(db) {
  if (!columnExists(db, 'sale_items', 'unit_cost')) {
    db.exec('ALTER TABLE sale_items ADD COLUMN unit_cost REAL');
  }
}

module.exports = { runMigrations };
