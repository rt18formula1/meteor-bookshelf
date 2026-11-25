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

/* ---------- items ---------- */
const ITEM_COLS = "id, user_id, type, title, creator, publisher, isbn, catno, edition, price, location, category, cover_url, image_key, spine_key, side_key, sort_order, notion_page_id, status, prog_cur, prog_total, created_at, updated_at";

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
  const limit = Math.min(parseInt(u.searchParams.get("limit") || "28"), 1000);
  const offset = parseInt(u.searchParams.get("offset") || "0");
  let where = "WHERE user_id = ?";
  const binds = [user.id];
  if (q) { where += " AND (title LIKE ? OR creator LIKE ? OR catno LIKE ? OR category LIKE ? OR location LIKE ?)"; binds.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  if (type && ["book", "cd", "dvd", "other"].includes(type)) { where += " AND type = ?"; binds.push(type); }
  if (category) { where += " AND category = ?"; binds.push(category); }
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
  out.type = ["book", "cd", "dvd", "other"].includes(b.type) ? b.type : "book";
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
  out.cover_url = String(b.cover_url || "").trim();
  out.image_key = String(b.image_key || "").trim();
  out.spine_key = String(b.spine_key || "").trim();
  out.side_key = String(b.side_key || "").trim();
  out.status = ["unread", "reading", "done"].includes(b.status) ? b.status : "unread";
  out.prog_cur = Math.max(0, parseInt(b.prog_cur) || 0);
  out.prog_total = Math.max(0, parseInt(b.prog_total) || 0);
  return out;
}

async function createItem(request, env, user, ctx) {
  const b = validItemBody(await request.json().catch(() => ({})));
  if (!b) return err("タイトルは必須です");
  const now = Math.floor(Date.now() / 1000);
  const res = await env.DB.prepare(
    `INSERT INTO items (user_id, type, title, creator, publisher, isbn, catno, edition, price, location, category, cover_url, image_key, spine_key, side_key, sort_order, status, prog_cur, prog_total, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM items WHERE user_id = ?), ?, ?, ?, ?, ?)`
  ).bind(user.id, b.type, b.title, b.creator, b.publisher, b.isbn, b.catno, b.edition, b.price, b.location, b.category, b.cover_url, b.image_key, b.spine_key, b.side_key, user.id, b.status, b.prog_cur, b.prog_total, now, now).run();
  const item = await env.DB.prepare(`SELECT ${ITEM_COLS}, 0 AS memo_count FROM items WHERE id = ?`).bind(res.meta.last_row_id).first();
  if (ctx) ctx.waitUntil(syncToNotion(env, user, item, "create", new URL(request.url).origin));
  return json(item, 201);
}

async function getItem(env, user, id) {
  return env.DB.prepare(
    `SELECT ${ITEM_COLS}, (SELECT COUNT(*) FROM memos m WHERE m.item_id = items.id) AS memo_count FROM items WHERE id = ? AND user_id = ?`
  ).bind(id, user.id).first();
}

async function updateItem(request, env, user, id, ctx) {
  const existing = await getItem(env, user, id);
  if (!existing) return err("見つかりません", 404);
  const b = validItemBody(await request.json().catch(() => ({})));
  if (!b) return err("タイトルは必須です");
  await env.DB.prepare(
    `UPDATE items SET type=?, title=?, creator=?, publisher=?, isbn=?, catno=?, edition=?, price=?, location=?, category=?, cover_url=?, image_key=?, spine_key=?, side_key=?, status=?, prog_cur=?, prog_total=?, updated_at=? WHERE id=? AND user_id=?`
  ).bind(b.type, b.title, b.creator, b.publisher, b.isbn, b.catno, b.edition, b.price, b.location, b.category, b.cover_url, b.image_key, b.spine_key, b.side_key, b.status, b.prog_cur, b.prog_total, Math.floor(Date.now() / 1000), id, user.id).run();
  const updated = await getItem(env, user, id);
  if (ctx) ctx.waitUntil(syncToNotion(env, user, updated, "update", new URL(request.url).origin));
  return json(updated);
}

