// Bookshelf App — Cloudflare Worker (API + static assets)
// Bindings: DB (D1), IMAGES_R2 (R2, 画像の本命), IMAGES (KV, 旧キーの読取互換), ASSETS (static)
// Auth: Firebase Authentication (ID token verified against Google JWKS)

/* ---------- helpers ---------- */
function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}
function err(message, status = 400) {
  return json({ error: message }, status);
}

/* ---------- subscription（エクスポートプラン / 有料化） ---------- */
/* 管理者メール。このアカウントはサブスクリプション状態によらず常時すべての機能を使える */
const ADMIN_EMAIL = "rb18vcarb@gmail.com";

function nowSec() {
  return Math.floor(Date.now() / 1000);
}
function isAdminUser(user) {
  return !!user && String(user.email || "").toLowerCase() === ADMIN_EMAIL;
}
/* 外部エクスポート（有料機能）の利用権利: 管理者は常時可、それ以外は期間内のみ */
function hasExportAccess(user) {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  return (user.sub_period_end || 0) > nowSec();
}
function subRequiredResponse() {
  return json({ error: "この機能はエクスポートプラン（有料）が必要です", code: "subscription_required" }, 403);
}
/* 設定 API で返すサブスクリプション状態 */
function subscriptionInfo(user) {
  const periodEnd = (user && user.sub_period_end) || 0;
  return {
    active: hasExportAccess(user),
    period_end: periodEnd,
    unlimited: isUnlimitedEnd(periodEnd),
    source: (user && user.sub_source) || "",
    is_admin: isAdminUser(user),
  };
}
/* 無期限を表すセンチネル値（2100-01-01 UTC）。sub_period_end がこれ以上なら「無期限」として扱う */
const SUB_UNLIMITED_END = 4102444800;
function isUnlimitedEnd(periodEnd) {
  return (periodEnd || 0) >= SUB_UNLIMITED_END;
}

/* ---------- auth (Firebase ID token verification) ---------- */
function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
function b64urlJson(s) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));
}

const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let jwksCache = { keys: null, expiresAt: 0 };

/* JWKS を取得する。Cache API にキャッシュし、Cache-Control の max-age を尊重する */
async function fetchJwks() {
  const now = Date.now();
  if (jwksCache.keys && jwksCache.expiresAt > now) return jwksCache.keys;
  let res = null;
  try {
    res = await caches.default.match(JWKS_URL);
  } catch (_) { /* Cache API が使えない環境では fetch にフォールバック */ }
  if (!res) {
    res = await fetch(JWKS_URL);
    if (!res.ok) throw new Error("JWKS fetch failed: " + res.status);
    try {
      await caches.default.put(JWKS_URL, res.clone());
    } catch (_) { /* キャッシュ失敗は無視 */ }
  }
  const data = await res.json();
  const cc = res.headers.get("Cache-Control") || "";
  const m = cc.match(/max-age=(\d+)/);
  const ttlSec = m ? parseInt(m[1]) : 3600;
  jwksCache = { keys: data.keys || [], expiresAt: now + ttlSec * 1000 };
  return jwksCache.keys;
}

/* Firebase ID トークンを検証し、ペイロードを返す。失敗時は null */
async function verifyFirebaseToken(token, env) {
  const projectId = env.FIREBASE_PROJECT_ID || "meteor-bookshelf";
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return null;
  let header, payload;
  try {
    header = b64urlJson(parts[0]);
    payload = b64urlJson(parts[1]);
  } catch (_) {
    return null;
  }
  if (header.alg !== "RS256" || !header.kid) return null;
  const keys = await fetchJwks().catch(() => null);
  if (!keys) return null;
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return null;
  let key;
  try {
    key = await crypto.subtle.importKey(
      "jwk", jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false, ["verify"]
    );
  } catch (_) {
    return null;
  }
  const signed = new TextEncoder().encode(parts[0] + "." + parts[1]);
  const ok = await crypto.subtle
    .verify("RSASSA-PKCS1-v1_5", key, b64urlToBytes(parts[2]), signed)
    .catch(() => false);
  if (!ok) return null;
  const now = Math.floor(Date.now() / 1000);
  if (payload.aud !== projectId) return null;
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null;
  if (!payload.exp || payload.exp <= now) return null;
  if (!payload.sub) return null;
  if (!payload.email) return null;
  return payload;
}

/* Authorization: Bearer <Firebase ID token> からユーザーを解決する。
   firebase_uid で検索 → なければ email で検索して紐付け → なければ新規作成 */
async function currentUser(request, env) {
  const authz = request.headers.get("Authorization") || "";
  const m = authz.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  const payload = await verifyFirebaseToken(m[1].trim(), env);
  if (!payload) return null;
  /* メール確認（Stripe のセキュリティ対策申告「ユーザー登録時の個人情報の確認（メールアドレス）」に該当）:
     メールアドレス＋パスワードで登録したユーザーは、メール確認が完了するまで API を利用できない。
     Google ログインは Google 側でメールアドレスが確認済みのため対象外。
     未確認の場合は _emailNotVerified フラグ付きのオブジェクトを返し、呼び出し側で 401 を返す */
  const provider = payload.firebase && payload.firebase.sign_in_provider;
  if (provider === "password" && payload.email_verified !== true) {
    return { _emailNotVerified: true };
  }
  const uid = payload.sub;
  const email = String(payload.email).toLowerCase();
  /* Notion 連携設定・サブスクリプション状態も含めて返す（内部利用のみ。API レスポンスに出す場合は呼び出し側で絞ること） */
  const cols = "id, email, notion_token, notion_db_id, notion_enabled, sheets_id, sheets_url, sub_period_end, sub_source, stripe_customer_id, stripe_subscription_id";
  let user = await env.DB.prepare(`SELECT ${cols} FROM users WHERE firebase_uid = ?`).bind(uid).first();
  if (user) return user;
  user = await env.DB.prepare(`SELECT ${cols} FROM users WHERE email = ?`).bind(email).first();
  if (user) {
    await env.DB.prepare("UPDATE users SET firebase_uid = ? WHERE id = ?").bind(uid, user.id).run();
    return user;
  }
  const res = await env.DB.prepare(
    "INSERT INTO users (email, pass_hash, salt, firebase_uid, created_at) VALUES (?, '', '', ?, ?)"
  ).bind(email, uid, Math.floor(Date.now() / 1000)).run();
  return { id: res.meta.last_row_id, email, notion_token: "", notion_db_id: "", notion_enabled: 0, sheets_id: "", sheets_url: "", sub_period_end: 0, sub_source: "", stripe_customer_id: "", stripe_subscription_id: "" };
}

/* ---------- folders ---------- */
/* フォルダのスキーマ保証。schema.sql が正本（新規DB用）だが、既存DBにも
   反映されるよう Worker 起動時に CREATE TABLE / ALTER TABLE を実行する。
   プロセスごとに1回だけ（重複エラーは無視）。
   item_folders は「1アイテム＝複数フォルダ」の中間テーブル（正本）。
   items.folder_id は互換のため残し、最初のフォルダと同期させる。
   users.public_share_id / users.is_public は本棚全体の公開用。 */
let schemaEnsured = null;
function ensureSchema(env) {
  if (!schemaEnsured) {
    schemaEnsured = (async () => {
      const stmts = [
        `CREATE TABLE IF NOT EXISTS folders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL REFERENCES users(id),
          name TEXT NOT NULL,
          share_id TEXT NOT NULL UNIQUE,
          is_public INTEGER NOT NULL DEFAULT 0,
          sort_order INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )`,
        "CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id, sort_order)",
        "CREATE INDEX IF NOT EXISTS idx_folders_share ON folders(share_id)",
        "CREATE INDEX IF NOT EXISTS idx_items_folder ON items(user_id, folder_id)",
        "ALTER TABLE items ADD COLUMN folder_id INTEGER",
        `CREATE TABLE IF NOT EXISTS item_folders (
          item_id INTEGER NOT NULL REFERENCES items(id),
          folder_id INTEGER NOT NULL REFERENCES folders(id),
          PRIMARY KEY (item_id, folder_id)
        )`,
        "CREATE INDEX IF NOT EXISTS idx_item_folders_folder ON item_folders(folder_id, item_id)",
        "CREATE INDEX IF NOT EXISTS idx_item_folders_item ON item_folders(item_id)",
        /* 既存の単一フォルダ所属を中間テーブルへ移行する（2回目以降は主キー重複で無視される） */
        "INSERT INTO item_folders (item_id, folder_id) SELECT id, folder_id FROM items WHERE folder_id IS NOT NULL",
        "ALTER TABLE users ADD COLUMN public_share_id TEXT",
        "ALTER TABLE users ADD COLUMN is_public INTEGER",
        "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_share ON users(public_share_id) WHERE public_share_id != ''",
        "ALTER TABLE items ADD COLUMN format TEXT",
        "ALTER TABLE items ADD COLUMN height_mm INTEGER",
      ];
      for (const sql of stmts) {
        try { await env.DB.prepare(sql).run(); } catch (_) { /* 既存の列・表・索引はエラーを無視 */ }
      }
    })();
  }
  return schemaEnsured;
}

/* 公開URL用の share_id を生成する（15文字、紛らわしい文字を除いた英数字、約87ビット）。
   フォルダの内部ID（連番）は URL に出さない */
const SHARE_ID_ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
function generateShareId() {
  const bytes = new Uint8Array(15);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += SHARE_ID_ALPHABET[b % SHARE_ID_ALPHABET.length];
  return s;
}

/* ---------- items ---------- */
const ITEM_COLS = "id, user_id, type, title, creator, publisher, isbn, catno, edition, price, location, category, folder_id, cover_url, image_key, spine_key, side_key, format, height_mm, sort_order, notion_page_id, status, prog_cur, prog_total, created_at, updated_at";

/* 並び順: manual=手動（sort_order 昇順、NULL は後ろ）、title / creator / category / new / old / type */
function sortClause(sort) {
  const manual = "(sort_order IS NULL), sort_order ASC, created_at ASC, id ASC";
  switch (sort) {
    case "title": return "title ASC, created_at ASC, id ASC";
    case "creator": return "creator ASC, created_at ASC, id ASC";
    case "category": return "category ASC, " + manual;
    case "new": return "created_at DESC, id DESC";
    case "old": return "created_at ASC, id ASC";
    case "type": return "type ASC, " + manual;
    default: return manual; // manual
  }
}

