const path = require("path");
const sqlite3 = require("sqlite3").verbose();

const dbPath = path.join(__dirname, "ranked_gym.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run(
    `
    CREATE TABLE IF NOT EXISTS state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      tier TEXT NOT NULL,
      division INTEGER NOT NULL,
      lp INTEGER NOT NULL,
      updated_at TEXT NOT NULL
    )
    `
  );

  db.run(
    `
    CREATE TABLE IF NOT EXISTS exercise_baselines (
      exercise_key TEXT PRIMARY KEY,
      rm_reps INTEGER NOT NULL,
      rm_weight REAL NOT NULL,
      e1rm REAL NOT NULL,
      step REAL NOT NULL DEFAULT 5,
      updated_at TEXT NOT NULL
    )
    `
  );

  db.run(
    `
    CREATE TABLE IF NOT EXISTS challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      success INTEGER NOT NULL,
      lp_value INTEGER NOT NULL,
      lp_change INTEGER NOT NULL,
      created_at TEXT NOT NULL
    )
    `
  );

  db.run(
    `
    INSERT INTO state (id, tier, division, lp, updated_at)
    VALUES (1, 'Iron', 4, 0, datetime('now'))
    ON CONFLICT(id) DO NOTHING
    `
  );
});

module.exports = db;