async function deleteItem(env, user, id, ctx) {
  const existing = await getItem(env, user, id);
  if (!existing) return err("見つかりません", 404);
  await env.DB.prepare("DELETE FROM memos WHERE item_id = ? AND user_id = ?").bind(id, user.id).run();
  await env.DB.prepare("DELETE FROM items WHERE id = ? AND user_id = ?").bind(id, user.id).run();
  for (const key of [existing.image_key, existing.spine_key, existing.side_key]) {
    await deleteImage(env, key);
  }
  if (ctx) ctx.waitUntil(syncToNotion(env, user, existing, "delete"));
  return json({ ok: true });
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
  } catch (_) { /* 価格・版が取れなければ空のまま */ }
  return { title: s.title || "", creator: s.author || "", publisher: s.publisher || "", isbn: s.isbn || code, catno: "", edition, price, cover_url: s.cover || "", type: "book", source: "OpenBD" };
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
  return { title: v.title || "", creator: (v.authors || []).join(", "), publisher: v.publisher || "", isbn: code, catno: "", edition: "", price: "", cover_url: cover, type: "book", source: "Google Books" };
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
  return {
    title, creator, publisher, isbn: code, catno: "", edition: "", price: "",
    cover_url: isBookCode ? `https://ndlsearch.ndl.go.jp/thumbnail/${code}.jpg` : "",
    type: "other", source: "NDLサーチ",
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
async function handleLookup(request) {
  const params = new URL(request.url).searchParams;
  const catno = (params.get("catno") || "").trim();
  if (catno) {
    if (catno.length < 4) return err("品番が短すぎます");
    const results = await lookupMusicBrainzByCatno(catno);
    return json({ results, catno });
  }
  const code = (params.get("code") || "").replace(/[-\s]/g, "");
  if (!code || code.length < 8) return err("コードが短すぎます");
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
  /* ネットワークが応答しない場合にリクエストを吊るさないためのタイムアウト */
  const signal = typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function"
    ? AbortSignal.timeout(15000)
    : undefined;
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Notion-Version": version || "2022-06-28",
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
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
const NOTION_TYPE_LABEL = { book: "書籍", cd: "CD", dvd: "DVD", other: "その他" };
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
  let where = "WHERE user_id = ?";
  const binds = [];
  if (q) { where += " AND (title LIKE ? OR creator LIKE ? OR catno LIKE ? OR category LIKE ? OR location LIKE ?)"; binds.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  if (type && ["book", "cd", "dvd", "other"].includes(type)) { where += " AND type = ?"; binds.push(type); }
  if (category) { where += " AND category = ?"; binds.push(category); }
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
  const header = ["ID", "種別", "タイトル", "著者/アーティスト", "出版社/レーベル", "ISBN/バーコード", "規格品番", "版・仕様", "価格", "保有場所", "カテゴリー", "状態", "進捗（現在）", "進捗（全体）", "進捗率", "メモ件数", "メモ", "表紙URL", "登録日時", "更新日時"];
  const table = [header];
  for (const it of items) {
    const pct = it.prog_total > 0 ? Math.min(100, Math.round((it.prog_cur / it.prog_total) * 100)) + "%" : "";
    table.push([
      it.id, it.type, it.title, it.creator || "", it.publisher || "", it.isbn || "", it.catno || "", it.edition || "", it.price || "", it.location || "", it.category || "", it.status,
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
        properties: { title: "私の本棚｜蔵書リスト" },
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

      if (path.startsWith("/api/")) {
        const user = await currentUser(request, env);
        if (!user) return json({ error: "unauthorized" }, 401);
        if (user._emailNotVerified) return json({ error: "email_not_verified" }, 401);
        /* /api/auth/me は id と email のみ返す（Notion トークン等の設定値は出さない） */
        if (path === "/api/auth/me" && request.method === "GET") return json({ id: user.id, email: user.email });
        if (path === "/api/settings" && request.method === "GET") return getUserSettings(env, user);
        if (path === "/api/settings" && request.method === "PUT") return updateUserSettings(request, env, user);
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