async function listItems(request, env, user) {
  const u = new URL(request.url);
  const q = (u.searchParams.get("q") || "").trim();
  const type = u.searchParams.get("type") || "";
  const category = (u.searchParams.get("category") || "").trim();
  const sort = u.searchParams.get("sort") || "manual";
  const unread = u.searchParams.get("unread") === "1";
  const withMemo = u.searchParams.get("withMemo") === "1";
  const folder = (u.searchParams.get("folder") || "").trim();
  const limit = Math.min(parseInt(u.searchParams.get("limit") || "28"), 1000);
  const offset = parseInt(u.searchParams.get("offset") || "0");
  let where = "WHERE user_id = ?";
  const binds = [user.id];
  if (q) { where += " AND (title LIKE ? OR creator LIKE ? OR catno LIKE ? OR category LIKE ? OR location LIKE ?)"; binds.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  if (type && ["book", "cd", "dvd", "magazine", "other"].includes(type)) { where += " AND type = ?"; binds.push(type); }
  if (category) { where += " AND category = ?"; binds.push(category); }
  if (folder === "none") { where += " AND NOT EXISTS (SELECT 1 FROM item_folders f WHERE f.item_id = items.id)"; }
  else if (/^\d+$/.test(folder)) { where += " AND EXISTS (SELECT 1 FROM item_folders f WHERE f.item_id = items.id AND f.folder_id = ?)"; binds.push(parseInt(folder)); }
  if (unread) where += " AND status = 'unread'";
  if (withMemo) where += " AND EXISTS (SELECT 1 FROM memos m WHERE m.item_id = items.id)";
  const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS c FROM items ${where}`).bind(...binds).first();
  const rows = await env.DB.prepare(
    `SELECT ${ITEM_COLS}, (SELECT COUNT(*) FROM memos m WHERE m.item_id = items.id) AS memo_count
     FROM items ${where} ORDER BY ${sortClause(sort)} LIMIT ? OFFSET ?`
  ).bind(...binds, limit, offset).all();
  return json({ items: rows.results, total: totalRow.c });
}

/* 手動並び順を保存する。body { ids: [...] } の順に sort_order=0..n を付け直す */
async function reorderItems(request, env, user) {
  const { ids } = await request.json().catch(() => ({}));
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 1000) return err("並び順のリストが不正です");
  const clean = [...new Set(ids.map((v) => parseInt(v)).filter((v) => Number.isInteger(v) && v > 0))];
  if (!clean.length) return err("並び順のリストが不正です");
  /* 自分のアイテムであることを確認（他人の id は無視） */
  const placeholders = clean.map(() => "?").join(",");
  const mine = await env.DB.prepare(`SELECT id FROM items WHERE user_id = ? AND id IN (${placeholders})`).bind(user.id, ...clean).all();
  const mineSet = new Set((mine.results || []).map((r) => r.id));
  const stmts = [];
  let n = 0;
  for (const id of clean) {
    if (!mineSet.has(id)) continue;
    stmts.push(env.DB.prepare("UPDATE items SET sort_order = ?, updated_at = ? WHERE id = ? AND user_id = ?").bind(n++, Math.floor(Date.now() / 1000), id, user.id));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return json({ ok: true, count: n });
}

/* 複数アイテムを1つのフォルダへ一括追加する。body { ids: [...], folder_id }。
   既存のフォルダ割り当ては残し、指定フォルダだけ追加する（INSERT OR IGNORE）。
   互換用の items.folder_id が NULL の場合のみ先頭フォルダで補完する */
async function bulkAddToFolder(request, env, user, ctx) {
  const { ids, folder_id } = await request.json().catch(() => ({}));
  const folderIds = await resolveFolderIds(env, user, [folder_id]);
  if (!folderIds.length) return err("フォルダが見つかりません", 404);
  const target = folderIds[0];
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 1000) return err("アイテムのリストが不正です");
  const clean = [...new Set(ids.map((v) => parseInt(v)).filter((v) => Number.isInteger(v) && v > 0))];
  if (!clean.length) return err("アイテムのリストが不正です");
  /* 自分のアイテムであることを確認（他人の id は無視） */
  const placeholders = clean.map(() => "?").join(",");
  const mine = await env.DB.prepare(`SELECT id, folder_id FROM items WHERE user_id = ? AND id IN (${placeholders})`).bind(user.id, ...clean).all();
  const mineRows = mine.results || [];
  if (!mineRows.length) return json({ updated: 0, already: 0 });
  const mineIds = mineRows.map((r) => r.id);
  const minePlaceholders = mineIds.map(() => "?").join(",");
  const alreadyRows = await env.DB.prepare(
    `SELECT item_id FROM item_folders WHERE folder_id = ? AND item_id IN (${minePlaceholders})`
  ).bind(target, ...mineIds).all();
  const alreadySet = new Set((alreadyRows.results || []).map((r) => r.item_id));
  const toAdd = mineRows.filter((r) => !alreadySet.has(r.id));
  if (toAdd.length) {
    const stmts = toAdd.map((r) =>
      env.DB.prepare("INSERT OR IGNORE INTO item_folders (item_id, folder_id) VALUES (?, ?)").bind(r.id, target));
    await env.DB.batch(stmts);
    /* 互換用の items.folder_id が NULL のものだけ先頭フォルダで補完する */
    const nullFolder = toAdd.filter((r) => r.folder_id == null);
    if (nullFolder.length) {
      const nstmts = nullFolder.map((r) =>
        env.DB.prepare("UPDATE items SET folder_id = ? WHERE id = ? AND user_id = ?").bind(target, r.id, user.id));
      await env.DB.batch(nstmts);
    }
  }
  /* Notion 同期は更新分だけ（updateItem と同じく waitUntil。Notion 未設定時は no-op） */
  if (ctx && toAdd.length) {
    const updIds = toAdd.map((r) => r.id);
    const updPlaceholders = updIds.map(() => "?").join(",");
    const rows = await env.DB.prepare(
      `SELECT ${ITEM_COLS}, (SELECT COUNT(*) FROM memos m WHERE m.item_id = items.id) AS memo_count FROM items WHERE user_id = ? AND id IN (${updPlaceholders})`
    ).bind(user.id, ...updIds).all();
    const folderRows = await env.DB.prepare(
      `SELECT item_id, folder_id FROM item_folders WHERE item_id IN (${updPlaceholders})`
    ).bind(...updIds).all();
    const folderMap = new Map();
    for (const fr of folderRows.results || []) {
      if (!folderMap.has(fr.item_id)) folderMap.set(fr.item_id, []);
      folderMap.get(fr.item_id).push(fr.folder_id);
    }
    for (const it of rows.results || []) {
      it.folder_ids = folderMap.get(it.id) || [];
      ctx.waitUntil(syncToNotion(env, user, it, "update", new URL(request.url).origin));
    }
  }
  return json({ updated: toAdd.length, already: alreadySet.size });
}

/* 保有場所・カテゴリーの候補一覧（自分のアイテムから重複なし・空除く・昇順） */
async function listLabels(env, user) {
  const locs = await env.DB.prepare("SELECT DISTINCT location FROM items WHERE user_id = ? AND location != '' ORDER BY location ASC").bind(user.id).all();
  const cats = await env.DB.prepare("SELECT DISTINCT category FROM items WHERE user_id = ? AND category != '' ORDER BY category ASC").bind(user.id).all();
  return json({
    locations: (locs.results || []).map((r) => r.location),
    categories: (cats.results || []).map((r) => r.category),
  });
}

function validItemBody(b) {
  const out = {};
  out.type = ["book", "cd", "dvd", "magazine", "other"].includes(b.type) ? b.type : "book";
  out.title = String(b.title || "").trim();
  if (!out.title) return null;
  out.creator = String(b.creator || "").trim();
  out.publisher = String(b.publisher || "").trim();
  out.isbn = String(b.isbn || "").trim();
  out.catno = String(b.catno || "").trim().slice(0, 40);
  out.edition = String(b.edition || "").trim().slice(0, 60);
  out.price = String(b.price || "").trim().slice(0, 20);
  out.location = String(b.location || "").trim().slice(0, 60);
  out.category = String(b.category || "").trim().slice(0, 60);
  /* フォルダ: folder_ids（配列）が正本。従来の folder_id（単数）が来た場合は1要素の配列として扱う。
     どちらも無い場合は空（未分類）。所有権の確認は呼び出し側（resolveFolderIds）で行う */
  out.folder_ids = [];
  if (Array.isArray(b.folder_ids)) {
    out.folder_ids = b.folder_ids.map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0);
  } else if (b.folder_id !== null && b.folder_id !== undefined && b.folder_id !== "") {
    const n = Number(b.folder_id);
    if (Number.isInteger(n) && n > 0) out.folder_ids = [n];
  }
  out.folder_id = out.folder_ids.length ? out.folder_ids[0] : null;
  out.cover_url = String(b.cover_url || "").trim();
  out.image_key = String(b.image_key || "").trim();
  out.spine_key = String(b.spine_key || "").trim();
  out.side_key = String(b.side_key || "").trim();
  /* 判型（書籍のみ。文庫・新書・B6・四六判・A5・菊判・B5・A4・その他・未設定）。
     書籍以外は空にする。判型が分からない場合の高さ上書きは 100〜300mm に収める */
  const FORMAT_VALUES = ["bunko", "shinsho", "b6", "shirokuban", "a5", "kikuban", "b5", "a4", "other"];
  out.format = out.type === "book" && FORMAT_VALUES.includes(b.format) ? b.format : "";
  if (b.height_mm === "" || b.height_mm === null || b.height_mm === undefined) {
    out.height_mm = null;
  } else {
    const n = parseInt(b.height_mm, 10);
    out.height_mm = Number.isInteger(n) && n > 0 ? Math.max(100, Math.min(300, n)) : null;
  }
  out.status = ["unread", "reading", "done"].includes(b.status) ? b.status : "unread";
  out.prog_cur = Math.max(0, parseInt(b.prog_cur) || 0);
  out.prog_total = Math.max(0, parseInt(b.prog_total) || 0);
  return out;
}

/* フォルダID配列の所有権を確認し、自分のフォルダだけを返す（重複除去・数値のみ・入力順を維持） */
async function resolveFolderIds(env, user, ids) {
  const clean = [...new Set((Array.isArray(ids) ? ids : []).map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))];
  if (!clean.length) return [];
  const placeholders = clean.map(() => "?").join(",");
  const rows = await env.DB.prepare(`SELECT id FROM folders WHERE user_id = ? AND id IN (${placeholders})`).bind(user.id, ...clean).all();
  const mine = new Set((rows.results || []).map((r) => r.id));
  return clean.filter((id) => mine.has(id));
}

/* アイテムの所属フォルダID一覧（中間テーブルが正本） */
async function listItemFolderIds(env, itemId) {
  const rows = await env.DB.prepare("SELECT folder_id FROM item_folders WHERE item_id = ? ORDER BY folder_id ASC").bind(itemId).all();
  return (rows.results || []).map((r) => r.folder_id);
}

/* 中間テーブルを同期する。folderIds は所有権確認済みのID一覧。
   items.folder_id（互換用）も先頭要素に合わせる（空なら NULL） */
async function syncItemFolders(env, itemId, folderIds) {
  await env.DB.prepare("DELETE FROM item_folders WHERE item_id = ?").bind(itemId).run();
  if (folderIds.length) {
    const stmts = folderIds.map((fid) =>
      env.DB.prepare("INSERT INTO item_folders (item_id, folder_id) VALUES (?, ?)").bind(itemId, fid));
    await env.DB.batch(stmts);
  }
  const first = folderIds.length ? folderIds[0] : null;
  await env.DB.prepare("UPDATE items SET folder_id = ? WHERE id = ?").bind(first, itemId).run();
}

async function createItem(request, env, user, ctx) {
  const b = validItemBody(await request.json().catch(() => ({})));
  if (!b) return err("タイトルは必須です");
  const folderIds = await resolveFolderIds(env, user, b.folder_ids);
  const folderId = folderIds.length ? folderIds[0] : null;
  const now = Math.floor(Date.now() / 1000);
  const res = await env.DB.prepare(
    `INSERT INTO items (user_id, type, title, creator, publisher, isbn, catno, edition, price, location, category, folder_id, cover_url, image_key, spine_key, side_key, format, height_mm, sort_order, status, prog_cur, prog_total, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM items WHERE user_id = ?), ?, ?, ?, ?, ?)`
  ).bind(user.id, b.type, b.title, b.creator, b.publisher, b.isbn, b.catno, b.edition, b.price, b.location, b.category, folderId, b.cover_url, b.image_key, b.spine_key, b.side_key, b.format, b.height_mm, user.id, b.status, b.prog_cur, b.prog_total, now, now).run();
  const item = await env.DB.prepare(`SELECT ${ITEM_COLS}, 0 AS memo_count FROM items WHERE id = ?`).bind(res.meta.last_row_id).first();
  await syncItemFolders(env, item.id, folderIds);
  item.folder_ids = folderIds;
  if (ctx) ctx.waitUntil(syncToNotion(env, user, item, "create", new URL(request.url).origin));
  return json(item, 201);
}

async function getItem(env, user, id) {
  const item = await env.DB.prepare(
    `SELECT ${ITEM_COLS}, (SELECT COUNT(*) FROM memos m WHERE m.item_id = items.id) AS memo_count FROM items WHERE id = ? AND user_id = ?`
  ).bind(id, user.id).first();
  if (!item) return null;
  item.folder_ids = await listItemFolderIds(env, id);
  return item;
}

async function updateItem(request, env, user, id, ctx) {
  const existing = await getItem(env, user, id);
  if (!existing) return err("見つかりません", 404);
  const b = validItemBody(await request.json().catch(() => ({})));
  if (!b) return err("タイトルは必須です");
  const folderIds = await resolveFolderIds(env, user, b.folder_ids);
  const folderId = folderIds.length ? folderIds[0] : null;
  await env.DB.prepare(
    `UPDATE items SET type=?, title=?, creator=?, publisher=?, isbn=?, catno=?, edition=?, price=?, location=?, category=?, folder_id=?, cover_url=?, image_key=?, spine_key=?, side_key=?, format=?, height_mm=?, status=?, prog_cur=?, prog_total=?, updated_at=? WHERE id=? AND user_id=?`
  ).bind(b.type, b.title, b.creator, b.publisher, b.isbn, b.catno, b.edition, b.price, b.location, b.category, folderId, b.cover_url, b.image_key, b.spine_key, b.side_key, b.format, b.height_mm, b.status, b.prog_cur, b.prog_total, Math.floor(Date.now() / 1000), id, user.id).run();
  await syncItemFolders(env, id, folderIds);
  const updated = await getItem(env, user, id);
  if (ctx) ctx.waitUntil(syncToNotion(env, user, updated, "update", new URL(request.url).origin));
  return json(updated);
}

async function deleteItem(env, user, id, ctx) {
  const existing = await getItem(env, user, id);
  if (!existing) return err("見つかりません", 404);
  await env.DB.prepare("DELETE FROM memos WHERE item_id = ? AND user_id = ?").bind(id, user.id).run();
  await env.DB.prepare("DELETE FROM item_folders WHERE item_id = ?").bind(id).run();
  await env.DB.prepare("DELETE FROM items WHERE id = ? AND user_id = ?").bind(id, user.id).run();
  for (const key of [existing.image_key, existing.spine_key, existing.side_key]) {
    await deleteImage(env, key);
  }
  if (ctx) ctx.waitUntil(syncToNotion(env, user, existing, "delete"));
  return json({ ok: true });
}

/* ---------- folders ---------- */
const FOLDER_COLS = "id, user_id, name, share_id, is_public, sort_order, created_at, updated_at";

/* フォルダ一覧（自分のものだけ。件数付き・並び順）。
   件数は中間テーブルから数える（1アイテムが複数フォルダに入るため）。
   未分類件数（どのフォルダにも属さないアイテム数）も一緒に返す */
async function listFolders(env, user) {
  const rows = await env.DB.prepare(
    `SELECT ${FOLDER_COLS}, (SELECT COUNT(*) FROM item_folders f JOIN items i ON i.id = f.item_id WHERE f.folder_id = folders.id AND i.user_id = ?) AS item_count
     FROM folders WHERE user_id = ? ORDER BY (sort_order IS NULL), sort_order ASC, created_at ASC, id ASC`
  ).bind(user.id, user.id).all();
  const unc = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM items WHERE user_id = ? AND NOT EXISTS (SELECT 1 FROM item_folders f WHERE f.item_id = items.id)`
  ).bind(user.id).first();
  return json({ folders: rows.results || [], uncategorized_count: unc ? unc.c : 0 });
}

