// Bookshelf App — Cloudflare Worker (API + static assets)
// Bindings: DB (D1), IMAGES (KV), ASSETS (static)

const SESSION_TTL = 60 * 60 * 24 * 30; // 30 days

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
function hex(buf) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function unhex(s) {
  const b = new Uint8Array(s.length / 2);
  for (let i = 0; i < b.length; i++) b[i] = parseInt(s.substr(i * 2, 2), 16);
  return b;
}
function getCookie(request, name) {
  const c = request.headers.get("Cookie") || "";
  const m = c.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return m ? decodeURIComponent(m[1]) : null;
}
function sessionCookie(request, token) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL}${secure}`;
}

/* ---------- auth ---------- */
async function hashPassword(password, saltBytes) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: 100000, hash: "SHA-256" },
    key, 256
  );
  return hex(bits);
}
async function createSession(env, userId) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const exp = Math.floor(Date.now() / 1000) + SESSION_TTL;
  await env.DB.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").bind(token, userId, exp).run();
  return token;
}
async function currentUser(request, env) {
  const token = getCookie(request, "session");
  if (!token) return null;
  const row = await env.DB.prepare(
    "SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND s.expires_at > ?"
  ).bind(token, Math.floor(Date.now() / 1000)).first();
  return row || null;
}

async function handleRegister(request, env) {
  const { email, password } = await request.json().catch(() => ({}));
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err("メールアドレスの形式が正しくありません");
  if (!password || password.length < 8) return err("パスワードは8文字以上にしてください");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await hashPassword(password, salt);
  try {
    const res = await env.DB.prepare(
      "INSERT INTO users (email, pass_hash, salt, created_at) VALUES (?, ?, ?, ?)"
    ).bind(email.toLowerCase(), hash, hex(salt), Math.floor(Date.now() / 1000)).run();
    const token = await createSession(env, res.meta.last_row_id);
    return json({ id: res.meta.last_row_id, email: email.toLowerCase() }, 201, { "Set-Cookie": sessionCookie(request, token) });
  } catch (e) {
    if (String(e).includes("UNIQUE")) return err("このメールアドレスは既に登録されています", 409);
    throw e;
  }
}
async function handleLogin(request, env) {
  const { email, password } = await request.json().catch(() => ({}));
  if (!email || !password) return err("メールアドレスとパスワードを入力してください");
  const user = await env.DB.prepare("SELECT * FROM users WHERE email = ?").bind(email.toLowerCase()).first();
  if (!user) return err("メールアドレスまたはパスワードが違います", 401);
  const hash = await hashPassword(password, unhex(user.salt));
  if (hash !== user.pass_hash) return err("メールアドレスまたはパスワードが違います", 401);
  const token = await createSession(env, user.id);
  return json({ id: user.id, email: user.email }, 200, { "Set-Cookie": sessionCookie(request, token) });
}
async function handleLogout(request, env) {
  const token = getCookie(request, "session");
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  return json({ ok: true }, 200, { "Set-Cookie": "session=; Path=/; HttpOnly; Max-Age=0" });
}

/* ---------- items ---------- */
const ITEM_COLS = "id, user_id, type, title, creator, publisher, isbn, cover_url, image_key, status, prog_cur, prog_total, created_at, updated_at";

async function listItems(request, env, user) {
  const u = new URL(request.url);
  const q = (u.searchParams.get("q") || "").trim();
  const type = u.searchParams.get("type") || "";
  const unread = u.searchParams.get("unread") === "1";
  const withMemo = u.searchParams.get("withMemo") === "1";
  const limit = Math.min(parseInt(u.searchParams.get("limit") || "28"), 100);
  const offset = parseInt(u.searchParams.get("offset") || "0");
  let where = "WHERE user_id = ?";
  const binds = [user.id];
  if (q) { where += " AND (title LIKE ? OR creator LIKE ?)"; binds.push(`%${q}%`, `%${q}%`); }
  if (type && ["book", "cd", "dvd", "other"].includes(type)) { where += " AND type = ?"; binds.push(type); }
  if (unread) where += " AND status = 'unread'";
  if (withMemo) where += " AND EXISTS (SELECT 1 FROM memos m WHERE m.item_id = items.id)";
  const totalRow = await env.DB.prepare(`SELECT COUNT(*) AS c FROM items ${where}`).bind(...binds).first();
  const rows = await env.DB.prepare(
    `SELECT ${ITEM_COLS}, (SELECT COUNT(*) FROM memos m WHERE m.item_id = items.id) AS memo_count
     FROM items ${where} ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`
  ).bind(...binds, limit, offset).all();
  return json({ items: rows.results, total: totalRow.c });
}

function validItemBody(b) {
  const out = {};
  out.type = ["book", "cd", "dvd", "other"].includes(b.type) ? b.type : "book";
  out.title = String(b.title || "").trim();
  if (!out.title) return null;
  out.creator = String(b.creator || "").trim();
  out.publisher = String(b.publisher || "").trim();
  out.isbn = String(b.isbn || "").trim();
  out.cover_url = String(b.cover_url || "").trim();
  out.image_key = String(b.image_key || "").trim();
  out.status = ["unread", "reading", "done"].includes(b.status) ? b.status : "unread";
  out.prog_cur = Math.max(0, parseInt(b.prog_cur) || 0);
  out.prog_total = Math.max(0, parseInt(b.prog_total) || 0);
  return out;
}

async function createItem(request, env, user) {
  const b = validItemBody(await request.json().catch(() => ({})));
  if (!b) return err("タイトルは必須です");
  const now = Math.floor(Date.now() / 1000);
  const res = await env.DB.prepare(
    `INSERT INTO items (user_id, type, title, creator, publisher, isbn, cover_url, image_key, status, prog_cur, prog_total, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(user.id, b.type, b.title, b.creator, b.publisher, b.isbn, b.cover_url, b.image_key, b.status, b.prog_cur, b.prog_total, now, now).run();
  const item = await env.DB.prepare(`SELECT ${ITEM_COLS}, 0 AS memo_count FROM items WHERE id = ?`).bind(res.meta.last_row_id).first();
  return json(item, 201);
}

