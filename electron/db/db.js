const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { runMigrations } = require('./migrations');

let db = null;

function initDb(userDataDir) {
  const dbDir = path.join(userDataDir, 'data');
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

  const photosDir = path.join(userDataDir, 'photos');
  if (!fs.existsSync(photosDir)) fs.mkdirSync(photosDir, { recursive: true });

  const dbPath = path.join(dbDir, 'teensfashion.db');
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  const schemaCandidates = [
    path.join(__dirname, 'schema.sql'),
    path.join(process.resourcesPath || '', 'schema.sql')
  ];
  const schemaPath = schemaCandidates.find((p) => p && fs.existsSync(p));
  if (!schemaPath) throw new Error('schema.sql introuvable');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(schema);
  runMigrations(db);

  return { db, dbPath, photosDir };
}

function getDb() {
  if (!db) throw new Error('Base de donnees non initialisee');
  return db;
}

module.exports = { initDb, getDb };