async function getFolder(env, user, id) {
  return env.DB.prepare(`SELECT ${FOLDER_COLS} FROM folders WHERE id = ? AND user_id = ?`).bind(id, user.id).first();
}

async function createFolder(request, env, user) {
  const b = await request.json().catch(() => ({}));
  const name = String(b.name || "").trim().slice(0, 60);
  if (!name) return err("フォルダ名を入力してください");
  const now = Math.floor(Date.now() / 1000);
  /* share_id は一意になるまで再生成する（衝突はほぼ起きないが念のため3回まで） */
  for (let attempt = 0; attempt < 3; attempt++) {
    const shareId = generateShareId();
    try {
      const res = await env.DB.prepare(
        `INSERT INTO folders (user_id, name, share_id, is_public, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, 0, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM folders WHERE user_id = ?), ?, ?)`
      ).bind(user.id, name, shareId, user.id, now, now).run();
      const folder = await env.DB.prepare(`SELECT ${FOLDER_COLS}, 0 AS item_count FROM folders WHERE id = ?`).bind(res.meta.last_row_id).first();
      return json(folder, 201);
    } catch (e) {
      if (!String((e && e.message) || "").includes("UNIQUE")) throw e;
    }
  }
  return err("フォルダの作成に失敗しました", 500);
}

async function updateFolder(request, env, user, id) {
  const folder = await getFolder(env, user, id);
  if (!folder) return err("見つかりません", 404);
  const b = await request.json().catch(() => ({}));
  const sets = [];
  const binds = [];
  if (typeof b.name === "string") {
    const name = b.name.trim().slice(0, 60);
    if (!name) return err("フォルダ名を入力してください");
    sets.push("name = ?");
    binds.push(name);
  }
  if (typeof b.is_public === "boolean") {
    sets.push("is_public = ?");
    binds.push(b.is_public ? 1 : 0);
  }
  if (!sets.length) return json(folder);
  sets.push("updated_at = ?");
  binds.push(Math.floor(Date.now() / 1000));
  await env.DB.prepare(`UPDATE folders SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`).bind(...binds, id, user.id).run();
  const updated = await getFolder(env, user, id);
  return json(updated);
}

/* フォルダ削除：中間テーブルの該当行だけを消す。アイテム自体は削除しない。
   互換用の items.folder_id は、残ったフォルダの先頭（なければ NULL）に合わせ直す */
async function deleteFolder(env, user, id) {
  const folder = await getFolder(env, user, id);
  if (!folder) return err("見つかりません", 404);
  await env.DB.prepare("DELETE FROM item_folders WHERE folder_id = ?").bind(id).run();
  await env.DB.prepare(
    `UPDATE items SET folder_id = (SELECT MIN(folder_id) FROM item_folders WHERE item_id = items.id)
     WHERE user_id = ? AND folder_id = ?`
  ).bind(user.id, id).run();
  await env.DB.prepare("DELETE FROM folders WHERE id = ? AND user_id = ?").bind(id, user.id).run();
  return json({ ok: true });
}

/* フォルダの並び順を保存する。自分のフォルダであることを確認（他人の id は無視） */
async function reorderFolders(request, env, user) {
  const { ids } = await request.json().catch(() => ({}));
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 1000) return err("並び順のリストが不正です");
  const clean = [...new Set(ids.map((v) => parseInt(v)).filter((v) => Number.isInteger(v) && v > 0))];
  if (!clean.length) return err("並び順のリストが不正です");
  const placeholders = clean.map(() => "?").join(",");
  const mine = await env.DB.prepare(`SELECT id FROM folders WHERE user_id = ? AND id IN (${placeholders})`).bind(user.id, ...clean).all();
  const mineSet = new Set((mine.results || []).map((r) => r.id));
  const stmts = [];
  let n = 0;
  for (const id of clean) {
    if (!mineSet.has(id)) continue;
    stmts.push(env.DB.prepare("UPDATE folders SET sort_order = ?, updated_at = ? WHERE id = ? AND user_id = ?").bind(n++, Math.floor(Date.now() / 1000), id, user.id));
  }
  if (stmts.length) await env.DB.batch(stmts);
  return json({ ok: true, count: n });
}

/* ---------- memos ---------- */
async function listItemMemos(env, user, itemId) {
  const item = await getItem(env, user, itemId);
  if (!item) return err("見つかりません", 404);
  const rows = await env.DB.prepare("SELECT id, item_id, body, created_at FROM memos WHERE item_id = ? AND user_id = ? ORDER BY created_at DESC").bind(itemId, user.id).all();
  return json({ memos: rows.results });
}
async function addMemo(request, env, user, itemId) {
  const item = await getItem(env, user, itemId);
  if (!item) return err("見つかりません", 404);
  const { body } = await request.json().catch(() => ({}));
  if (!body || !String(body).trim()) return err("メモが空です");
  const res = await env.DB.prepare("INSERT INTO memos (item_id, user_id, body, created_at) VALUES (?, ?, ?, ?)")
    .bind(itemId, user.id, String(body).trim(), Math.floor(Date.now() / 1000)).run();
  const memo = await env.DB.prepare("SELECT id, item_id, body, created_at FROM memos WHERE id = ?").bind(res.meta.last_row_id).first();
  return json(memo, 201);
}
async function deleteMemo(env, user, memoId) {
  await env.DB.prepare("DELETE FROM memos WHERE id = ? AND user_id = ?").bind(memoId, user.id).run();
  return json({ ok: true });
}
async function listAllMemos(env, user) {
  const rows = await env.DB.prepare(
    `SELECT m.id, m.item_id, m.body, m.created_at, i.title AS item_title, i.type AS item_type
     FROM memos m JOIN items i ON i.id = m.item_id WHERE m.user_id = ? ORDER BY m.created_at DESC LIMIT 200`
  ).bind(user.id).all();
  return json({ memos: rows.results });
}

/* ---------- images (R2 本命 / KV は旧キーの読み取り互換) ----------
   新規アップロードは R2（IMAGES_R2）へ。バインディングが無い環境では KV へフォールバック。
   取得は R2 を先に引き、無ければ KV を引く（移行前の既存キーをそのまま読めるように） */
async function uploadImage(request, env, user) {
  const form = await request.formData().catch(() => null);
  const file = form && form.get("file");
  if (!file || typeof file === "string") return err("ファイルがありません");
  if (file.size > 5 * 1024 * 1024) return err("画像は5MB以下にしてください", 413);
  const type = file.type || "image/jpeg";
  if (!type.startsWith("image/")) return err("画像ファイルを選択してください");
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const key = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const buf = await file.arrayBuffer();
  if (env.IMAGES_R2) {
    await env.IMAGES_R2.put(key, buf, { httpMetadata: { contentType: type } });
  } else {
    await env.IMAGES.put(key, buf, { metadata: { contentType: type } });
  }
  return json({ key }, 201);
}
async function deleteImage(env, key) {
  if (!key) return;
  try { if (env.IMAGES_R2) await env.IMAGES_R2.delete(key); } catch (_) {}
  try { if (env.IMAGES) await env.IMAGES.delete(key); } catch (_) {}
}
async function serveImage(env, user, key) {
  if (!key.startsWith(`${user.id}/`)) return err("見つかりません", 404);
  if (env.IMAGES_R2) {
    const obj = await env.IMAGES_R2.get(key).catch(() => null);
    if (obj) {
      const ct = (obj.httpMetadata && obj.httpMetadata.contentType) || "image/jpeg";
      return new Response(obj.body, {
        headers: { "Content-Type": ct, "Cache-Control": "private, max-age=31536000, immutable", "ETag": obj.httpEtag || "" },
      });
    }
  }
  const obj = await env.IMAGES.getWithMetadata(key, { type: "stream" });
  if (!obj || !obj.value) return err("見つかりません", 404);
  return new Response(obj.value, {
    headers: { "Content-Type": (obj.metadata && obj.metadata.contentType) || "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable" },
  });
}

/* ---------- bibliographic lookup ---------- */
/* 書誌情報から本の物理的な高さ（mm）を読み取る（判型の自動判別用）。
   確実な寸法が取れない場合は null を返し、判型は未設定のままにする。
   - Google Books: volumeInfo.dimensions.height（例："21.59 cm"）
   - NDL: dc:extent（例："259p ; 21cm"、"21×15cm" の場合は最初の数が高さ）
   - OpenBD: onix.DescriptiveDetail.Measure（MeasureType "01"=高さ、mm単位）
   検証結果：OpenBD の onix には Measure が入っていないことが多く、NDL の
   dc:extent はページ数だけ（"259p"）のことが多い。Google Books は
   dimensions を持つが、未認証アクセスは429（quota超過）になりやすい。
   そのため寸法が取れるのは稀で、取れない場合は未設定のまま手動登録に任せる */
