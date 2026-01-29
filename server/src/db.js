const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dbPath = path.join(__dirname, '..', 'data', 'salat.db');

// Ensure data folder exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

function migrate() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      user_id INTEGER,
      created_by_user_id INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS recipe_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT 'Standard',
      servings INTEGER NOT NULL,
      created_by_user_id INTEGER,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL
    );
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS template_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      template_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT DEFAULT '',
      FOREIGN KEY (template_id) REFERENCES recipe_templates(id) ON DELETE CASCADE
    );
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      reset_day_of_week INTEGER NOT NULL DEFAULT 5, -- 0=Sonntag
      reset_hour INTEGER NOT NULL DEFAULT 23,
      reset_minute INTEGER NOT NULL DEFAULT 59,
      last_reset TEXT,
      active_template_id INTEGER,
      FOREIGN KEY (active_template_id) REFERENCES recipe_templates(id) ON DELETE SET NULL
    );
  `).run();

  db.prepare(`
    CREATE TABLE IF NOT EXISTS ingredient_exclusions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      template_id INTEGER NOT NULL,
      ingredient_name TEXT NOT NULL,
      ingredient_key TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES recipe_templates(id) ON DELETE CASCADE
    );
  `).run();

  db.prepare(`
    CREATE UNIQUE INDEX IF NOT EXISTS ingredient_exclusions_unique
    ON ingredient_exclusions (user_id, template_id, ingredient_key);
  `).run();

  const settingsRow = db.prepare('SELECT id FROM settings WHERE id = 1').get();
  if (!settingsRow) {
    db.prepare(`
      INSERT INTO settings (id, reset_day_of_week, reset_hour, reset_minute, last_reset)
      VALUES (1, 5, 23, 59, NULL);
    `).run();
  } else {
    const columns = db.prepare('PRAGMA table_info(settings)').all();
    const hasActiveTemplate = columns.some((col) => col.name === 'active_template_id');
    if (!hasActiveTemplate) {
      db.prepare('ALTER TABLE settings ADD COLUMN active_template_id INTEGER').run();
    }
  }
}

module.exports = {
  db,
  migrate,
};