async function getItem(env, user, id) {
  return env.DB.prepare(
    `SELECT ${ITEM_COLS}, (SELECT COUNT(*) FROM memos m WHERE m.item_id = items.id) AS memo_count FROM items WHERE id = ? AND user_id = ?`
  ).bind(id, user.id).first();
}

async function updateItem(request, env, user, id) {
  const existing = await getItem(env, user, id);
  if (!existing) return err("見つかりません", 404);
  const b = validItemBody(await request.json().catch(() => ({})));
  if (!b) return err("タイトルは必須です");
  await env.DB.prepare(
    `UPDATE items SET type=?, title=?, creator=?, publisher=?, isbn=?, cover_url=?, image_key=?, status=?, prog_cur=?, prog_total=?, updated_at=? WHERE id=? AND user_id=?`
  ).bind(b.type, b.title, b.creator, b.publisher, b.isbn, b.cover_url, b.image_key, b.status, b.prog_cur, b.prog_total, Math.floor(Date.now() / 1000), id, user.id).run();
  return json(await getItem(env, user, id));
}

async function deleteItem(env, user, id) {
  const existing = await getItem(env, user, id);
  if (!existing) return err("見つかりません", 404);
  await env.DB.prepare("DELETE FROM memos WHERE item_id = ? AND user_id = ?").bind(id, user.id).run();
  await env.DB.prepare("DELETE FROM items WHERE id = ? AND user_id = ?").bind(id, user.id).run();
  if (existing.image_key) { try { await env.IMAGES.delete(existing.image_key); } catch (_) {} }
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

/* ---------- images (KV) ---------- */
async function uploadImage(request, env, user) {
  const form = await request.formData().catch(() => null);
  const file = form && form.get("file");
  if (!file || typeof file === "string") return err("ファイルがありません");
  if (file.size > 5 * 1024 * 1024) return err("画像は5MB以下にしてください", 413);
  const type = file.type || "image/jpeg";
  if (!type.startsWith("image/")) return err("画像ファイルを選択してください");
  const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
  const key = `${user.id}/${crypto.randomUUID()}.${ext}`;
  await env.IMAGES.put(key, await file.arrayBuffer(), { metadata: { contentType: type } });
  return json({ key }, 201);
}
async function serveImage(env, user, key) {
  if (!key.startsWith(`${user.id}/`)) return err("見つかりません", 404);
  const obj = await env.IMAGES.getWithMetadata(key, { type: "stream" });
  if (!obj || !obj.value) return err("見つかりません", 404);
  return new Response(obj.value, {
    headers: { "Content-Type": (obj.metadata && obj.metadata.contentType) || "image/jpeg", "Cache-Control": "private, max-age=86400" },
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
  return { title: s.title || "", creator: s.author || "", publisher: s.publisher || "", isbn: s.isbn || code, cover_url: s.cover || "", type: "book", source: "OpenBD" };
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
  return { title: v.title || "", creator: (v.authors || []).join(", "), publisher: v.publisher || "", isbn: code, cover_url: cover, type: "book", source: "Google Books" };
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
    title, creator, publisher, isbn: code,
    cover_url: isBookCode ? `https://ndlsearch.ndl.go.jp/thumbnail/${code}.jpg` : "",
    type: "other", source: "NDLサーチ",
  };
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
    cover_url: rel.id ? `https://coverartarchive.org/release/${rel.id}/front-500` : "",
    type: "cd", source: "MusicBrainz",
  };
}
async function handleLookup(request) {
  const code = (new URL(request.url).searchParams.get("code") || "").replace(/[-\s]/g, "");
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

/* ---------- router ---------- */
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    try {
      if (path === "/api/auth/register" && request.method === "POST") return handleRegister(request, env);
      if (path === "/api/auth/login" && request.method === "POST") return handleLogin(request, env);
      if (path === "/api/auth/logout" && request.method === "POST") return handleLogout(request, env);

      if (path.startsWith("/api/")) {
        const user = await currentUser(request, env);
        if (!user) return err("ログインが必要です", 401);
        if (path === "/api/auth/me" && request.method === "GET") return json(user);
        if (path === "/api/items" && request.method === "GET") return listItems(request, env, user);
        if (path === "/api/items" && request.method === "POST") return createItem(request, env, user);
        if (path === "/api/memos" && request.method === "GET") return listAllMemos(env, user);
        if (path === "/api/lookup" && request.method === "GET") return handleLookup(request);
        if (path === "/api/images" && request.method === "POST") return uploadImage(request, env, user);
        let m;
        if ((m = path.match(/^\/api\/images\/(.+)$/)) && request.method === "GET") return serveImage(env, user, decodeURIComponent(m[1]));
        if ((m = path.match(/^\/api\/items\/(\d+)$/))) {
          const id = parseInt(m[1]);
          if (request.method === "GET") { const it = await getItem(env, user, id); return it ? json(it) : err("見つかりません", 404); }
          if (request.method === "PUT") return updateItem(request, env, user, id);
          if (request.method === "DELETE") return deleteItem(env, user, id);
        }
        if ((m = path.match(/^\/api\/items\/(\d+)\/memos$/))) {
          const id = parseInt(m[1]);
          if (request.method === "GET") return listItemMemos(env, user, id);
          if (request.method === "POST") return addMemo(request, env, user, id);
        }
        if ((m = path.match(/^\/api\/memos\/(\d+)$/)) && request.method === "DELETE") return deleteMemo(env, user, parseInt(m[1]));
        return err("Not Found", 404);
      }

      return env.ASSETS.fetch(request);
    } catch (e) {
      return json({ error: "サーバーエラー: " + (e && e.message ? e.message : String(e)) }, 500);
    }
  },
};