function parseDimensionToMm(str) {
  const m = String(str || "").match(/([\d.]+)\s*(cm|mm|in|"|inch|inches)/i);
  if (!m) return null;
  const v = Number(m[1]);
  if (!Number.isFinite(v) || v <= 0) return null;
  const unit = m[2].toLowerCase();
  if (unit === "cm") return Math.round(v * 10);
  if (unit === "mm") return Math.round(v);
  return Math.round(v * 25.4); // in / " / inch
}
function parseExtentHeightMm(extent) {
  const s = String(extent || "");
  /* "21×15cm" のように高さ×幅の場合は最初の数が高さ */
  let m = s.match(/([\d.]+)\s*[×x]\s*([\d.]+)\s*cm/i);
  if (m) return Math.round(Number(m[1]) * 10);
  m = s.match(/([\d.]+)\s*cm/i);
  if (m) return Math.round(Number(m[1]) * 10);
  m = s.match(/([\d.]+)\s*mm/i);
  if (m) return Math.round(Number(m[1]));
  return null;
}
function openbdHeightMm(onix) {
  try {
    const dd = onix && onix.DescriptiveDetail;
    if (!dd || !dd.Measure) return null;
    const measures = Array.isArray(dd.Measure) ? dd.Measure : [dd.Measure];
    for (const m of measures) {
      if (!m || String(m.MeasureType || "") !== "01") continue;
      const v = Number(m.Measurement);
      if (!Number.isFinite(v) || v <= 0) continue;
      const unit = String(m.MeasureUnitCode || "mm").toLowerCase();
      if (unit === "mm") return Math.round(v);
      if (unit === "cm") return Math.round(v * 10);
      if (unit === "in") return Math.round(v * 25.4);
    }
  } catch (_) { /* 寸法が取れなければ null */ }
  return null;
}
function xmlTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").trim() : "";
}
async function lookupOpenBD(code) {
  const r = await fetch(`https://api.openbd.jp/v1/get?isbn=${encodeURIComponent(code)}`);
  if (!r.ok) return null;
  const data = await r.json();
  const entry = Array.isArray(data) && data[0];
  if (!entry || !entry.summary) return null;
  const s = entry.summary;
  /* 価格: onix.ProductSupply.SupplyDetail.Price[].PriceAmount（JPY）。
     版: onix.DescriptiveDetail.EditionStatement。なければ空（推測で入れない） */
  let price = "", edition = "";
  let height_mm = null;
  try {
    const onix = entry.onix || {};
    const prices = onix.ProductSupply && onix.ProductSupply.SupplyDetail && onix.ProductSupply.SupplyDetail.Price;
    if (Array.isArray(prices)) {
      const jpy = prices.find((p) => p.CurrencyCode === "JPY") || prices[0];
      if (jpy && jpy.PriceAmount != null) price = String(jpy.PriceAmount).replace(/[^\d]/g, "");
    }
    const es = onix.DescriptiveDetail && onix.DescriptiveDetail.EditionStatement;
    if (typeof es === "string") edition = es.trim();
    else if (es && typeof es.content === "string") edition = es.content.trim();
    height_mm = openbdHeightMm(onix);
  } catch (_) { /* 価格・版・寸法が取れなければ空のまま */ }
  return { title: s.title || "", creator: s.author || "", publisher: s.publisher || "", isbn: s.isbn || code, catno: "", edition, price, cover_url: s.cover || "", type: "book", source: "OpenBD", height_mm };
}
async function lookupGoogleBooks(code) {
  const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(code)}`);
  if (!r.ok) return null;
  const data = await r.json();
  const v = data.items && data.items[0] && data.items[0].volumeInfo;
  if (!v) return null;
  let cover = "";
  if (v.imageLinks) {
    cover = (v.imageLinks.thumbnail || v.imageLinks.smallThumbnail || "").replace("http://", "https://").replace("&edge=curl", "");
  }
  const height_mm = v.dimensions && v.dimensions.height ? parseDimensionToMm(v.dimensions.height) : null;
  return { title: v.title || "", creator: (v.authors || []).join(", "), publisher: v.publisher || "", isbn: code, catno: "", edition: "", price: "", cover_url: cover, type: "book", source: "Google Books", height_mm };
}
async function lookupNDL(code) {
  const r = await fetch(`https://ndlsearch.ndl.go.jp/api/opensearch?isbn=${encodeURIComponent(code)}`);
  if (!r.ok) return null;
  const xml = await r.text();
  if (!xml.includes("<item>")) return null;
  const itemXml = xml.split("<item>")[1].split("</item>")[0];
  const title = xmlTag(itemXml, "title");
  if (!title) return null;
  const creator = xmlTag(itemXml, "dc:creator");
  const publisher = xmlTag(itemXml, "dc:publisher");
  const isBookCode = /^(978|979)/.test(code);
  const height_mm = parseExtentHeightMm(xmlTag(itemXml, "dc:extent"));
  return {
    title, creator, publisher, isbn: code, catno: "", edition: "", price: "",
    cover_url: isBookCode ? `https://ndlsearch.ndl.go.jp/thumbnail/${code}.jpg` : "",
    /* ISBN（978/979始まり）なら書籍。それ以外はその他 */
    type: isBookCode ? "book" : "other", source: "NDLサーチ", height_mm,
  };
}
/* 版・仕様の推定: release の disambiguation を正とし、タイトル内の
   （初回限定盤）【初回生産限定盤】[期間生産限定盤] 等の括弧書きも補う。
   タイトル自体は変更しない */
function mbEdition(rel) {
  const parts = [];
  const dis = String(rel.disambiguation || "").trim();
  if (dis) parts.push(dis);
  const title = String(rel.title || "");
  const re = /[（(【\[]([^）)\]】]{1,40})[）)\]】]/g;
  let m;
  while ((m = re.exec(title)) !== null) {
    const inner = m[1].trim();
    if (/(初回|限定|通常盤|生産限定)/.test(inner) && !parts.includes(inner)) parts.push(inner);
  }
  return parts.join("／").slice(0, 60);
}

async function lookupMusicBrainz(code) {
  const r = await fetch(`https://musicbrainz.org/ws/2/release/?query=barcode:${encodeURIComponent(code)}&fmt=json`, {
    headers: { "User-Agent": "BookshelfApp/1.0 (personal bookshelf manager)", "Accept": "application/json" },
  });
  if (!r.ok) return null;
  const data = await r.json();
  const rel = data.releases && data.releases[0];
  if (!rel) return null;
  return {
    title: rel.title || "",
    creator: (rel["artist-credit"] || []).map((a) => a.name).join(", "),
    publisher: (rel["label-info"] || []).map((l) => l.label && l.label.name).filter(Boolean).join(", "),
    isbn: code,
    catno: (rel["label-info"] || []).map((l) => l["catalog-number"]).filter(Boolean)[0] || "",
    edition: mbEdition(rel),
    price: "",
    cover_url: rel.id ? `https://coverartarchive.org/release/${rel.id}/front-500` : "",
    type: "cd", source: "MusicBrainz",
  };
}

/* 規格品番（カタログ番号）で MusicBrainz のリリースを検索する。
   入力の表記ゆれ（ハイフンあり/なし）に対応するため、複数パターンを順に試す */
function mbReleaseToLookup(rel) {
  return {
    title: rel.title || "",
    creator: (rel["artist-credit"] || []).map((a) => a.name).join(", "),
    publisher: (rel["label-info"] || []).map((l) => l.label && l.label.name).filter(Boolean).join(", "),
    isbn: rel.barcode || "",
    catno: (rel["label-info"] || []).map((l) => l["catalog-number"]).filter(Boolean)[0] || "",
    edition: mbEdition(rel),
    price: "",
    cover_url: rel.id ? `https://coverartarchive.org/release/${rel.id}/front-500` : "",
    type: "cd", source: "MusicBrainz",
  };
}
async function lookupMusicBrainzByCatno(raw) {
  const norm = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
  if (!norm || norm.length < 4) return [];
  const noHyphen = norm.replace(/-/g, "");
  /* ハイフンあり/なしの2パターンのみ。ワイルドカードは無関係な作品を
     拾ってしまうため使わない（存在しない品番は空を返すのが正しい） */
  const queries = [...new Set([`catno:"${norm}"`, `catno:"${noHyphen}"`])];
  const results = [];
  for (const q of queries) {
    try {
      const r = await fetch(`https://musicbrainz.org/ws/2/release/?query=${encodeURIComponent(q)}&fmt=json&limit=5`, {
        headers: { "User-Agent": "BookshelfApp/1.0 (personal bookshelf manager)", "Accept": "application/json" },
      });
      if (!r.ok) continue;
      const data = await r.json();
      for (const rel of data.releases || []) {
        if (!rel.title) continue;
        const hit = mbReleaseToLookup(rel);
        if (!results.some((x) => x.title === hit.title && x.catno === hit.catno)) results.push(hit);
      }
      if (results.length) break;
    } catch (_) { /* try next variant */ }
  }
  return results.slice(0, 2);
}
/* 雑誌（定期刊行物JANコード）のパース。
   13桁: 491 + Y1(年号十の位) + 雑誌コード5桁 + 号数V1V2(2桁) + Y2(年号一の位) + チェックデジット。
   2026年1月発行分から4桁目が年号になるため、判定は ^491（^4910 決め打ち禁止）。
   アドオン5桁（あれば）: 0 + 本体価格4桁。10000円以上は0000で価格不明。
   JANにはタイトル・出版社・ISSNは入っていないため、タイトルは取得できない */
function parseMagazineJan(code) {
  const digits = String(code || "").replace(/[^\d]/g, "");
  const m = digits.match(/^491(\d)(\d{5})(\d{2})(\d)(\d)(\d{5})?$/);
  if (!m) return null;
  const y1 = Number(m[1]);
  const y2 = Number(m[4]);
  let year;
  if (y1 === 0) {
    /* 旧仕様（2025年12月号まで）は4桁目が0固定で年号の十の位がないため、
       一の位だけでは年代が曖昧。現在以前で最も新しい該当年にする
       （例：2026年時点で Y2=5 → 2025年、Y2=6 → 2026年）。
       2000 + Y1*10 + Y2 のままでは2025年号が2005年になってしまうため */
    const now = new Date().getFullYear();
    year = now - ((now - y2) % 10);
  } else {
    year = 2000 + y1 * 10 + y2;
  }
  const issue = Number(m[3]);
  let edition = "";
  if (issue >= 1 && issue <= 12) edition = `${year}年${issue}月号`;
  else if (issue > 12) edition = `第${issue}号`;
  else edition = `${year}年`;
  let price = "";
  if (m[6] && m[6].slice(1) !== "0000") price = String(Number(m[6].slice(1)));
  return { edition, price, year, issue };
}

/* 雑誌JANコードの検索結果。タイトルはJANから取得できないため空で返し、
   フロントでタイトル検索または手入力で補う。号数・年・価格はJANから導出する */
function lookupMagazine(code) {
  const parsed = parseMagazineJan(code);
  if (!parsed) return null;
  const digits = String(code || "").replace(/[^\d]/g, "");
  return {
    title: "", creator: "", publisher: "",
    isbn: digits, catno: "", edition: parsed.edition, price: parsed.price,
    cover_url: "", type: "magazine", source: "雑誌JAN",
  };
}

/* NDL OpenSearchでタイトル検索する（雑誌のタイトル検索用）。
   失敗（非200・429・パース失敗）は空配列を返す。例外は投げない */
async function lookupNDLByTitle(title) {
  const q = String(title || "").trim();
  if (!q) return [];
  try {
    const r = await fetch(`https://ndlsearch.ndl.go.jp/api/opensearch?title=${encodeURIComponent(q)}`);
    if (!r.ok) return [];
    const xml = await r.text();
    const parts = xml.split("<item>").slice(1);
    const results = [];
    for (const part of parts) {
      const itemXml = part.split("</item>")[0];
      const t = xmlTag(itemXml, "title");
      if (!t) continue;
      results.push({
        title: t,
        creator: xmlTag(itemXml, "dc:creator"),
        publisher: xmlTag(itemXml, "dc:publisher"),
        isbn: "", catno: "", edition: "", price: "",
        cover_url: "", type: "magazine", source: "NDLサーチ",
      });
      if (results.length >= 5) break;
    }
    return results;
  } catch (_) {
    return [];
  }
}

async function handleLookup(request) {
  const params = new URL(request.url).searchParams;
  const catno = (params.get("catno") || "").trim();
  if (catno) {
    if (catno.length < 4) return err("品番が短すぎます");
    const results = await lookupMusicBrainzByCatno(catno);
    return json({ results, catno });
  }
  /* タイトル検索（雑誌用）。NDL OpenSearchの title パラメータで検索する */
  const title = (params.get("title") || "").trim();
  if (title) {
    const results = await lookupNDLByTitle(title);
    return json({ results, title });
  }
  const code = (params.get("code") || "").replace(/[-\s]/g, "");
  if (!code || code.length < 8) return err("コードが短すぎます");
  /* 雑誌（定期刊行物JANコード）は ^491 で判定する。2026年以降は4912...等のため ^4910 決め打ち禁止 */
  if (/^491/.test(code)) {
    const hit = lookupMagazine(code);
    return json({ results: hit ? [hit] : [], code });
  }
  const isBookCode = /^(978|979)/.test(code);
  const chain = isBookCode
    ? [lookupOpenBD, lookupGoogleBooks, lookupNDL, lookupMusicBrainz]
    : [lookupMusicBrainz, lookupNDL, lookupGoogleBooks, lookupOpenBD];
  const results = [];
  for (const fn of chain) {
    try {
      const hit = await fn(code);
      if (hit && hit.title && !results.some((x) => x.title === hit.title)) results.push(hit);
      if (results.length >= 2) break;
    } catch (_) { /* try next source */ }
  }
  return json({ results, code });
}

/* ---------- settings (Notion 連携設定) ---------- */
/* データベースIDはハイフンを除去し、32桁 hex に正規化できればその形にする */
function normalizeNotionDbId(raw) {
  const s = String(raw || "").trim();
  const hex = s.replace(/-/g, "").toLowerCase();
  if (/^[0-9a-f]{32}$/.test(hex)) return hex;
  return s;
}

/* 設定の読み取り。トークン自体は絶対に返さず、設定済みかどうかだけを返す */
async function getUserSettings(env, user) {
  const row = await env.DB.prepare("SELECT notion_token, notion_db_id, notion_enabled, sheets_url FROM users WHERE id = ?").bind(user.id).first();
  return json({
    notion_db_id: (row && row.notion_db_id) || "",
    notion_enabled: !!((row && row.notion_enabled) || 0),
    has_notion_token: !!String((row && row.notion_token) || "").trim(),
    sheets_url: (row && row.sheets_url) || "",
    subscription: subscriptionInfo(user),
  });
}

