-- Schema de la base de donnees Teens Fashion - Gestion
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT DEFAULT '',
  description TEXT DEFAULT '',
  cost_price REAL NOT NULL DEFAULT 0,
  sale_price REAL NOT NULL DEFAULT 0,
  photo TEXT DEFAULT '',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  color TEXT DEFAULT '',
  size TEXT DEFAULT '',
  sku TEXT UNIQUE,
  quantity INTEGER NOT NULL DEFAULT 0,
  alert_threshold INTEGER NOT NULL DEFAULT 3,
  price_override REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_id);

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  variant_id INTEGER NOT NULL REFERENCES variants(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- reception | vente | ajustement | retour | annulation
  quantity INTEGER NOT NULL, -- delta (positif ou negatif)
  note TEXT DEFAULT '',
  source TEXT DEFAULT 'pc', -- pc | tablette
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_movements_variant ON stock_movements(variant_id);
CREATE INDEX IF NOT EXISTS idx_movements_date ON stock_movements(created_at);

CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_number TEXT UNIQUE,
  total REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'especes',
  amount_received REAL,
  change_given REAL,
  seller TEXT DEFAULT '',
  note TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'validee', -- validee | annulee
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
);

CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(created_at);

CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  variant_id INTEGER NOT NULL REFERENCES variants(id),
  product_name TEXT NOT NULL,
  color TEXT DEFAULT '',
  size TEXT DEFAULT '',
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  unit_cost REAL,
  subtotal REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_variant ON sale_items(variant_id);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

INSERT OR IGNORE INTO settings (key, value) VALUES ('shop_name', 'Teens Fashion by Di');
INSERT OR IGNORE INTO settings (key, value) VALUES ('shop_address', 'Mikata.mg');
INSERT OR IGNORE INTO settings (key, value) VALUES ('shop_phone', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('currency', 'Ar');
INSERT OR IGNORE INTO settings (key, value) VALUES ('low_stock_threshold', '3');
INSERT OR IGNORE INTO settings (key, value) VALUES ('receipt_footer', 'Merci de votre visite !');
