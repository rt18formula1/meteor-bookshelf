CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL DEFAULT '',
  salt TEXT NOT NULL DEFAULT '',
  firebase_uid TEXT,
  notion_token TEXT NOT NULL DEFAULT '',   -- Notion インテグレーショントークン（APIでは返さない）
  notion_db_id TEXT NOT NULL DEFAULT '',   -- 連携先 Notion データベースID（32桁hex）
  notion_enabled INTEGER NOT NULL DEFAULT 0, -- Notion 連携の有効/無効
  sheets_id TEXT NOT NULL DEFAULT '',      -- Google Sheets 書き出し先スプレッドシートID
  sheets_url TEXT NOT NULL DEFAULT '',     -- 同 URL
  sub_period_end INTEGER NOT NULL DEFAULT 0, -- エクスポートプランの権利終了時刻（unix秒）。4102444800 以上は無期限
  sub_source TEXT NOT NULL DEFAULT '',       -- 権利の取得方法: stripe | code | admin
  stripe_customer_id TEXT NOT NULL DEFAULT '',
  stripe_subscription_id TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  type TEXT NOT NULL DEFAULT 'book',        -- book | cd | dvd | magazine | other
  title TEXT NOT NULL,
  creator TEXT DEFAULT '',
  publisher TEXT DEFAULT '',
  isbn TEXT DEFAULT '',
  catno TEXT DEFAULT '',             -- 規格品番（カタログ番号、CD/DVD/BD）
  edition TEXT DEFAULT '',           -- 版・仕様（初回限定盤など）
  price TEXT DEFAULT '',              -- 価格（数字文字列、円）
  location TEXT DEFAULT '',           -- 保有場所（本棚 / Kindle 等、自由ラベル）
  category TEXT DEFAULT '',           -- オリジナルカテゴリー（自由ラベル）
  folder_id INTEGER,                  -- 所属フォルダ（NULL は未分類。論理参照。既存DBには Worker の ensureSchema が ALTER TABLE で追加する）
  cover_url TEXT DEFAULT '',
  image_key TEXT DEFAULT '',           -- 表表紙の画像キー（KV）
  spine_key TEXT DEFAULT '',           -- 背表紙の画像キー（KV）
  side_key TEXT DEFAULT '',            -- 横（側面）の画像キー（KV）
  sort_order INTEGER,                 -- 手動並び順（NULL は未設定）
  notion_page_id TEXT NOT NULL DEFAULT '', -- 同期先 Notion ページID（未同期は空）
  status TEXT NOT NULL DEFAULT 'unread',   -- unread | reading | done
  prog_cur INTEGER DEFAULT 0,
  prog_total INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_items_folder ON items(user_id, folder_id);

-- フォルダ（本棚の中の「入れ物」）。カテゴリーとは別概念。
-- share_id は公開URL /s/:shareId 用の推測困難なランダム文字列。is_public=1 のフォルダだけ公開される。
CREATE TABLE IF NOT EXISTS folders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  share_id TEXT NOT NULL UNIQUE,
  is_public INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_folders_share ON folders(share_id);

CREATE TABLE IF NOT EXISTS memos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memos_user ON memos(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_memos_item ON memos(item_id, created_at);

-- アクティベーションコード。平文は保存せず SHA-256 ハッシュのみ。
-- duration_days が NULL のコードは「無期限」（償還時に sub_period_end へセンチネル値を入れる）
CREATE TABLE IF NOT EXISTS license_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code_hash TEXT NOT NULL UNIQUE,
  code_hint TEXT NOT NULL DEFAULT '',       -- 末尾4文字（管理画面での識別用）
  duration_days INTEGER,                    -- 付与日数。NULL は無期限
  note TEXT NOT NULL DEFAULT '',            -- 発行先メモ（友人への配布など）
  created_at INTEGER NOT NULL,
  created_by TEXT NOT NULL DEFAULT '',      -- 発行した管理者のメール
  redeemed_by INTEGER REFERENCES users(id), -- NULL は未使用
  redeemed_at INTEGER,
  revoked INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_license_codes_redeemed_by ON license_codes(redeemed_by);