async function updateUserSettings(request, env, user) {
  const b = await request.json().catch(() => ({}));
  /* Notion 同期の有効化はエクスポートプラン（有料）が必要。無効化はいつでも可 */
  if (b.notion_enabled === true && !hasExportAccess(user)) return subRequiredResponse();
  const sets = [];
  const binds = [];
  if (b.clear_notion_token === true) {
    sets.push("notion_token = ''");
  } else if (typeof b.notion_token === "string" && b.notion_token.trim()) {
    /* 空文字のときは既存トークンを保持する（再入力された場合のみ差し替え） */
    sets.push("notion_token = ?");
    binds.push(b.notion_token.trim());
  }
  if (typeof b.notion_db_id === "string") {
    sets.push("notion_db_id = ?");
    binds.push(normalizeNotionDbId(b.notion_db_id));
  }
  if (typeof b.notion_enabled === "boolean") {
    sets.push("notion_enabled = ?");
    binds.push(b.notion_enabled ? 1 : 0);
  }
  if (sets.length) {
    await env.DB.prepare(`UPDATE users SET ${sets.join(", ")} WHERE id = ?`).bind(...binds, user.id).run();
  }
  return getUserSettings(env, user);
}

/* ---------- アクティベーションコード ---------- */
/* 紛らわしい文字（0/O/1/I/L）を除いた英数字でコードを生成する */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateLicenseCodePlain() {
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const groups = [];
  let i = 0;
  for (let g = 0; g < 3; g++) {
    let s = "";
    for (let j = 0; j < 6; j++) s += CODE_ALPHABET[bytes[i++] % CODE_ALPHABET.length];
    groups.push(s);
  }
  return "MBSH-" + groups.join("-");
}
/* 照合用に正規化する（大文字化し、ハイフンと空白を取り除く） */
function normalizeLicenseCode(raw) {
  return String(raw || "").toUpperCase().replace(/[\s-]+/g, "");
}
async function sha256Hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* コードの償還: 未使用・未失効なら期間を延長する。失敗理由は漏らさず一律の文言にする */
async function redeemLicense(request, env, user) {
  const fail = () => json({ ok: false, error: "コードが無効です" });
  const b = await request.json().catch(() => ({}));
  const normalized = normalizeLicenseCode(b.code);
  if (!normalized || normalized.length < 8) return fail();
  const hash = await sha256Hex(normalized);
  const row = await env.DB.prepare("SELECT * FROM license_codes WHERE code_hash = ?").bind(hash).first();
  if (!row || row.revoked || row.redeemed_by) return fail();
  const now = nowSec();
  let newEnd;
  if (row.duration_days === null || row.duration_days === undefined) {
    /* duration_days が NULL のコードは無期限 */
    newEnd = SUB_UNLIMITED_END;
  } else {
    const days = parseInt(row.duration_days) || 0;
    if (days < 1) return fail();
    newEnd = Math.max(now, user.sub_period_end || 0) + days * 86400;
  }
  /* redeemed_by が NULL の行だけを更新し、二重利用を防ぐ */
  const upd = await env.DB.prepare(
    "UPDATE license_codes SET redeemed_by = ?, redeemed_at = ? WHERE id = ? AND redeemed_by IS NULL AND revoked = 0"
  ).bind(user.id, now, row.id).run();
  if (!upd.meta || upd.meta.changes === 0) return fail();
  await env.DB.prepare("UPDATE users SET sub_period_end = ?, sub_source = 'code' WHERE id = ?").bind(newEnd, user.id).run();
  return json({ ok: true, sub_period_end: newEnd });
}

/* ---------- 管理 API（管理者メールのみ） ---------- */
function requireAdmin(user) {
  return isAdminUser(user) ? null : json({ error: "権限がありません" }, 403);
}

async function adminListUsers(env, user) {
  const denied = requireAdmin(user);
  if (denied) return denied;
  const rows = await env.DB.prepare(
    `SELECT u.id, u.email, u.sub_period_end, u.sub_source,
            (SELECT COUNT(*) FROM items i WHERE i.user_id = u.id) AS item_count
     FROM users u ORDER BY u.id ASC`
  ).all();
  return json({ users: rows.results || [] });
}

async function adminGrant(request, env, user, id) {
  const denied = requireAdmin(user);
  if (denied) return denied;
  const b = await request.json().catch(() => ({}));
  const target = await env.DB.prepare("SELECT id, sub_period_end FROM users WHERE id = ?").bind(id).first();
  if (!target) return err("ユーザーが見つかりません", 404);
  let newEnd;
  if (b.unlimited === true) {
    /* 無期限付与はセンチネル値を入れる */
    newEnd = SUB_UNLIMITED_END;
  } else {
    const days = Math.min(3650, Math.max(1, parseInt(b.days) || 0));
    if (!days) return err("日数が不正です");
    newEnd = Math.max(nowSec(), target.sub_period_end || 0) + days * 86400;
    if (newEnd > SUB_UNLIMITED_END) newEnd = SUB_UNLIMITED_END;
  }
  await env.DB.prepare("UPDATE users SET sub_period_end = ?, sub_source = 'admin' WHERE id = ?").bind(newEnd, id).run();
  return json({ ok: true, sub_period_end: newEnd });
}

