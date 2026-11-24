CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL DEFAULT 'book',        -- book | cd | dvd | other
  title TEXT NOT NULL,
  creator TEXT DEFAULT '',
  publisher TEXT DEFAULT '',
  isbn TEXT DEFAULT '',
  cover_url TEXT DEFAULT '',
  image_key TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'unread',   -- unread | reading | done
  prog_cur INTEGER DEFAULT 0,
  prog_total INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id, created_at);

CREATE TABLE IF NOT EXISTS memos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memos_user ON memos(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_memos_item ON memos(item_id, created_at);