async function adminRevokeSub(env, user, id) {
  const denied = requireAdmin(user);
  if (denied) return denied;
  await env.DB.prepare("UPDATE users SET sub_period_end = 0 WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

async function adminCreateCodes(request, env, user) {
  const denied = requireAdmin(user);
  if (denied) return denied;
  const b = await request.json().catch(() => ({}));
  const count = Math.min(100, Math.max(1, parseInt(b.count) || 0));
  /* duration_days が null（または unlimited: true）の場合は無期限コードとして発行する */
  const unlimited = b.unlimited === true || b.duration_days === null;
  const durationDays = unlimited ? null : Math.min(3650, Math.max(1, parseInt(b.duration_days) || 0));
  if (!count || (!unlimited && !durationDays)) return err("個数と期間を指定してください");
  const note = String(b.note || "").slice(0, 200);
  const now = nowSec();
  const plains = [];
  const stmts = [];
  for (let i = 0; i < count; i++) {
    const plain = generateLicenseCodePlain();
    const hash = await sha256Hex(normalizeLicenseCode(plain));
    plains.push(plain);
    stmts.push(env.DB.prepare(
      "INSERT INTO license_codes (code_hash, code_hint, duration_days, note, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)"
    ).bind(hash, plain.slice(-4), durationDays, note, now, user.email));
  }
  await env.DB.batch(stmts);
  /* 平文コードはこの応答でのみ返す（DB にはハッシュしか残らない） */
  return json({ ok: true, codes: plains });
}

async function adminListCodes(env, user) {
  const denied = requireAdmin(user);
  if (denied) return denied;
  const rows = await env.DB.prepare(
    `SELECT c.id, c.code_hint, c.duration_days, c.note, c.created_at, c.created_by,
            c.redeemed_at, c.revoked, u.email AS redeemed_by_email
     FROM license_codes c LEFT JOIN users u ON u.id = c.redeemed_by
     ORDER BY c.id DESC LIMIT 500`
  ).all();
  return json({ codes: rows.results || [] });
}

async function adminRevokeCode(env, user, id) {
  const denied = requireAdmin(user);
  if (denied) return denied;
  await env.DB.prepare("UPDATE license_codes SET revoked = 1 WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

/* ---------- Stripe（キーが設定されている場合のみ有効） ---------- */
async function stripeApi(env, method, path, params) {
  const signal = typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(20000)
    : undefined;
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method,
    headers: {
      "Authorization": "Basic " + btoa(String(env.STRIPE_SECRET_KEY || "") + ":"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params ? new URLSearchParams(params).toString() : undefined,
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error((data.error && data.error.message) || `Stripe API error (${res.status})`);
    e.status = res.status;
    throw e;
  }
  return data;
}

/* サブスクリプションオブジェクトから現在の期間終了を取得する（API バージョン差異を吸収） */
function stripePeriodEnd(sub) {
  if (!sub) return 0;
  if (sub.current_period_end) return sub.current_period_end;
  const items = sub.items && sub.items.data;
  if (items && items[0] && items[0].current_period_end) return items[0].current_period_end;
  return 0;
}

async function billingCheckout(request, env, user) {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_ID) {
    return json({ ok: false, code: "stripe_not_configured", error: "決済は現在準備中です" });
  }
  const origin = new URL(request.url).origin;
  try {
    const params = {
      "mode": "subscription",
      "line_items[0][price]": String(env.STRIPE_PRICE_ID),
      "line_items[0][quantity]": "1",
      "client_reference_id": String(user.id),
      "success_url": `${origin}/?billing=success`,
      "cancel_url": `${origin}/?billing=cancel`,
    };
    if (user.stripe_customer_id) params.customer = String(user.stripe_customer_id);
    else params.customer_email = user.email;
    const session = await stripeApi(env, "POST", "/checkout/sessions", params);
    return json({ ok: true, url: session.url });
  } catch (e) {
    return json({ ok: false, error: e.message || String(e) });
  }
}

async function hmacSha256Hex(key, msg) {
  const k = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* Stripe Webhook（認証なし。署名検証で正当性を確認する）。
   サブスクリプションが終了・解約されても、既に書き出した外部データには触れない。
   ここで変わるのはアプリ内の権利状態だけ。 */
async function billingWebhook(request, env) {
  const secret = env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return err("webhook is not configured", 400);
  const payload = await request.text();
  const sigHeader = request.headers.get("Stripe-Signature") || "";
  const parts = {};
  for (const kv of sigHeader.split(",")) {
    const idx = kv.indexOf("=");
    if (idx > 0) parts[kv.slice(0, idx).trim()] = kv.slice(idx + 1).trim();
  }
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return err("invalid signature", 400);
  if (Math.abs(nowSec() - parseInt(t)) > 300) return err("signature timestamp out of tolerance", 400);
  const expected = await hmacSha256Hex(secret, `${t}.${payload}`);
  if (!timingSafeEqualStr(expected, v1)) return err("invalid signature", 400);
  let event;
  try {
    event = JSON.parse(payload);
  } catch (_) {
    return err("invalid payload", 400);
  }
  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object || {};
      const userId = parseInt(s.client_reference_id);
      if (userId && s.subscription) {
        const sub = await stripeApi(env, "GET", `/subscriptions/${encodeURIComponent(s.subscription)}`);
        await env.DB.prepare(
          "UPDATE users SET stripe_customer_id = ?, stripe_subscription_id = ?, sub_period_end = ?, sub_source = 'stripe' WHERE id = ?"
        ).bind(String(s.customer || ""), String(s.subscription), stripePeriodEnd(sub), userId).run();
      }
    } else if (event.type === "customer.subscription.updated") {
      const sub = event.data.object || {};
      if (sub.id) {
        await env.DB.prepare("UPDATE users SET sub_period_end = ? WHERE stripe_subscription_id = ?")
          .bind(stripePeriodEnd(sub), String(sub.id)).run();
      }
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object || {};
      if (sub.id) {
        /* 期間終了までは使えるよう sub_period_end はそのまま。紐付けだけ解除する */
        await env.DB.prepare("UPDATE users SET stripe_subscription_id = '' WHERE stripe_subscription_id = ?")
          .bind(String(sub.id)).run();
      }
    }
  } catch (e) {
    console.error("[stripe-webhook] handling failed:", e && e.message ? e.message : e);
    return err("webhook handling failed", 500);
  }
  return json({ received: true });
}

/* ---------- Notion API ---------- */
async function notionApi(token, method, path, body, version) {
  /* AbortSignal.timeout は使わない。waitUntil 経由で Notion 同期がリクエスト終了後も
     続く場合、タイムアウト用のタイマーが元のリクエストに紐づいて残り、
     handle_cross_request_promise_resolution により「作成したリクエストが終了した
     promise は解決できない」というサーバーエラーになるため。fetch は
     Cloudflare の既定のタイムアウトに任せる。 */
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": version || "2022-06-28",
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data.message || `Notion API error (${res.status})`);
    e.code = data.code || "";
    e.status = res.status;
    throw e;
  }
  return data;
}

/* 入力された ID がデータベースとして見つからない場合、データソース ID と
   間違えている可能性があるため、新 API でデータソースから親 DB を特定する */
async function resolveNotionDatabase(token, id) {
  try {
    const db = await notionApi(token, "GET", `/databases/${id}`);
    return { db, databaseId: id, resolvedFromDataSource: false };
  } catch (e) {
    if (e.code !== "object_not_found") throw e;
    try {
      const ds = await notionApi(token, "GET", `/data_sources/${id}`, undefined, "2025-09-03");
      const parentId = ds && ds.parent && ds.parent.database_id;
      if (parentId) {
        const db = await notionApi(token, "GET", `/databases/${parentId}`);
        return { db, databaseId: parentId, resolvedFromDataSource: true };
      }
    } catch (e2) { /* 特定できなければ元のエラーを投げる */ }
    throw e;
  }
}

/* 接続テスト: 保存済み（または body で渡された）token + db_id でデータベースを取得する */
async function testNotion(request, env, user) {
  const b = await request.json().catch(() => ({}));
  const token = (typeof b.notion_token === "string" && b.notion_token.trim()) || String(user.notion_token || "").trim();
  const dbId = normalizeNotionDbId((typeof b.notion_db_id === "string" && b.notion_db_id.trim()) || user.notion_db_id || "");
  if (!token) return json({ ok: false, error: "インテグレーショントークンが設定されていません" });
  if (!dbId) return json({ ok: false, error: "データベースIDが設定されていません" });
  try {
    const { db, databaseId, resolvedFromDataSource } = await resolveNotionDatabase(token, dbId);
    const title = (db.title || []).map((t) => t.plain_text || "").join("");
    return json({ ok: true, database_title: title, resolved_database_id: resolvedFromDataSource ? databaseId : "" });
  } catch (e) {
    let msg = (e.code ? `${e.code}: ` : "") + (e.message || String(e));
    if (e.code === "object_not_found") {
      msg += "（データベースの ID が正しいか、そのデータベースにインテグレーションが「コネクトの追加」で接続されているかをご確認ください）";
    }
    return json({ ok: false, error: msg });
  }
}

/* 既存アイテムをまとめて Notion へ送る一括同期（設定画面のボタンから手動実行）。
   自動同期は追加・変更のタイミングでのみ働くため、連携前に登録したアイテムは
   このボタンで送る。トークンと DB ID が保存されていれば有効化フラグに関係なく実行する。 */
async function syncAllToNotion(request, env, user) {
  const token = String(user.notion_token || "").trim();
  const dbId = String(user.notion_db_id || "").trim();
  if (!token || !dbId) return json({ ok: false, error: "先にトークンとデータベース ID を保存してください" });
  const origin = new URL(request.url).origin;
  try {
    const { db, databaseId } = await resolveNotionDatabase(token, dbId);
    const dbProps = db.properties || {};
    const rows = await env.DB.prepare(
      `SELECT ${ITEM_COLS} FROM items WHERE user_id = ? ORDER BY id ASC`
    ).bind(user.id).all();
    const items = rows.results || [];
    const CAP = 120;
    const batch = items.slice(0, CAP);
    let created = 0, updated = 0, failed = 0;
    for (const item of batch) {
      try {
        const properties = buildNotionProperties(dbProps, item, { appUrl: origin, isCreate: !item.notion_page_id });
        if (item.notion_page_id) {
          await notionApi(token, "PATCH", `/pages/${item.notion_page_id}`, { properties });
          updated++;
        } else {
          const page = await notionApi(token, "POST", "/pages", { parent: { database_id: databaseId }, properties });
          if (page && page.id) {
            await env.DB.prepare("UPDATE items SET notion_page_id = ? WHERE id = ? AND user_id = ?")
              .bind(page.id, item.id, user.id).run();
          }
          created++;
        }
      } catch (e) {
        failed++;
        console.error(`[notion-sync-all] item=${item.id} failed:`, e && e.message ? e.message : e);
      }
      /* Notion API のレート制限（平均 3 req/sec）に配慮 */
      await new Promise((r) => setTimeout(r, 250));
    }
    return json({ ok: true, total: items.length, processed: batch.length, created, updated, failed, remaining: items.length - batch.length });
  } catch (e) {
    return json({ ok: false, error: (e.code ? `${e.code}: ` : "") + (e.message || String(e)) });
  }
}

/* === Notion プロパティマッピング（純粋関数。単体テスト対象） ===
   DB の properties 定義とアイテムから、Notion ページ作成/更新用の
   properties ペイロードを組み立てる。プロパティ名はエイリアス表で照合し、
   値の形はプロパティの型に合わせる。マッチしないプロパティには触らない。 */
const NOTION_TYPE_LABEL = { book: "書籍", cd: "CD", dvd: "DVD", magazine: "雑誌", other: "その他" };
const NOTION_STATUS_LABEL = { unread: "未読", reading: "読み進め中", done: "読了" };
const NOTION_FIELD_ALIASES = [
  ["creator", ["作者", "著者", "クリエイター", "アーティスト"]],
  ["publisher", ["出版社", "レーベル", "メーカー"]],
  ["isbn", ["ISBN", "ISBN/バーコード"]],
  ["catno", ["規格品番", "品番", "型番"]],
  ["edition", ["版", "仕様", "エディション"]],
  ["category", ["カテゴリー", "カテゴリ", "ジャンル"]],
  ["location", ["保有場所", "保管場所", "場所", "ロケーション"]],
  ["type", ["種別", "タイプ"]],
  ["status", ["状態", "ステータス", "進捗状況"]],
  ["price", ["価格", "定価", "購入価格"]],
  ["created_at", ["登録日", "追加日"]],
];

function notionPropValue(propType, field, item) {
  let text = "";
  if (field === "type") text = NOTION_TYPE_LABEL[item.type] || "その他";
  else if (field === "status") text = NOTION_STATUS_LABEL[item.status] || "未読";
  else if (field !== "created_at") text = String(item[field] || "").trim();
  switch (propType) {
    case "title":
      return text ? { title: [{ type: "text", text: { content: text.slice(0, 2000) } }] } : undefined;
    case "rich_text":
      return text ? { rich_text: [{ type: "text", text: { content: text.slice(0, 2000) } }] } : undefined;
    case "select":
      return text ? { select: { name: text.slice(0, 100) } } : undefined;
    case "status":
      return text ? { status: { name: text.slice(0, 100) } } : undefined;
    case "multi_select":
      return text ? { multi_select: [{ name: text.slice(0, 100) }] } : undefined;
    case "url":
      return text ? { url: text } : undefined;
    case "number": {
      if (field !== "price") return undefined;
      const digits = String(item.price || "").replace(/[^\d.]/g, "");
      if (!digits) return undefined; // 数字が無い価格は数値化できないので入れない
      const num = Number(digits);
      return Number.isFinite(num) ? { number: num } : undefined;
    }
    case "date": {
      if (field !== "created_at" || !item.created_at) return undefined;
      return { date: { start: new Date(item.created_at * 1000).toISOString().slice(0, 10) } };
    }
    default:
      return undefined;
  }
}

function buildNotionProperties(dbProps, item, opts) {
  const o = opts || {};
  const out = {};
  const entries = Object.entries(dbProps || {});
  /* title 型プロパティ（名前不問）にはアイテムのタイトルを入れる */
  for (const [name, def] of entries) {
    if (def && def.type === "title") {
      out[name] = { title: [{ type: "text", text: { content: String(item.title || "").slice(0, 2000) } }] };
    }
  }
  for (const [field, aliases] of NOTION_FIELD_ALIASES) {
    const hit = entries.find(([name]) => aliases.some((a) => a.toLowerCase() === String(name).trim().toLowerCase()));
    if (!hit) continue;
    const [propName, def] = hit;
    if (propName in out) continue;
    const val = notionPropValue(def && def.type, field, item);
    if (val !== undefined) out[propName] = val;
  }
  /* 専用プロパティ: アプリ内ID（アイテム ID）・アプリURL（アプリへのリンク） */
  const appIdHit = entries.find(([name]) => String(name).trim() === "アプリ内ID");
  if (appIdHit && appIdHit[1] && appIdHit[1].type === "rich_text") {
    out[appIdHit[0]] = { rich_text: [{ type: "text", text: { content: String(item.id) } }] };
  }
  const appUrlHit = entries.find(([name]) => String(name).trim() === "アプリURL");
  if (appUrlHit && appUrlHit[1] && appUrlHit[1].type === "url" && o.appUrl) {
    out[appUrlHit[0]] = { url: o.appUrl };
  }
  /* 所有状態は新規追加時のみ「所有中」にする（更新時は Notion 側の変更を上書きしない） */
  if (o.isCreate) {
    const ownHit = entries.find(([name]) => String(name).trim() === "所有状態");
    if (ownHit && ownHit[1] && (ownHit[1].type === "select" || ownHit[1].type === "status")) {
      const def = ownHit[1];
      const options = ((def[def.type] || {}).options || []).map((x) => x && x.name);
      if (options.includes("所有中")) {
        out[ownHit[0]] = def.type === "select" ? { select: { name: "所有中" } } : { status: { name: "所有中" } };
      }
    }
  }
  return out;
}
/* === /Notion プロパティマッピング === */

/* アイテムの作成・更新・削除を Notion へ一方向同期する。
   連携が無効・未設定なら何もしない。失敗しても呼び出し側（本体処理）は
   絶対に止めないよう、ここで例外を握ってログに残す。 */
async function syncToNotion(env, user, item, action, origin) {
  try {
    if (!user || !item) return;
    if (!user.notion_enabled) return;
    /* Notion 同期の実行はエクスポートプラン（有料）が必要。期限切れなら静かに止める */
    if (!hasExportAccess(user)) return;
    const token = String(user.notion_token || "").trim();
    const dbId = String(user.notion_db_id || "").trim();
    if (!token || !dbId) return;
    if (action === "delete") {
      if (item.notion_page_id) {
        await notionApi(token, "PATCH", `/pages/${item.notion_page_id}`, { archived: true });
      }
      return;
    }
    const { db, databaseId } = await resolveNotionDatabase(token, dbId);
    const properties = buildNotionProperties(db.properties || {}, item, { appUrl: origin || "", isCreate: !item.notion_page_id });
    if (item.notion_page_id) {
      await notionApi(token, "PATCH", `/pages/${item.notion_page_id}`, { properties });
    } else {
      const page = await notionApi(token, "POST", "/pages", { parent: { database_id: databaseId }, properties });
      if (page && page.id) {
        await env.DB.prepare("UPDATE items SET notion_page_id = ? WHERE id = ? AND user_id = ?")
          .bind(page.id, item.id, user.id).run();
      }
    }
  } catch (e) {
    console.error(`[notion-sync] action=${action} item=${item && item.id} failed:`, e && e.message ? e.message : e);
  }
}

/* ---------- CSV export ---------- */
function buildItemFilter(request) {
  const u = new URL(request.url);
  const q = (u.searchParams.get("q") || "").trim();
  const type = u.searchParams.get("type") || "";
  const category = (u.searchParams.get("category") || "").trim();
  const unread = u.searchParams.get("unread") === "1";
  const withMemo = u.searchParams.get("withMemo") === "1";
  const folder = (u.searchParams.get("folder") || "").trim();
  let where = "WHERE user_id = ?";
  const binds = [];
  if (q) { where += " AND (title LIKE ? OR creator LIKE ? OR catno LIKE ? OR category LIKE ? OR location LIKE ?)"; binds.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  if (type && ["book", "cd", "dvd", "magazine", "other"].includes(type)) { where += " AND type = ?"; binds.push(type); }
  if (category) { where += " AND category = ?"; binds.push(category); }
  if (folder === "none") { where += " AND NOT EXISTS (SELECT 1 FROM item_folders f WHERE f.item_id = items.id)"; }
  else if (/^\d+$/.test(folder)) { where += " AND EXISTS (SELECT 1 FROM item_folders f WHERE f.item_id = items.id AND f.folder_id = ?)"; binds.push(parseInt(folder)); }
  if (unread) where += " AND status = 'unread'";
  if (withMemo) where += " AND EXISTS (SELECT 1 FROM memos m WHERE m.item_id = items.id)";
  return { where, binds };
}
function csvCell(v) {
  const s = String(v ?? "");
  if (/["\n\r,]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function fmtJST(ts) {
  const d = new Date((ts || 0) * 1000 + 9 * 60 * 60 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}
/* エクスポート共通の表データ（CSV / JSON(xlsx生成用) / Google Sheets で共用）。
   request があれば絞り込みを適用、なければ全件。 */
async function buildExportTable(env, user, request) {
  const { where, binds } = request ? buildItemFilter(request) : { where: "WHERE user_id = ?", binds: [] };
  const rows = await env.DB.prepare(
    `SELECT ${ITEM_COLS}, (SELECT COUNT(*) FROM memos m WHERE m.item_id = items.id) AS memo_count
     FROM items ${where} ORDER BY created_at DESC, id DESC LIMIT 5000`
  ).bind(user.id, ...binds).all();
  const items = rows.results || [];
  const memoRows = items.length
    ? await env.DB.prepare(
        `SELECT item_id, body FROM memos WHERE user_id = ? ORDER BY item_id, created_at ASC`
      ).bind(user.id).all()
    : { results: [] };
  const memoMap = new Map();
  for (const m of memoRows.results || []) {
    if (!memoMap.has(m.item_id)) memoMap.set(m.item_id, []);
    memoMap.get(m.item_id).push(m.body);
  }
  const FORMAT_LABEL_JA = { bunko: "文庫", shinsho: "新書", b6: "B6", shirokuban: "四六判", a5: "A5", kikuban: "菊判", b5: "B5", a4: "A4", other: "その他" };
  const header = ["ID", "種別", "タイトル", "著者/アーティスト", "出版社/レーベル", "ISBN/バーコード", "規格品番", "版・仕様", "判型", "高さ（mm）", "価格", "保有場所", "カテゴリー", "状態", "進捗（現在）", "進捗（全体）", "進捗率", "メモ件数", "メモ", "表紙URL", "登録日時", "更新日時"];
  const table = [header];
  for (const it of items) {
    const pct = it.prog_total > 0 ? Math.min(100, Math.round((it.prog_cur / it.prog_total) * 100)) + "%" : "";
    table.push([
      it.id, it.type, it.title, it.creator || "", it.publisher || "", it.isbn || "", it.catno || "", it.edition || "", FORMAT_LABEL_JA[it.format] || "", it.height_mm || "", it.price || "", it.location || "", it.category || "", it.status,
      it.prog_cur || 0, it.prog_total || 0, pct, it.memo_count || 0,
      (memoMap.get(it.id) || []).join("\n"), it.cover_url || "", fmtJST(it.created_at), fmtJST(it.updated_at),
    ]);
  }
  return table;
}

async function exportCsv(request, env, user) {
  const table = await buildExportTable(env, user, request);
  const lines = table.map((row) => row.map(csvCell).join(","));
  const now = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const stamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(now.getUTCDate()).padStart(2, "0")}-${String(now.getUTCHours()).padStart(2, "0")}${String(now.getUTCMinutes()).padStart(2, "0")}`;
  return new Response("\uFEFF" + lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bookshelf-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

/* xlsx 生成用に表データを JSON で返す（フロントで SheetJS により .xlsx 化する） */
async function exportJson(request, env, user) {
  const table = await buildExportTable(env, user, request);
  return json({ header: table[0], rows: table.slice(1) });
}

/* ---------- Google Sheets 書き出し ---------- */
async function sheetsApi(accessToken, method, url, body) {
  const signal = typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(20000)
    : undefined;
  const res = await fetch(url, {
    method,
    headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error((data.error && data.error.message) || `Google Sheets API error (${res.status})`);
    e.status = res.status;
    throw e;
  }
  return data;
}

/* 全アイテムを Google スプレッドシートへ書き出す（手動実行）。
   アクセストークンはフロントが Google 承認ポップアップで取得したものを
   その場限りで受け取り、保存はしない。シートは初回に作成し、次回からは
   同じシートを丸ごと書き換える。 */
async function exportToSheets(request, env, user) {
  const b = await request.json().catch(() => ({}));
  const accessToken = String(b.access_token || "").trim();
  if (!accessToken) return json({ ok: false, error: "Google のアクセストークンがありません" });
  try {
    const table = await buildExportTable(env, user, null);
    let spreadsheetId = String(user.sheets_id || "").trim();
    let spreadsheetUrl = String(user.sheets_url || "").trim();
    if (spreadsheetId) {
      try {
        await sheetsApi(accessToken, "GET", `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId`);
      } catch (e) {
        if (e.status === 404) spreadsheetId = "";
        else throw e;
      }
    }
    if (!spreadsheetId) {
      const created = await sheetsApi(accessToken, "POST", "https://sheets.googleapis.com/v4/spreadsheets", {
        properties: { title: "わたしの本棚の手帖｜蔵書リスト" },
        sheets: [{ properties: { title: "蔵書" } }],
      });
      spreadsheetId = created.spreadsheetId;
      spreadsheetUrl = created.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
      await env.DB.prepare("UPDATE users SET sheets_id = ?, sheets_url = ? WHERE id = ?")
        .bind(spreadsheetId, spreadsheetUrl, user.id).run();
    }
    await sheetsApi(accessToken, "POST",
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent("蔵書!A1:Z5000")}:clear`, {});
    await sheetsApi(accessToken, "PUT",
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent("蔵書!A1")}?valueInputOption=RAW`,
      { range: "蔵書!A1", majorDimension: "ROWS", values: table });
    return json({ ok: true, url: spreadsheetUrl, count: table.length - 1 });
  } catch (e) {
    return json({ ok: false, error: e.message || String(e) });
  }
}

/* ---------- 公開ページ（認証不要・読み取り専用） ----------
   公開フォルダは /s/:shareId でログインなしに閲覧できる。
   返す情報は表示に必要なものだけ（メールアドレス・ユーザーID・メモ等は含めない） */
const PUBLIC_ITEM_COLS = "i.id, i.type, i.title, i.creator, i.publisher, i.isbn, i.catno, i.edition, i.price, i.cover_url, i.image_key, i.spine_key, i.side_key, i.format, i.height_mm";

/* 公開フォルダの情報と中のアイテム一覧。非公開・存在しない shareId は404 */
async function getPublicFolder(env, shareId) {
  const folder = await env.DB.prepare(
    "SELECT id, name, share_id FROM folders WHERE share_id = ? AND is_public = 1"
  ).bind(shareId).first();
  if (!folder) return err("見つかりません", 404);
  const rows = await env.DB.prepare(
    `SELECT ${PUBLIC_ITEM_COLS} FROM items i
     WHERE EXISTS (SELECT 1 FROM item_folders f WHERE f.item_id = i.id AND f.folder_id = ?)
     ORDER BY (i.sort_order IS NULL), i.sort_order ASC, i.created_at ASC, i.id ASC LIMIT 500`
  ).bind(folder.id).all();
  const items = rows.results || [];
  return json({ folder: { name: folder.name, share_id: folder.share_id, item_count: items.length }, items });
}

/* ---------- 本棚全体の公開（/s/all/:shareId） ----------
   ユーザー単位で本棚全体を公開できる。users.public_share_id / users.is_public で管理する。
   返す情報は表示に必要なものだけ（メールアドレス・ユーザーID・メモ等は含めない） */
async function getPublicCollection(env, shareId) {
  const user = await env.DB.prepare(
    "SELECT id FROM users WHERE public_share_id = ? AND is_public = 1"
  ).bind(shareId).first();
  if (!user) return err("見つかりません", 404);
  const rows = await env.DB.prepare(
    `SELECT ${PUBLIC_ITEM_COLS} FROM items i
     WHERE i.user_id = ? ORDER BY (i.sort_order IS NULL), i.sort_order ASC, i.created_at ASC, i.id ASC LIMIT 500`
  ).bind(user.id).all();
  const items = rows.results || [];
  return json({ collection: { name: "わたしの本棚の手帖", share_id: shareId, item_count: items.length }, items });
}

/* 本棚全体の公開設定を取得する（認証必須） */
async function getPublicCollectionSettings(request, env, user) {
  const row = await env.DB.prepare("SELECT public_share_id, is_public FROM users WHERE id = ?").bind(user.id).first();
  const shareId = (row && row.public_share_id) || "";
  const isPublic = !!((row && row.is_public) || 0);
  return json({
    is_public: isPublic,
    share_id: shareId,
    url: shareId ? `${new URL(request.url).origin}/s/all/${shareId}` : "",
  });
}

/* 本棚全体の公開設定を更新する（認証必須）。{ is_public } を受け付け、
   公開にする際に share_id が未発行なら新規発行する */
async function updatePublicCollectionSettings(request, env, user) {
  const b = await request.json().catch(() => ({}));
  if (typeof b.is_public !== "boolean") return err("is_public が必要です");
  let row = await env.DB.prepare("SELECT public_share_id FROM users WHERE id = ?").bind(user.id).first();
  let shareId = (row && row.public_share_id) || "";
  if (b.is_public && !shareId) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const candidate = generateShareId();
      try {
        await env.DB.prepare("UPDATE users SET public_share_id = ? WHERE id = ? AND (public_share_id IS NULL OR public_share_id = '')")
          .bind(candidate, user.id).run();
        shareId = candidate;
        break;
      } catch (e) {
        if (!String((e && e.message) || "").includes("UNIQUE")) throw e;
      }
    }
    if (!shareId) return err("公開URLの発行に失敗しました", 500);
  }
  await env.DB.prepare("UPDATE users SET is_public = ? WHERE id = ?").bind(b.is_public ? 1 : 0, user.id).run();
  return getPublicCollectionSettings(request, env, user);
}

/* 公開アイテムの画像（R2 本命 / KV は旧キーの読み取り互換）。
   公開フォルダ内のアイテム、または本棚全体を公開中のユーザーのアイテムの画像だけ返す。
   それ以外は404。認証なし・公開キャッシュ可 */
async function servePublicImage(env, key) {
  const row = await env.DB.prepare(
    `SELECT 1 FROM items i
     WHERE (i.image_key = ? OR i.spine_key = ? OR i.side_key = ?)
     AND (
       EXISTS (SELECT 1 FROM item_folders f JOIN folders fo ON fo.id = f.folder_id WHERE f.item_id = i.id AND fo.is_public = 1)
       OR EXISTS (SELECT 1 FROM users u WHERE u.id = i.user_id AND u.is_public = 1)
     )`
  ).bind(key, key, key).first();
  if (!row) return err("見つかりません", 404);
  if (env.IMAGES_R2) {
    const obj = await env.IMAGES_R2.get(key).catch(() => null);
    if (obj) {
      const ct = (obj.httpMetadata && obj.httpMetadata.contentType) || "image/jpeg";
      return new Response(obj.body, {
        headers: { "Content-Type": ct, "Cache-Control": "public, max-age=86400", "ETag": obj.httpEtag || "" },
      });
    }
  }
  const obj = await env.IMAGES.getWithMetadata(key, { type: "stream" });
  if (!obj || !obj.value) return err("見つかりません", 404);
  return new Response(obj.value, {
    headers: { "Content-Type": (obj.metadata && obj.metadata.contentType) || "image/jpeg", "Cache-Control": "public, max-age=86400" },
  });
}

/* HTML属性値用のエスケープ（OGP差し込み用） */
function escapeHtmlAttr(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* index.html の静的な SEO タグ（description / canonical / OGP / Twitter Card）を除去する。
   公開ページではページ固有のタグと差し替えるため */
function stripStaticSeoTags(html) {
  return html
    .replace(/<meta name="description"[^>]*>\n?/g, "")
    .replace(/<link rel="canonical"[^>]*>\n?/g, "")
    .replace(/<meta property="og:[^>]*>\n?/g, "")
    .replace(/<meta name="twitter:[^>]*>\n?/g, "");
}

/* /s/:shareId の公開ページ。index.html にフォルダに応じた OGP を差し込んで返す。
   非公開・存在しないフォルダの場合は汎用のタイトル・説明にする（React 側で「見つかりません」を表示） */
async function servePublicPage(request, env, shareId) {
  const origin = new URL(request.url).origin;
  const assetRes = await env.ASSETS.fetch(new Request(new URL("/index.html", request.url).toString(), { method: "GET" }));
  let html = await assetRes.text();
  let title = "わたしの本棚の手帖 — Bookshelf";
  let desc = "本棚を共有しています";
  let image = "";
  try {
    const folder = await env.DB.prepare("SELECT id, name FROM folders WHERE share_id = ? AND is_public = 1").bind(shareId).first();
    if (folder) {
      const countRow = await env.DB.prepare(
        "SELECT COUNT(*) AS c FROM items i WHERE EXISTS (SELECT 1 FROM item_folders f WHERE f.item_id = i.id AND f.folder_id = ?)"
      ).bind(folder.id).first();
      const count = countRow ? countRow.c : 0;
      title = `${folder.name} — わたしの本棚の手帖`;
      desc = `「${folder.name}」 ${count}点の本棚を共有しています`;
      const imgRow = await env.DB.prepare(
        `SELECT image_key, cover_url FROM items i
         WHERE EXISTS (SELECT 1 FROM item_folders f WHERE f.item_id = i.id AND f.folder_id = ?)
         AND (image_key != '' OR cover_url != '')
         ORDER BY (sort_order IS NULL), sort_order ASC, created_at ASC, id ASC LIMIT 1`
      ).bind(folder.id).first();
      if (imgRow) {
        if (imgRow.image_key) image = `${origin}/api/public/images/${encodeURIComponent(imgRow.image_key)}`;
        else if (imgRow.cover_url) image = imgRow.cover_url;
      }
    }
  } catch (_) { /* OGP の取得に失敗してもページ自体は返す */ }
  const jsonLd = { "@context": "https://schema.org", "@type": "WebPage", name: title, description: desc, url: `${origin}/s/${shareId}` };
  const og = buildOgTags({ title, desc, url: `${origin}/s/${shareId}`, image, jsonLd });
  html = stripStaticSeoTags(html);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtmlAttr(title)}</title>`);
  html = html.replace("</head>", og + "\n</head>");
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/* OGP メタタグを組み立てる */
function buildOgTags({ title, desc, url, image, jsonLd }) {
  return [
    `<meta name="description" content="${escapeHtmlAttr(desc)}">`,
    `<link rel="canonical" href="${escapeHtmlAttr(url)}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="わたしの本棚の手帖">`,
    `<meta property="og:locale" content="ja_JP">`,
    `<meta property="og:title" content="${escapeHtmlAttr(title)}">`,
    `<meta property="og:description" content="${escapeHtmlAttr(desc)}">`,
    `<meta property="og:url" content="${escapeHtmlAttr(url)}">`,
    image ? `<meta property="og:image" content="${escapeHtmlAttr(image)}">` : "",
    image ? `<meta name="twitter:card" content="summary_large_image">` : `<meta name="twitter:card" content="summary">`,
    `<meta name="twitter:title" content="${escapeHtmlAttr(title)}">`,
    `<meta name="twitter:description" content="${escapeHtmlAttr(desc)}">`,
    image ? `<meta name="twitter:image" content="${escapeHtmlAttr(image)}">` : "",
    jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>` : "",
  ].filter(Boolean).join("\n");
}

/* /s/all/:shareId の本棚全体の公開ページ。index.html に本棚全体に応じた OGP を差し込んで返す。
   非公開・存在しない場合は汎用のタイトル・説明にする（React 側で「見つかりません」を表示） */
async function servePublicCollectionPage(request, env, shareId) {
  const origin = new URL(request.url).origin;
  const assetRes = await env.ASSETS.fetch(new Request(new URL("/index.html", request.url).toString(), { method: "GET" }));
  let html = await assetRes.text();
  let title = "わたしの本棚の手帖 — Bookshelf";
  let desc = "本棚を共有しています";
  let image = "";
  try {
    const user = await env.DB.prepare("SELECT id FROM users WHERE public_share_id = ? AND is_public = 1").bind(shareId).first();
    if (user) {
      const countRow = await env.DB.prepare("SELECT COUNT(*) AS c FROM items WHERE user_id = ?").bind(user.id).first();
      const count = countRow ? countRow.c : 0;
      title = "わたしの本棚の手帖";
      desc = `わたしの本棚の手帖 ${count}点を共有しています`;
      const imgRow = await env.DB.prepare(
        `SELECT image_key, spine_key, side_key, cover_url FROM items
         WHERE user_id = ? AND (image_key != '' OR spine_key != '' OR side_key != '' OR cover_url != '')
         ORDER BY (sort_order IS NULL), sort_order ASC, created_at ASC, id ASC LIMIT 1`
      ).bind(user.id).first();
      if (imgRow) {
        const key = imgRow.image_key || imgRow.spine_key || imgRow.side_key || "";
        if (key) image = `${origin}/api/public/images/${encodeURIComponent(key)}`;
        else if (imgRow.cover_url) image = imgRow.cover_url;
      }
    }
  } catch (_) { /* OGP の取得に失敗してもページ自体は返す */ }
  const jsonLd = { "@context": "https://schema.org", "@type": "CollectionPage", name: title, description: desc, url: `${origin}/s/all/${shareId}` };
  const og = buildOgTags({ title, desc, url: `${origin}/s/all/${shareId}`, image, jsonLd });
  html = stripStaticSeoTags(html);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtmlAttr(title)}</title>`);
  html = html.replace("</head>", og + "\n</head>");
  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/* /lp は LP 専用のタイトル・説明・canonical を差し込んで返す（SEO 用） */
async function serveLpPage(request, env) {
  const origin = new URL(request.url).origin;
  const assetRes = await env.ASSETS.fetch(new Request(new URL("/index.html", request.url).toString(), { method: "GET" }));
  let html = await assetRes.text();
  const title = "わたしの本棚の手帖 — 書籍・CD・DVDを木の本棚で管理";
  const desc = "書籍・CD・DVD・雑誌を木の本棚のメタファーで管理するWebアプリ。バーコード・ISBNスキャンで自動登録、読書や視聴の進捗とメモ、フォルダ分け、公開・共有もできます。基本機能は無料。";
  const url = `${origin}/lp`;
  const image = `${origin}/promo-shelf.jpg`;
  const jsonLd = { "@context": "https://schema.org", "@type": "WebPage", name: "わたしの本棚の手帖", description: desc, url };
  const og = buildOgTags({ title, desc, url, image, jsonLd });
  html = stripStaticSeoTags(html);
  html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtmlAttr(title)}</title>`);
  html = html.replace("</head>", og + "\n</head>");
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
}

/* ---------- router ---------- */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      /* 旧自前認証エンドポイントは廃止（認証は Firebase Authentication） */
      if (path === "/api/auth/register" || path === "/api/auth/login" || path === "/api/auth/logout") {
        return err("Not Found", 404);
      }

      /* Stripe Webhook は認証なし（署名検証で正当性を確認する） */
      if (path === "/api/billing/webhook" && request.method === "POST") return billingWebhook(request, env);

      /* 公開ページ /s/all/:shareId は本棚全体の公開ページ（OGP付き・認証不要）。
         /s/:shareId はフォルダの公開ページ */
      const cm = path.match(/^\/s\/all\/([A-Za-z0-9]+)$/);
      if (cm && request.method === "GET") {
        await ensureSchema(env);
        return servePublicCollectionPage(request, env, cm[1]);
      }
      const sm = path.match(/^\/s\/([A-Za-z0-9]+)$/);
      if (sm && request.method === "GET") {
        await ensureSchema(env);
        return servePublicPage(request, env, sm[1]);
      }

      /* /lp は LP 専用のタイトル・説明・canonical を差し込んで返す（SEO 用） */
      if (path === "/lp" && request.method === "GET") {
        return serveLpPage(request, env);
      }

      /* 公開 API（認証不要）。非公開・存在しないものはハンドラ側で404 */
      if (path.startsWith("/api/public/")) {
        await ensureSchema(env);
        let pm;
        if ((pm = path.match(/^\/api\/public\/folders\/([A-Za-z0-9]+)$/)) && request.method === "GET") return getPublicFolder(env, pm[1]);
        if ((pm = path.match(/^\/api\/public\/collection\/([A-Za-z0-9]+)$/)) && request.method === "GET") return getPublicCollection(env, pm[1]);
        if ((pm = path.match(/^\/api\/public\/images\/(.+)$/)) && request.method === "GET") return servePublicImage(env, decodeURIComponent(pm[1]));
        return err("Not Found", 404);
      }

      if (path.startsWith("/api/")) {
        await ensureSchema(env);
        const user = await currentUser(request, env);
        if (!user) return json({ error: "unauthorized" }, 401);
        if (user._emailNotVerified) return json({ error: "email_not_verified" }, 401);
        /* /api/auth/me は id と email のみ返す（Notion トークン等の設定値は出さない） */
        if (path === "/api/auth/me" && request.method === "GET") return json({ id: user.id, email: user.email });
        if (path === "/api/settings" && request.method === "GET") return getUserSettings(env, user);
        if (path === "/api/settings" && request.method === "PUT") return updateUserSettings(request, env, user);
        if (path === "/api/settings/public-collection" && request.method === "GET") return getPublicCollectionSettings(request, env, user);
        if (path === "/api/settings/public-collection" && request.method === "PUT") return updatePublicCollectionSettings(request, env, user);
        if (path === "/api/license/redeem" && request.method === "POST") return redeemLicense(request, env, user);
        if (path === "/api/billing/checkout" && request.method === "POST") return billingCheckout(request, env, user);
        /* 管理 API（ハンドラ側でも管理者チェックを行う） */
        if (path === "/api/admin/users" && request.method === "GET") return adminListUsers(env, user);
        if (path === "/api/admin/codes" && request.method === "GET") return adminListCodes(env, user);
        if (path === "/api/admin/codes" && request.method === "POST") return adminCreateCodes(request, env, user);
        let am;
        if ((am = path.match(/^\/api\/admin\/users\/(\d+)\/grant$/)) && request.method === "POST") return adminGrant(request, env, user, parseInt(am[1]));
        if ((am = path.match(/^\/api\/admin\/users\/(\d+)\/revoke-sub$/)) && request.method === "POST") return adminRevokeSub(env, user, parseInt(am[1]));
        if ((am = path.match(/^\/api\/admin\/codes\/(\d+)\/revoke$/)) && request.method === "POST") return adminRevokeCode(env, user, parseInt(am[1]));
        if (path === "/api/notion/test" && request.method === "POST") return testNotion(request, env, user);
        if (path === "/api/notion/sync-all" && request.method === "POST") {
          if (!hasExportAccess(user)) return subRequiredResponse();
          return syncAllToNotion(request, env, user);
        }
        if (path === "/api/items/reorder" && request.method === "PUT") return reorderItems(request, env, user);
        if (path === "/api/items/bulk-folders" && request.method === "POST") return bulkAddToFolder(request, env, user, ctx);
        if (path === "/api/folders" && request.method === "GET") return listFolders(env, user);
        if (path === "/api/folders" && request.method === "POST") return createFolder(request, env, user);
        if (path === "/api/folders/reorder" && request.method === "PUT") return reorderFolders(request, env, user);
        let fm;
        if ((fm = path.match(/^\/api\/folders\/(\d+)$/))) {
          const folderId = parseInt(fm[1]);
          if (request.method === "PATCH") return updateFolder(request, env, user, folderId);
          if (request.method === "DELETE") return deleteFolder(env, user, folderId);
        }
        if (path === "/api/labels" && request.method === "GET") return listLabels(env, user);
        if (path === "/api/items" && request.method === "GET") return listItems(request, env, user);
        if (path === "/api/export.csv" && request.method === "GET") {
          if (!hasExportAccess(user)) return subRequiredResponse();
          return exportCsv(request, env, user);
        }
        if (path === "/api/export.json" && request.method === "GET") {
          if (!hasExportAccess(user)) return subRequiredResponse();
          return exportJson(request, env, user);
        }
        if (path === "/api/sheets/export" && request.method === "POST") {
          if (!hasExportAccess(user)) return subRequiredResponse();
          return exportToSheets(request, env, user);
        }
        if (path === "/api/items" && request.method === "POST") return createItem(request, env, user, ctx);
        if (path === "/api/memos" && request.method === "GET") return listAllMemos(env, user);
        if (path === "/api/lookup" && request.method === "GET") return handleLookup(request);
        if (path === "/api/images" && request.method === "POST") return uploadImage(request, env, user);
        let m;
        if ((m = path.match(/^\/api\/images\/(.+)$/)) && request.method === "GET") return serveImage(env, user, decodeURIComponent(m[1]));
        if ((m = path.match(/^\/api\/items\/(\d+)$/))) {
          const id = parseInt(m[1]);
          if (request.method === "GET") { const it = await getItem(env, user, id); return it ? json(it) : err("見つかりません", 404); }
          if (request.method === "PUT") return updateItem(request, env, user, id, ctx);
          if (request.method === "DELETE") return deleteItem(env, user, id, ctx);
        }
        if ((m = path.match(/^\/api\/items\/(\d+)\/memos$/))) {
          const id = parseInt(m[1]);
          if (request.method === "GET") return listItemMemos(env, user, id);
          if (request.method === "POST") return addMemo(request, env, user, id);
        }
        if ((m = path.match(/^\/api\/memos\/(\d+)$/)) && request.method === "DELETE") return deleteMemo(env, user, parseInt(m[1]));
        return err("Not Found", 404);
      }

      const assetRes = await env.ASSETS.fetch(request);
      /* SPA フォールバック: /admin など拡張子のないパスは index.html を返す */
      if (assetRes.status === 404 && request.method === "GET" && !path.includes(".")) {
        return env.ASSETS.fetch(new Request(new URL("/index.html", request.url).toString(), { method: "GET" }));
      }
      return assetRes;
    } catch (e) {
      return json({ error: "サーバーエラー: " + (e && e.message ? e.message : String(e)) }, 500);
    }
  },
};
